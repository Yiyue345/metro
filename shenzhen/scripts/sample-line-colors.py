"""Sample robust line colors from ordinary station cores in the reference JPG.

White ring pixels and interchange gradients are excluded. A median is taken
within each small colored core, then across all ordinary stations of a line.
Only line.color fields are replaced in stations.ts; station geometry is kept.
"""
from pathlib import Path
import sys,json,re
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.ocr-deps'))
import numpy as np
from PIL import Image

path=ROOT/'src/data/stations.ts';text=path.read_text(encoding='utf-8')
lines=json.loads(text.split('export const lines: MetroLine[] = ')[1].split(';\n')[0])
stations=json.loads(text.split('export const stations: Station[] = ')[1].rstrip(';\n'))
image=np.asarray(Image.open(ROOT/'public/maps/shenzhen-reference.jpg').convert('RGB'))
colors={};evidence={}
for line in lines:
    samples=[]
    for station in stations:
        if station['lines']!=[line['id']]:continue
        x,y=round(station['x']),round(station['y'])
        cut=image[y-1:y+2,x-1:x+2].reshape(-1,3).astype(float)
        colored=cut[(cut.min(1)<220)&(cut.max(1)-cut.min(1)>15)]
        if len(colored)>=4:
            samples.append((station['id'],np.median(colored,axis=0)))
    values=np.array([v for _,v in samples])
    median=np.median(values,axis=0)
    # Remove accidental coordinate/text hits using a broad robust color distance.
    distances=np.linalg.norm(values-median,axis=1)
    good=[(name,v) for (name,v),d in zip(samples,distances) if d<45]
    value=np.rint(np.median([v for _,v in good],axis=0)).astype(int)
    colors[line['id']]='#'+''.join(f'{v:02x}' for v in value)
    evidence[line['id']]={'color':colors[line['id']],'sampleCount':len(good),'samples':[{'name':n,'rgb':np.rint(v).astype(int).tolist()} for n,v in good]}
    line['color']=colors[line['id']]

text=re.sub(r'export const lines: MetroLine\[\] = .*?;\n','export const lines: MetroLine[] = '+json.dumps(lines,ensure_ascii=False)+';\n',text,count=1)
path.write_text(text,encoding='utf-8')
(ROOT/'src/data/line-colors.json').write_text(json.dumps(colors,indent=2)+'\n',encoding='utf-8')
(ROOT/'scripts/line-color-samples.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:{'color':v['color'],'sampleCount':v['sampleCount']} for k,v in evidence.items()},indent=2))
