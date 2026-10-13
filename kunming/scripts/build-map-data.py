"""Build Kunming operating geometry from reviewed roster and OCR/color pixels."""
from pathlib import Path
import sys,json,re,math
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'shenzhen/.ocr-deps'))
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
DATA=ROOT/'data';SCRIPTS=ROOT/'scripts'
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
source=json.loads((SCRIPTS/'amap-kunming-source.json').read_text(encoding='utf-8-sig'))
review=SCRIPTS/'reference-roster.json'
reviewed={}
assert review.exists(),'Reviewed operating roster is required; do not derive an unverified roster.'
if review.exists():
    checked=json.loads(review.read_text(encoding='utf-8'))
    reviewed={s['id']:s for s in checked['stations']}
    roster={'edition':'2026.07','source':checked['reference'],'aliases':{},'lines':[{'id':i,'name':f'{i}号线','stations':list(dict.fromkeys(n for path in paths for n in path)),'paths':paths} for i,paths in checked['linePaths'].items()]}
write(DATA/'official-roster.json',roster)
records=json.loads((SCRIPTS/'labels-rapid.json').read_text(encoding='utf-8'))
image=np.asarray(Image.open(ROOT/'public/maps/kunming-reference-pure.jpg').convert('RGB'))
colors={'1':'#e60012','2':'#0075ad','3':'#a61b87','4':'#ff9900','5':'#349328','6':'#008c99'}
nodes=[]
for line,color in colors.items():
    target=np.array([int(color[i:i+2],16) for i in [1,3,5]])
    mask=(np.linalg.norm(image.astype(float)-target,axis=2)<55).astype(np.uint8)
    count,_,stats,centers=cv2.connectedComponentsWithStats(mask,8)
    for i in range(1,count):
        x,y,w,h,a=map(int,stats[i]);cx,cy=centers[i]
        if not(3<=w<=24 and 3<=h<=24 and 8<=a<=300 and .4<w/h<2.5):continue
        rgb=np.median(image[y:y+h,x:x+w][mask[y:y+h,x:x+w]>0],axis=0)
        nodes.append({'x':round(cx,2),'y':round(cy,2),'rgb':rgb.tolist(),'bounds':[x,y,w,h],'area':a,'line':line})
write(SCRIPTS/'node-candidates.json',nodes)
manual={'穿心鼓楼':[655,438,712,456],'白龙路':[747,438,794,456]}
manual_anchors={'环城南路':(669,608),'火车北站':(667,403),'东风广场':(663,520),'塘子巷':(664,549),'五一路':(580,524),'大树营':(785,531),'东部汽车站':(1058,540),'菊华':(836,610),'斗南':(1077,1336),'联大街':(1317,1641),'昆明南火车站':(1468,1573)}
ocr_aliases={'珥季路':'琪季路','大学城南·云南开放大学':'大学城南'}
normalize=lambda n:''.join(re.findall(r'[\u4e00-\u9fff]',n))
membership={}
for line in roster['lines']:
 for n in line['stations']:
  n=roster.get('aliases',{}).get(n,n)
  membership.setdefault(n,[])
  if line['id'] not in membership[n]:membership[n].append(line['id'])
draft=[];missing=[]
for name,lineids in membership.items():
    display=reviewed.get(name,{}).get('name',name)
    labels=[r for r in records if normalize(r['text'])==normalize(ocr_aliases.get(display,display)) and 8<r['box'][3]-r['box'][1]<27]
    if name in manual: labels=[{'box':manual[name],'confidence':1}]
    targets=[np.array([int(colors[line][i:i+2],16) for i in [1,3,5]]) for line in lineids]
    candidates=[]
    for label in labels:
        l,t,r,b=label['box']
        for node in nodes:
            if node['line'] not in lineids:continue
            color_distance=min(np.linalg.norm(np.array(node['rgb'])-rgb) for rgb in targets)
            if color_distance>(145 if len(lineids)>1 else 95):continue
            d=math.hypot(max(l-node['x'],node['x']-r,0),max(t-node['y'],node['y']-b,0))
            if d<43:candidates.append((d+color_distance*.015,node,label))
    if name in manual_anchors and labels:
        x,y=manual_anchors[name];n={'x':x,'y':y,'manual':'original reference station-symbol center'}
        label=min(labels,key=lambda q:math.hypot(q['box'][0]-x,q['box'][1]-y))
    elif not candidates:missing.append(name);continue
    else:score,n,label=min(candidates,key=lambda c:c[0])
    draft.append({'id':name,'name':display,'lines':lineids,'aliases':reviewed.get(name,{}).get('aliases',[]),'x':n['x'],'y':n['y'],'labelBox':label['box'],'sourceNode':n})
