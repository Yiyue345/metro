"""Rebuild cropped image station geometry from the checked roster and local OCR."""
from pathlib import Path
import sys,json,re,math,collections
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'shenzhen/.ocr-deps'))
import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageFont
DATA=ROOT/'data'; SCRIPTS=ROOT/'scripts'
ROSTER=[
('1','石埠 南职院 鹏飞路 西乡塘客运站 民族大学 清川 动物园 鲁班路 广西大学 白苍岭 火车站 朝阳广场 新民路 民族广场 麻村 南湖 金湖广场 会展中心 万象城 东盟商务区 凤岭 埌东客运站 百花岭 佛子岭 火车东站'),
('2','西津 安吉客运站 苏卢 三十三中 秀厢 明秀路 火车站 朝阳广场 南宁剧场 福建园 亭洪路 石柱岭 江南客运站 大沙田 建设路 石子塘 金象 玉洞 东风路 玉岭路 那福路 平良立交 坛泽'),
('3','科园大道 创业路 安吉客运站 北湖北路 秀峰路 邕武路 大鸡村 兴桂路 小鸡村 东沟岭 长堽路 东葛路 滨湖路 金湖广场 埌西 青竹立交 青秀山 市博物馆 总部基地 广西规划馆 庆歌路 五象湖 平良立交'),
('4','洪运路 那历村 那洪立交 金阳路 通源路 大沙田 金象大道 五象岭 玉象路 总部基地 飞龙路 体育中心西 体育中心东 良庆大桥南 良庆圩 楞塘村 清平坡 龙岗'),
('5','国凯大道 那洪立交 金凯路 江南公园 周家坡 五一立交 新秀公园 广西大学 秀灵路 明秀路 北湖南路 虎邱 狮山公园 小鸡村 邕宾立交 降桥 金桥客运站')]
roster={'edition':'2026.01','source':'User supplied 01.公开版-南宁地铁线路3.0-a运营版（至2026年01月）.jpg; checked against white-background counterpart','aliases':{},'lines':[{'id':i,'name':f'{i}号线','stations':s.split()} for i,s in ROSTER]}
def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
write(DATA/'official-roster.json',roster)
directory=next(Path('E:/BaiduNetdiskDownload').glob('27.*'))
crop=(620,60,2680,1420)
source=next(directory.glob('*纯白底.jpg'))
pure=Image.open(source).convert('RGB').crop(crop)
pure.save(ROOT/'public/maps/nanning-reference-pure.jpg',quality=96)
Image.open(next(p for p in directory.glob('*运营版*.jpg') if '纯白' not in p.name)).convert('RGB').crop(crop).save(ROOT/'public/maps/nanning-reference.jpg',quality=96)
write(DATA/'source-meta.json',{'edition':'2026.01','sourceDimensions':[3220,2300],'crop':list(crop),'width':pure.width,'height':pure.height,'reference':source.name,'coordinateSpace':'cropped reference pixels'})
image=np.asarray(pure);hi=image.max(2).astype(np.int16);lo=image.min(2).astype(np.int16)
# Tiny isolated color disks and black-ring capsules are measured independently.
mask=((hi-lo>27)&(lo<200)).astype(np.uint8)
count,_,stats,centers=cv2.connectedComponentsWithStats(mask,8)
nodes=[]
for i in range(1,count):
    x,y,w,h,area=map(int,stats[i]);cx,cy=centers[i]
    if not(4<=w<=11 and 4<=h<=11 and 10<=area<=85 and area/(w*h)>.5 and .6<w/h<1.7):continue
    if x<6 or y<6 or x+w>pure.width-6 or y+h>pure.height-6:continue
    white=sum(lo[round(cy+(h/2+1.6)*math.sin(a)),round(cx+(w/2+1.6)*math.cos(a))]>205 for a in np.linspace(0,math.pi*2,24,endpoint=False))/24
    if white<.5:continue
    rgb=np.median(image[y:y+h,x:x+w][mask[y:y+h,x:x+w]>0],axis=0)
    nodes.append({'x':round(cx,2),'y':round(cy,2),'width':10.5,'height':10.5,'angle':0,'transfer':False,'rgb':rgb.tolist()})
