"""Extract only EAL/TML from the supplied operating reference; never warp routes."""
from pathlib import Path
import sys, json, math, heapq, hashlib
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'shenzhen/.ocr-deps'))
sys.path.insert(0, str(ROOT.parent / 'hangzhou/scripts'))
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from route_curves import make_curve

DATA = ROOT / 'data'
source = next(p for p in Path('E:/BaiduNetdiskDownload').glob('13.*/*.jpg') if p.name.startswith('01.') and '纯色' in p.name)
image = Image.open(source).convert('RGB')
assert image.size == (4375, 3125)
full = np.asarray(image).astype(np.float32)
small = np.asarray(image.resize((2188, 1563), Image.Resampling.BILINEAR)).astype(float)
review = json.loads((ROOT / 'scripts/geometry-review.json').read_text(encoding='utf-8'))
roster = json.loads((DATA / 'official-roster.json').read_text(encoding='utf-8'))
colors = {'EAL': '#65b5e4', 'TML': '#954424'}
stations, symbols, labels, english = [], {}, {}, {}
for station in roster['stations']:
    code = station['id']; x, y = review['stations'][code]
    stations.append({**{key: station[key] for key in ['id', 'name', 'lines']}, 'x': x, 'y': y})
    offset = review['labels'].get(code, {})
    labels[code] = {'x': x + offset.get('dx', 12), 'y': y + offset.get('dy', 0), 'anchor': offset.get('anchor', 'start'), 'fontSize': 14, 'englishLineLength': 26}
    english[code] = station['englishName']
    parts = [{'x': x, 'y': y, 'width': 11, 'height': 11, 'angle': 0, 'lines': station['lines'], 'transfer': len(station['lines']) > 1}]
    extra = review['sharedSymbols'].get(code)
    if extra and extra.get('joined'):
        parts = [{**parts[0], 'x': x + part['dx'], 'y': y + part['dy'], 'lines': [part['line']]} for part in extra['parts']]
        symbols[code] = {'parts': parts, 'joined': True, 'gradient': {'x1': x - 9.5, 'y1': y, 'x2': x + 9.5, 'y2': y, 'lines': ['EAL', 'TML']}}
    else:
        if extra: parts[0].update(extra)
        symbols[code] = {'parts': parts}
byid = {station['id']: station for station in stations}

def point(code, line):
    if code == 'HUH': return (byid[code]['x'] + (-4 if line == 'EAL' else 4), byid[code]['y'])
    if code == 'TAW':
        # Parallel EAL/TML bands meet the opposite halves of the shared capsule.
        offset = -2.2 if line == 'EAL' else 2.2
        return (byid[code]['x'] + offset, byid[code]['y'] - offset * .72)
    return (byid[code]['x'], byid[code]['y'])

