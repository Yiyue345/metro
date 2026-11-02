"""Apply the source-space label positions reviewed in the browser."""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
draft = json.loads((ROOT/'scripts/hotspots-draft.json').read_text(encoding='utf-8'))
labels = {s['id']: {'x': round(s['labelBox'][0], 2), 'y': round(s['labelBox'][1] + (10 if s['lines'] == ['r2'] else 13), 2),
                     'anchor': 'start', 'fontSize': 11 if s['lines'] == ['r2'] else 14} for s in draft}
offsets = {'韦家碾': [4, 0], '草堂北路': [4, 8], '人民公园': [8, 0], '青羊宫': [0, -12],
           '成都东客站': [0, -4], '成都医学院': [0, 4], '石油大学': [0, -4], '高升桥': [0, 4],
           '红牌楼': [0, -4], '武侯立交': [0, -4], '迎春桥': [-4, 0], '沙湾': [0, 4],
           '建设北路': [0, 8], '双流机场2航站楼东': [4, 0]}
review = {name: {**labels[name], 'x': labels[name]['x'] + dx, 'y': labels[name]['y'] + dy}
          for name, (dx, dy) in offsets.items()}
for name, (x, y, anchor) in {
    '省骨科医院': (1747, 1301, 'end'), '市一医院': (1800, 1772, 'end'),
    '交子大道': (1805, 1820, 'end'), '西南财大': (1617, 1214, 'end'),
    '北站西二路': (1887, 1006, 'end'), '西南交大': (1793, 1042, 'end'),
    '兴业北街': (1394, 612, 'end'), '交大犀浦校区': (1395.25, 550.25, 'start'),
    '锦城学院': (1196, 783, 'end'), '双流机场2航站楼': (1230, 1865, 'end'),
}.items():
    review[name] = {**labels[name], 'x': x, 'y': y, 'anchor': anchor}
review['市一医院']['englishLineLength'] = 100
review['省骨科医院']['englishLineLength'] = 28
labels.update(review)
symbol_review = json.loads((ROOT/'scripts/label-symbol-layout-review.json').read_text(encoding='utf-8'))
for name, (dx, dy) in symbol_review['offsets'].items():
    label = labels[name]
    review[name] = {**label, 'x': round(label['x'] + dx, 2), 'y': round(label['y'] + dy, 2)}
labels.update(review)
for path, value in [(ROOT/'scripts/label-layout-review.json', review), (ROOT/'data/station-labels.json', labels)]:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Applied {len(review)} reviewed labels across {len(labels)} stations.')
