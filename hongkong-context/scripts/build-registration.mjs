import { readFileSync, writeFileSync } from 'node:fs';
import { registerDiagram } from '../../shenzhen/src/data/map-registration.mjs';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const stations = read('../data/stations.json'), coordinates = read('../data/station-coordinates.json');
// Fit the entire reference to its own 41 government-source station coordinates.
// Border icons follow the resulting endpoints and must never displace stations.
const fit = registerDiagram(stations, coordinates, 4375);
const reference = { origin: fit.origin, east: fit.east };
const registration = registerDiagram(stations, coordinates, 4375, reference);
const distance = (a,b) => Math.hypot((a.lon-b.lon)*Math.cos((a.lat+b.lat)*Math.PI/360), a.lat-b.lat)*111320;
const deviations = stations.map(station => ({ id: station.id, name: station.name, reference: coordinates[station.id], displayed: registration.stationCoordinates[station.id], errorMeters: +distance(registration.stationCoordinates[station.id], coordinates[station.id]).toFixed(1) }));
const rms = Math.sqrt(deviations.reduce((sum,station) => sum+station.errorMeters**2,0)/stations.length);
const review = { method: 'One north-up Mercator scale and translation fitted to all 41 government-source WGS84 station coordinates. No Shenzhen-derived fixed offset or icon-spacing adjustment.',
  rootCause: 'The former registration inferred Hong Kong station positions from Shenzhen display anchors and a fabricated southward gap, introducing systematic scale and position errors.',
  rmsGovernmentDeviationMeters: +rms.toFixed(1),
  maximumGovernmentDeviationMeters: Math.max(...deviations.map(station => station.errorMeters)),
  stations: deviations,
  note: 'Residual differences come from preserving the supplied reference geometry under a single uniform transform; the border connectors follow station positions.' };
if (rms > 80 || review.maximumGovernmentDeviationMeters > 200 || deviations.filter(station => ['LOW','LMC'].includes(station.id)).some(station => station.errorMeters > 110)) throw new Error(JSON.stringify(review));
writeFileSync(new URL('../data/diagram-registration.json', import.meta.url), JSON.stringify(reference, null, 2)+'\n');
writeFileSync(new URL('./registration-review.json', import.meta.url), JSON.stringify(review, null, 2)+'\n');
console.log(JSON.stringify(review, null, 2));