def trace(start, end, distance, inside):
    a, b = [tuple(round(v / 2) for v in p) for p in (start, end)]
    margin = round(min(180, max(45, math.dist(a, b) * .35)))
    x0 = max(0, min(a[0], b[0]) - margin); x1 = min(small.shape[1]-1, max(a[0], b[0]) + margin)
    y0 = max(0, min(a[1], b[1]) - margin); y1 = min(small.shape[0]-1, max(a[1], b[1]) + margin)
    d = distance[y0:y1+1, x0:x1+1]; ins = inside[y0:y1+1, x0:x1+1]
    cost = (1 + .9 * np.minimum(d, 55)**1.7 + .7/(ins+1)).astype(np.float32)
    aa = (a[0]-x0, a[1]-y0); bb = (b[0]-x0, b[1]-y0)
    for p in [aa, bb]: cv2.circle(cost, p, 3, 1.0, -1)
    h, w = cost.shape; first = aa[1]*w+aa[0]; last = bb[1]*w+bb[0]
    best = np.full(w*h, np.inf); best[first] = 0
    previous = np.full(w*h, -1, dtype=np.int32)
    queue = [(math.dist(aa, bb), 0, first)]
    directions = [(dx, dy, math.hypot(dx, dy)) for dx in [-1,0,1] for dy in [-1,0,1] if dx or dy]
    while queue:
        _, g, k = heapq.heappop(queue)
        if g > best[k]: continue
        if k == last: break
        y, x = divmod(k, w)
        for dx, dy, length in directions:
            nx, ny = x+dx, y+dy
            if not (0 <= nx < w and 0 <= ny < h): continue
            nk = ny*w+nx; ng = g + length * float((cost[y,x]+cost[ny,nx])*.5)
            if ng < best[nk]:
                best[nk] = ng; previous[nk] = k
                heapq.heappush(queue, (ng+math.hypot(nx-bb[0],ny-bb[1]), ng, nk))
    assert previous[last] >= 0
    keys = [last]
    while keys[-1] != first: keys.append(int(previous[keys[-1]]))
    points = [((k%w+x0)*2, (k//w+y0)*2) for k in reversed(keys)]
    points[0], points[-1] = start, end
    departures = [float(distance[round(y/2),round(x/2)])*2 for x,y in points]
    return points, {'maxColorDistance': round(max(departures), 2), 'offBandFraction': round(sum(d>6 for d in departures)/len(departures), 4)}

routes, report, polylines = [], [], {}
for line in roster['lines']:
    color = colors[line['id']]; rgb = np.array([int(color[i:i+2],16) for i in [1,3,5]])
    mask = ((np.linalg.norm(small-rgb, axis=2)<65)&(small.max(2)-small.min(2)>30)).astype(np.uint8)
    outside = cv2.distanceTransform(1-mask, cv2.DIST_L2, 5)
    inside = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    paths = []
    for index, names in enumerate(line['paths']):
        anchors = [point(code,line['id']) for code in names]; raw = []; segments = []
        for i, (a,b) in enumerate(zip(anchors, anchors[1:])):
            points, stats = trace(a,b,outside,inside)
            raw.extend(points if not raw else points[1:])
            segments.append({'from': names[i], 'to': names[i+1], **stats})
        curve, drawpoints, stats = make_curve(raw,full,color,anchors)
        coverage = [{'id':code,'distance':round(min(math.dist(anchor,p) for p in drawpoints),3)} for code,anchor in zip(names,anchors)]
        assert max(v['distance'] for v in coverage)<4.5, coverage
        paths.append(curve); polylines[f"{line['id']}-{index}"] = drawpoints
        report.append({'line':line['id'],'path':index,'stations':names,'coverage':coverage,'curve':stats,'segments':segments})
        print(line['id'],index,'stations',len(names),'maxCoverage',max(v['distance'] for v in coverage),flush=True)
    routes.append({'id':line['id'],'color':color,'width':8,'paths':paths})

def write(path, data): path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for name, data in [('stations.json',stations),('station-symbols.json',symbols),('station-labels.json',labels),('station-english.json',english),('route-paths.json',routes),('line-colors.json',colors)]: write(DATA/name,data)
write(DATA/'source-meta.json',{'edition':'2026.08','width':4375,'height':3125,'source':source.name,'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'geometry':'reference pixels, north-up uniform scale and translation only'})
write(ROOT/'scripts/route-tracing-report.json',report)
write(ROOT/'scripts/route-polylines.json',polylines)
preview=Image.new('RGB',image.size,'white');draw=ImageDraw.Draw(preview)
for key, points in polylines.items(): draw.line([tuple(p) for p in points],fill=colors[key.split('-')[0]],width=8)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14)
for station in stations:
    x,y=station['x'],station['y'];draw.ellipse((x-5,y-5,x+5,y+5),fill=colors[station['lines'][0]],outline='black',width=1)
    label=labels[station['id']];draw.text((label['x'],label['y']-14),station['name'],font=font,fill='black',anchor={'start':'la','end':'ra','middle':'ma'}[label['anchor']])
preview.resize((2100,1500)).save(ROOT.parent/'output/playwright/hk-extracted-review.jpg')
print('Exported 41 stations, 2 lines, 4 continuous physical paths.',flush=True)
