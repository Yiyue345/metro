"""Extract map geography and Chinese label placements from the supplied image.

Run from the project with Python, Pillow, NumPy and OpenCV. Existing local OCR
results are input; no external service is used. Only context data and QA images
are written. SVG coordinates remain in the source image's 5950 x 4250 system.
"""
from pathlib import Path
import json
import re
import sys
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--labels-only', action='store_true', help='Preserve existing geography data')
args = parser.parse_args()

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.ocr-deps'))
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SOURCE = ROOT / 'public/maps/shenzhen-reference.jpg'
DATA = ROOT / 'src/data'
OUT = ROOT / 'scripts/review'
OUT.mkdir(exist_ok=True)
image = Image.open(SOURCE).convert('RGB')
pixels = np.asarray(image)
height, width = pixels.shape[:2]
assert (width, height) == (5950, 4250)
text = (DATA / 'stations.ts').read_text(encoding='utf-8')
stations = json.loads(text.split('export const stations: Station[] = ')[1].rstrip(';\n'))
symbols = json.loads((DATA / 'station-symbols.json').read_text(encoding='utf-8'))
ocr = json.loads((ROOT / 'scripts/labels-rapid.json').read_text(encoding='utf-8'))
english_path = DATA / 'station-english.json'
english_names = json.loads(english_path.read_text(encoding='utf-8')) if english_path.exists() else {}
metrics_path = OUT / 'browser-label-metrics.json'
metrics_cache_path = ROOT / 'scripts/browser-label-cache.json'
measured = json.loads(metrics_path.read_text(encoding='utf-8')) if metrics_path.exists() else None
metrics_cache = json.loads(metrics_cache_path.read_text(encoding='utf-8')) if metrics_cache_path.exists() else None
if measured is None and metrics_cache:
    measured = {'nodes':metrics_cache['nodes']}
previous_labels = json.loads((DATA / 'station-labels.json').read_text(encoding='utf-8')) if measured else {}
# Cache offsets relative to the SVG text anchor, rather than absolute positions.
# This remains reusable after labels move. Metrics include browser font/stroke.
font_metrics = {r['name']: {'dx':r['bbox']['x']-r['x'],'dy':r['bbox']['y']-r['y'],
                           'width':r['bbox']['width'],'height':r['bbox']['height']}
                for r in measured['labels']} if measured and 'labels' in measured else (metrics_cache['labels'] if metrics_cache else {})
if measured:
    metrics_cache_path.write_text(json.dumps({'labels':font_metrics,'nodes':measured['nodes']},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def contour_path(points):
    pts = points[:, 0, :]
    if len(pts) < 3:
        return ''
    return 'M' + ' L'.join(f'{int(x)},{int(y)}' for x, y in pts) + ' Z'


def geography(kind, color, mask, minimum, opening):
    # Colour gates exclude the saturated cyan/blue subway lines. Opening also
    # removes narrow strokes; retained components must have significant area.
    mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN,
                            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (opening, opening)))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE,
                            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    paths = []
    retained = np.zeros(mask.shape, dtype=np.uint8)
    if hierarchy is None:
        return {'kind': kind, 'fill': color, 'paths': paths}, retained
    for i, contour in enumerate(contours):
        if hierarchy[0, i, 3] != -1 or cv2.contourArea(contour) < minimum:
            continue
        x, y, w, h = cv2.boundingRect(contour)
        if min(w, h) < 12:
            continue
        # Keep holes in the same compound path. Render with SVG evenodd fill.
        pieces = [contour_path(cv2.approxPolyDP(contour, 2.1, True))]
        cv2.drawContours(retained, [contour], -1, 255, cv2.FILLED)
        child = hierarchy[0, i, 2]
        while child >= 0:
            hole = contours[child]
            # Repeated source watermarks punch small white diamond/text holes
            # through coloured areas. Fill these instead of tracing them.
            if cv2.contourArea(hole) > 6500:
                pieces.append(contour_path(cv2.approxPolyDP(hole, 2.1, True)))
                cv2.drawContours(retained, [hole], -1, 0, cv2.FILLED)
            child = hierarchy[0, child, 0]
        paths.append(' '.join(p for p in pieces if p))
    return {'kind': kind, 'fill': color, 'paths': paths}, retained


