"""Crop and recognize the user-supplied 2026.11 Chengdu operating map."""
from pathlib import Path
import sys, json, hashlib
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'shenzhen/.ocr-deps'))
from PIL import Image
import numpy as np
from rapidocr_onnxruntime import RapidOCR

source = Path('E:/BaiduNetdiskDownload/05.成都地铁3.0 公开免费版（更新至2026.08）')
pure = next(source.glob('01*2026年11月*纯色底.jpg'))
geographic = next(p for p in source.glob('01*2026年11月*.jpg') if '纯色底' not in p.name)
crop = (1250, 400, 6050, 4430)
image = Image.open(pure).convert('RGB').crop(crop)
assert Image.open(pure).size == Image.open(geographic).size == (6300, 4500)
(ROOT / 'public/maps').mkdir(parents=True, exist_ok=True)
(ROOT / 'data').mkdir(parents=True, exist_ok=True)
image.save(ROOT / 'public/maps/chengdu-reference-pure.jpg', quality=97)
Image.open(geographic).convert('RGB').crop(crop).save(ROOT / 'public/maps/chengdu-reference.jpg', quality=97)
meta = {'edition': '2026.11', 'sourceDimensions': [6300, 4500], 'crop': list(crop),
        'width': image.width, 'height': image.height, 'reference': geographic.name,
        'geometryReference': pure.name, 'sourceSHA256': {
            'reference': hashlib.sha256(geographic.read_bytes()).hexdigest(),
            'geometry': hashlib.sha256(pure.read_bytes()).hexdigest()},
        'coordinateSpace': 'cropped operating-reference pixels'}
(ROOT / 'data/source-meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
image.resize((2400, 2015)).save(ROOT.parent / 'output/playwright/chengdu-reference-overview.jpg', quality=95)
engine = RapidOCR(det_limit_side_len=2200, det_limit_type='max', max_side_len=2600,
                  intra_op_num_threads=4, inter_op_num_threads=4, use_cls=False)
records = json.loads((ROOT / 'scripts/labels-rapid.json').read_text(encoding='utf-8')) if '--changed-only' in sys.argv else []
tiles = [(x, y) for y in range(0, image.height, 650) for x in range(0, image.width, 900)]
if '--changed-only' in sys.argv:
    # Existing anchors were checked against both reference images: the November
    # diagram changes the eastern Line 2 segment, while the rest is unchanged.
    # S3's separate inset is reviewed in its own source-coordinate workflow.
    tiles = [(2380, 1530), (2750, 1630)]
for index, (x, y) in enumerate(tiles):
    tile = image.crop((x, y, min(x + 1100, image.width), min(y + 850, image.height)))
    tile = tile.resize((tile.width * 2, tile.height * 2), Image.Resampling.LANCZOS)
    result, _ = engine(np.asarray(tile), use_cls=False)
    for points, text, confidence in result or []:
        records.append({'text': text, 'confidence': confidence, 'box': [
            min(p[0] for p in points) / 2 + x, min(p[1] for p in points) / 2 + y,
            max(p[0] for p in points) / 2 + x, max(p[1] for p in points) / 2 + y]})
    (ROOT / 'scripts/labels-rapid.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'{index + 1}/{len(tiles)} tiles, {len(records)} OCR records', flush=True)
