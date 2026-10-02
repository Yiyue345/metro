"""Convert source-backed AMap public subway GCJ-02 coordinates to WGS84.

Source snapshots are saved beside this script. Coordinates are never inferred
from schematic pixels; missing station matches fail the build.
"""
import json,math,re,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'scripts/amap-nanning-source.json'
def transform_lat(x,y):
    v=-100+2*x+3*y+.2*y*y+.1*x*y+.2*math.sqrt(abs(x))
    v+=(20*math.sin(6*x*math.pi)+20*math.sin(2*x*math.pi))*2/3
    v+=(20*math.sin(y*math.pi)+40*math.sin(y/3*math.pi))*2/3
    return v+(160*math.sin(y/12*math.pi)+320*math.sin(y*math.pi/30))*2/3
def transform_lon(x,y):
    v=300+x+2*y+.1*x*x+.1*x*y+.1*math.sqrt(abs(x))
    v+=(20*math.sin(6*x*math.pi)+20*math.sin(2*x*math.pi))*2/3
    v+=(20*math.sin(x*math.pi)+40*math.sin(x/3*math.pi))*2/3
    return v+(150*math.sin(x/12*math.pi)+300*math.sin(x/30*math.pi))*2/3
def forward(lat,lon):
    a,e=6378245.0,.00669342162296594323
    dlat,dlon=transform_lat(lon-105,lat-35),transform_lon(lon-105,lat-35)
    rad=lat/180*math.pi;magic=1-e*math.sin(rad)**2;root=math.sqrt(magic)
    return lat+dlat*180/((a*(1-e))/(magic*root)*math.pi),lon+dlon*180/(a/root*math.cos(rad)*math.pi)
def inverse(lat,lon):
    x,y=lat,lon
    for _ in range(30):
        gx,gy=forward(x,y);ex,ey=gx-lat,gy-lon;x-=ex;y-=ey
        if max(abs(ex),abs(ey))<1e-10:return round(x,7),round(y,7)
    raise ValueError('GCJ inverse failed')
def normalize(name):return re.sub(r'(?:地铁站|站)$','',name.strip())
source=json.loads(SOURCE.read_text(encoding='utf-8-sig'))
records=[{'name':s['n'],'id':s.get('poiid',s.get('si')),'location':{'lon':float(s['sl'].split(',')[0]),'lat':float(s['sl'].split(',')[1]),'crs':'gcj02'}} for line in source['l'] for s in line['st']]
byname={normalize(s['name']):s for s in records}
roster=json.loads((ROOT/'data/official-roster.json').read_text(encoding='utf-8'))
for line in roster['lines']:
    amapline=next(l for l in source['l'] if l['ln']==line['name'])
    assert {normalize(s['n']) for s in amapline['st']}=={normalize(n) for n in line['stations']},line['name']
stations=json.loads((ROOT/'data/stations.ts').read_text(encoding='utf-8').split('export const stations: Station[] = ')[1].rstrip(';\n'))
planned=json.loads((ROOT/'data/planned-stations.json').read_text(encoding='utf-8'))
aliases={'南职院':'南宁职业技术学院','长堽路':'长岗路'}
coordinates={};report=[];missing=[]
for station in stations+planned:
    name=station['name'];record=byname.get(normalize(name)) or byname.get(normalize(aliases.get(name,name)))
    if not record or not record.get('location'):missing.append(name);continue
    location=record['location'];lat,lon=location['lat'],location['lon'];crs=location.get('crs')
    assert 22.5<lat<23.2 and 108<lon<109,name
    if crs=='gcj02':lat,lon=inverse(lat,lon)
    else:assert crs in ['wgs84','WGS84'],{'name':name,'crs':crs}
    coordinates[station['id']]={'lat':lat,'lon':lon}
    report.append({'name':name,'sourceName':record['name'],'sourceId':record.get('id'),'sourceCRS':crs,'sourceLocation':location,'outputCRS':'WGS84','coordinate':coordinates[station['id']]})
(ROOT/'scripts/station-coordinates-report.json').write_text(json.dumps({'source':'https://map.amap.com/service/subway?srhdata=4501_drw_nanning.json','snapshot':'amap-nanning-source.json','snapshotSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'operatingRosterMatched':True,'stations':report,'missing':missing},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert not [s['name'] for s in stations if s['name'] in missing],missing
(ROOT/'data/station-coordinates.json').write_text(json.dumps(coordinates,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Converted {len(coordinates)} source-backed station coordinates to WGS84.')
