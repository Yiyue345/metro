"""Write the 35 manually reviewed tram anchors in cropped reference pixels.

Each coordinate was checked in 4x regional source crops. Tiny ring centers were
refined against neutral-dark contour holes in the native 4800 x 4030 image.
The script uses no geographic coordinates. Preview crops are temporary QA only.
"""
from pathlib import Path
import json
import math
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'shenzhen/.ocr-deps'))
from PIL import Image, ImageDraw, ImageFont

# name, source ring center, Chinese label bounds (English is a separate line).
ROWS = [
    ('成都西站', (1355.5, 1097), (1296, 1072, 1349.75, 1085.5)),
    ('联工', (1371.5, 1024.5), (1373.75, 1014, 1390, 1022.25)),
    ('土龙路', (1315, 889), (1317.75, 877.25, 1338.75, 885.25)),
    ('新业路', (1241, 815.5), (1245.5, 804.5, 1267, 814.5)),
    ('锦城学院', (1205, 778.5), (1209, 768.5, 1240, 777.5)),
    ('电子科大', (1074, 690), (1076.5, 673.5, 1105.25, 682.5)),
    ('合信路', (1032.5, 633.5), (1034.25, 633.5, 1055.75, 642.75)),
    ('合作路', (1052.5, 605), (1057, 602.5, 1078.5, 611.5)),
    ('天欣路', (1028.5, 583.5), (1031.5, 572, 1053.25, 580.75)),
    ('安埠', (992, 535.5), (995.5, 528, 1010.75, 537.5)),
    ('天映路', (925, 578), (903.5, 577, 925.25, 586.75)),
    ('天源路', (882.5, 527.5), (886, 518.25, 907.5, 527)),
    ('德富大道', (669.5, 461.5), (670.75, 448, 699, 456.5)),
    ('红旗大道', (638, 469.5), (607.5, 469.25, 638, 478)),
    ('红展东路', (615.5, 445.5), (585.5, 441.5, 612.5, 450)),
    ('大禹东路', (653.5, 403.5), (657.5, 402.25, 685, 410)),
    ('花石', (682, 365), (685.5, 362, 701.25, 370.5)),
    ('晨光', (722.5, 306.5), (726, 306.5, 740, 316)),
    ('何公路', (768.5, 270.5), (772, 270.75, 792.25, 279.75)),
    ('望丛祠', (768.5, 237.2), (773.75, 220, 811.75, 235)),
    ('梨园路', (783, 183.5), (787, 180.5, 807.5, 189)),
    ('郫县西站', (786.5, 131.5), (790.5, 128.25, 819, 136)),
    ('百叶路', (1279.5, 759.5), (1283, 758.5, 1305, 767.5)),
    ('晨风', (1331.5, 706.5), (1314, 695.5, 1329.75, 705.25)),
    ('天河路', (1359.4, 667.6), (1364.5, 665.5, 1402.75, 679.5)),
    ('龙吟', (1414.5, 604.5), (1397.5, 595, 1411, 604)),
    ('交大犀浦校区', (1392, 556), (1395.25, 546.25, 1436, 553.25)),
    ('犀方路', (1362.5, 520.5), (1365.5, 509.5, 1388.25, 519.75)),
    ('国宁', (1313.5, 525), (1315.5, 527.25, 1330.75, 536.75)),
    ('大田', (1290.5, 464.5), (1294, 460.75, 1309.25, 470)),
    ('西华大学', (1285, 415), (1289, 410.75, 1317.5, 420.25)),
    ('双林村', (1291.5, 383), (1295, 380.5, 1315.5, 389)),
    ('金土', (1249, 368.5), (1232, 364.25, 1246, 373.5)),
    ('技师学院', (1265, 322), (1269, 319.5, 1297, 328.5)),
    ('仁和', (1241, 295), (1223, 291.5, 1237, 300)),
]

review = {
    name: {
        'anchor': list(anchor),
        'labelBox': list(box),
        'reason': 'source review: native reference ring and Chinese label manually checked at 4x; center refined from the small black-ring white hole; no geographic inference.',
        'tramSymbolCenters': [list(anchor)],
        'tramSymbolDiameters': [8],
    }
    for name, anchor, box in ROWS
}