contours,hierarchy=cv2.findContours((hi<115).astype(np.uint8),cv2.RETR_TREE,cv2.CHAIN_APPROX_NONE)
for i,outer in enumerate(contours):
    child=int(hierarchy[0,i,2]);x,y,w,h=cv2.boundingRect(outer)
    if child<0 or not(8<=w<=50 and 8<=h<=50):continue
    hole=contours[child];m=cv2.moments(hole)
    if m['m00']<18:continue
    cx=m['m10']/m['m00'];cy=m['m01']/m['m00'];cut=image[round(cy)-2:round(cy)+3,round(cx)-2:round(cx)+3].astype(float)
    if np.mean(cut.max(2)-cut.min(2))<20:continue
    pts=hole[:,0,:].astype(float);eigval,eigvec=np.linalg.eigh(np.cov(pts.T));axis=eigvec[:,1];perp=np.array([-axis[1],axis[0]])
    width=float(np.ptp(pts@axis))+4.5;height=float(np.ptp(pts@perp))+4.5;angle=math.degrees(math.atan2(axis[1],axis[0]))%180
    if width/height<1.16:width=height=(width+height)/2;angle=0
    nodes.append({'x':round(cx,2),'y':round(cy,2),'width':round(width,2),'height':round(height,2),'angle':round(angle,2),'transfer':True,'rgb':np.median(cut.reshape(-1,3),axis=0).tolist()})
write(SCRIPTS/'node-candidates.json',nodes)
# Ordinary disks touching antialiased track pixels can fail isolation.
# Centers checked against enlarged source details (Nanhu, Fujianyuan,
# Langdong Coach Station and Sports Center West).
for x,y,rgb in [(1305.7,601.7,[46,153,73]),(962.0,728.5,[246,66,72]),(1680.0,611.5,[46,153,73]),(1502.0,952.5,[208,221,1])]:
    nodes.append({'x':x,'y':y,'width':10.5,'height':10.5,'angle':0,'transfer':False,'rgb':rgb})
records=json.loads((SCRIPTS/'labels-rapid.json').read_text(encoding='utf-8'))
fixes={'长堤路':'长堽路','琅西':'埌西'}
def chinese(v):return fixes.get(''.join(re.findall(r'[\u4e00-\u9fff]',v)),''.join(re.findall(r'[\u4e00-\u9fff]',v)))
def distance(n,b):l,t,r,bt=b;return math.hypot(max(l-n['x'],n['x']-r,0),max(t-n['y'],n['y']-bt,0))
byname={}
for l in roster['lines']:
    for name in l['stations']:byname.setdefault(name,{'id':name,'name':name,'lines':[],'aliases':[]})['lines'].append(l['id'])
draft=[];missing=[]
for name,item in byname.items():
    labels=[r for r in records if chinese(r['text'])==name and 7<r['box'][3]-r['box'][1]<25]
    candidates=[]
    for label in labels:
        for node in nodes:
            d=distance(node,label['box'])
            if d>45 or node['transfer']!=(len(item['lines'])>1):continue
            b=label['box'];inside=b[0]+3<node['x']<b[2]-3 and b[1]+1<node['y']<b[3]-1
            candidates.append((d+(30 if inside else 0)-label['confidence']*2,node,label))
    if not candidates:missing.append(name);continue
    score,node,label=min(candidates,key=lambda c:c[0])
    draft.append({**item,'x':node['x'],'y':node['y'],'symbol':{k:v for k,v in node.items() if k!='rgb'},'labelBox':label['box'],'nodeScore':round(score,1),'candidates':[{'score':round(s,1),'x':n['x'],'y':n['y']} for s,n,r in sorted(candidates,key=lambda c:c[0])[:3]]})
write(SCRIPTS/'hotspots-draft.json',draft);write(SCRIPTS/'missing-stations.json',missing)
positions={}
for station in draft:
    position=(station['x'],station['y'])
    assert position not in positions, f"Duplicate station position: {positions.get(position)} / {station['id']}"
    positions[position]=station['id']
