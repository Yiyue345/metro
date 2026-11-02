"""Register and trace the S3 inset without changing any existing map outputs.

The inset is approximately 60% of the main geographic scale. Real coordinates
are used only to register two printed map panels; no geographic coordinates are
inferred from image pixels. Run with the workspace's OCR dependency directory.
"""
from pathlib import Path
import hashlib, heapq, json, math, sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'shenzhen/.ocr-deps'))
sys.path.insert(0, str(ROOT.parent / 'hangzhou/scripts'))
import cv2
import numpy as np
from PIL import Image, ImageDraw
from route_curves import resample, gaussian

SOURCE = Path('E:/BaiduNetdiskDownload/05.成都地铁3.0 公开免费版（更新至2026.08）')
PURE = SOURCE / '01.公开版-成都地铁线路3.0-a运营版（至2026年11月）纯色底.jpg'
GEOGRAPHIC = SOURCE / '01.公开版-成都地铁线路3.0-a运营版（至2026年11月）.jpg'
CROP_ORIGIN = np.array([1250., 400.])
REVIEW = ROOT / 'scripts/review'
REVIEW.mkdir(exist_ok=True)
pixels = np.asarray(Image.open(PURE).convert('RGB'))
assert pixels.shape[:2] == (4500, 6300)

# Reviewed source pixel anchors. Tianfu uses tianfu-geometry-review.json's
# measured capsule center, replacing the older override that was 9.4px low.
main_registration = {
    '天府站': [3656.2, 3516.6], '三岔': [4649.79, 4064.425],
    '福田': [5064.7, 4294.1],
    '天府机场1号2号航站楼': [5406.2, 4062.915],
    '天府机场北': [5470.365, 3907.68], '芦葭': [5389.5, 4451.5],
}
inset_registration = {
    '资阳临空': [570.5, 4123.5], '幸福大道': [702.5, 4311.5],
    '苌弘广场': [806.5, 4384.5], '宝台': [889.5, 4365.5],
    '资阳北站': [917.5, 4316.5],
}
amap = json.loads((ROOT / 'scripts/amap-chengdu-source.json').read_text(encoding='utf-8'))
gcj = {s['n']: [float(v) for v in s['sl'].split(',')] for line in amap['l'] for s in line['st']}

def mercator(value):
    lon, lat = value
    return [lon, -math.degrees(math.asinh(math.tan(math.radians(lat))))]

def fit_panel(anchors):
    geo = np.array([mercator(gcj[n]) for n in anchors])
    image = np.array(list(anchors.values()))
    centered_geo, centered_image = geo - geo.mean(0), image - image.mean(0)
    scale = float((centered_geo * centered_image).sum() / (centered_geo ** 2).sum())
    offset = image.mean(0) - scale * geo.mean(0)
    errors = geo * scale + offset - image
    report = {
        'scalePixelsPerMercatorDegree': scale, 'offset': offset.tolist(),
        'rmsPixels': float(np.sqrt((errors ** 2).sum(1).mean())),
        'anchors': [{'name': n, 'sourcePixel': xy, 'gcj02': gcj[n],
                     'residualPixels': errors[i].tolist()} for i, (n, xy) in enumerate(anchors.items())],
    }
    return scale, offset, report

main_scale, main_offset, main_fit = fit_panel(main_registration)
inset_scale, inset_offset, inset_fit = fit_panel(inset_registration)
SCALE = main_scale / inset_scale
TRANSLATION = main_offset - inset_offset * SCALE

def registered(points):
    return np.asarray(points, dtype=float) * SCALE + TRANSLATION - CROP_ORIGIN

# Corridor seeds only select the correct printed track and exclude the depot.
# A* below follows the actual gray rail band between reviewed station anchors.
main_seed = [[5060.5,4301.5],[5100,4325],[5160,4358],[5220,4383],
             [5300,4411],[5389.5,4451.5],[5430,4471],[5457,4482],[5476,4499]]
