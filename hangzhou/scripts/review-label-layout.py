"""Propose bilingual-label placement without editing the live city dataset.

Uses source-scale font rectangles, current route polylines, and station-symbol
exclusion zones. Writes review suggestions plus independent raster QA artifacts.
"""
from pathlib import Path
import sys,json,math,hashlib
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'scripts/review').mkdir(exist_ok=True)
sys.path.insert(0,str(ROOT.parent/'shenzhen/.ocr-deps'))
from PIL import Image,ImageDraw,ImageFont
import numpy as np
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf-8'))
text=(ROOT/'data/stations.ts').read_text(encoding='utf-8')
stations=json.loads(text.split('export const stations: Station[] = ')[1].rstrip(';\n'))+read('data/planned-stations.json')
labels=read('data/station-labels.json');english=read('data/station-english.json');symbols=read('data/station-symbols.json')
original={k:dict(v)for k,v in labels.items()};inputHash=hashlib.sha256((ROOT/'data/station-labels.json').read_bytes()).hexdigest()
colors=read('data/line-colors.json');paths=read('scripts/route-polylines.json')
W,H=5910,3200
zh={n:ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',n)for n in [13,14]};en=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',8)
scratch=ImageDraw.Draw(Image.new('L',(1,1)))
lineim=Image.new('L',(W,H),0);d=ImageDraw.Draw(lineim)
for key,points in paths.items():d.line([tuple(p)for p in points],fill=1,width=10,joint='curve')
lineIntegral=np.pad(np.asarray(lineim).astype(np.int32).cumsum(0).cumsum(1),((1,0),(1,0)))
nodeim=Image.new('L',(W,H),0);d=ImageDraw.Draw(nodeim)
for s in stations:
 p=symbols[s['id']]['parts'][0];x,y=p['x'],p['y'];r=max(p['width'],p['height'])/2+3
 d.ellipse((x-r,y-r,x+r,y+r),fill=1)
nodeIntegral=np.pad(np.asarray(nodeim).astype(np.int32).cumsum(0).cumsum(1),((1,0),(1,0)))
def wrapped(name,limit):
 rows=[]
 for word in name.split(' '):
  if rows and len(rows[-1])+len(word)<limit:rows[-1]+=' '+word
  else:rows.append(word)
 return rows
def boxes(s,l):
 x,y=l['x'],l['y'];a={'start':'ls','middle':'ms','end':'rs'}[l['anchor']]
 result=[scratch.textbbox((x,y),s['name'],font=zh[l['fontSize']],anchor=a)]
 result.extend(scratch.textbbox((x,y+9*(i+1)),row,font=en,anchor=a)for i,row in enumerate(wrapped(english[s['id']],l.get('englishLineLength',24))))
 return result
def area(a,b):return max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))
def pixels(integral,box):
 x1,y1,x2,y2=[int(round(v))for v in box];x1=max(0,min(W,x1));x2=max(0,min(W,x2));y1=max(0,min(H,y1));y2=max(0,min(H,y2))
 return int(integral[y2,x2]-integral[y1,x2]-integral[y2,x1]+integral[y1,x1])
byid={s['id']:s for s in stations};current={s['id']:boxes(s,labels[s['id']])for s in stations}
originalBoxes={k:list(v)for k,v in current.items()}
neighbors={s['id']:[t['id']for t in stations if t['id']!=s['id'] and math.dist((s['x'],s['y']),(t['x'],t['y']))<330]for s in stations}
def obstacles(bs):return sum(pixels(lineIntegral,b)*1.3+pixels(nodeIntegral,b)*9 for b in bs)
def overlap(name,bs):return sum(area(a,b)*12 for other in neighbors[name]for a in bs for b in current[other])
def score(s,l,bs):
 oldbs=originalBoxes[s['id']];center=lambda b:((b[0]+b[2])/2,(b[1]+b[3])/2)
 displacement=math.dist(center(bs[0]),center(oldbs[0]))
 bounds=sum(10000 for b in bs if b[0]<5 or b[1]<5 or b[2]>W-5 or b[3]>H-5)
 obstacleCost=obstacles(bs)
 if '--polish' in sys.argv:obstacleCost=sum(pixels(lineIntegral,b)*20+pixels(nodeIntegral,b)*500 for b in bs)
 return obstacleCost+overlap(s['id'],bs)*200+displacement*.6+bounds+(.7 if l.get('englishLineLength',24)!=24 else 0)
def candidates(s):
 old=original[s['id']];x,y=s['x'],s['y'];values=[dict(old)]
 for dx,dy in [(0,-9),(0,9),(-9,0),(9,0),(0,-18),(0,18),(-18,0),(18,0),(-9,-9),(9,-9),(-9,9),(9,9)]:values.append({**old,'x':old['x']+dx,'y':old['y']+dy})
 for px,py,a in [(x+11,y+3,'start'),(x-11,y+3,'end'),(x,y-16,'middle'),(x,y+23,'middle'),(x+11,y-12,'start'),(x-11,y-12,'end'),(x+11,y+22,'start'),(x-11,y+22,'end')]:values.append({'x':round(px,2),'y':round(py,2),'anchor':a,'fontSize':14})
 output=[]
 for l in values:
  for limit in [24,18,15]:
   v={**l}
   if limit!=24:v['englishLineLength']=limit
   output.append((v,boxes(s,v)))
 return output
