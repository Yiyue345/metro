"""Trace colored rail bands between ordered station parts, then emit SVG paths.

The reference JPG is sampled at half size. A* costs favor the actual line-color
pixels and penalize distance away from them; this preserves bends between
stations and crosses small occlusions at station rings/interchanges. Ground
and underground track decorations are reduced to one colored center stroke.
"""
from pathlib import Path
import sys,json,math,heapq,time,hashlib
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'shenzhen/.ocr-deps'))
import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageFont
sys.path.insert(0,str(ROOT.parent/'hangzhou/scripts'))
from route_curves import make_curve

SCALE=2
source=Image.open(ROOT/'public/maps/chengdu-reference.jpg').convert('RGB')
pure=ROOT/'public/maps/chengdu-reference-pure.jpg'
trace_source=Image.open(pure).convert('RGB')
assert trace_source.size==source.size==(4800,4030)
image=np.asarray(trace_source.resize((2400,2015),Image.Resampling.BILINEAR)).astype(float)
full_image=np.asarray(trace_source).astype(np.float32)
roster=json.loads((ROOT/'data/official-roster.json').read_text(encoding='utf-8'))
colors=json.loads((ROOT/'data/line-colors.json').read_text(encoding='utf-8'))
source_meta=json.loads((ROOT/'data/source-meta.json').read_text(encoding='utf-8'))
s3_review=json.loads((ROOT/'scripts/s3-geometry-review.json').read_text(encoding='utf-8'))
symbols=json.loads((ROOT/'data/station-symbols.json').read_text(encoding='utf-8'))
text=(ROOT/'data/stations.ts').read_text(encoding='utf-8')
stations=json.loads(text.split('export const stations: Station[] = ')[1].rstrip(';\n'))
byname={s['id']:s for s in stations}

def position(name,line_id):
    parts=[p for p in symbols[name]['parts'] if line_id in p['lines']]
    if not parts:
        s=byname[name];return (s['x'],s['y'])
    anchors=[]
    color=colors[line_id];target=np.array([int(color[i:i+2],16) for i in [1,3,5]])
    for p in parts:
        if p['transfer'] and len(p['lines'])>1:
            # Each colored stripe has its own anchor inside a long interchange
            # capsule. Forcing parallel tracks to its common center makes a V.
            cx,cy=p['x'],p['y'];radius=math.ceil(p['width']/2+3)
            x0=round(cx)-radius;y0=round(cy)-radius
            cut=full_image[y0:y0+radius*2+1,x0:x0+radius*2+1]
            yy,xx=np.mgrid[:cut.shape[0],:cut.shape[1]];xx=xx+x0;yy=yy+y0
            angle=math.radians(p['angle'])
            u=(xx-cx)*math.cos(angle)+(yy-cy)*math.sin(angle)
            v=-(xx-cx)*math.sin(angle)+(yy-cy)*math.cos(angle)
            r=max(1,(p['height']-6)/2);half=max(r,(p['width']-6)/2)
            interior=np.maximum(np.abs(u)-(half-r),0)**2+v*v<=r*r
            delta=np.linalg.norm(cut-target,axis=2)
            minimum=float(delta[interior].min())
            selected=interior&(delta<minimum+10)
            anchors.append((float(np.median(xx[selected])),float(np.median(yy[selected]))))
        else:anchors.append((p['x'],p['y']))
    return (sum(p[0] for p in anchors)/len(anchors),sum(p[1] for p in anchors)/len(anchors))