inset_seed = [[112,3815],[138,3855],[187,3885],[228,3900],[276,3926],
              [323,3936],[358,3947],[373,3959],[388,3975],[418,3995],
              [438,4015],[466,4038],[503,4065],[530,4091],[548,4104],
              [570.5,4123.5],[605,4153],[620,4180],[621,4205],[635,4220],
              [665,4231],[688,4242],[699,4260],[699,4285],[702.5,4311.5],
              [710,4330],[736,4355],[760,4378],[785,4390],[806.5,4384.5],
              [828,4376],[848,4381],[870,4385],[889.5,4365.5],[911,4347],
              [924,4334],[923,4323],[917.5,4316.5]]

def trace(seeds, station_points, bounds):
    x0,y0,x1,y1 = bounds
    patch = pixels[y0:y1,x0:x1]
    gray = patch.mean(2)
    neutral = patch.max(2).astype(float)-patch.min(2).astype(float)
    band = ((gray < 187) & (gray > 105) & (neutral < 17)).astype(np.uint8)
    band = cv2.morphologyEx(band, cv2.MORPH_CLOSE, np.ones((5,5),np.uint8))
    seed_local = np.array(seeds)-[x0,y0]
    corridor = np.zeros(gray.shape,np.uint8)
    cv2.polylines(corridor,[np.rint(seed_local).astype(np.int32)],False,1,25)
    band *= corridor
    for xy in station_points:
        cv2.circle(band,tuple(np.rint(np.array(xy)-[x0,y0]).astype(int)),5,1,-1)
    outside = cv2.distanceTransform(1-band,cv2.DIST_L2,5)
    inside = cv2.distanceTransform(band,cv2.DIST_L2,5)
    seed_raster = np.ones(gray.shape,np.uint8)
    cv2.polylines(seed_raster,[np.rint(seed_local).astype(np.int32)],False,0,1)
    rough_distance = cv2.distanceTransform(seed_raster,cv2.DIST_L2,5)
    cost = 1 + 2.5*outside**2 + 5/(inside+1) + .015*rough_distance**2
    h,w = gray.shape
    def one(a,b):
        aa=np.rint(np.array(a)-[x0,y0]).astype(int);bb=np.rint(np.array(b)-[x0,y0]).astype(int)
        start=aa[1]*w+aa[0];end=bb[1]*w+bb[0]
        best=np.full(w*h,np.inf);previous=np.full(w*h,-1,np.int32)
        best[start]=0;queue=[(math.dist(aa,bb),0,start)]
        directions=[(-1,0,1),(1,0,1),(0,-1,1),(0,1,1),(-1,-1,2**.5),(-1,1,2**.5),(1,-1,2**.5),(1,1,2**.5)]
        while queue:
            _,g,k=heapq.heappop(queue)
            if g>best[k]:continue
            if k==end:break
            y,x=divmod(k,w)
            for dx,dy,length in directions:
                nx,ny=x+dx,y+dy
                if not(0<=nx<w and 0<=ny<h):continue
                nk=ny*w+nx;ng=g+length*float((cost[y,x]+cost[ny,nx])*.5)
                if ng<best[nk]:
                    best[nk]=ng;previous[nk]=k
                    heapq.heappush(queue,(ng+math.hypot(nx-bb[0],ny-bb[1]),ng,nk))
        assert previous[end]>=0
        path=[end]
        while path[-1]!=start:path.append(int(previous[path[-1]]))
        result=[[k%w+x0,k//w+y0] for k in reversed(path)]
        result[0]=a;result[-1]=b
        return result
    points=[]
    for a,b in zip(station_points,station_points[1:]):
        section=one(a,b);points += section if not points else section[1:]
    return points

main_points=trace(main_seed,[main_seed[0],main_registration['芦葭'],main_seed[-1]],(5020,4265,5500,4500))
inset_points=trace(inset_seed,[inset_seed[0],*inset_registration.values()],(95,3815,950,4410))
global_raw=np.vstack([np.array(main_points)-CROP_ORIGIN,registered(inset_points)])

def make_cubic(points):
    raw=resample(points,2)
    smooth=gaussian(raw,3)
    smooth[0]=raw[0];smooth[-1]=raw[-1]
    knots=resample(smooth,10)
    tangent=np.empty_like(knots)
    tangent[1:-1]=(knots[2:]-knots[:-2])/2
    tangent[0]=knots[1]-knots[0];tangent[-1]=knots[-1]-knots[-2]
    fmt=lambda p:f'{p[0]:.2f},{p[1]:.2f}'
    d='M '+fmt(knots[0]);poly=[]
    for i in range(len(knots)-1):
        a,b=knots[i],knots[i+1];c=a+tangent[i]/3;e=b-tangent[i+1]/3
        d+=' C '+fmt(c)+' '+fmt(e)+' '+fmt(b)
        t=np.linspace(0,1,9)[:,None]
        samples=(1-t)**3*a+3*(1-t)**2*t*c+3*(1-t)*t**2*e+t**3*b
        poly.extend(samples[:-1].tolist())
    poly.append(knots[-1].tolist())
    return d,poly

path,polyline=make_cubic(global_raw)
label_boxes={
    '福田':[5005,4292,5050,4308], '芦葭':[5378,4460,5404,4475],
    '资阳临空':[521,4130,570,4143], '幸福大道':[710,4304,761,4317],
    '苌弘广场':[810,4388,860,4401], '宝台':[895,4365,919,4378],
    '资阳北站':[861,4308,913,4321],
}
stations=[]
for name,source in {**{'福田':main_registration['福田'],'芦葭':main_registration['芦葭']},**inset_registration}.items():
    inset=name in inset_registration
    anchor=registered([source])[0] if inset else np.array(source)-CROP_ORIGIN
    source_box=label_boxes[name]
    # Standard 14px map labels retain their source glyph size after map-panel
    # registration, while the source box is also recorded for full auditability.
    top_left=anchor+np.array(source_box[:2])-np.array(source) if inset else np.array(source_box[:2])-CROP_ORIGIN
    label_box=[*top_left,top_left[0]+source_box[2]-source_box[0],top_left[1]+source_box[3]-source_box[1]]
    part={'x':float(anchor[0]),'y':float(anchor[1]),'width':11,'height':11,'angle':0,'lines':['s3'],'transfer':False}
    if name=='福田':part.update(width=22.8,height=12.1,angle=116.6,lines=['18','19','s3'],transfer=True)
    station={'id':name,'anchor':anchor.tolist(),'labelBox':label_box,'sourceAnchor':source,
             'sourceLabelBox':source_box,'panel':'inset' if inset else 'main',
             'status':'planned' if name=='芦葭' else 'operating','parts':[part]}
    if name=='芦葭':station['sourceSymbolKeptPlanned']=True
    line_anchor=np.array(main_seed[0])-CROP_ORIGIN if name=='福田' else anchor
    station['lineAnchor']=line_anchor.tolist()
    station['routeDistancePixels']=float(np.linalg.norm(np.array(polyline)-line_anchor,axis=1).min())
    if name=='福田':station['sharedSymbolCenterDistancePixels']=float(np.linalg.norm(np.array(polyline)-anchor,axis=1).min())
    stations.append(station)

result={
    'lineId':'s3','coordinateSpace':'existing main cropped reference image coordinates, extended southeast',
    'source':{'edition':'2026.11','mainCrop':[1250,400,6050,4430],'originalSize':[6300,4500],
              'geographic':{'path':str(GEOGRAPHIC),'sha256':hashlib.sha256(GEOGRAPHIC.read_bytes()).hexdigest()},
              'pure':{'path':str(PURE),'sha256':hashlib.sha256(PURE.read_bytes()).hexdigest()},
              'insetBounds':[88,3815,985,4430]},
    'registration':{'model':'uniform scale and translation; north-up WebMercator panel fits',
                    'mainAnchorReviewSource':'scripts/tianfu-geometry-review.json: tianfuStation.centerOriginal [3656.2,3516.6]',
                    'inputCoordinateReference':'AMap GCJ-02 sl values, same service for both panel fits; coordinates only register panels',
                    'geographicCoordinatePolicy':'No geographic coordinate is generated or changed here. Existing WGS84 registry remains authoritative.',
                    'insetToOriginalScale':SCALE,'insetToOriginalTranslation':TRANSLATION.tolist(),
                    'cropOrigin':CROP_ORIGIN.tolist(),'mainFit':main_fit,'insetFit':inset_fit,
                    'scaleExplanation':'Inset basemap is approximately 60% of main basemap scale; its route geometry is enlarged by the fitted ratio. Symbol and label glyph sizes remain consistent with main map.',
                    'seam':{'mainLast':(np.array(main_points[-1])-CROP_ORIGIN).tolist(),
                            'insetFirst':registered([inset_points[0]])[0].tolist(),
                            'gapPixels':float(np.linalg.norm(registered([inset_points[0]])[0]-(np.array(main_points[-1])-CROP_ORIGIN))),
                            'method':'single global cubic bridges the short gap across the page edge; no route is drawn across the printed inset layout'}},
    'stationOrder':[s['id'] for s in stations],
    'operatingStationOrder':[s['id'] for s in stations if s['status']=='operating'],
    'stations':stations,
    'route':{'id':'s3','color':'#8b8b8b','width':8,'paths':[path],
             'polyline':[[round(x,3),round(y,3)] for x,y in polyline],
             'sourceMainPolyline':main_points,'sourceInsetPolyline':inset_points,
             'traceMethod':'Gray rail-band A* inside source-reviewed corridors; depot and other gray branches excluded; global tangent-continuous cubic',
             'bounds':[float(np.min(polyline,axis=0)[0]),float(np.min(polyline,axis=0)[1]),float(np.max(polyline,axis=0)[0]),float(np.max(polyline,axis=0)[1])]},
    'recommendedCanvas':{'width':5660,'height':5130,'existingWidth':4800,'existingHeight':4030,
                         'keepExistingLocalCoordinates':True},
    'exclusions':['临空车辆段支线','inset frame and line badge','unrelated gray planning tracks','source-label subtext'],
}
raw_array=resample(global_raw,1);curve_array=np.array(polyline)
nearest=[]
for chunk in np.array_split(curve_array,30):
    nearest.extend(np.sqrt(((chunk[:,None,:]-raw_array[None,:,:])**2).sum(2).min(1)).tolist())
result['verification']={
    'maxCubicToTracedPolylineDistancePixels':max(nearest),
    'operatingStationCoverage':[{'name':s['id'],'x':s['lineAnchor'][0],'y':s['lineAnchor'][1],'curveDistance':s['routeDistancePixels']} for s in stations if s['status']=='operating'],
    'physicalStationCoverage':[{'name':s['id'],'x':s['lineAnchor'][0],'y':s['lineAnchor'][1],'curveDistance':s['routeDistancePixels'],'status':s['status']} for s in stations],
    'visuallyReviewed':['s3-main-trace-review.png','s3-inset-trace-review.png'],
}
assert max(nearest)<4.5
assert all(s['routeDistancePixels']<4.5 for s in stations)
(ROOT/'scripts/s3-geometry-review.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

# Independent pixel QA overlays, kept outside production data.
for filename,bounds,points in [('s3-main-trace-review.png',(5000,4250,5510,4500),main_points),
                              ('s3-inset-trace-review.png',(88,3815,985,4430),inset_points)]:
    image=Image.open(PURE).crop(bounds).convert('RGB');draw=ImageDraw.Draw(image)
    draw.line([(x-bounds[0],y-bounds[1]) for x,y in points],fill=(255,0,0),width=1)
    image.save(REVIEW/filename)
scale=.24
context=Image.new('RGB',(round(5660*scale),round(5130*scale)),'white')
main_image=Image.open(GEOGRAPHIC).crop((1250,400,6050,4430))
context.paste(main_image.resize((round(4800*scale),round(4030*scale)),Image.Resampling.LANCZOS),(0,0))
draw=ImageDraw.Draw(context)
draw.rectangle((0,0,round(4800*scale),round(4030*scale)),outline=(180,180,180),width=1)
draw.line([(x*scale,y*scale) for x,y in polyline],fill=(220,0,0),width=2)
for station in stations:
    x,y=np.array(station['anchor'])*scale
    draw.ellipse((x-3,y-3,x+3,y+3),fill='white',outline=(220,0,0),width=1)
context.save(REVIEW/'s3-registration-context-review.png')
print(json.dumps({'scale':SCALE,'translation':TRANSLATION.tolist(),'bounds':result['route']['bounds'],
                  'stationCoverage':[{s['id']:round(s['routeDistancePixels'],3)} for s in stations]},ensure_ascii=False))