write(SCRIPTS/'hotspots-draft.json',draft)
print('Matched',len(draft),'of',len(membership),'missing:',missing,flush=True)
duplicates={}
for s in draft:duplicates.setdefault((s['x'],s['y']),[]).append(s['name'])
print('Duplicate anchors:',[ns for ns in duplicates.values() if len(ns)>1],flush=True)
pure=Image.fromarray(image);draw=ImageDraw.Draw(pure);font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',13)
for s in draft:
    x,y=s['x'],s['y'];draw.ellipse((x-8,y-8,x+8,y+8),outline='#ff00ff',width=2);draw.text((x+10,y+10),s['name'],fill='#8d008d',font=font)
pure.save(ROOT.parent/'output/playwright/km-station-overlay.jpg',quality=96)
assert not missing,missing
assert len(duplicates)==len(draft),'Duplicate anchors require review'
symbols={s['id']:{'parts':[{'x':s['x'],'y':s['y'],'width':18 if len(s['lines'])>1 else 10,'height':10,'angle':0,'transfer':len(s['lines'])>1,'lines':s['lines']}]} for s in draft}
contours,_=cv2.findContours((image.max(2)<105).astype(np.uint8),cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
for s in draft:
    if s['id'] not in manual_anchors or s['id']=='环城南路':continue
    matches=[]
    for c in contours:
        x,y,w,h=cv2.boundingRect(c)
        if not(9<=w<=22 and 9<=h<=22):continue
        r=cv2.minAreaRect(c);center=r[0]
        if math.dist(center,(s['x'],s['y']))<3:matches.append((cv2.contourArea(c),r))
    assert matches,s['name']
    _,(center,(w,h),angle)=max(matches,key=lambda q:q[0])
    if w<h:w,h=h,w;angle+=90
    part=symbols[s['id']]['parts'][0]
    part.update(x=round(center[0],2),y=round(center[1],2),width=round(w,2),height=round(h,2),angle=round(angle,2))
    s['x'],s['y']=part['x'],part['y']
symbols['环城南路']['parts'][0].update(width=10,height=14,angle=0,transfer=False)
labels={s['id']:{'x':round(s['labelBox'][0],2),'y':round(s['labelBox'][1]+13,2),'anchor':'start','fontSize':14} for s in draft}
english={}
for line in source['l']:
 for s in line['st']:
    name=s['n'].split('(')[0].replace('大学城南·云南开放大学','大学城南')
    value=s.get('multilang',{}).get('n',{}).get('en') or s['sp']
    english[name]=value
english.update(roster.get('english',{}))
if reviewed:english={id:s['englishName'] for id,s in reviewed.items()}
for name,value in [('line-colors.json',colors),('station-symbols.json',symbols),('station-labels.json',labels),('station-english.json',english),('planned-stations.json',[])]:
    # Preserve the reviewed bilingual label positions on ordinary rebuilds.
    if name=='station-labels.json' and (DATA/name).exists() and '--refresh-labels' not in sys.argv:continue
    write(DATA/name,value)
for name,value in [('visited-stations.json',[]),('station-notes.json',{}),('basemap.json',{'base':'https://tiles.versatiles.org','tileset':'https://tiles.versatiles.org/tiles/osm/tiles.json','theme':'muted','attribution':'<a href="https://versatiles.org/">© VersaTiles</a>','maxZoom':14})]:
 if not(DATA/name).exists():write(DATA/name,value)
header="export interface Station { id: string; name: string; x: number; y: number; lines: string[]; aliases?: string[]; status?: 'planned' }\nexport const plannedStations: Station[] = [];\nexport interface MetroLine { id: string; name: string; color: string }\nexport const mapMeta = { width: 1980, height: 1960, image: '/kunming/maps/kunming-reference.jpg', edition: '2026.07' };\n"
lines={l['id']:{'id':l['id'],'name':l['name'],'color':colors[l['id']]} for l in roster['lines']}
header+='export const lines: MetroLine[] = '+json.dumps(list(lines.values()),ensure_ascii=False)+';\n'
header+='export const stations: Station[] = '+json.dumps([{k:v for k,v in s.items() if k not in ['labelBox','sourceNode']} for s in draft],ensure_ascii=False,indent=2)+';\n'
(DATA/'stations.ts').write_text(header,encoding='utf-8')
