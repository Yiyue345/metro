"""Measure station ring geometry from the supplied 5950 x 4250 map.

Uses OpenCV contour hierarchy and the inner hole's principal axis. Connected
black rings with multiple holes (e.g. 上屋) remain separate circular parts.
Coordinates and SVG rotation angles are absolute source-image coordinates.
"""
from pathlib import Path
import sys,json,math
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.ocr-deps'))
import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageFont

text=(ROOT/'src/data/stations.ts').read_text(encoding='utf-8')
stations=json.loads(text.split('export const stations: Station[] = ')[1].rstrip(';\n'))
image=np.asarray(Image.open(ROOT/'public/maps/shenzhen-reference.jpg').convert('RGB'))
hi=image.max(2)
contours,hierarchy=cv2.findContours((hi<110).astype(np.uint8),cv2.RETR_TREE,cv2.CHAIN_APPROX_NONE)
hierarchy=hierarchy[0]
rings=[]
for i,outer in enumerate(contours):
    child=int(hierarchy[i,2])
    if child<0:continue
    bx,by,bw,bh=cv2.boundingRect(outer)
    if not(8<=bw<=70 and 8<=bh<=70):continue
    children=[]
    while child>=0:
        hole=contours[child];area=cv2.contourArea(hole)
        if area>12:
            pts=hole[:,0,:].astype(float)
            m=cv2.moments(hole)
            if m['m00']:
                x=m['m10']/m['m00'];y=m['m01']/m['m00']
                cut=image[max(0,int(y)-2):int(y)+3,max(0,int(x)-2):int(x)+3].astype(float)
                if np.mean(cut.max(2)-cut.min(2))>15:
                    eigval,eigvec=np.linalg.eigh(np.cov(pts.T))
                    axis=eigvec[:,1]
                    angle=math.degrees(math.atan2(axis[1],axis[0]))%180
                    perpendicular=np.array([-axis[1],axis[0]])
                    width=np.ptp(pts@axis)+4.5;height=np.ptp(pts@perpendicular)+4.5
                    # Near circles have no meaningful orientation.
                    if width/height<1.16:
                        width=height=(width+height)/2;angle=0
                    children.append({'x':round(x,1),'y':round(y,1),'width':round(width,1),'height':round(height,1),'angle':round(angle,1),'transfer':True})
        child=int(hierarchy[child,0])
    if children:rings.append({'x':bx+bw/2,'y':by+bh/2,'parts':children,'bounds':[bx,by,bw,bh]})

nodes=json.loads((ROOT/'scripts/node-candidates.json').read_text(encoding='utf-8'))
ordinary=[n for n in nodes if n['type']=='ordinary']
def circular(x,y,lines):
    return {'x':round(x,1),'y':round(y,1),'width':10.5,'height':10.5,'angle':0,'lines':lines,'transfer':False}

result={};report=[]
for station in stations:
    x,y=station['x'],station['y'];lines=station['lines']
    candidates=sorted(rings,key=lambda r:min((p['x']-x)**2+(p['y']-y)**2 for p in r['parts']))
    best=candidates[0]
    distance=min(math.hypot(p['x']-x,p['y']-y) for p in best['parts'])
    if distance < (22 if len(lines)>1 else 8):
        parts=[{**p,'lines':lines} for p in best['parts']]
        status='contour'
    else:
        parts=[circular(x,y,lines)];status='circle'
    result[station['id']]={'parts':parts}
    report.append({'name':station['name'],'method':status,'nearestContourDistance':round(distance,1),'parts':len(parts)})

# These stations explicitly draw separated platforms in the reference map.
# The four-line Chegongmiao interchange is a rounded square in the reference.
result['车公庙']['parts'][0]['cornerRadius']=4.5
# Normalize Hongshan's undersized extracted capsule to the nearby interchange height.
hongshan=result['红山']['parts'][0]
hongshan['width']=round(hongshan['width'] * 11.7 / hongshan['height'], 1)
hongshan['height']=11.7

def nearest_ring(x,y):
    return min([p for r in rings for p in r['parts']],key=lambda p:(p['x']-x)**2+(p['y']-y)**2)

result['福民']={'parts':[{**nearest_ring(2761,3291),'lines':['4','7']},{**nearest_ring(2790,3271),'lines':['10']}],
    'connections':[{'x1':2761,'y1':3291,'x2':2790,'y2':3271,'points':'2761,3291 2784.5,3291 2784.5,3271 2790,3271','kind':'corridor'}]}

# 9 and 11 use two ordinary white circles with a short out-of-station link.
result['红岭南']={'parts':[circular(3101.2,3136,['9']),circular(3107,3144.5,['11'])]}

# 湖贝 is another pair of adjacent circles, not a shared interchange capsule.
result['湖贝']={'parts':[circular(3277,3089,['2']),circular(3271.3,3097.4,['5'])]}

# 光明's pale grey outer ring is below the contrast of the black contour pass.
# The 140-luminance local contour bounds are x=1734,y=999,w=19,h=14.
result['光明']={'parts':[{'x':1743.5,'y':1005.5,'width':19,'height':14,'angle':0,'lines':['6','6b'],'transfer':True}]}

# The two terminal circles are red and pink and do not have a shared black ring.
result['福田口岸']={'parts':[circular(2799.5,3358.2,['4']),circular(2783.3,3365.5,['10'])],
    'connections':[{'x1':2799.5,'y1':3358.2,'x2':2783.3,'y2':3365.5,'kind':'out-of-station'}]}

# Associate each hole in 上屋's figure-eight ring with its own line.
result['上屋']={'parts':[
    {'x':1685.5,'y':1767.5,'width':13,'height':13,'angle':0,'transfer':True,'lines':['6']},
    {'x':1692.5,'y':1765.5,'width':13,'height':13,'angle':0,'transfer':True,'lines':['13']}
]}

(ROOT/'src/data/station-symbols.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'scripts/station-symbols-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'scripts/ring-contours.json').write_text(json.dumps(rings,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'stations':len(result),'contourStations':sum(r['method']=='contour' for r in report),'multiPart':[name for name,v in result.items() if len(v['parts'])>1]},ensure_ascii=False))
for name in ['上屋','福民','福田口岸','红岭南','岗厦北','黄木岗','大运','深圳北']:
    print(name,json.dumps(result[name],ensure_ascii=False))

# Validate every exported station/line association, bounds, and finite dimensions.
assert set(result)=={s['id'] for s in stations}
for station in stations:
    parts=result[station['id']]['parts']
    assert set(line for part in parts for line in part['lines'])==set(station['lines']),station['id']
    for part in parts:
        assert 0<=part['x']<=5950 and 0<=part['y']<=4250
        assert 0<part['height']<=part['width']<70
        assert all(math.isfinite(part[k]) for k in ['x','y','width','height','angle'])
print('Validated all 351 station IDs, line associations and geometry bounds.')
