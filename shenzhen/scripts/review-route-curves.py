"""Antialiased dense-interchange comparisons of source and cubic samples."""
from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.ocr-deps'))
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
source=Image.open(ROOT/'public/maps/shenzhen-reference.jpg').convert('RGB')
polylines=json.loads((ROOT/'scripts/route-polylines.json').read_text())
colors=json.loads((ROOT/'src/data/line-colors.json').read_text())
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',22)
areas=[('前海湾',(1220,3065,1540,3245)),('深大 / 粤海门',(1620,3070,1940,3250)),('车公庙',(2300,3095,2620,3275)),('岗厦北 / 福田',(2610,3060,2930,3240)),('黄木岗 / 八卦岭',(2850,2870,3170,3050))]
sheet=Image.new('RGB',(1920,580*len(areas)),'white')
for index,(name,box) in enumerate(areas):
    x0,y0,x1,y1=box
    crop=source.crop(box).resize((960,540),Image.Resampling.LANCZOS)
    faded=Image.blend(Image.new('RGB',crop.size,'white'),crop,.20)
    raster=np.asarray(faded).copy()
    for key,points in polylines.items():
        points=np.asarray(points)
        # Keep clipping consecutive runs outside the local review window.
        nearby=(points[:,0]>x0-12)&(points[:,0]<x1+12)&(points[:,1]>y0-12)&(points[:,1]<y1+12)
        boundaries=np.r_[False,nearby,False].astype(int)
        starts=np.where(np.diff(boundaries)==1)[0];ends=np.where(np.diff(boundaries)==-1)[0]
        color=colors[key];rgb=tuple(int(color[i:i+2],16) for i in [1,3,5])
        for start,end in zip(starts,ends):
            coords=np.rint((points[start:end]-[x0,y0])*3).astype(np.int32)
            cv2.polylines(raster,[coords],False,rgb,24,cv2.LINE_AA)
    sheet.paste(crop,(0,index*580+40));sheet.paste(Image.fromarray(raster),(960,index*580+40))
    draw=ImageDraw.Draw(sheet)
    draw.text((14,index*580+8),name+' · 原图',fill='#222222',font=font)
    draw.text((974,index*580+8),name+' · 连续三次 Bézier',fill='#222222',font=font)
    pair=sheet.crop((0,index*580,1920,(index+1)*580))
    pair.save(ROOT/f'scripts/review/curve-compare-{index+1}.png')
sheet.save(ROOT/'scripts/review/routes-cubic-comparisons.jpg',quality=95)
print('Generated 5 dense interchange comparisons at 3x source scale.')
