"""Continuous cubic geometry for complete rail routes, never per-station pieces."""
import math
import numpy as np
import cv2

def resample(points,spacing):
    points=np.asarray(points,dtype=float)
    lengths=np.linalg.norm(np.diff(points,axis=0),axis=1)
    keep=np.r_[True,lengths>1e-5];points=points[keep]
    arcs=np.r_[0,np.cumsum(np.linalg.norm(np.diff(points,axis=0),axis=1))]
    samples=np.linspace(0,arcs[-1],max(2,math.ceil(arcs[-1]/spacing)+1))
    return np.column_stack([np.interp(samples,arcs,points[:,axis]) for axis in [0,1]])

def gaussian(points,sigma):
    half=math.ceil(sigma*3);k=np.arange(-half,half+1)
    weights=np.exp(-.5*(k/sigma)**2);weights/=weights.sum()
    padded=np.pad(points,((half,half),(0,0)),mode='reflect')
    return np.column_stack([np.convolve(padded[:,axis],weights,mode='valid') for axis in [0,1]])

def make_curve(rawpoints,fullimage,color,stationanchors):
    raw=resample(rawpoints,2)
    center=raw.copy()
    target=np.array([int(color[i:i+2],16) for i in [1,3,5]])
    # Correct the grid path toward the middle of each real colored band.
    # Circles and gradients are excluded; they are bridged by global smoothing.
    anchor_distance=np.min(np.linalg.norm(center[:,None,:]-np.asarray(stationanchors)[None,:,:],axis=2),axis=1)
    shifted_before=np.vstack([center[:4],center[:-4]])
    shifted_after=np.vstack([center[4:],center[-4:]])
    tangent=shifted_after-shifted_before
    tangent/=np.maximum(1e-6,np.linalg.norm(tangent,axis=1))[:,None]
    normals=np.column_stack([-tangent[:,1],tangent[:,0]])
    offsets=np.arange(-7,7.1,.5)
    locations=center[:,None,:]+normals[:,None,:]*offsets[None,:,None]
    xs=np.clip(locations[:,:,0],0,fullimage.shape[1]-1).astype(np.float32)
    ys=np.clip(locations[:,:,1],0,fullimage.shape[0]-1).astype(np.float32)
    pixels=cv2.remap(fullimage,xs,ys,cv2.INTER_LINEAR)
    delta=np.linalg.norm(pixels-target,axis=2)
    valid=(delta<40)&(pixels.max(2)-pixels.min(2)>20)
    weights=np.maximum(0,1-delta/40)**2*valid
    denominator=weights.sum(1)
    correction=(weights*offsets[None,:]).sum(1)/np.maximum(denominator,1e-8)
    correction=np.clip(correction,-2.5,2.5)
    correction[(anchor_distance<19)|(denominator<1)]=0
    center+=normals*correction[:,None]
    # An eight-pixel kernel removes ring-induced wiggles as well as pixel stairs;
    # the corridor clamp below preserves the actual geographic bend locations.
    smooth=gaussian(center,4)
    smooth[0]=raw[0];smooth[-1]=raw[-1]
    # Keep displacement from the traced corridor bounded.
    movement=smooth-raw;lengths=np.linalg.norm(movement,axis=1)
    smooth=raw+movement*np.minimum(1,3.5/np.maximum(lengths,1e-8))[:,None]
    knots=resample(smooth,10)
    tangents=np.empty_like(knots)
    tangents[1:-1]=(knots[2:]-knots[:-2])/2
    tangents[0]=knots[1]-knots[0];tangents[-1]=knots[-1]-knots[-2]
    controls=[];drawpoints=[]
    for i in range(len(knots)-1):
        p0,p3=knots[i],knots[i+1]
        p1=p0+tangents[i]/3;p2=p3-tangents[i+1]/3
        controls.append((p0,p1,p2,p3))
        ts=np.linspace(0,1,9)[:,None]
        values=(1-ts)**3*p0+3*(1-ts)**2*ts*p1+3*(1-ts)*ts**2*p2+ts**3*p3
        drawpoints.extend(values[:-1].tolist())
    drawpoints.append(knots[-1].tolist())
    fmt=lambda p:f'{p[0]:.2f},{p[1]:.2f}'
    d='M '+fmt(knots[0])
    for p0,p1,p2,p3 in controls:d+=' C '+fmt(p1)+' '+fmt(p2)+' '+fmt(p3)
    # Compare densely sampled cubic geometry to the original traced corridor.
    raster=np.ones(fullimage.shape[:2],dtype=np.uint8)
    cv2.polylines(raster,[np.rint(raw).astype(np.int32)],False,0,1)
    distance=cv2.distanceTransform(raster,cv2.DIST_L2,5)
    values=cv2.remap(distance,np.asarray(drawpoints)[:,0].astype(np.float32),np.asarray(drawpoints)[:,1].astype(np.float32),cv2.INTER_LINEAR).ravel()
    stats={'kind':'globally tangent-continuous cubic Bezier','cubicCount':len(controls),'rawPointCount':len(rawpoints),'maxTracedCorridorDeviation':round(float(values.max()),2),'p95TracedCorridorDeviation':round(float(np.percentile(values,95)),2)}
    assert values.max()<4.5,stats
    return d,drawpoints,stats
