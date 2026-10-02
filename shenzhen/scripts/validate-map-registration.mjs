import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerDiagram } from '../src/data/map-registration.mjs';

const source = readFileSync(new URL('../src/data/stations.ts', import.meta.url), 'utf8');
const stations = JSON.parse(source.split('export const stations: Station[] = ')[1].trim().replace(/;$/, ''));
const coordinates = JSON.parse(readFileSync(new URL('../src/data/station-coordinates.json', import.meta.url), 'utf8'));
const registration = registerDiagram(stations, coordinates, 5950);
const project = ({ lon, lat }) => [lon / 360 + .5,
  (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2];
const origin = project(registration.origin), east = project(registration.east);
const scale = (east[0] - origin[0]) / 5950;
assert(scale > 0);
assert(Math.abs(east[1] - origin[1]) < 1e-12, 'Diagram must stay north-up');
for (const station of stations) {
  const position = project(registration.stationCoordinates[station.id]);
  assert(Math.abs((position[0] - origin[0]) / scale - station.x) < 1e-6, `Changed x geometry: ${station.id}`);
  assert(Math.abs((position[1] - origin[1]) / scale - station.y) < 1e-6, `Changed y geometry: ${station.id}`);
}
console.log(`Validated one shared x/y scale and translation for all ${stations.length} stations; diagram proportions unchanged.`);
