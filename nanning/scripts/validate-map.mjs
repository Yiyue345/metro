import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { validateVisitedStations } from '../../shenzhen/src/data/validate-visited.mjs';
import { validateStationNotes } from '../../shenzhen/src/data/validate-station-notes.mjs';
const data = new URL('../data/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, data), 'utf8'));
const source = readFileSync(new URL('stations.ts', data), 'utf8');
const stations = JSON.parse(source.split('export const stations: Station[] = ')[1].replace(/;\s*$/, ''));
const roster = read('official-roster.json');
const symbols = read('station-symbols.json');
const labels = read('station-labels.json');
const english = read('station-english.json');
const colors = read('line-colors.json');
const paths = read('route-paths.json');
const visited = read('visited-stations.json');
const notes = read('station-notes.json');
const planned = read('planned-stations.json');
const ids = new Set(stations.map(s => s.id));
assert.equal(ids.size, 95);
assert.equal(stations.length, 95);
assert.equal(new Set(stations.map(s => `${s.x},${s.y}`)).size, stations.length, 'Distinct stations must not share a diagram position');
assert.deepEqual(roster.lines.map(l => l.stations.length), [25, 23, 23, 18, 17]);
assert.equal(paths.length, 5);
validateVisitedStations(visited, ids);
validateStationNotes(notes, new Set([...ids, ...planned.map(station => station.id)]));
assert.equal(planned.length, 1);
assert.equal(planned[0].id, '五象火车站');
assert(!ids.has(planned[0].id));
for (const entries of [symbols, labels, english]) assert.deepEqual(new Set(Object.keys(entries)), ids);
for (const station of stations) {
  const memberships = roster.lines.filter(l => l.stations.includes(station.id)).map(l => l.id);
  assert.deepEqual(station.lines, memberships, station.id);
  assert.deepEqual(new Set(symbols[station.id].parts.flatMap(p => p.lines)), new Set(memberships), station.id);
  assert(station.x >= 0 && station.x <= 2060 && station.y >= 0 && station.y <= 1360, station.id);
  assert(english[station.id].trim() && !/[\u4e00-\u9fff]/.test(english[station.id]), station.id);
}
for (const line of roster.lines) {
  assert(/^#[0-9a-f]{6}$/i.test(colors[line.id]));
  const route = paths.find(r => r.id === line.id);
  assert(route && route.color === colors[line.id] && route.paths.every(p => p.startsWith('M ') && p.includes(' C ') && !p.includes('NaN')));
  assert(existsSync(new URL(`../public/lines/${line.id}.svg`, import.meta.url)));
}
const report = JSON.parse(readFileSync(new URL('route-tracing-report.json', import.meta.url), 'utf8'));
assert.equal(report.reduce((sum, r) => sum + r.segmentCount, 0), 101);
assert(report.every(r => r.suspiciousSegments.length === 0 && r.stationCoverage.every(s => s.curveDistance < 4.5)));
assert(report.every(r => r.curveStats.maxTracedCorridorDeviation < 4.5));
assert(report.every(r => r.segments.every(s => s.directLength > 0)), 'Consecutive stations must have distinct tracing anchors');
const polylines = JSON.parse(readFileSync(new URL('route-polylines.json', import.meta.url), 'utf8'));
for (const station of planned) {
  for (const part of station.symbol.parts) {
    assert.equal(part.x, station.x, `${station.id}: symbol and interaction x must agree`);
    assert.equal(part.y, station.y, `${station.id}: symbol and interaction y must agree`);
    for (const line of part.lines) {
      const distance = Math.min(...polylines[line].map(([x, y]) => Math.hypot(part.x - x, part.y - y)));
      assert(distance < 1, `${station.id}: unopened station must sit on its route (${distance.toFixed(2)}px)`);
    }
  }
}
if (existsSync(new URL('station-coordinates.json', data))) {
  const coordinates = read('station-coordinates.json');
  for (const s of stations) {
    const c = coordinates[s.id];
    assert(c && Number.isFinite(c.lon) && Number.isFinite(c.lat), s.id);
    assert(c.lon > 108 && c.lon < 109 && c.lat > 22.5 && c.lat < 23.2, s.id);
  }
  console.log(`WGS84 coordinates verified: ${Object.keys(coordinates).length}.`);
} else {
  console.log('Station coordinate verification pending: station-coordinates.json is absent.');
}
console.log('Verified 95 operating stations, 1 unopened station, 5 routes, 101 station-to-station segments, labels, symbols, English, badges, visited list and station notes.');
