"""Extract/OCR the supplied 2026.07 operating reference only, locally."""
from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'shenzhen/.ocr-deps'))
from PIL import Image
import numpy as np
from rapidocr_onnxruntime import RapidOCR
directory=Path('E:/BaiduNetdiskDownload/24.昆明地铁3.0 公开免费版（更新至2026.07）')
pure=next(directory.glob('01*纯白底.jpg'))
geographic=next(p for p in directory.glob('01*.jpg') if '纯白' not in p.name)
crop=(650,90,2630,2050)
image=Image.open(pure).convert('RGB').crop(crop)
assert Image.open(pure).size==Image.open(geographic).size==(2940,2100)
image.save(ROOT/'public/maps/kunming-reference-pure.jpg',quality=96)
Image.open(geographic).convert('RGB').crop(crop).save(ROOT/'public/maps/kunming-reference.jpg',quality=96)
engine=RapidOCR(det_limit_side_len=1800,det_limit_type='max',max_side_len=2400,intra_op_num_threads=4,inter_op_num_threads=4,use_cls=False)
records=[]
tiles=[(x,y) for y in range(0,image.height,500) for x in range(0,image.width,650)]
for index,(x,y) in enumerate(tiles):
    tile=image.crop((x,y,min(x+800,image.width),min(y+650,image.height)))
    tile=tile.resize((tile.width*3,tile.height*3),Image.Resampling.LANCZOS)
    result,_=engine(np.asarray(tile),use_cls=False)
    for points,text,confidence in result or []:
        records.append({'text':text,'confidence':confidence,'box':[min(p[0] for p in points)/3+x,min(p[1] for p in points)/3+y,max(p[0] for p in points)/3+x,max(p[1] for p in points)/3+y]})
    (ROOT/'scripts/labels-rapid.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'{index+1}/{len(tiles)} tiles, {len(records)} OCR records',flush=True)
(ROOT/'data/source-meta.json').write_text(json.dumps({'edition':'2026.07','sourceDimensions':[2940,2100],'crop':list(crop),'width':image.width,'height':image.height,'reference':geographic.name,'geometryReference':pure.name,'sourceSHA256':{'reference':hashlib.sha256(geographic.read_bytes()).hexdigest(),'geometry':hashlib.sha256(pure.read_bytes()).hexdigest()},'coordinateSpace':'cropped operating-reference pixels'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
