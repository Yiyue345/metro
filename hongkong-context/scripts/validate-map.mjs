import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerDiagram } from '../../shenzhen/src/data/map-registration.mjs';
const read = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const stations = read('stations'), roster = read('official-roster'), routes = read('route-paths');
const symbols = read('station-symbols'), labels = read('station-labels'), english = read('station-english');
const coordinates = read('station-coordinates'), colors = read('line-colors'), reference = read('diagram-registration');
const ids = stations.map(station => station.id).sort();
assert.equal(stations.length, 41);
assert.deepEqual(ids, roster.stations.map(station => station.id).sort());
for (const data of [symbols, labels, english, coordinates]) assert.deepEqual(Object.keys(data).sort(), ids);
assert.deepEqual(routes.map(route => route.id).sort(), ['EAL', 'TML']);
assert.equal(routes.find(route => route.id === 'EAL').paths.length, 3);
assert.equal(routes.find(route => route.id === 'TML').paths.length, 1);
assert.deepEqual(stations.filter(station => station.lines.length > 1).map(station => station.id).sort(), ['HUH', 'TAW']);
const eal = roster.lines.find(line => line.id === 'EAL');
assert(eal.paths.some(path => path.join() === 'SHS,LMC'));
assert(eal.paths.some(path => path.join() === 'SHT,RAC,UNI'));
assert.equal(symbols.HUH.joined, true);
assert.equal(symbols.HUH.parts.length, 2);
for (const station of stations) {
  assert(Number.isFinite(station.x) && Number.isFinite(station.y));
  assert(station.x >= 0 && station.x <= 4375 && station.y >= 0 && station.y <= 3125);
  assert(english[station.id].trim());
  assert.deepEqual([...new Set(symbols[station.id].parts.flatMap(part => part.lines))].sort(), [...station.lines].sort());
  assert(['start', 'middle', 'end'].includes(labels[station.id].anchor));
  assert(coordinates[station.id].lat > 22.2 && coordinates[station.id].lat < 22.6);
}
for (const route of routes) {
  assert.equal(route.color, colors[route.id]);
  for (const path of route.paths) {
    assert.match(path, /^M [-\d., ]+( C [-\d., ]+)+$/);
    const parts = path.split(' C '); let end = parts[0].slice(2).split(',').map(Number), incoming;
    for (const part of parts.slice(1)) {
      const [x1,y1,x2,y2,x3,y3] = part.split(/[ ,]+/).map(Number), outgoing = [x1-end[0], y1-end[1]];
      if (incoming) {
        const norm = Math.hypot(...incoming)*Math.hypot(...outgoing);
        assert(norm > 0 && (incoming[0]*outgoing[0]+incoming[1]*outgoing[1])/norm > Math.cos(Math.PI/180), 'Curve tangent discontinuity');
      }
      incoming = [x3-x2,y3-y2]; end = [x3,y3];
    }
  }
}
const tracing = JSON.parse(readFileSync(new URL('./route-tracing-report.json', import.meta.url), 'utf8'));
assert.equal(tracing.reduce((sum,path) => sum+path.segments.length,0), 42);
assert(tracing.every(path => path.coverage.every(station => station.distance < 4.5)));
assert(tracing.every(path => path.segments.every(segment => segment.maxColorDistance < 12 && segment.offBandFraction < .05)));
const registration = registerDiagram(stations, coordinates, 4375, reference);
assert(Object.values(registration.stationCoordinates).every(point => Number.isFinite(point.lon) && Number.isFinite(point.lat)));
// Geographic regression: icon spacing must not pull the context back across the river.
const distance = (a,b) => Math.hypot((a.lon-b.lon)*Math.cos((a.lat+b.lat)*Math.PI/360),a.lat-b.lat)*111320;
const errors = stations.map(station => distance(registration.stationCoordinates[station.id],coordinates[station.id]));
assert(Math.max(...errors) < 200, 'HK station registration exceeds 200m');
assert(Math.sqrt(errors.reduce((sum,error)=>sum+error**2,0)/errors.length) < 80, 'HK registration RMS exceeds 80m');
for (const id of ['LOW','LMC']) assert(distance(registration.stationCoordinates[id],coordinates[id]) < 110, `Border station misplaced: ${id}`);
console.log('Verified 41 HK context stations, EAL/TML only, 4 continuous paths and 42 source-traced intervals, two shared stations, both border branches, Racecourse branch and uniform registration.');
