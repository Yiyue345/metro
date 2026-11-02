"""Extract reviewed stations and label anchors from the operating reference pixels."""
from pathlib import Path
import sys,json,re,math
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'shenzhen/.ocr-deps'))
sys.path.insert(0,str(ROOT.parent/'shenzhen/scripts'))
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
from transfer_symbol_geometry import measure_transfer_symbols
DATA=ROOT/'data';SCRIPTS=ROOT/'scripts'
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
roster=json.loads((SCRIPTS/'reference-roster.json').read_text(encoding='utf-8-sig'))
reviewed={s['id']:s for s in roster['stations']}
records=json.loads((SCRIPTS/'labels-rapid.json').read_text(encoding='utf-8'))
image=np.asarray(Image.open(ROOT/'public/maps/hangzhou-reference-pure.jpg').convert('RGB'))
colors={'1':'#dc4768','2':'#d45300','3':'#faca00','4':'#70bd4d','5':'#00aebf','6':'#0076c2','7':'#881696','8':'#a8005d','9':'#b34d00','10':'#bfa400','16':'#fbb553','19':'#00c7d9','hh':'#2785bb'}
# Estimate the exact band colors from nearby saturated pixels at isolated stops.
examples={'1':'湘湖','2':'良渚','3':'星桥','4':'浦沿','5':'南湖东','6':'桂花西路','7':'吴山广场','8':'桥头堡','9':'龙安','10':'逸盛路','16':'九州街','19':'荆长路','hh':'浙大国际校区'}
for line,name in examples.items():
 labs=[r for r in records if r['text']==name]
 if not labs:continue
 l,t,r,b=map(round,labs[0]['box']);cut=image[max(0,t-35):b+35,max(0,l-35):r+35].reshape(-1,3)
 target=np.array([int(colors[line][i:i+2],16) for i in [1,3,5]])
 selected=cut[(np.linalg.norm(cut.astype(float)-target,axis=1)<35)&(cut.max(1)-cut.min(1)>60)]
 if len(selected)>10:colors[line]='#'+''.join(f'{int(v):02x}' for v in np.median(selected,axis=0))
write(DATA/'line-colors.json',colors)
print('Colors',colors,flush=True)
nodes=[]
for line,color in colors.items():
 target=np.array([int(color[i:i+2],16) for i in [1,3,5]])
 mask=(np.linalg.norm(image.astype(np.float32)-target,axis=2)<48).astype(np.uint8)
 count,_,stats,centers=cv2.connectedComponentsWithStats(mask,8)
 for i in range(1,count):
  x,y,w,h,a=map(int,stats[i]);cx,cy=centers[i]
  if not(3<=w<=32 and 3<=h<=32 and 8<=a<=650 and .35<w/h<2.8):continue
  rgb=np.median(image[y:y+h,x:x+w][mask[y:y+h,x:x+w]>0],axis=0)
  nodes.append({'x':round(cx,2),'y':round(cy,2),'rgb':rgb.tolist(),'bounds':[x,y,w,h],'area':a,'line':line})
write(SCRIPTS/'node-candidates.json',nodes)
normalize=lambda name:''.join(re.findall(r'[\u4e00-\u9fffA-Za-z0-9]',name)).lower()
override_path=SCRIPTS/'geometry-overrides.json'
overrides=json.loads(override_path.read_text(encoding='utf-8')) if override_path.exists() else {}
additional=SCRIPTS/'additional-anchor-review.json'
if additional.exists():overrides.update(json.loads(additional.read_text(encoding='utf-8')))
draft=[];missing=[]
for station in [*roster['stations'],*roster.get('plannedStations',[])]:
 name=station['id'];lineids=station.get('lines') or [line for line,paths in roster['linePaths'].items() if any(name in p for p in paths)]
 display=station['name'];override=overrides.get(name,{})
 names=[display,*station.get('aliases',[]),override.get('ocr',display)]
 labs=[r for r in records if normalize(r['text']) in set(map(normalize,names)) and 8<r['box'][3]-r['box'][1]<38]
 if 'labelBox' in override:labs=[{'box':override['labelBox'],'confidence':1}]
 candidates=[]
 for label in labs:
  l,t,r,b=label['box']
  for node in nodes:
   if node['line'] not in lineids:continue
   d=math.hypot(max(l-node['x'],node['x']-r,0),max(t-node['y'],node['y']-b,0))
   if d<55:candidates.append((d,node,label))
 if 'anchor' in override and labs:
  x,y=override['anchor'];node={'x':x,'y':y,'manual':'reviewed source station-symbol center'}
  label=min(labs,key=lambda q:math.dist(q['box'][:2],[x,y]))
 elif not candidates:missing.append({'name':name,'labels':len(labs),'lines':lineids});continue
 else:_,node,label=min(candidates,key=lambda q:q[0])
 draft.append({**station,'lines':lineids,'x':node['x'],'y':node['y'],'labelBox':label['box'],'sourceNode':node})
