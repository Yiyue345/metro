"""Rebuild the reviewed May 2026 Shaoxing map in source-image pixel space.

Approximate review anchors select the nearest matching station-color component;
they are not geographic coordinates. English names are transcribed from the image.
"""
from pathlib import Path
import sys,json,math,re
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'shenzhen/.ocr-deps'))
sys.path.insert(0,str(ROOT.parent/'shenzhen/scripts'))
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
from transfer_symbol_geometry import measure_transfer_symbols
DATA=ROOT/'data';SCRIPTS=ROOT/'scripts'
def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
image=np.asarray(Image.open(ROOT/'public/maps/shaoxing-reference-pure.jpg').convert('RGB'))
colors={'1':'#bd0044','2':'#293d86'}
# Source crop origin (3600,2570); reviewed centers below initially measured on
# the same source at crop y=2600, hence the explicit +30 vertical correction.
review=[
('姑娘桥',170,30,'Guniangqiao'),('衙前',331,106,'Yaqian'),('杨汛桥',362,231,'Yangxunqiao'),
('前梅',522,362,'Qianmei'),('钱清',622,375,'Qianqing'),('西沙路',706,405,'Xisha Road'),
('临杭大道',785,450,'Linhang Avenue'),('鉴水路',872,524,'Jianshui Road'),('越州大道',1000,591,'Yuezhou Avenue'),
('中国轻纺城',1054,627,'China Textile City'),('明珠广场',1089,645,'Mingzhu Square'),('瓜渚湖',1163,679,'Guazhuhu'),
('镜水路',1232,717,'Jingshui Road'),('黄酒小镇',1333,787,'Huangjiu Town'),('张墅',1412,818,'Zhangshu'),
('奥体中心',1500,798,'Olympic Sports Center'),('梅山广场',1539,834,'Meishan Square'),('凤林',1564,915,'Fenglin'),
('大滩',1570,1002,'Datan'),('火车站',1564,1070,'Railway Station'),('城市广场',1562,1129,'City Square'),
('鲁迅故里',1558,1205,'Lu Xun Native Place'),('城南大道',1557,1305,'Chengnan Avenue'),
('凤凰山',1542,1391,'Fenghuangshan'),('劳家葑',1538,1458,'Laojiafeng'),('南池',1532,1539,'Nanchi'),
('栖湖',1530,1605,'Qihu'),('芳泉',1502,1674,'Fangquan'),
('绍兴一中',1323,726,'Shaoxing No.1 High School'),('湖西',1324,654,'Huxi'),('大庆寺',1325,590,'Daqingsi'),
('绍兴北站',1323,524,'Shaoxing North Railway Station'),('会展中心',1210,510,'Exhibition and Convention Center'),
('人民医院总院',1439,871,"People's Hospital General Hospital"),('后墅路',1609,835,'Houshu Road'),
('袍谷',1673,836,'Paogu'),('袍中路',1734,835,'Paozhong Road'),('洋泾湖',1818,838,'Yangjinghu'),
('恂南',1878,841,'Xunnan'),('豆姜',1940,851,'Doujiang'),('檀渎',2020,876,'Tandu')]
main=[x[0] for x in review[:28] if x[0]!='张墅']
branch=['黄酒小镇','绍兴一中','湖西','大庆寺','绍兴北站','会展中心']
second=['人民医院总院','梅山广场','后墅路','袍谷','袍中路','洋泾湖','恂南','豆姜','檀渎']
roster={'edition':'2026.05','source':'User supplied Hangzhou metropolitan railway operating map, May 2026','aliases':{},'lines':[{'id':'1','name':'1号线','stations':list(dict.fromkeys(main+branch)),'paths':[main,branch]},{'id':'2','name':'2号线','stations':second,'paths':[second]}]}
write(DATA/'official-roster.json',roster)
ocr=json.loads((SCRIPTS/'labels-rapid.json').read_text(encoding='utf-8'))
nodes=[]
for line,color in colors.items():
 target=np.array([int(color[i:i+2],16) for i in [1,3,5]])
 mask=(np.linalg.norm(image.astype(float)-target,axis=2)<48).astype(np.uint8)
 count,_,stats,centers=cv2.connectedComponentsWithStats(mask,8)
 for i in range(1,count):
  x,y,w,h,a=map(int,stats[i]);cx,cy=centers[i]
  if 2<=w<=18 and 2<=h<=18 and 3<=a<=180:nodes.append({'x':round(cx,2),'y':round(cy,2),'line':line,'bounds':[x,y,w,h]})
