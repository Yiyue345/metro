"""Render contact sheets for comparing station hotspots to the source image."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[1]
img=Image.open(root/'public/maps/shenzhen-reference.jpg')
stations=json.loads((root/'scripts/hotspots-draft.json').read_text(encoding='utf-8'))
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16)
out=root/'scripts/review';out.mkdir(exist_ok=True)
for page in range((len(stations)+39)//40):
    sheet=Image.new('RGB',(1350,1120),'#eef2ee'); draw=ImageDraw.Draw(sheet)
    for i,s in enumerate(stations[page*40:(page+1)*40]):
        col,row=i%5,i//5;x,y=s['x'],s['y']
        crop=img.crop((x-67,y-26,x+68,y+28)).resize((270,108))
        sheet.paste(crop,(col*270,row*140+28))
        draw.text((col*270+6,row*140+3),f'{page*40+i+1}. {s["name"]} ({x},{y})',font=font,fill='#222222')
        cx,cy=col*270+134,row*140+80
        draw.ellipse((cx-9,cy-9,cx+9,cy+9),outline='#ff183c',width=2)
        draw.line((cx-14,cy,cx-10,cy),fill='#ff183c',width=2)
        draw.line((cx+10,cy,cx+14,cy),fill='#ff183c',width=2)
    sheet.save(out/f'hotspots-{page+1}.jpg',quality=90)
