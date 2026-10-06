"""Extract Dongguan metro only; the checked roster excludes every intercity line."""
from pathlib import Path
import sys,json,re,math
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'shenzhen/.ocr-deps'))
import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageFont
DATA=ROOT/'data'; SCRIPTS=ROOT/'scripts'
def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
ROSTER=[('1','东莞西站 厚德 昌平 人民医院 曲海 坝头 元美 中心广场 市民中心 立新 东城南站 同沙公园 牛山 连平 大岭山 金桔 广东医大 松山湖 松佛 大朗 荔香公园 凤山 黄江 黄牛埔 梅塘'),('2','东莞火车站 茶山 榴花公园 下桥 天宝 东城 旗峰公园 市民中心 西平 蛤地 陈屋 寮厦 珊美 展览中心 虎门火车站')]
roster={'edition':'2026.08','source':'User supplied Dongguan 2026.08 operating reference; metro only, no intercity','aliases':{},'lines':[{'id':i,'name':f'{i}号线','stations':s.split()} for i,s in ROSTER]}
write(DATA/'official-roster.json',roster)
pure=Image.open(ROOT/'public/maps/dongguan-reference-pure.jpg').convert('RGB')
image=np.asarray(pure);hi=image.max(2).astype(np.int16);lo=image.min(2).astype(np.int16)
mask=((hi-lo>45)&(lo<190)).astype(np.uint8)
count,_,stats,centers=cv2.connectedComponentsWithStats(mask,8)
nodes=[]
for i in range(1,count):
    x,y,w,h,area=map(int,stats[i]);cx,cy=centers[i]
    if not(3<=w<=16 and 3<=h<=16 and 5<=area<=180 and .5<w/h<2):continue
    rgb=np.median(image[y:y+h,x:x+w][mask[y:y+h,x:x+w]>0],axis=0)
    nodes.append({'x':round(cx,2),'y':round(cy,2),'rgb':rgb.tolist()})
write(SCRIPTS/'node-candidates.json',nodes)
records=json.loads((SCRIPTS/'labels-rapid.json').read_text(encoding='utf-8'))
manual_boxes={'市民中心':[758,460,811,475],'西平':[685,556,713,571],'寮厦':[309,870,338,884]}
colors={'1':'#398db8','2':'#e60012'}
draft=[]
for line in roster['lines']:
  rgb=np.array([int(colors[line['id']][i:i+2],16) for i in [1,3,5]])
  for name in line['stations']:
    if any(s['id']==name for s in draft):
      next(s for s in draft if s['id']==name)['lines'].append(line['id']);continue
    labels=[r for r in records if ''.join(re.findall(r'[\u4e00-\u9fff]',r['text']))==name and 7<r['box'][3]-r['box'][1]<26]
    if name in manual_boxes:labels=[{'box':manual_boxes[name],'confidence':1}]
    candidates=[]
    for label in labels:
      l,t,r,b=label['box']
      for node in nodes:
        if np.linalg.norm(np.array(node['rgb'])-rgb)>85:continue
        d=math.hypot(max(l-node['x'],node['x']-r,0),max(t-node['y'],node['y']-b,0))
        if d<40:candidates.append((d,node,label))
    if name=='市民中心': candidates=[(0,{'x':752,'y':475}, {'box':manual_boxes[name]})]
    if not candidates:print('MISSING',name,flush=True);continue
    d,n,label=min(candidates,key=lambda c:c[0])
    draft.append({'id':name,'name':name,'lines':[line['id']],'aliases':[],'x':n['x'],'y':n['y'],'labelBox':label['box']})
write(SCRIPTS/'hotspots-draft.json',draft)
print('Matched',len(draft),'of 39',flush=True)
assert len(draft)==39
assert len({(s['x'],s['y']) for s in draft})==39,'Duplicate station coordinates'
symbols={s['id']:{'parts':[{'x':s['x'],'y':s['y'],'width':14 if len(s['lines'])>1 else 10.5,'height':10.5,'angle':35 if len(s['lines'])>1 else 0,'transfer':len(s['lines'])>1,'lines':s['lines']}]} for s in draft}
labels={}
for s in draft:
    l,t,r,b=s['labelBox'];x,y=s['x'],s['y']
    label={'x':round(l,2),'y':round(t+13,2),'anchor':'start','fontSize':14}
    if t-4<=y<=b+4 and l-4<=x<=l+17:label['x']=round(x+10,2)
    labels[s['id']]=label
english=dict(zip(ROSTER[0][1].split(),['Dongguanxi Railway Station','Houde','Changping',"People’s Hospital",'Quhai','Batou','Yuanmei','Central Square','Civic Center','Lixin','Dongchengnan Railway Station','Tongsha Park','Niushan','Lianping','Dalingshan','Jinju','Guangdong Medical University','Songshan Lake','Songfo','Dalang','Lixiang Park','Fengshan','Huangjiang','Huangniupu','Meitang']))
english.update(dict(zip(ROSTER[1][1].split(),['Dongguan Railway Station','Chashan','Liuhua Park','Xiaqiao','Tianbao','Dongcheng','Qifeng Park','Civic Center','Xiping','Gedi','Chenwu','Liaoxia','Shanmei','Exhibition Center','Humen Railway Station'])))
for name,value in [('line-colors.json',colors),('station-symbols.json',symbols),('station-labels.json',labels),('station-english.json',english),('planned-stations.json',[])]:write(DATA/name,value)
for name,value in [('visited-stations.json',[]),('station-notes.json',{}),('basemap.json',{'base':'https://tiles.versatiles.org','tileset':'https://tiles.versatiles.org/tiles/osm/tiles.json','theme':'muted','attribution':'<a href="https://versatiles.org/">© VersaTiles</a>','maxZoom':13})]:
    if not (DATA/name).exists():write(DATA/name,value)
header="export interface Station { id: string; name: string; x: number; y: number; lines: string[]; aliases?: string[]; status?: 'planned' }\nexport const plannedStations: Station[] = [];\nexport interface MetroLine { id: string; name: string; color: string }\nexport const mapMeta = { width: 2070, height: 1500, image: '/dongguan/maps/dongguan-reference.jpg', edition: '2026.08' };\n"
header+='export const lines: MetroLine[] = '+json.dumps([{'id':l['id'],'name':l['name'],'color':colors[l['id']]} for l in roster['lines']],ensure_ascii=False)+';\n'
header+='export const stations: Station[] = '+json.dumps([{k:v for k,v in s.items() if k!='labelBox'} for s in draft],ensure_ascii=False,indent=2)+';\n'
(DATA/'stations.ts').write_text(header,encoding='utf-8')
overview=pure.copy();draw=ImageDraw.Draw(overview);font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',15)
for s in draft:
    x,y=s['x'],s['y'];draw.ellipse((x-9,y-9,x+9,y+9),outline='#ff00ff',width=2);draw.text((x+10,y+10),s['id'],fill='#8d008d',font=font)
overview.save(SCRIPTS/'review/station-overlay.jpg',quality=95)
