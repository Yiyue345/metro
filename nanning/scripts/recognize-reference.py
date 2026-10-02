"""OCR the user-supplied Nanning 2026.01 operating reference, local only."""
from pathlib import Path
import sys, json
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'shenzhen/.ocr-deps'))
from PIL import Image
import numpy as np
from rapidocr_onnxruntime import RapidOCR
directory=next(Path('E:/BaiduNetdiskDownload').glob('27.*'))
pure=next(directory.glob('*纯白底.jpg'))
geographic=next(p for p in directory.glob('*运营版*.jpg') if '纯白' not in p.name)
crop=(620,60,2680,1420)
image=Image.open(pure).convert('RGB').crop(crop)
image.save(ROOT/'public/maps/nanning-reference-pure.jpg',quality=96)
Image.open(geographic).convert('RGB').crop(crop).save(ROOT/'public/maps/nanning-reference.jpg',quality=96)
engine=RapidOCR(det_limit_side_len=1800,det_limit_type='max',max_side_len=2100,intra_op_num_threads=4,inter_op_num_threads=4,use_cls=False)
records=[]
tiles=[(x,y) for y in range(0,image.height,500) for x in range(0,image.width,650)]
for index,(x,y) in enumerate(tiles):
    tile=image.crop((x,y,min(x+800,image.width),min(y+650,image.height)))
    tile=tile.resize((tile.width*3,tile.height*3),Image.Resampling.LANCZOS)
    result,_=engine(np.asarray(tile),use_cls=False)
    for points,text,confidence in result or []:
        records.append({'text':text,'confidence':confidence,'box':[min(p[0] for p in points)/3+x,min(p[1] for p in points)/3+y,max(p[0] for p in points)/3+x,max(p[1] for p in points)/3+y]})
    (ROOT/'scripts/labels-rapid.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'{index+1}/{len(tiles)} tiles, {len(records)} records',flush=True)
(ROOT/'data/source-meta.json').write_text(json.dumps({'edition':'2026.01','sourceDimensions':[3220,2300],'crop':list(crop),'width':image.width,'height':image.height,'reference':geographic.name,'geometryReference':pure.name,'coordinateSpace':'cropped reference pixels'},ensure_ascii=False,indent=2),encoding='utf-8')
