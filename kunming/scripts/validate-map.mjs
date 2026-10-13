import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateVisitedStations } from '../../shenzhen/src/data/validate-visited.mjs';
import { validateStationNotes } from '../../shenzhen/src/data/validate-station-notes.mjs';

const data = new URL('../data/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, data), 'utf8'));
const report = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const source = readFileSync(new URL('stations.ts', data), 'utf8');
const stations = JSON.parse(source.split('export const stations: Station[] = ')[1].replace(/;\s*$/, ''));
const roster = read('official-roster.json'), meta = read('source-meta.json');
const checked = report('reference-roster.json');
const symbols = read('station-symbols.json'), labels = read('station-labels.json'), english = read('station-english.json');
const colors = read('line-colors.json'), paths = read('route-paths.json'), coordinates = read('station-coordinates.json');
const ids = new Set(stations.map(station => station.id)), lineIds = ['1', '2', '3', '4', '5', '6'];
assert.equal(ids.size, 103); assert.equal(stations.length, 103);
assert.equal(new Set(stations.map(station => `${station.x},${station.y}`)).size, 103);
assert.equal(roster.edition, '2026.07'); assert.equal(meta.edition, roster.edition);
assert.deepEqual([meta.width, meta.height], [1980, 1960]); assert.deepEqual(meta.crop, [650, 90, 2630, 2050]);
assert.match(source, /mapMeta = \{ width: 1980, height: 1960,/);
assert.deepEqual(roster.lines.map(line => line.id), lineIds);
assert.deepEqual(roster.lines.map(line => line.stations.length), [22, 14, 20, 29, 22, 8]);
assert.deepEqual(new Set(roster.lines.flatMap(line => line.stations)), ids);
assert.equal(stations.reduce((sum, station) => sum + station.lines.length, 0), 115);
assert.deepEqual(read('planned-stations.json'), []);
validateVisitedStations(read('visited-stations.json'), ids); validateStationNotes(read('station-notes.json'), ids);
for (const entries of [symbols, labels, english, coordinates]) assert.deepEqual(new Set(Object.keys(entries)), ids);
assert.deepEqual(new Set(Object.keys(colors)), new Set(lineIds)); assert.equal(paths.length, 6);
assert.deepEqual(new Set(paths.map(route => route.id)), new Set(lineIds));
for (const station of stations) {
  const verified = checked.stations.find(value => value.id === station.id);
  assert(verified); assert.equal(station.name, verified.name); assert.equal(english[station.id], verified.englishName);
  const memberships = roster.lines.filter(line => line.stations.includes(station.id)).map(line => line.id);
  assert.deepEqual(station.lines, memberships, station.id);
  assert.deepEqual(new Set(symbols[station.id].parts.flatMap(part => part.lines)), new Set(memberships), station.id);
  assert(station.x >= 0 && station.x <= meta.width && station.y >= 0 && station.y <= meta.height, station.id);
  assert(english[station.id].trim() && !/[\u4e00-\u9fff]/.test(english[station.id]), station.id);
  const label = labels[station.id]; assert(Number.isFinite(label.x) && Number.isFinite(label.y) && label.fontSize > 0, station.id);
  assert(['start', 'middle', 'end'].includes(label.anchor), station.id);
  const coordinate = coordinates[station.id];
  assert(Number.isFinite(coordinate.lon) && Number.isFinite(coordinate.lat), station.id);
  assert(coordinate.lon > 102.3 && coordinate.lon < 103.4 && coordinate.lat > 24.5 && coordinate.lat < 25.4, station.id);
}
for (const line of roster.lines) {
  assert.equal(new Set(line.stations).size, line.stations.length, line.id);
  assert.deepEqual(line.paths, checked.linePaths[line.id]);
  assert.deepEqual(new Set(line.paths.flat()), new Set(line.stations));
  assert(/^#[0-9a-f]{6}$/i.test(colors[line.id]));
  const route = paths.find(path => path.id === line.id);
  assert.equal(route.paths.length, line.paths.length);
  assert(route.color === colors[line.id] && route.paths.every(path => path.startsWith('M ') && path.includes(' C ') && !/NaN|Infinity/.test(path)));
  assert(existsSync(new URL(`../public/lines/${line.id}.svg`, import.meta.url)));
}
const coordinateReport = report('station-coordinates-report.json');
assert.equal(coordinateReport.operatingRosterMatched, true); assert.deepEqual(coordinateReport.missing, []);
assert.equal(coordinateReport.stations.length, 103);
assert.equal(coordinateReport.snapshotSHA256, createHash('sha256').update(readFileSync(new URL('amap-kunming-source.json', import.meta.url))).digest('hex'));
for (const station of coordinateReport.stations) {
  assert.equal(station.sourceCRS, 'gcj02'); assert.equal(station.outputCRS, 'WGS84'); assert(station.sourceId);
  assert.deepEqual(station.coordinate, coordinates[station.id]);
}
const traces = report('route-tracing-report.json'), reviews = report('route-review.json').reviewedSegments;
const sequences = roster.lines.flatMap(line => line.paths.map(path => ({ id: line.id, stations: path })));
assert.equal(traces.length, 7);
for (const [index, trace] of traces.entries()) {
  const sequence = sequences[index]; assert.equal(trace.id, sequence.id);
  assert.equal(trace.stationCount, sequence.stations.length); assert.equal(trace.segmentCount, sequence.stations.length - 1);
  assert.deepEqual(trace.stationCoverage.map(station => station.name), sequence.stations);
  assert(trace.stationCoverage.every(station => station.curveDistance >= 0 && station.curveDistance < 4.5));
  assert(trace.curveStats.maxTracedCorridorDeviation < 4.5);
  for (const [i, segment] of trace.segments.entries()) {
    assert.equal(segment.from, sequence.stations[i]); assert.equal(segment.to, sequence.stations[i + 1]); assert(segment.directLength > 0);
    if (segment.suspicious) {
      assert(reviews.some(review => review.line === trace.id && review.from === segment.from && review.to === segment.to));
      assert(segment.maxColorDistance < 14 && segment.offBandFraction < .28 && segment.length < segment.directLength * 1.4);
    }
  }
}
console.log('Verified 103 operating stations, 115 line memberships, 6 lines with a branched Line 1, 103 source-backed WGS84 coordinates, complete names/symbols/labels, and 7 continuous route paths.');
