"""Adapt the existing Shenzhen raster-to-vector pipeline without modifying it."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=ROOT.parent/'shenzhen/scripts'
curve=(source/'route_curves.py').read_text(encoding='utf-8').replace('np.ones((4250,5950),dtype=np.uint8)','np.ones(fullimage.shape[:2],dtype=np.uint8)')
(ROOT/'scripts/route_curves.py').write_text(curve,encoding='utf-8')
text=(source/'extract-route-paths.py').read_text(encoding='utf-8')
text=text[:text.index("review=ROOT/'scripts/review'")]
text=text.replace("sys.path.insert(0,str(ROOT/'.ocr-deps'))","sys.path.insert(0,str(ROOT.parent/'shenzhen/.ocr-deps'))")
text=text.replace("ROOT/'src/data/","ROOT/'data/")
text=text.replace("ROOT/'public/maps/shenzhen-reference.jpg'","ROOT/'public/maps/nanning-reference.jpg'")
begin=text.index('pure=Path(');end=text.index('image=np.asarray',begin)
text=text[:begin]+"pure=ROOT/'public/maps/nanning-reference-pure.jpg'\ntrace_source=Image.open(pure).convert('RGB')\nassert trace_source.size==source.size==(2060,1360)\n"+text[end:]
text=text.replace('(2975,2125)','(1030,680)').replace('2974','1029').replace('2124','679')
text=text.replace("    if line_id=='8':names=['莲塘']+names\n",'')
text=text.replace("'pure-color reference' if pure.exists() else 'geographic reference'","'user supplied white-background 2026.01 operating reference'")
text+="\nprint(f'Exported {len(routes)} lines and {sum(r[\"segmentCount\"] for r in report)} ordered segments.',flush=True)\n"
(ROOT/'scripts/extract-route-paths.py').write_text(text,encoding='utf-8')