for name, metro_center, metro_size, metro_lines, tram_center in [
    ('望丛祠', (768.5, 237.2), (10, 10), ['6'], (766, 244.5)),
    ('天河路', (1359.4, 667.6), (10, 10), ['2'], (1354, 664.5)),
    ('成都西站', (1355.5, 1097), (16, 13), ['4', '9'], (1373, 1087.5)),
]:
    entry = review[name]
    entry.update({
        'metroSymbolCenter': list(metro_center),
        'metroSymbolSize': list(metro_size),
        'metroLines': metro_lines,
        'tramSymbolCenters': [list(tram_center)],
        'tramSymbolDiameters': [8],
        'connections': [{
            'x1': metro_center[0], 'y1': metro_center[1],
            'x2': tram_center[0], 'y2': tram_center[1],
            'kind': 'out-of-station',
        }],
        'reason': 'source review: separate metro symbol and 8px tram ring manually checked at 12x; keep the metro symbol as primary anchor. Connection endpoints reproduce the two source centers; the connection is an interactive interchange overlay, not a claim of paid-area transfer.',
    })

review['新业路'].update({
    'tramSymbolCenters': [[1241, 815.5], [1242.5, 806.5]],
    'tramSymbolDiameters': [8, 8],
    'connections': [{
        'x1': 1241, 'y1': 815.5, 'x2': 1242.5, 'y2': 806.5,
        'kind': 'out-of-station',
    }],
    'reason': 'source review: two distinct 8px black tram rings on the main and branch routes checked at 12x. Primary anchor is the main-route ring; retain both rings as one named station.',
})

roster = json.loads((ROOT / 'scripts/reference-roster.json').read_text(encoding='utf-8'))
expected = {name for path in roster['linePaths']['r2'] for name in path}
assert set(review) == expected and len(review) == 35
assert len({tuple(row['anchor']) for row in review.values()}) == 35
image = Image.open(ROOT / 'public/maps/chengdu-reference-pure.jpg').convert('RGB')
assert image.size == (4800, 4030)
for entry in review.values():
    x, y = entry['anchor']
    l, t, r, b = entry['labelBox']
    assert 0 <= x < image.width and 0 <= y < image.height
    assert l < r and t < b and math.dist((x, y), ((l + r) / 2, (t + b) / 2)) < 100

(ROOT / 'scripts/tram-anchor-review.json').write_text(
    json.dumps(review, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# A full contact sheet keeps every small label/ring reviewable at a readable size.
sheet = Image.new('RGB', (1800, 9 * 175), '#eeeeee')
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)
for index, (name, entry) in enumerate(review.items()):
    l, t, r, b = entry['labelBox']
    centers = entry['tramSymbolCenters'] + ([entry['metroSymbolCenter']] if 'metroSymbolCenter' in entry else [])
    minx = min([l] + [p[0] for p in centers]) - 8
    maxx = max([r] + [p[0] for p in centers]) + 8
    miny = min([t] + [p[1] for p in centers]) - 8
    maxy = max([b + 7] + [p[1] for p in centers]) + 8
    box = (math.floor(minx), math.floor(miny), math.ceil(maxx), math.ceil(maxy))
    tile = image.crop(box)
    scale = min(4, 430 / tile.width, 140 / tile.height)
    tile = tile.resize((round(tile.width * scale), round(tile.height * scale)), Image.Resampling.NEAREST)
    td = ImageDraw.Draw(tile)
    for cx, cy in centers:
        cx, cy = (cx - box[0]) * scale, (cy - box[1]) * scale
        td.line((cx - 6, cy, cx + 6, cy), fill='#e500d8', width=1)
        td.line((cx, cy - 6, cx, cy + 6), fill='#e500d8', width=1)
    sx, sy = (index % 4) * 450, (index // 4) * 175
    sheet.paste(tile, (sx, sy + 28))
    draw.text((sx + 2, sy + 2), f'{name} {entry["anchor"]}', fill='black', font=font)
output = Path(tempfile.gettempdir()) / 'chengdu-tram-all-35-review.png'
sheet.save(output)
print(f'Wrote 35 reviewed stations / 36 tram rings; QA: {output}')