write(SCRIPTS/'node-candidates.json',nodes)
symbols={};labels={};english={};stations=[];planned=[];checked=[]
for name,x,y,en in review:
 y+=30;lineids=[l['id'] for l in roster['lines'] if name in l['stations']]
 if name=='张墅':lineids=['1']
 nearby=[n for n in nodes if n['line'] in lineids and math.dist((n['x'],n['y']),(x,y))<9]
 if nearby and name not in ['姑娘桥','黄酒小镇','梅山广场','张墅']:
  node=min(nearby,key=lambda n:math.dist((n['x'],n['y']),(x,y)));x,y=node['x'],node['y']
 aliases={'人民医院总院':['镜湖医院'],'湖西':['越秀'],'火车站':['绍兴站']}.get(name,[])
 s={'id':name,'name':name,'lines':lineids,'aliases':aliases,'x':x,'y':y}
 if name=='张墅':s['status']='planned';planned.append(s)
 else:stations.append(s)
 transfer=name in ['姑娘桥','黄酒小镇','梅山广场']
 symbols[name]={'parts':[{'x':x,'y':y,'width':16 if transfer else 10,'height':10,'angle':-20 if name=='黄酒小镇' else 0,'transfer':transfer,'lines':lineids}]}
 if name=='张墅':symbols[name]['parts'][0]['planned']=True
 matches=[r for r in ocr if re.sub(r'[^\u4e00-\u9fff]','',r['text'])==name and math.dist(((r['box'][0]+r['box'][2])/2,(r['box'][1]+r['box'][3])/2),(x,y))<90]
 if matches:
  b=min(matches,key=lambda r:math.dist(((r['box'][0]+r['box'][2])/2,(r['box'][1]+r['box'][3])/2),(x,y)))['box']
  labels[name]={'x':round(b[0],2),'y':round(b[1]+12,2),'anchor':'start','fontSize':14}
 else:
  labels[name]={'x':x+9,'y':y+3,'anchor':'start','fontSize':14}
 english[name]=en
 checked.append({**s,'englishName':en,'label':labels[name],'anchorReview':'source-image station symbol center'})
# Original text is tight around the two interchanges; keep both label rows clear.
labels.update({'姑娘桥':{'x':170,'y':84,'anchor':'middle','fontSize':14,'englishLineLength':24},'黄酒小镇':{'x':1346,'y':818,'anchor':'start','fontSize':14},'奥体中心':{'x':1514,'y':809,'anchor':'end','fontSize':14},'梅山广场':{'x':1533,'y':847,'anchor':'end','fontSize':14},'会展中心':{'x':1205,'y':558,'anchor':'middle','fontSize':14},'芳泉':{'x':1502,'y':1726,'anchor':'middle','fontSize':14},'人民医院总院':{'x':1439,'y':921,'anchor':'middle','fontSize':14}})
# OCR boxes sometimes include the adjacent ring. Ensure right-side labels and
# their English rows clear station symbols and the rail stroke.
right=['衙前','杨汛桥','凤林','大滩','火车站','城市广场','鲁迅故里','城南大道','凤凰山','劳家葑','南池','栖湖','绍兴一中','湖西','大庆寺']
for s in stations:
 if s['id'] in right:labels[s['id']]={'x':round(s['x']+11,2),'y':round(s['y']+3,2),'anchor':'start','fontSize':14}
labels['越州大道'].update(x=1007,y=603,anchor='start')
labels['中国轻纺城'].update(x=1048,y=640,anchor='start')
labels['明珠广场'].update(x=1095,y=667,anchor='start')
labels['奥体中心'].update(x=1510,y=807,anchor='end')
labels['黄酒小镇'].update(x=1346,y=816,anchor='start')
labels['绍兴北站'].update(x=1335,y=541,anchor='start')
labels['人民医院总院']['englishLineLength']=21
labels['张墅'].update(x=1412,y=872,anchor='middle')
for s in checked:s['label']=labels[s['id']]
symbols,_=measure_transfer_symbols(image,symbols)
for name,value in [('line-colors.json',colors),('station-symbols.json',symbols),('station-labels.json',labels),('station-english.json',english),('planned-stations.json',planned),('basemap.json',{'base':'https://tiles.versatiles.org','tileset':'https://tiles.versatiles.org/tiles/osm/tiles.json','theme':'muted','attribution':'<a href="https://versatiles.org/">© VersaTiles</a>','maxZoom':14}),('transport-transfers.json',{'火车站':[{'mode':'rail','destination':'绍兴站','access':'direct','railways':['萧甬铁路']}],'绍兴北站':[{'mode':'highSpeedRail','destination':'绍兴北站','access':'direct','railways':['杭甬高速铁路','杭台高速铁路']}]})]:write(DATA/name,value)
for name,value in [('visited-stations.json',[]),('station-notes.json',{})]:
 if not (DATA/name).exists():write(DATA/name,value)
header="export interface Station { id: string; name: string; x: number; y: number; lines: string[]; aliases?: string[]; status?: 'planned' }\n"
header+='export const plannedStations: Station[] = '+json.dumps(planned,ensure_ascii=False)+';\n'
header+="export interface MetroLine { id: string; name: string; color: string }\nexport const mapMeta = { width: 2140, height: 1810, image: '/shaoxing/maps/shaoxing-reference.jpg', edition: '2026.05' };\n"
header+='export const lines: MetroLine[] = '+json.dumps([{'id':k,'name':k+'号线','color':v} for k,v in colors.items()],ensure_ascii=False)+';\n'
header+='export const stations: Station[] = '+json.dumps(stations,ensure_ascii=False,indent=2)+';\n'
(DATA/'stations.ts').write_text(header,encoding='utf-8')
write(SCRIPTS/'reference-roster.json',{'reference':roster['source'],'crop':[3600,2570,5740,4380],'linePaths':{'1':[main,branch],'2':[second]},'stations':checked})
overlay=Image.fromarray(image);draw=ImageDraw.Draw(overlay);font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14)
for s in stations+planned:
 x,y=s['x'],s['y'];draw.ellipse((x-9,y-9,x+9,y+9),outline='#00bb00',width=2)
overlay.save(SCRIPTS/'review/station-anchor-review.jpg',quality=96)
print(f'Built {len(stations)} operating stations, {len(planned)} deferred station, {len(symbols)} symbols.')
