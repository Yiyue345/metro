"""Prepare black-text-only tiles for local Windows OCR; never alters the display map."""
import argparse
from pathlib import Path
import numpy as np
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('source')
args = parser.parse_args()
root = Path(__file__).resolve().parent
out = root / 'ocr-clean-tiles'
out.mkdir(exist_ok=True)
image = Image.open(args.source).convert('RGB')
rgb = np.asarray(image).astype(np.int16)
ink = (rgb.max(axis=2) < 160) & (rgb.max(axis=2) - rgb.min(axis=2) < 55)
clean = Image.fromarray(np.where(ink, 0, 255).astype(np.uint8)).convert('RGB')
for y in range(350, 4000, 850):
    for x in range(0, 5950, 850):
        tile = clean.crop((x, y, min(x+1050,5950), min(y+1050,4250)))
        tile.resize((tile.width*3,tile.height*3), Image.Resampling.LANCZOS).save(out / f'{x}_{y}.png')
print(f'Prepared {len(list(out.glob("*.png")))} OCR tiles')
