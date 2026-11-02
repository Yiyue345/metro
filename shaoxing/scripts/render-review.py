"""Render a source-scale geometry/label review without a browser dependency."""
from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'scripts/review').mkdir(exist_ok=True)
sys.path.insert(0,str(ROOT.parent/'shenzhen/.ocr-deps'))
from PIL import Image,ImageDraw,ImageFont
read=lambda p:json.loads((ROOT/p).read_text(encoding='utf-8'))
symbols=read('data/station-symbols.json');labels=read('data/station-labels.json');english=read('data/station-english.json')
colors=read('data/line-colors.json');paths=read('scripts/route-polylines.json')
im=Image.new('RGB',(2140,1810),'white');d=ImageDraw.Draw(im)
zh=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14);en=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',8)
for key,points in paths.items():d.line([tuple(p) for p in points],fill=colors[key.split('-')[0]],width=8,joint='curve')
boxes=[]
for name,symbol in symbols.items():
 for p in symbol['parts']:
  x,y=p['x'],p['y'];w,h=p['width'],p['height'];d.rounded_rectangle((x-w/2,y-h/2,x+w/2,y+h/2),radius=5,fill='white',outline='#222222' if p['transfer'] else 'white',width=1)
  d.rounded_rectangle((x-w/2+2,y-h/2+2,x+w/2-2,y+h/2-2),radius=3,fill='#aaaaaa' if p.get('planned') else colors[p['lines'][0]])
 l=labels[name];x,y=l['x'],l['y'];anchor={'start':'ls','middle':'ms','end':'rs'}[l['anchor']]
 ink='#999999' if name=='张墅' else '#222222'
 d.text((x,y),name,font=zh,fill=ink,anchor=anchor);boxes.append((name,'zh',d.textbbox((x,y),name,font=zh,anchor=anchor)))
 chunks=[]
 for word in english[name].split(' '):
  if chunks and len(chunks[-1])+len(word)<l.get('englishLineLength',24):chunks[-1]+=' '+word
  else:chunks.append(word)
 for index,row in enumerate(chunks):
  pos=(x,y+9*(index+1));d.text(pos,row,font=en,fill=ink,anchor=anchor);boxes.append((name,'en',d.textbbox(pos,row,font=en,anchor=anchor)))
overlaps=[]
for i,(name,kind,a) in enumerate(boxes):
 for other,otherkind,b in boxes[i+1:]:
  if name==other:continue
  if min(a[2],b[2])>max(a[0],b[0])+1 and min(a[3],b[3])>max(a[1],b[1])+1:overlaps.append([name,kind,other,otherkind])
im.save(ROOT/'scripts/review/diagram-review.png')
(ROOT/'scripts/label-collision-report.json').write_text(json.dumps({'textOverlaps':overlaps,'font':'Microsoft YaHei 14px / Arial 8px','scope':'source-scale raster review; native browser typography still requires a page check'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Text overlaps:',overlaps)
