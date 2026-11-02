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
image=np.asarray(Image.open(ROOT/'public/maps/chengdu-reference-pure.jpg').convert('RGB'))
colors={'1':'#171b85','2':'#ff6543','3':'#df007a','4':'#12b35f','5':'#a33b91','6':'#bc792e','7':'#5ecdd7','8':'#bad22c','9':'#f3ad00','10':'#0058b3','13':'#baa600','17':'#83dcaa','18':'#286367','19':'#9ba4dc','27':'#55a4d7','30':'#f68bb1','s3':'#8b8b8b','r2':'#86b545'}
examples={'1':'科学城','2':'龙泉驿','3':'成都医学院','4':'西河','5':'华桂路','6':'兰家沟','7':'神仙树','8':'龙港','9':'黄田坝','10':'新平','13':'龙安','17':'高洪','18':'天府机场北','19':'金星','27':'石佛','30':'龙泉驿火车站南','r2':'晨光'}
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
# Interchange centers contain a blend of line colors. Locate their black outer
# rings directly, so a nearby single-line stop cannot replace the true station.
ring_nodes=[]
mask=((image.max(2)<140)&(image.max(2)-image.min(2)<40)).astype(np.uint8)
contours,hierarchy=cv2.findContours(mask,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
for index,contour in enumerate(contours):
 if hierarchy[0][index][3]!=-1 or hierarchy[0][index][2]<0:continue
 (x,y),(w,h),angle=cv2.minAreaRect(contour);area=cv2.contourArea(contour)
 if 9<=min(w,h)<=max(w,h)<=32 and 90<=area<=500 and area/(w*h)>.7:
  # Text such as 口 also has a black outer contour and a white hole. A real
  # transfer ring has colored track pixels inside that hole.
  child=contours[hierarchy[0][index][2]]
  xx,yy,ww,hh=cv2.boundingRect(child);inside=np.zeros((hh,ww),dtype=np.uint8)
  cv2.drawContours(inside,[child-np.array([[[xx,yy]]])],-1,1,-1)
  pixels=image[yy:yy+hh,xx:xx+ww][inside>0]
  if np.mean((pixels.max(1)-pixels.min(1)>15)&(pixels.min(1)<220))>.18:
   ring_nodes.append({'x':round(x,2),'y':round(y,2),'ring':True,'area':area})
write(SCRIPTS/'ring-candidates.json',ring_nodes)
normalize=lambda name:''.join(re.findall(r'[\u4e00-\u9fffA-Za-z0-9]',name)).lower()
override_path=SCRIPTS/'geometry-overrides.json'
overrides=json.loads(override_path.read_text(encoding='utf-8')) if override_path.exists() else {}
additional=SCRIPTS/'additional-anchor-review.json'
if additional.exists():overrides.update(json.loads(additional.read_text(encoding='utf-8')))
tram_review=SCRIPTS/'tram-anchor-review.json'
if tram_review.exists():overrides.update(json.loads(tram_review.read_text(encoding='utf-8')))
airport_review=json.loads((SCRIPTS/'airport-symbol-review.json').read_text(encoding='utf-8'))
tianfu_review=json.loads((SCRIPTS/'tianfu-geometry-review.json').read_text(encoding='utf-8'))['tianfuStation']
airport_review['天府站']={'anchor':tianfu_review['centerCropped'],'parts':[{'x':tianfu_review['centerCropped'][0],'y':tianfu_review['centerCropped'][1],'width':tianfu_review['outerSize'][0],'height':tianfu_review['outerSize'][1],'angle':tianfu_review['angleDegrees'],'lines':['18','19'],'transfer':True}]}
for name,review in airport_review.items():overrides[name]={**overrides.get(name,{}),'anchor':review['anchor']}
transfer_audit=json.loads((SCRIPTS/'transfer-audit-review.json').read_text(encoding='utf-8'))
for name,review in transfer_audit.items():overrides[name]={**overrides.get(name,{}),'anchor':[review['anchor']['x'],review['anchor']['y']]}
s3_review=json.loads((SCRIPTS/'s3-geometry-review.json').read_text(encoding='utf-8'))
for review in s3_review['stations']:
 overrides[review['id']]={**overrides.get(review['id'],{}),'anchor':review['anchor'],'labelBox':review['labelBox']}
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
  station_nodes=ring_nodes if len(lineids)>1 and set(lineids)!=set(['18','19']) else nodes
  for node in station_nodes:
   if 'line' in node and node['line'] not in lineids:continue
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
pure.resize((2400,2015)).save(ROOT.parent/'output/playwright/chengdu-station-overlay.jpg',quality=96)
if (missing or len(duplicates)!=len(draft)) and '--review' not in sys.argv:sys.exit(1)
symbols={s['id']:{'parts':[{'x':s['x'],'y':s['y'],'width':20 if len(s['lines'])>1 else 11,'height':11,'angle':0,'transfer':len(s['lines'])>1 and set(s['lines'])!=set(['18','19']),'lines':s['lines'],**({'planned':True} if s.get('status') else {})}]} for s in draft}
# Measure the black outer ring rather than the nearest nested white hole.
symbol_review=json.loads((SCRIPTS/'transfer-symbol-overrides.json').read_text(encoding='utf-8'))
tram_review=json.loads(tram_review.read_text(encoding='utf-8')) if tram_review.exists() else {}
for name,review in tram_review.items():
 if 'metroSymbolCenter' in review:
  symbol_review[name]={'width':review['metroSymbolSize'][0],'height':review['metroSymbolSize'][1],'angle':0,'reason':review['reason']}
for review in s3_review['stations']:
 if len(review['parts'][0]['lines'])>1:
  part=review['parts'][0];symbol_review[review['id']]={**{key:part[key] for key in ['width','height','angle']},'reason':'Reviewed S3 joint station symbol in the supplied reference.'}
symbols,measurements=measure_transfer_symbols(image,symbols,symbol_review)
write(SCRIPTS/'transfer-symbol-measurements.json',measurements)
symbols.update(json.loads((SCRIPTS/'transfer-topology-overrides.json').read_text(encoding='utf-8')))
for name,review in tram_review.items():
 parts=[]
 if 'metroSymbolCenter' in review:
  x,y=review['metroSymbolCenter'];w,h=review['metroSymbolSize']
  parts.append({'x':x,'y':y,'width':w,'height':h,'angle':0,'lines':review['metroLines'],'transfer':len(review['metroLines'])>1})
 for (x,y),size in zip(review['tramSymbolCenters'],review['tramSymbolDiameters']):
  parts.append({'x':x,'y':y,'width':size,'height':size,'angle':0,'lines':['r2'],'transfer':True})
 symbols[name]={'parts':parts,**({'connections':review['connections']} if review.get('connections') else {})}
for name,review in airport_review.items():symbols[name]={'parts':review['parts']}
for name,review in transfer_audit.items():symbols[name]=review['symbol']
for review in s3_review['stations']:symbols[review['id']]={'parts':review['parts']}
by_id={s['id']:s for s in draft}
if '龙泉驿火车站' in by_id:
 a=by_id['龙泉驿火车站'];b=by_id['龙泉驿火车站南']
 symbols[a['id']]['connections']=[{'x1':a['x'],'y1':a['y'],'x2':b['x'],'y2':b['y'],'kind':'out-of-station'}]
labels={s['id']:{'x':round(s['labelBox'][0],2),'y':round(s['labelBox'][1]+(10 if s['lines']==['r2'] else 13),2),'anchor':'start','fontSize':11 if s['lines']==['r2'] else 14} for s in draft}
layout_review=SCRIPTS/'label-layout-review.json'
if layout_review.exists():labels.update(json.loads(layout_review.read_text(encoding='utf-8')))
for name,value in [('station-symbols.json',symbols),('station-labels.json',labels),('station-english.json',{s['id']:s['englishName'] for s in draft}),('planned-stations.json',[{k:v for k,v in s.items() if k not in ['labelBox','sourceNode']} for s in draft if s.get('status')])]:
 if name=='station-labels.json' and (DATA/name).exists() and '--refresh-labels' not in sys.argv:continue
 write(DATA/name,value)
for name,value in [('visited-stations.json',[]),('station-notes.json',{}),('basemap.json',{'base':'https://tiles.versatiles.org','tileset':'https://tiles.versatiles.org/tiles/osm/tiles.json','theme':'muted','attribution':'<a href="https://versatiles.org/">© VersaTiles</a>','maxZoom':14})]:
 if not(DATA/name).exists():write(DATA/name,value)
canvas=s3_review['recommendedCanvas']
meta=json.loads((DATA/'source-meta.json').read_text(encoding='utf-8'))
meta.update({'cropWidth':4800,'cropHeight':4030,'width':canvas['width'],'height':canvas['height'],'extendedGeometry':'S3 reference inset scaled uniformly and translated into the main source space; see scripts/s3-geometry-review.json.'})
write(DATA/'source-meta.json',meta)
header="export interface Station { id: string; name: string; x: number; y: number; lines: string[]; aliases?: string[]; status?: 'planned' | 'suspended' }\nimport planned from './planned-stations.json';\nexport const plannedStations: Station[] = planned as Station[];\nexport interface MetroLine { id: string; name: string; color: string }\n"
header+='export const mapMeta = '+json.dumps({'width':canvas['width'],'height':canvas['height'],'image':'/chengdu/maps/chengdu-reference.jpg','edition':'2026.11'},ensure_ascii=False)+';\n'
header+='export const lines: MetroLine[] = '+json.dumps([{'id':i,'name':'蓉2号线' if i=='r2' else 'S3资阳线' if i=='s3' else f'{i}号线','color':color} for i,color in colors.items()],ensure_ascii=False)+';\n'
header+='export const stations: Station[] = '+json.dumps([{k:v for k,v in s.items() if k not in ['labelBox','sourceNode','englishName']} for s in draft if not s.get('status')],ensure_ascii=False,indent=2)+';\n'
(DATA/'stations.ts').write_text(header,encoding='utf-8')