red, green, blue = [pixels[:, :, i].astype(np.int16) for i in range(3)]
water_mask = ((red > 65) & (red < 155) & (green > 125) & (green < 210)
              & (blue > 175) & (blue > green + 30) & (green > red + 32))
park_mask = ((red > 35) & (red < 135) & (green > 175) & (blue > 95)
             & (blue < 195) & (green > red + 75) & (green > blue + 35))
# The lower-right legend hides open water. Restore the enclosing water field;
# the legend's coloured swatches and white panels are not map geography.
water_mask[3500:4160, 5200:5900] = True
park_mask[3500:4160, 5200:5900] = False
water, water_pixels = geography('water', '#6da9e5', water_mask, 1200, 5)
parks, park_pixels = geography('park', '#59e19d', park_mask, 1800, 7)
if not args.labels_only:
    (DATA / 'map-geography.json').write_text(
        json.dumps([water, parks], ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

fonts = {size: ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', size) for size in [12,13,14]}
english_font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 8)
font_sizes = {}
fixes = {'李松荫': '李松蓢', '沙墨': '沙壆'}


def chinese(value):
    return fixes.get(value, ''.join(re.findall(r'[\u4e00-\u9fff]', value)))


def distance_to_box(x, y, box):
    left, top, right, bottom = box
    return np.hypot(max(left-x, x-right, 0), max(top-y, y-bottom, 0))


def bounds(x, y, anchor, name):
    if name in font_metrics:
        cached = font_metrics[name]
        return (x+cached['dx'],y+cached['dy'],x+cached['dx']+cached['width'],y+cached['dy']+cached['height'])
    size = font_sizes.get(name,13)
    label_width = size * len(name)
    left = x if anchor == 'start' else x - label_width if anchor == 'end' else x - label_width / 2
    return (left, y-size+1, left+label_width, y+2)


def overlap(a, b):
    return max(0, min(a[2], b[2])-max(a[0], b[0])) * max(0, min(a[3], b[3])-max(a[1], b[1]))


def padded(box, margin=3):
    return (box[0]-margin,box[1]-margin,box[2]+margin,box[3]+margin)


def english_lines(name):
    result = []
    for word in name.split(' '):
        if result and len(result[-1])+len(word)<24:
            result[-1]+=' '+word
        else:
            result.append(word)
    return result


choices = {}
matched = 0
for station in stations:
    name = station['name']
    node_points = [(p['x'], p['y']) for p in symbols[station['id']]['parts']]
    candidates = []
    for record in ocr:
        label = chinese(record['text'])
        box = record['box']
        if label != name or record['confidence'] < .6:
            continue
        if not (5 < box[3]-box[1] < 30) or box[2]-box[0] > 220:
            continue
        distance = min(distance_to_box(x, y, box) for x, y in node_points)
        if distance > 65:
            continue
        candidates.append((distance-record['confidence']*8, box))
    x, y = station['x'], station['y']
    if candidates:
        matched += 1
        score, box = min(candidates)
        left, top, right, bottom = box
        # SVG uses a text baseline. Place the Chinese label at the original
        # OCR top rather than the English subtitle or label bounding-box center.
        size = int(np.clip(round(bottom-top),12,14))
        font_sizes[name] = size
        lx, ly = left, top + size - 1
        options = [(lx, ly, 'start', 0)]
        for step in range(4,37,4):
            for dx, dy in [(0,-step),(0,step),(-step,0),(step,0),
                           (-step,-step),(step,-step),(-step,step),(step,step)]:
                options.append((lx+dx, ly+dy, 'start', np.hypot(dx,dy)))
        choices[name] = (True, options)
    else:
        font_sizes[name] = 13
        choices[name] = (False, [(x+14,y+5,'start',0),(x-14,y+5,'end',2),
                                (x,y-15,'middle',3),(x,y+28,'middle',4),
                                (x+14,y-9,'start',5),(x-14,y-9,'end',5),
                                (x+24,y+5,'start',10),(x-24,y+5,'end',12)])

labels = dict(previous_labels)
occupied = []
nodes = []
for value in symbols.values():
    for part in value['parts']:
        angle = np.radians(part['angle'])
        hw = (abs(part['width']*np.cos(angle))+abs(part['height']*np.sin(angle)))/2+3
        hh = (abs(part['width']*np.sin(angle))+abs(part['height']*np.cos(angle)))/2+3
        nodes.append((part['x']-hw,part['y']-hh,part['x']+hw,part['y']+hh))
# Place long and unmatched labels first: small nearby labels have more freedom.
ordered = [] if measured else sorted(stations, key=lambda s: (choices[s['name']][0], -len(s['name'])))
for station in ordered:
    name = station['name']
    options = choices[name][1]
    sx, sy = station['x'],station['y']
    nearby_nodes = [n for n in nodes if sx-160<n[0]<sx+160 and sy-110<n[1]<sy+110]
    nearby_labels = [n for n in occupied if sx-220<n[0]<sx+220 and sy-130<n[1]<sy+130]
    def cost(option):
        lx, ly, anchor, shift = option
        box = bounds(lx, ly, anchor, name)
        label_overlap = sum(overlap(padded(box), other) for other in nearby_labels)
        node_overlap = sum(overlap(box, node) for node in nearby_nodes)
        edge = 1000 if box[0] < 0 or box[2] > width or box[1] < 0 or box[3] > height else 0
        station_distance = min(distance_to_box(p['x'],p['y'],box) for p in symbols[station['id']]['parts'])
        distance_penalty = max(0,station_distance-45)*1000
        return label_overlap*500 + node_overlap*1000 + shift*2 + edge + distance_penalty
    lx, ly, anchor, _ = min(options, key=cost)
    labels[station['id']] = {'x': round(lx, 1), 'y': round(ly, 1),
                              'anchor': anchor, 'fontSize': font_sizes[name]}
    occupied.append(padded(bounds(lx, ly, anchor, name)))

browser_moves = []
if measured:
    # Keep every current anchor/font size; repair only measured collisions.
    nodes = [(r['bbox']['x'],r['bbox']['y'],r['bbox']['x']+r['bbox']['width'],
              r['bbox']['y']+r['bbox']['height']) for r in measured['nodes']]
    font_sizes = {s['name']:labels[s['id']]['fontSize'] for s in stations}
    def label_bounds(name):
        value = labels[name]
        return bounds(value['x'],value['y'],value['anchor'],name)
    for iteration in range(6):
        moved = False
        for station in stations:
            name = station['id']
            value = labels[name]
            box = label_bounds(name)
            others = [label_bounds(other['id']) for other in stations if other['id']!=name]
            obstacles = [b for b in nodes+others if box[0]-110<b[2] and b[0]<box[2]+110
                         and box[1]-90<b[3] and b[1]<box[3]+90]
            if not any(overlap(padded(box,2),b)>1e-5 for b in obstacles):
                continue
            # Candidate shifts are the nearest exact obstacle boundaries. Small
            # horizontal moves win ties; diagonals are used only when needed.
            dxs = {0.0}
            dys = {0.0}
            for obstacle in obstacles:
                dxs.update(v for v in [obstacle[0]-box[2]-2.15,obstacle[2]-box[0]+2.15] if abs(v)<65)
                dys.update(v for v in [obstacle[1]-box[3]-2.15,obstacle[3]-box[1]+2.15] if abs(v)<50)
            candidates = sorted(((dx,dy) for dx in dxs for dy in dys),
                                key=lambda d:np.hypot(*d)+abs(d[1])*.12)
            found = None
            for dx,dy in candidates:
                shifted = (box[0]+dx,box[1]+dy,box[2]+dx,box[3]+dy)
                if any(overlap(padded(shifted,2),b)>1e-5 for b in obstacles):
                    continue
                if shifted[0]<0 or shifted[2]>width or shifted[1]<0 or shifted[3]>height:
                    continue
                if min(distance_to_box(p['x'],p['y'],shifted) for p in symbols[name]['parts'])>45:
                    continue
                found = (dx,dy)
                break
            if found is None:
                raise RuntimeError('Could not resolve browser label collision: '+name)
            dx,dy = found
            value['x'] = round(value['x']+dx,2)
            value['y'] = round(value['y']+dy,2)
            browser_moves.append({'name':name,'dx':round(dx,2),'dy':round(dy,2)})
            moved = True
        if not moved:
            break
    occupied = [padded(label_bounds(s['id']),1) for s in stations]
labels = {s['id']: labels[s['id']] for s in stations}
(DATA / 'station-labels.json').write_text(json.dumps(labels, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

preview_pixels = np.full(pixels.shape, [248,248,248], dtype=np.uint8)
preview_pixels[water_pixels > 0] = [109,169,229]
preview_pixels[park_pixels > 0] = [89,225,157]
preview = Image.fromarray(preview_pixels)
draw = ImageDraw.Draw(preview)
for station in stations:
    for part in symbols[station['id']]['parts']:
        x, y = part['x'], part['y']
        draw.ellipse((x-4,y-4,x+4,y+4), fill='#ffffff', outline='#444444', width=2)
    label = labels[station['id']]
    text_anchor = {'start':'ls','middle':'ms','end':'rs'}[label['anchor']]
    draw.text((label['x'],label['y']),station['name'],font=fonts[label['fontSize']],
              fill='#202421',anchor=text_anchor,stroke_width=1,stroke_fill='#f8f8f8')
    for row,line in enumerate(english_lines(english_names.get(station['id'],''))):
        draw.text((label['x'],label['y']+(row+1)*9),line,font=english_font,
                  fill='#202421',anchor=text_anchor,stroke_width=1,stroke_fill='#f8f8f8')
preview.resize((2200,1571), Image.Resampling.LANCZOS).save(OUT/'map-context-preview.jpg', quality=92)
preview.crop((900,2600,2600,4000)).save(OUT/'map-context-southwest.jpg', quality=95)
preview.crop((2450,2650,3450,3500)).resize((1800,1530),Image.Resampling.LANCZOS).save(OUT/'map-context-center.jpg',quality=95)
fallback_stations = [s for s in stations if not choices[s['name']][0]]
contact = Image.new('RGB',(1600,840),'#ffffff')
contact_draw = ImageDraw.Draw(contact)
for index,station in enumerate(fallback_stations):
    col,row = index%4,index//4
    x,y = station['x'],station['y']
    region = (x-100,y-45,x+100,y+45)
    for source,offset in [(image,20),(preview,220)]:
        tile = source.crop(region).resize((400,180),Image.Resampling.LANCZOS)
        contact.paste(tile,(col*400,row*420+offset))
    contact_draw.text((col*400+5,row*420+2),station['name']+' / 原图与矢量',font=fonts[14],fill='#222222')
contact.save(OUT/'map-context-fallbacks.jpg',quality=95)
report = {'stations':len(stations),'labels':len(labels),'ocrMatched':matched,
          'fallback':len(stations)-matched,'waterPaths':len(water['paths']),
          'parkPaths':len(parks['paths']),
          'fallbackNames':[s['name'] for s in stations if not choices[s['name']][0]],
          'remainingLabelOverlaps':sum(overlap(a,b)>1 for i,a in enumerate(occupied) for b in occupied[i+1:]),
          'remainingNodeOverlaps':[s['name'] for s in stations if any(overlap(bounds(labels[s['id']]['x'],labels[s['id']]['y'],labels[s['id']]['anchor'],s['name']),node)>1 for node in nodes)],
          'labelsFurtherThan45px':[s['name'] for s in stations if min(distance_to_box(p['x'],p['y'],bounds(labels[s['id']]['x'],labels[s['id']]['y'],labels[s['id']]['anchor'],s['name'])) for p in symbols[s['id']]['parts'])>45]}
if measured:
    report['browserMetricLabels'] = len(font_metrics)
    report['browserMoves'] = browser_moves
    report['browserNodeClearanceConflicts'] = [s['name'] for s in stations if any(overlap(padded(label_bounds(s['id']),2),node)>1e-5 for node in nodes)]
(OUT/'map-context-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='browserMoves'},ensure_ascii=False))