def totals():
 collisions=[];linehits=[]
 for s in stations:
  name=s['id'];bs=current[name]
  for other in neighbors[name]:
   if name>=other:continue
   if any(area(a,b)>2 for a in bs for b in current[other]):collisions.append([name,other])
  n=sum(pixels(nodeIntegral,b)for b in bs);rail=sum(pixels(lineIntegral,b)for b in bs)
  if n>0 or rail>0:linehits.append({'id':name,'nodeRectanglePixels':n,'railRectanglePixels':rail})
 return {'labelOverlapPairs':collisions,'obstacleRectangleOverlaps':linehits}
before=totals()
if '--refine' in sys.argv or '--render-only' in sys.argv or '--polish' in sys.argv:
 labels.update(read('scripts/label-layout-review.json'));current={s['id']:boxes(s,labels[s['id']])for s in stations}
options={} if '--render-only' in sys.argv or '--polish' in sys.argv else {s['id']:candidates(s)for s in stations}
if '--polish' in sys.argv:
 problems={item['id']for item in totals()['obstacleRectangleOverlaps']}
 options={s['id']:[(labels[s['id']],current[s['id']])]for s in stations}
 for name in problems:
  s=byid[name];old=labels[name]
  for dx in [-18,-12,-9,-6,-3,-2,-1,0,1,2,3,6,9,12,18]:
   for dy in [-18,-12,-9,-6,-3,-2,-1,0,1,2,3,6,9,12,18]:
    l={**old,'x':old['x']+dx,'y':old['y']+dy};options[name].append((l,boxes(s,l)))
if '--refine' in sys.argv:
 problems={item['id']for item in totals()['obstacleRectangleOverlaps']}
 problems.update(name for pair in totals()['labelOverlapPairs']for name in pair)
 for name in problems:
  s=byid[name];old=labels[name];options[name].append((old,boxes(s,old)))
  for dx in [-60,-40,-20,0,20,40,60]:
   for dy in [-45,-30,-15,0,15,30,45]:
    for limit in [15,18,24]:
     l={**old,'x':old['x']+dx,'y':old['y']+dy,'englishLineLength':limit};options[name].append((l,boxes(s,l)))
for iteration in range(0 if '--render-only' in sys.argv else 5):
 changed=0
 order=sorted(stations,key=lambda s:score(s,labels[s['id']],current[s['id']]),reverse=True)
 for s in order:
  name=s['id'];best=min(options[name],key=lambda v:score(s,v[0],v[1]));oldscore=score(s,labels[name],current[name])
  if score(s,*best)<oldscore-.01:labels[name],current[name]=best;changed+=1
 print('Pass',iteration+1,'changed',changed)
 if not changed:break
after=totals();suggestions={k:v for k,v in labels.items()if v!=original[k]}
for name,value in [('label-layout-review.json',suggestions),('label-layout-review-report.json',{'stationCount':len(stations),'inputLabelsSHA256':inputHash,'before':before,'after':after,'suggestedChanges':len(suggestions),'limitations':'Conservative font rectangles, not browser glyph outlines; final browser and symbol checks remain necessary.'})]:
 (ROOT/'scripts'/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
im=Image.new('RGB',(W,H),'white');d=ImageDraw.Draw(im)
for key,points in paths.items():d.line([tuple(p)for p in points],fill=colors[key.split('-')[0]],width=8,joint='curve')
for s in stations:
 for p in symbols[s['id']]['parts']:
  x,y=p['x'],p['y'];w,h=p['width'],p['height'];d.rounded_rectangle((x-w/2,y-h/2,x+w/2,y+h/2),radius=max(0,min(w,h)/2-1),fill='white',outline='#222222'if p['transfer']else'white',width=1)
  if w>4 and h>4:d.rounded_rectangle((x-w/2+2,y-h/2+2,x+w/2-2,y+h/2-2),radius=max(1,min(w,h)/2-2),fill=colors[p['lines'][0]])
 l=labels[s['id']];a={'start':'ls','middle':'ms','end':'rs'}[l['anchor']];x,y=l['x'],l['y']
 d.text((x,y),s['name'],font=zh[l['fontSize']],anchor=a,fill='#222222')
 for i,row in enumerate(wrapped(english[s['id']],l.get('englishLineLength',24))):d.text((x,y+9*(i+1)),row,font=en,anchor=a,fill='#222222')
im.save(ROOT/'scripts/review/label-layout-review.png')
im.crop((2350,1450,3250,2050)).resize((1800,1200)).save(ROOT/'scripts/review/label-layout-core-review.png')
print('Suggestions',len(suggestions),'label overlaps',len(before['labelOverlapPairs']),'->',len(after['labelOverlapPairs']),'obstacle hits',len(before['obstacleRectangleOverlaps']),'->',len(after['obstacleRectangleOverlaps']))