write(SCRIPTS/'hotspots-draft.json',draft)
duplicates={}
for s in draft:duplicates.setdefault((s['x'],s['y']),[]).append(s['id'])
print('Matched',len(draft),'of',len(roster['stations'])+len(roster.get('plannedStations',[])),'missing',missing,flush=True)
print('Duplicate anchors',[ns for ns in duplicates.values() if len(ns)>1],flush=True)
write(SCRIPTS/'geometry-match-report.json',{'matched':len(draft),'missing':missing,'duplicates':[ns for ns in duplicates.values() if len(ns)>1]})
pure=Image.fromarray(image);draw=ImageDraw.Draw(pure);font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16)
for s in draft:
 x,y=s['x'],s['y'];draw.ellipse((x-10,y-10,x+10,y+10),outline='#ff00ff',width=2);draw.text((x+12,y+12),s['name'],fill='#8d008d',font=font)
pure.resize((2955,1600)).save(ROOT.parent/'output/playwright/hz-station-overlay.jpg',quality=96)
if missing or len(duplicates)!=len(draft):sys.exit(1)
symbols={s['id']:{'parts':[{'x':s['x'],'y':s['y'],'width':20 if len(s['lines'])>1 else 11,'height':11,'angle':0,'transfer':len(s['lines'])>1,'lines':s['lines'],**({'planned':True} if s.get('status')=='planned' else {})}]} for s in draft}
# Measure the black outer ring rather than the nearest nested white hole.
symbols,_=measure_transfer_symbols(image,symbols,json.loads((SCRIPTS/'transfer-symbol-overrides.json').read_text(encoding='utf-8')))
symbols.update(json.loads((SCRIPTS/'transfer-topology-overrides.json').read_text(encoding='utf-8')))
labels={s['id']:{'x':round(s['labelBox'][0],2),'y':round(s['labelBox'][1]+13,2),'anchor':'start','fontSize':14} for s in draft}
layout_review=SCRIPTS/'label-layout-review.json'
if layout_review.exists():labels.update(json.loads(layout_review.read_text(encoding='utf-8')))
for name,value in [('station-symbols.json',symbols),('station-labels.json',labels),('station-english.json',{s['id']:s['englishName'] for s in draft}),('planned-stations.json',[{k:v for k,v in s.items() if k not in ['labelBox','sourceNode']} for s in draft if s.get('status')=='planned'])]:
 if name=='station-labels.json' and (DATA/name).exists() and '--refresh-labels' not in sys.argv:continue
 write(DATA/name,value)
for name,value in [('visited-stations.json',[]),('station-notes.json',{}),('basemap.json',{'base':'https://tiles.versatiles.org','tileset':'https://tiles.versatiles.org/tiles/osm/tiles.json','theme':'muted','attribution':'<a href="https://versatiles.org/">© VersaTiles</a>','maxZoom':14})]:
 if not(DATA/name).exists():write(DATA/name,value)
header="export interface Station { id: string; name: string; x: number; y: number; lines: string[]; aliases?: string[]; status?: 'planned' }\nimport planned from './planned-stations.json';\nexport const plannedStations: Station[] = planned as Station[];\nexport interface MetroLine { id: string; name: string; color: string }\nexport const mapMeta = { width: 5910, height: 3200, image: '/hangzhou/maps/hangzhou-reference.jpg', edition: '2026.05' };\n"
header+='export const lines: MetroLine[] = '+json.dumps([{'id':i,'name':'杭海城际' if i=='hh' else f'{i}号线','color':color} for i,color in colors.items()],ensure_ascii=False)+';\n'
header+='export const stations: Station[] = '+json.dumps([{k:v for k,v in s.items() if k not in ['labelBox','sourceNode','englishName']} for s in draft if s.get('status')!='planned'],ensure_ascii=False,indent=2)+';\n'
(DATA/'stations.ts').write_text(header,encoding='utf-8')