print('Roster',len(byname),'appearances',sum(len(l['stations']) for l in roster['lines']),'matched',len(draft),'missing',missing,flush=True)
colors={}
for line in roster['lines']:
    values=[min(nodes,key=lambda n:math.hypot(n['x']-s['x'],n['y']-s['y']))['rgb'] for s in draft if s['lines']==[line['id']]]
    rgb=np.median(values,axis=0).round().astype(int);colors[line['id']]='#'+''.join(f'{v:02x}' for v in rgb)
write(DATA/'line-colors.json',colors)
if missing:sys.exit(1)
symbols={s['id']:{'parts':[{**s['symbol'],'lines':s['lines']}]} for s in draft}
labels={s['id']:{'x':round(s['labelBox'][0],2),'y':round(s['labelBox'][1]+13,2),'anchor':'start','fontSize':14} for s in draft}
for s in draft:
    l,t,r,b=s['labelBox'];x,y=s['x'],s['y'];label=labels[s['id']]
    # OCR sometimes absorbs the adjacent station disk as part of the first
    # Chinese glyph. Keep labels beside the ring, as in the reference map.
    if t-4<=y<=b+4 and l-3<=x<=l+16:label['x']=round(x+10,2)
    elif t-4<=y<=b+4 and r-16<=x<=r+3:
        label['x']=round(x-10,2);label['anchor']='end'
write(DATA/'station-symbols.json',symbols);write(DATA/'station-labels.json',labels)
english=json.loads((SCRIPTS/'station-english-reviewed.json').read_text(encoding='utf-8'))
assert set(english)==set(byname),{'missing':list(set(byname)-set(english)),'extra':list(set(english)-set(byname))}
write(DATA/'station-english.json',english)
planned=[{'id':'五象火车站','name':'五象火车站','status':'planned','x':1813.04,'y':1050.16,'lines':['4'],'aliases':[],'englishName':'Wuxiang Railway Station','label':{'x':1782.1,'y':1070.2,'anchor':'start','fontSize':14},'symbol':{'parts':[{'x':1813.04,'y':1050.16,'width':10.5,'height':10.5,'angle':0,'lines':['4'],'transfer':False,'planned':True}]}}]
write(DATA/'planned-stations.json',planned)
# Rebuilding source geometry must preserve user-maintained city settings.
for file,value in [('visited-stations.json',[]),('station-notes.json',{})]:
    if not (DATA/file).exists():write(DATA/file,value)
if not (DATA/'basemap.json').exists():
    basemap=json.loads((ROOT.parent/'shenzhen/src/data/basemap.json').read_text(encoding='utf-8'))
    basemap['maxZoom']=13
    write(DATA/'basemap.json',basemap)
header="import plannedData from './planned-stations.json';\nexport interface Station { id: string; name: string; x: number; y: number; lines: string[]; aliases?: string[]; status?: 'planned' }\nexport const plannedStations = plannedData as (Station & { status: 'planned'; englishName: string; label: { x: number; y: number; anchor: 'start' | 'middle' | 'end'; fontSize: number }; symbol: { parts: { x: number; y: number; width: number; height: number; angle: number; lines: string[]; transfer: boolean; planned: boolean }[] } })[];\nexport interface MetroLine { id: string; name: string; color: string }\nexport const mapMeta = { width: 2060, height: 1360, image: '/nanning/maps/nanning-reference.jpg', edition: '2026.01' };\n"
header+='export const lines: MetroLine[] = '+json.dumps([{'id':l['id'],'name':l['name'],'color':colors[l['id']]} for l in roster['lines']],ensure_ascii=False)+';\n'
header+='export const stations: Station[] = '+json.dumps([{k:v for k,v in s.items() if k in ['id','name','lines','aliases','x','y']} for s in draft],ensure_ascii=False,indent=2)+';\n'
(DATA/'stations.ts').write_text(header,encoding='utf-8')
overview=pure.copy();draw=ImageDraw.Draw(overview);font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',13)
for s in draft:
    x,y=s['x'],s['y'];draw.ellipse((x-8,y-8,x+8,y+8),outline='#ff00ff',width=2);draw.text((x+9,y+9),s['id'],fill='#8d008d',font=font)
overview.save(SCRIPTS/'review/station-overlay.jpg',quality=94)