def trace(start,end,distance,inside):
    a=tuple(round(v/SCALE) for v in start);b=tuple(round(v/SCALE) for v in end)
    span=math.dist(a,b);margin=round(min(200,max(55,span*.4)))
    x0=max(0,min(a[0],b[0])-margin);x1=min(2399,max(a[0],b[0])+margin)
    y0=max(0,min(a[1],b[1])-margin);y1=min(2014,max(a[1],b[1])+margin)
    d=distance[y0:y1+1,x0:x1+1]
    ins=inside[y0:y1+1,x0:x1+1]
    cost=(1+.9*np.minimum(d,55)**1.7+.7/(ins+1)).astype(np.float32)
    aa=(a[0]-x0,a[1]-y0);bb=(b[0]-x0,b[1]-y0)
    # Fill node rings so a tiny white/black gap cannot pull the trace around them.
    for cx,cy in [aa,bb]:
        cv2.circle(cost,(cx,cy),3,1.0,-1)
    w=cost.shape[1];h=cost.shape[0]
    startkey=aa[1]*w+aa[0];endkey=bb[1]*w+bb[0]
    best=np.full(w*h,np.inf,dtype=np.float64);best[startkey]=0
    previous=np.full(w*h,-1,dtype=np.int32)
    queue=[(math.dist(aa,bb),0,startkey)]
    directions=[(-1,0,1),(1,0,1),(0,-1,1),(0,1,1),(-1,-1,1.41421356),(-1,1,1.41421356),(1,-1,1.41421356),(1,1,1.41421356)]
    expanded=0
    while queue:
        _,g,k=heapq.heappop(queue)
        if g>best[k]:continue
        if k==endkey:break
        expanded+=1
        y,x=divmod(k,w)
        for dx,dy,length in directions:
            nx=x+dx;ny=y+dy
            if not(0<=nx<w and 0<=ny<h):continue
            nk=ny*w+nx;ng=g+length*float((cost[y,x]+cost[ny,nx])*.5)
            if ng<best[nk]:
                best[nk]=ng;previous[nk]=k
                heapq.heappush(queue,(ng+math.hypot(nx-bb[0],ny-bb[1]),ng,nk))
    assert previous[endkey]>=0 or startkey==endkey,'A* failed'
    keys=[endkey]
    while keys[-1]!=startkey:keys.append(int(previous[keys[-1]]))
    points=[((k%w+x0)*SCALE,(k//w+y0)*SCALE) for k in reversed(keys)]
    points[0]=start;points[-1]=end
    departures=[float(distance[min(2014,round(y/SCALE)),min(2399,round(x/SCALE))])*SCALE for x,y in points]
    length=sum(math.dist(p,q) for p,q in zip(points,points[1:]))
    info={'length':round(length,1),'directLength':round(math.dist(start,end),1),'maxColorDistance':round(max(departures),1),'offBandFraction':round(sum(d>6 for d in departures)/len(departures),3),'expanded':expanded}
    return points,info

routes=[];report=[];polylines={};starttime=time.time()
sequences=[{**line,'stations':path} for line in roster['lines'] for path in line.get('paths',[line['stations']])]
inactive_reports=[];inactive_polylines={}
sequences += [{'id':line,'stations':path,'inactive':True} for line,paths in roster.get('inactivePaths',{}).items() for path in paths]
cache_directory=ROOT/'scripts/review/route-cache';cache_directory.mkdir(parents=True,exist_ok=True)
for sequence_index,line in enumerate(sequences):
    line_id=line['id'];inactive=line.get('inactive',False);color='#b6b6b6' if inactive else colors[line_id]
    names=line['stations'].copy()
    assert all(name in symbols for name in names),f'Missing station geometry for line {line_id}'
    if line_id=='s3':
        reviewed=s3_review['verification'];polyline=s3_review['route']['polyline']
        coverage=reviewed['operatingStationCoverage']
        anchors=[(s['x'],s['y']) for s in coverage]
        segments=[]
        for a,b,p,q in zip(names,names[1:],anchors,anchors[1:]):
            start=min(range(len(polyline)),key=lambda j:math.dist(polyline[j],p))
            end=min(range(len(polyline)),key=lambda j:math.dist(polyline[j],q))
            length=sum(math.dist(polyline[j],polyline[j+1]) for j in range(start,end))
            segments.append({'from':a,'to':b,'directLength':round(math.dist(p,q),2),'length':round(length,2)})
        report.append({'id':'s3','stationCount':len(names),'segmentCount':len(names)-1,'stationCoverage':coverage,'segments':segments,'curveStats':{'kind':'source main and registered inset continuous cubic Bezier','maxTracedCorridorDeviation':reviewed['maxCubicToTracedPolylineDistancePixels']},'traceSource':'2026.11 source panels; scripts/s3-geometry-review.json'})
        routes.append({k:s3_review['route'][k] for k in ['id','color','width','paths']})
        polylines[f'{line_id}-{sequence_index}']=polyline
        continue
    ordered=[position(name,line_id) for name in names]
    fingerprint=hashlib.sha256(json.dumps([source_meta['sourceSHA256']['geometry'],color,ordered,inactive,'closed-tangent-tram-mask-v3',line_id=='r2' and 'tram-sharp-corners']).encode()).hexdigest()
    cache_path=cache_directory/f'{sequence_index}-{fingerprint}.json'
    if cache_path.exists():
        cached=json.loads(cache_path.read_text(encoding='utf-8'))
        assert all(s['curveDistance']<4.5 for s in cached['report']['stationCoverage']),f'Cached coverage requires review: {line_id}'
        assert cached['report']['curveStats']['maxTracedCorridorDeviation']<4.5
        route=next((r for r in routes if r['id']==line_id),None)
        if not route:route={'id':line_id,'color':colors[line_id],'width':3.5 if line_id=='r2' else 8,'paths':[]};routes.append(route)
        route.setdefault('inactivePaths' if inactive else 'paths',[]).append(cached['curve'])
        (inactive_reports if inactive else report).append(cached['report'])
        (inactive_polylines if inactive else polylines)[f'{line_id}-{sequence_index}']=cached['points']
        print(f'Line {line_id}: reused verified station anchors',flush=True)
        continue
    rgb=np.array([int(color[i:i+2],16) for i in [1,3,5]])
    delta=np.linalg.norm(image-rgb,axis=2)
    # Half-size sampling mixes narrow parallel rail bands with white pixels.
    # Retain those pale, still-saturated pixels instead of treating real track as a gap.
    saturation=image.max(2)-image.min(2)
    mask=((delta<40)&(saturation<25) if inactive else (delta<(115 if line_id=='r2' else 65))&(saturation>(25 if line_id=='r2' else 20))).astype(np.uint8)
    outside=cv2.distanceTransform(1-mask,cv2.DIST_L2,5)
    inside=cv2.distanceTransform(mask,cv2.DIST_L2,5)
    points=[];segments=[]
    for index,(a,b) in enumerate(zip(ordered,ordered[1:])):
        path,info=trace(a,b,outside,inside)
        points+=path if not points else path[1:]
        info.update({'from':names[index],'to':names[index+1]})
        info['suspicious']=info['offBandFraction']>.15 or info['maxColorDistance']>22 or info['length']>info['directLength']*2.2
        segments.append(info)
    curve,drawpoints,curve_stats=make_curve(points,full_image,color,ordered,**({'smoothing':2,'knot_spacing':6} if line_id=='r2' else {}))
    route=next((r for r in routes if r['id']==line_id),None)
    if not route:route={'id':line_id,'color':colors[line_id],'width':3.5 if line_id=='r2' else 8,'paths':[]};routes.append(route)
    route.setdefault('inactivePaths' if inactive else 'paths',[]).append(curve)
    (inactive_polylines if inactive else polylines)[f'{line_id}-{sequence_index}']=drawpoints
    coverage=[]
    for name,point in zip(names,ordered):
        error=min(math.dist(point,p) for p in drawpoints)
        if error>=4.5:print('Review station coverage',line_id,name,round(error,3),flush=True)
        assert error<4.5 or '--review' in sys.argv,(line_id,name,error)
        coverage.append({'name':name,'x':point[0],'y':point[1],'curveDistance':round(error,4)})
    reviewed={'id':line_id,'curveStats':curve_stats,'traceSource':'user supplied white-background 2026.11 operating reference','stationCount':len(names),'segmentCount':len(segments),'stationCoverage':coverage,'suspiciousSegments':[s for s in segments if s['suspicious']],'segments':segments}
    (inactive_reports if inactive else report).append(reviewed)
    cache_path.write_text(json.dumps({'curve':curve,'points':drawpoints,'report':reviewed},ensure_ascii=False),encoding='utf-8')
    print(f'Line {line_id}: {len(names)} stops, {sum(s["suspicious"] for s in segments)} review segments; elapsed {time.time()-starttime:.1f}s',flush=True)

tianfu=json.loads((ROOT/'scripts/tianfu-geometry-review.json').read_text(encoding='utf-8'))
branch_points=[tianfu['tianfuStation']['centerCropped'],*tianfu['line19TerminalTail']['visibleTailCenterlineCropped']]
branch,branch_polyline,branch_stats=make_curve(branch_points,full_image,colors['19'],[branch_points[0],branch_points[-1]],smoothing=2,knot_spacing=6)
line19=next(route for route in routes if route['id']=='19')
line19['branchPaths']=[branch]
line19['terminalMarkers']=[{'x':branch_points[-1][0],'y':branch_points[-1][1],'radius':5.5}]
(ROOT/'scripts/tianfu-route-review.json').write_text(json.dumps({'branchPoints':branch_points,'branchPolyline':branch_polyline,'curveStats':branch_stats,'passengerStationAdded':False},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'data/route-paths.json').write_text(json.dumps(routes,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'scripts/route-tracing-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'scripts/route-polylines.json').write_text(json.dumps(polylines,ensure_ascii=False)+'\n',encoding='utf-8')
(ROOT/'scripts/inactive-route-tracing-report.json').write_text(json.dumps(inactive_reports,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'scripts/inactive-route-polylines.json').write_text(json.dumps(inactive_polylines,ensure_ascii=False)+'\n',encoding='utf-8')


print(f'Exported {len(routes)} lines and {sum(r["segmentCount"] for r in report)} ordered segments.',flush=True)




