"""Read-only source-image audit of interchange anchors; separate from overrides."""
from pathlib import Path
import sys,json,math
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'scripts/review').mkdir(exist_ok=True)
sys.path.insert(0,str(ROOT.parent/'shenzhen/.ocr-deps'))
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
im=Image.open(ROOT/'public/maps/hangzhou-reference-pure.jpg').convert('RGB');pixels=np.asarray(im)
draft=json.loads((ROOT/'scripts/hotspots-draft.json').read_text(encoding='utf-8'))
selected=[s for s in draft if len(s['lines'])>1 or s['id']=='姑娘桥']
contours,hierarchy=cv2.findContours((pixels.max(2)<105).astype('uint8'),cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
candidates=[]
for i,c in enumerate(contours):
 center,size,angle=cv2.minAreaRect(c);w,h=sorted(size,reverse=True);area=cv2.contourArea(c)
 if not (8<=h<=24 and 10<=w<=60 and area>60):continue
 x,y,bw,bh=cv2.boundingRect(c);cut=pixels[y:y+bh,x:x+bw];mask=np.zeros((bh,bw),np.uint8);cv2.drawContours(mask,[c-np.array([x,y])],-1,1,-1)
 colored=((cut.max(2).astype(float)-cut.min(2))>55)&(cut.min(2)<185)&(mask>0)
 if colored.sum()<8:continue
 candidates.append({'anchor':[round(center[0],2),round(center[1],2)],'size':[round(w,2),round(h,2)],'angle':round(angle,2),'colored':int(colored.sum()),'area':area})
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16);small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',12)
tilew,tileh=360,320;sheet=Image.new('RGB',(tilew*6,tileh*math.ceil(len(selected)/6)),'#eeeeee');d=ImageDraw.Draw(sheet)
found={}
for index,s in enumerate(selected):
 x,y=s['x'],s['y'];left,top=round(x)-80,round(y)-65;tile=im.crop((left,top,left+180,top+140)).resize((360,280));td=ImageDraw.Draw(tile)
 near=[c for c in candidates if math.dist(c['anchor'],(x,y))<70]
 found[s['id']]=near
 for j,c in enumerate(near):
  xx,yy=[(c['anchor'][k]-[left,top][k])*2 for k in (0,1)];td.ellipse((xx-14,yy-14,xx+14,yy+14),outline='#00cc00',width=2);td.text((xx+10,yy-12),str(j),font=small,fill='#008800')
 xx,yy=(x-left)*2,(y-top)*2;td.line((xx-10,yy,xx+10,yy),fill='#ff00ff',width=2);td.line((xx,yy-10,xx,yy+10),fill='#ff00ff',width=2)
 tx,ty=index%6*tilew,index//6*tileh;sheet.paste(tile,(tx,ty+40));d.text((tx+5,ty+3),f'{index}: {s["id"]}',fill='black',font=font)
sheet.save(ROOT/'scripts/review/interchange-anchor-audit.jpg',quality=95)
(ROOT/'scripts/interchange-anchor-candidates.json').write_text(json.dumps(found,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(len(selected),'interchanges;',len(candidates),'ring candidates')
