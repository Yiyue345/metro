"""Build image-coordinate hotspots from the supplied map and Windows OCR tiles.
Run with the bundled Python (Pillow and NumPy); see DATA_NOTES.md.
"""
from pathlib import Path
import json, re, math
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(r'E:\BaiduNetdiskDownload\04.深圳地铁3.0 公开免费版（更新至2026.09）\01.公开版-深圳地铁线路3.0-a运营版（至2026年09月）-纯色底.jpg')
records=[]
rapid=json.loads((ROOT/'scripts/labels-rapid.json').read_text(encoding='utf-8'))
node_candidates=json.loads((ROOT/'scripts/node-candidates.json').read_text(encoding='utf-8'))
node_candidates=[n for n in node_candidates if n['type']!='ordinary' or not any(a['box'][0]+9<n['x']<a['box'][2]-9 and a['box'][1]+1<n['y']<a['box'][3]-1 for a in rapid)]
label_corrections={'李松荫':'李松蓢','背':'嶂背','沙墨':'沙壆','ShenehenNorthStation':'深圳北','Minle':'民乐'}
for p in (ROOT/'scripts/ocr-clean-tiles').glob('*.png.json'):
    ox,oy=map(int,p.name.split('.')[0].split('_'))
    data=json.loads(p.read_text(encoding='utf-8-sig'))
    if abs(data.get('angle') or 0) > 1:
        print('Skipping skewed OCR tile', p.name, data['angle'])
        continue
    for line in data['lines']:
        words=line['words']; chars=[]
        for w in words:
            # The OCR engine emits a word per Chinese character. Retain geometry.
            for c in w['text']:
                if '\u4e00'<=c<='\u9fff': chars.append((c,w))
        if not chars: continue
        records.append({'text':''.join(c for c,w in chars),'chars':chars,'ox':ox,'oy':oy,'file':p.name})

def match_label(name):
    exact=[r['box'] for r in rapid if label_corrections.get(r['text'],''.join(re.findall(r'[\u4e00-\u9fff]',r['text'])))==name and r['confidence']>.65 and r['box'][1]<3950 and not (r['box'][0]>5000 and r['box'][1]>3450)]
    if exact: return exact
    candidates=[]
    for rec in records:
        idx=rec['text'].find(name)
        if idx<0:continue
        words=[w for c,w in rec['chars'][idx:idx+len(name)]]
        left=min(w['x'] for w in words)/3+rec['ox']; top=min(w['y'] for w in words)/3+rec['oy']
        right=max(w['x']+w['width'] for w in words)/3+rec['ox']; bottom=max(w['y']+w['height'] for w in words)/3+rec['oy']
        # Exclude title/legend. Chinese station labels are about 12 px high.
        if 6<bottom-top<22 and top<3950 and left<5900:
            candidates.append((left,top,right,bottom))
    return candidates

