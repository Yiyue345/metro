import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { validateVisitedStations } from '../../shenzhen/src/data/validate-visited.mjs';
import { validateStationNotes } from '../../shenzhen/src/data/validate-station-notes.mjs';

const data = new URL('../data/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, data), 'utf8'));
const source = readFileSync(new URL('stations.ts', data), 'utf8');
const stations = JSON.parse(source.split('export const stations: Station[] = ')[1].replace(/;\s*$/, ''));
const roster = read('official-roster.json');
const meta = read('source-meta.json');
const symbols = read('station-symbols.json');
const labels = read('station-labels.json');
const english = read('station-english.json');
const colors = read('line-colors.json');
const paths = read('route-paths.json');
const planned = read('planned-stations.json');
const coordinates = read('station-coordinates.json');
const ids = new Set(stations.map(station => station.id));
const lineIds = ['1', '2'];

assert.equal(ids.size, 39);
assert.equal(stations.length, 39);
assert.equal(new Set(stations.map(station => `${station.x},${station.y}`)).size, stations.length, 'Distinct stations must not share a diagram position');
assert.equal(roster.edition, '2026.08');
assert.equal(meta.edition, roster.edition);
assert.deepEqual([meta.width, meta.height], [2070, 1500]);
assert.deepEqual(meta.crop, [650, 250, 2720, 1750]);
assert.match(source, /mapMeta = \{ width: 2070, height: 1500,/);
assert.deepEqual(roster.lines.map(line => line.id), lineIds, 'Only metro lines 1 and 2 belong in this map');
assert.deepEqual(roster.lines.map(line => line.stations.length), [25, 15]);
assert.deepEqual(new Set(roster.lines.flatMap(line => line.stations)), ids);
assert.deepEqual(stations.filter(station => station.lines.length > 1).map(station => station.id), ['市民中心']);
assert.deepEqual(planned, []);
assert.match(source, /export const plannedStations: Station\[\] = \[\];/);
validateVisitedStations(read('visited-stations.json'), ids);
validateStationNotes(read('station-notes.json'), ids);
for (const entries of [symbols, labels, english, coordinates]) assert.deepEqual(new Set(Object.keys(entries)), ids);
assert.deepEqual(new Set(Object.keys(colors)), new Set(lineIds));
assert.equal(paths.length, 2);
assert.deepEqual(new Set(paths.map(route => route.id)), new Set(lineIds));

for (const station of stations) {
  const memberships = roster.lines.filter(line => line.stations.includes(station.id)).map(line => line.id);
  assert.deepEqual(station.lines, memberships, station.id);
  assert.deepEqual(new Set(symbols[station.id].parts.flatMap(part => part.lines)), new Set(memberships), station.id);
  assert(station.x >= 0 && station.x <= meta.width && station.y >= 0 && station.y <= meta.height, station.id);
  assert(english[station.id].trim() && !/[\u4e00-\u9fff]/.test(english[station.id]), station.id);
  const label = labels[station.id];
  assert(Number.isFinite(label.x) && Number.isFinite(label.y) && label.fontSize > 0, station.id);
  const coordinate = coordinates[station.id];
  assert(Number.isFinite(coordinate.lon) && Number.isFinite(coordinate.lat), station.id);
  assert(coordinate.lon > 113.4 && coordinate.lon < 114.5 && coordinate.lat > 22.6 && coordinate.lat < 23.4, station.id);
}
for (const line of roster.lines) {
  assert.equal(new Set(line.stations).size, line.stations.length, line.id);
  assert(/^#[0-9a-f]{6}$/i.test(colors[line.id]));
  const route = paths.find(path => path.id === line.id);
  assert(route.color === colors[line.id] && route.paths.length > 0 && route.paths.every(path => path.startsWith('M ') && path.includes(' C ') && !/NaN|Infinity/.test(path)));
  assert(existsSync(new URL(`../public/lines/${line.id}.svg`, import.meta.url)));
}

const report = JSON.parse(readFileSync(new URL('route-tracing-report.json', import.meta.url), 'utf8'));
assert.equal(report.length, 2);
assert.deepEqual(new Set(report.map(route => route.id)), new Set(lineIds));
assert.equal(report.reduce((sum, route) => sum + route.segmentCount, 0), 38);
for (const route of report) {
  const line = roster.lines.find(line => line.id === route.id);
  assert.equal(route.stationCount, line.stations.length);
  assert.equal(route.segmentCount, line.stations.length - 1);
  assert.equal(route.segments.length, route.segmentCount);
  assert.equal(route.suspiciousSegments.length, 0);
  assert.deepEqual(route.stationCoverage.map(station => station.name), line.stations);
  assert(route.stationCoverage.every(station => station.curveDistance >= 0 && station.curveDistance < 4.5));
  assert(route.curveStats.maxTracedCorridorDeviation >= 0 && route.curveStats.maxTracedCorridorDeviation < 4.5);
  for (const [index, segment] of route.segments.entries()) {
    assert.equal(segment.from, line.stations[index]);
    assert.equal(segment.to, line.stations[index + 1]);
    assert(segment.directLength > 0, 'Consecutive stations must have distinct tracing anchors');
    assert.equal(segment.suspicious, false);
  }
}
console.log('Verified 39 operating stations, Civic Center as the only transfer, 2 metro routes, 38 station-to-station segments, WGS84 coordinates, labels, symbols, English, badges, visited list and station notes.');
