"""Match source-map English OCR to the existing 351-station roster.

Raw OCR is only a review aid. Final data is built exclusively from the checked
station-english-reviewed.json dictionary, never from unreviewed candidates.
"""
from pathlib import Path
import json,re,math

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'src/data'
REVIEW=ROOT/'scripts/review'
REVIEW.mkdir(exist_ok=True)
source=(DATA/'stations.ts').read_text(encoding='utf-8')
stations=json.loads(source.split('export const stations: Station[] = ')[1].rstrip(';\n'))
symbols=json.loads((DATA/'station-symbols.json').read_text(encoding='utf-8'))
ocr=json.loads((ROOT/'scripts/labels-rapid.json').read_text(encoding='utf-8'))
fixes={'李松荫':'李松蓢','沙墨':'沙壆'}

def chinese(text):
    value=''.join(re.findall(r'[\u4e00-\u9fff]',text))
    return fixes.get(value,value)

def distance(x,y,box):
    l,t,r,b=box
    return math.hypot(max(l-x,x-r,0),max(t-y,y-b,0))

english=[r for r in ocr if re.search('[A-Za-z]{2}',r['text']) and not chinese(r['text'])
         and 4<r['box'][3]-r['box'][1]<23 and r['box'][2]-r['box'][0]<200]
draft={}
for station in stations:
    name=station['name']
    parts=symbols[station['id']]['parts']
    chinese_records=[r for r in ocr if chinese(r['text'])==name and
                     min(distance(p['x'],p['y'],r['box']) for p in parts)<65]
    chosen=min(chinese_records,key=lambda r:min(distance(p['x'],p['y'],r['box']) for p in parts)-r['confidence']*4) if chinese_records else None
    candidates=[]
    for record in english:
        l,t,r,b=record['box']
        node_distance=min(distance(p['x'],p['y'],record['box']) for p in parts)
        if node_distance>100:continue
        if chosen:
            cl,ct,cr,cb=chosen['box']
            if not ct+8<t<cb+32 or abs(l-cl)>55:continue
            score=abs(l-cl)*.7+abs(t-(ct+14))*2-record['confidence']*4
        else:
            score=node_distance-record['confidence']*5
        candidates.append((score,record))
    candidates.sort(key=lambda c:c[0])
    selected=[]
    if candidates:
        first=candidates[0][1]
        selected=[first]
        # A few long English names are printed in two short stacked rows.
        fl,ft,fr,fb=first['box']
        following=[r for r in english if abs(r['box'][0]-fl)<7 and ft+6<r['box'][1]<ft+20]
        if following:
            second=min(following,key=lambda r:abs(r['box'][1]-fb)+abs(r['box'][0]-fl))
            selected.append(second)
    draft[name]={'raw':' '.join(r['text'] for r in selected),
                 'boxes':[r['box'] for r in selected],
                 'candidates':[{'text':r['text'],'box':r['box'],'score':round(score,1)} for score,r in candidates[:4]]}
(REVIEW/'station-english-ocr-draft.json').write_text(json.dumps(draft,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
roster=json.loads((DATA/'official-roster.json').read_text(encoding='utf-8'))
rows=[]
for line in roster['lines']:
    rows.append('\n'+line['name'])
    for rawname in line['stations']:
        name=roster['aliases'].get(rawname,rawname)
        rows.append(name+' = '+draft[name]['raw'])
(REVIEW/'station-english-line-review.txt').write_text('\n'.join(rows)+'\n',encoding='utf-8')
reviewed_path=ROOT/'scripts/station-english-reviewed.json'
if reviewed_path.exists():
    reviewed=json.loads(reviewed_path.read_text(encoding='utf-8'))
    expected={s['id'] for s in stations}
    assert set(reviewed)==expected, {'missing':list(expected-set(reviewed)), 'extra':list(set(reviewed)-expected)}
    assert all(isinstance(value,str) and value.strip() and not re.search(r'[\u4e00-\u9fff]',value) for value in reviewed.values())
    result={s['id']:reviewed[s['id']] for s in stations}
    (DATA/'station-english.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Built checked English names:',len(result))
else:
    print('OCR review draft only; checked dictionary required for final data.')