pixels=np.asarray(Image.open(SOURCE).convert('RGB'))
def find_node(box, transfer=False):
    l,t,r,b=box
    nearby=[]
    for node in node_candidates:
        x,y=node['x'],node['y']
        distance=math.hypot(max(l-x,x-r,0),max(t-y,y-b,0))
        if distance>(35 if transfer else 18) or l+9<=x<=r-9 and t<=y<=b:continue
        penalty=18 if transfer and node['type']!='transfer' else 0
        score=100-distance-penalty
        nearby.append((x,y,score))
    if nearby:
        x,y,score=max(nearby,key=lambda n:n[2])
        return x,y,round(score,1)
    l,t,r,b=box; x0=max(0,int(l)-55);y0=max(0,int(t)-45); x1=min(5950,int(r)+35);y1=min(4250,int(b)+45)
    patch=pixels[y0:y1,x0:x1].astype(np.float32)
    # Centers are colored and surrounded by a white ring. Interchanges additionally have a dark outer ring.
    white=np.min(patch,axis=2)>211
    saturated=(np.max(patch,axis=2)-np.min(patch,axis=2)>8)&(np.max(patch,axis=2)<245)
    dark=np.max(patch,axis=2)<110
    yy,xx=np.mgrid[:patch.shape[0],:patch.shape[1]]
    dist=np.sqrt(np.maximum(np.maximum(l-(xx+x0),xx+x0-r),0)**2+np.maximum(np.maximum(t-(yy+y0),yy+y0-b),0)**2)
    scores=np.full(white.shape,-999.,dtype=np.float32)
    for radius in [3,4,5,6]:
        ring=np.zeros(white.shape,dtype=np.float32)
        for angle in np.arange(0,2*math.pi,math.pi/4):
            dx=round(radius*math.cos(angle));dy=round(radius*math.sin(angle))
            ring+=np.roll(np.roll(white,dy,axis=0),dx,axis=1)
        score=ring*7+saturated*18-dist*1.1
        # Text glyphs are dark, and labels sit next to the actual circle.
        score[~saturated]=-999;score[dist<3]=-999
        score[:8,:]=-999;score[-8:,:]=-999;score[:,:8]=-999;score[:,-8:]=-999
        scores=np.maximum(scores,score)
    iy,ix=np.unravel_index(np.argmax(scores),scores.shape)
    return int(ix+x0),int(iy+y0),round(float(scores[iy,ix]),1)

if __name__=='__main__':
    calibrated=json.loads((ROOT/'src/data/calibrated-coordinates.json').read_text(encoding='utf-8'))
    roster=json.loads((ROOT/'src/data/official-roster.json').read_text(encoding='utf-8-sig'))
    linecolors=json.loads((ROOT/'src/data/line-colors.json').read_text(encoding='utf-8'))
    byname={}
    for line in roster['lines']:
        for rawname in line['stations']:
            name=roster['aliases'].get(rawname,rawname)
            item=byname.setdefault(name,{'id':name,'name':name,'lines':[],'aliases':[]})
            item['lines'].append(line['id'])
            if rawname!=name:item['aliases'].append(rawname)
    found=[];missing=[]
    for name,item in byname.items():
        boxes=match_label(name)
        if not boxes:missing.append(name);continue
        nodes=[(*find_node(box,len(item['lines'])>1),box) for box in boxes]
        x,y,score,box=max(nodes,key=lambda n:n[2])
        if name in calibrated: x,y=calibrated[name]
        found.append({**item,'x':x,'y':y,'ocrScore':score,'labelBox':box})
    (ROOT/'scripts/hotspots-draft.json').write_text(json.dumps(found,ensure_ascii=False,indent=2),encoding='utf-8')
    (ROOT/'scripts/missing-stations.json').write_text(json.dumps(missing,ensure_ascii=False,indent=2),encoding='utf-8')
    # Planned stations are maintained separately and never enter the operating roster.
    header="""import plannedData from './planned-stations.json';
export interface Station { id: string; name: string; x: number; y: number; lines: string[]; aliases?: string[]; status?: 'planned' }
export const plannedStations = plannedData as (Station & { status: 'planned'; englishName: string; label: { x: number; y: number; anchor: 'start' | 'middle' | 'end'; fontSize: number }; symbol: { parts: { x: number; y: number; width: number; height: number; angle: number; lines: string[]; transfer: boolean; planned: boolean }[] } })[];
"""
    source=header+'export interface MetroLine { id: string; name: string; color: string }\nexport const mapMeta = { width: 5950, height: 4250, image: "/maps/shenzhen-reference.jpg", edition: "2026.09" };\n'
    source+='export const lines: MetroLine[] = '+json.dumps([{'id':l['id'],'name':l['name'],'color':linecolors[l['id']]} for l in roster['lines']],ensure_ascii=False)+';\n'
    source+='export const stations: Station[] = '+json.dumps([{k:v for k,v in s.items() if k not in ['ocrScore','labelBox']} for s in found],ensure_ascii=False,indent=2)+';\n'
    (ROOT/'src/data/stations.ts').write_text(source,encoding='utf-8')
    print(f'OCR records={len(records)}; roster={len(byname)}; matched={len(found)}; missing={len(missing)}\n{missing}')
