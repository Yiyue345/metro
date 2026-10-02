"""Local-only OCR of map labels. Install rapidocr-onnxruntime into .ocr-deps."""
from pathlib import Path
import sys, json, argparse
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / '.ocr-deps'))
from PIL import Image
import numpy as np
from rapidocr_onnxruntime import RapidOCR

parser = argparse.ArgumentParser()
parser.add_argument('source')
parser.add_argument('--sample', action='store_true')
args = parser.parse_args()
image = Image.open(args.source).convert('RGB')
engine = RapidOCR(det_limit_side_len=2100, det_limit_type='max', max_side_len=2200,
                  intra_op_num_threads=4, inter_op_num_threads=4, use_cls=False)
records = []
tiles = [(2550,2550)] if args.sample else [(x,y) for y in range(350,4000,900) for x in range(0,5950,900)]
for index,(x,y) in enumerate(tiles):
    tile = image.crop((x,y,min(x+1100,5950),min(y+1100,4250)))
    tile = tile.resize((tile.width*2,tile.height*2), Image.Resampling.LANCZOS)
    result, _ = engine(np.asarray(tile), use_cls=False)
    for points,text,confidence in result or []:
        records.append({'text':text,'confidence':confidence,
                        'box':[min(p[0] for p in points)/2+x,min(p[1] for p in points)/2+y,
                               max(p[0] for p in points)/2+x,max(p[1] for p in points)/2+y]})
    print(f'{index+1}/{len(tiles)}: {len(records)} labels', flush=True)
    (root/'scripts'/'labels-rapid.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
