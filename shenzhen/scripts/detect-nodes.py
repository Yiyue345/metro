"""Find isolated station centers surrounded by the source map's white rings."""
from pathlib import Path
import sys,json
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'.ocr-deps'))
import cv2
import numpy as np
from PIL import Image
image=np.asarray(Image.open(root/'public/maps/shenzhen-reference.jpg').convert('RGB'))
hi=image.max(axis=2).astype(np.int16);lo=image.min(axis=2).astype(np.int16)
mask=(((hi-lo>27)&(lo<180))|((hi-lo<28)&(lo>95)&(hi<185))).astype(np.uint8)
count,labels,stats,centers=cv2.connectedComponentsWithStats(mask,8)
nodes=[]
for i in range(1,count):
    x,y,w,h,area=map(int,stats[i]);cx,cy=centers[i]
    if x<5 or y<5 or x+w>image.shape[1]-5 or y+h>image.shape[0]-5:continue
    if not(5<=w<=10 and 5<=h<=10 and 18<=area<=65 and area/(w*h)>.55 and .7<w/h<1.4):continue
    # Most ordinary stations have a colored disk, transfers an elongated disk.
    white=[]
    for angle in np.linspace(0,np.pi*2,24,endpoint=False):
        px=round(cx+(w/2+1.3)*np.cos(angle));py=round(cy+(h/2+1.3)*np.sin(angle))
        white.append(bool(lo[py,px]>200))
    ring=sum(white)/24
    if ring<.55: continue
    nodes.append({'x':round(cx,1),'y':round(cy,1),'w':w,'h':h,'area':area,'ring':round(ring,3),'type':'ordinary'})
contours,hierarchy=cv2.findContours((hi<110).astype(np.uint8),cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
for i,c in enumerate(contours):
    child=int(hierarchy[0,i,2])
    if child<0:continue
    x,y,w,h=cv2.boundingRect(c)
    if not (8<=w<=65 and 8<=h<=65):continue
    hole=contours[child]
    area=cv2.contourArea(hole)
    if area<12:continue
    moments=cv2.moments(hole)
    if not moments['m00']:continue
    cx=moments['m10']/moments['m00'];cy=moments['m01']/moments['m00']
    cut=image[max(0,int(cy)-2):int(cy)+3,max(0,int(cx)-2):int(cx)+3].astype(float)
    if np.mean(cut.max(2)-cut.min(2))<15:continue
    nodes.append({'x':round(cx,1),'y':round(cy,1),'w':w,'h':h,'area':area,'ring':1.0,'type':'transfer'})
(root/'scripts/node-candidates.json').write_text(json.dumps(nodes,indent=2),encoding='utf-8')
print('Node candidates:',len(nodes))
for name,xy in {'老街':(3196,3087),'少年宫':(2727,3057),'会展中心':(2729,3185),'前海湾':(1334,3158)}.items():
    best=sorted(nodes,key=lambda n:(n['x']-xy[0])**2+(n['y']-xy[1])**2)[:2]
    print(name,best)
