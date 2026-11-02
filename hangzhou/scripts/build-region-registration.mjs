import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {registerDiagram} from '../../shenzhen/src/data/map-registration.mjs';
const read=(city,file)=>JSON.parse(readFileSync(new URL(`../../${city}/data/${file}`,import.meta.url),'utf8'));
const cities=['hangzhou','shaoxing'];
const stations=city=>JSON.parse(readFileSync(new URL(`../../${city}/data/stations.ts`,import.meta.url),'utf8').split('export const stations: Station[] = ')[1].replace(/;\s*$/,''));
const controls=[],coordinates={};
for(const city of cities){const meta=read(city,'source-meta.json'),coords=read(city,'station-coordinates.json');for(const s of stations(city)){const id=`${city}:${s.id}`;controls.push({...s,id,x:s.x+meta.crop[0],y:s.y+meta.crop[1]});coordinates[id]=coords[s.id];}}
const fit=registerDiagram(controls,coordinates,6300);
const project=({lon,lat})=>[lon/360+.5,(1-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))/Math.PI)/2];
const unproject=([x,y])=>({lon:(x-.5)*360,lat:Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI});
const origin=project(fit.origin),scale=(project(fit.east)[0]-origin[0])/6300;
const locate=(x,y)=>unproject([origin[0]+x*scale,origin[1]+y*scale]);
const registrations={};
for(const city of cities){const meta=read(city,'source-meta.json');const reference={origin:locate(meta.crop[0],meta.crop[1]),east:locate(meta.crop[0]+meta.width,meta.crop[1])};writeFileSync(new URL(`../../${city}/data/diagram-registration.json`,import.meta.url),JSON.stringify(reference,null,2)+'\n');registrations[city]=registerDiagram(stations(city),read(city,'station-coordinates.json'),meta.width,reference);}
const a=project(registrations.hangzhou.stationCoordinates['姑娘桥']),b=project(registrations.shaoxing.stationCoordinates['姑娘桥']);
assert(Math.hypot(a[0]-b[0],a[1]-b[1])/scale<1,'The shared interchange must align within one source pixel.');
console.log(`Registered both crops to one north-up scale using ${controls.length} source-backed station controls; Guniangqiao aligned.`);
