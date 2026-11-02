import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateVisitedStations } from '../../shenzhen/src/data/validate-visited.mjs';
import { validateStationNotes } from '../../shenzhen/src/data/validate-station-notes.mjs';
const read = name => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'));
const report = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const source = readFileSync(new URL('../data/stations.ts', import.meta.url), 'utf8');
const stations = JSON.parse(source.split('export const stations: Station[] = ')[1].replace(/;\s*$/, ''));
const planned = read('planned-stations.json'), all = [...stations, ...planned];
const ids = new Set(stations.map(s => s.id)), allIds = new Set(all.map(s => s.id));
const roster = read('official-roster.json'), checked = report('reference-roster.json'), meta = read('source-meta.json');
const symbols = read('station-symbols.json'), labels = read('station-labels.json'), english = read('station-english.json');
const colors = read('line-colors.json'), paths = read('route-paths.json'), coordinates = read('station-coordinates.json');
assert.equal(stations.length, 40); assert.equal(ids.size, 40); assert.equal(allIds.size, 41);
assert.equal(new Set(all.map(s => `${s.x},${s.y}`)).size, 41);
assert.deepEqual(planned.map(s => [s.id, s.status]), [['张墅', 'planned']]);
assert(symbols['张墅'].parts[0].planned);
assert.deepEqual(roster.lines.map(l => [l.id, l.stations.length]), [['1', 32], ['2', 9]]);
assert.deepEqual(roster.lines.map(l => l.paths.length), [2, 1]);
assert.deepEqual(roster.lines[0].paths[1], ['黄酒小镇', '绍兴一中', '湖西', '大庆寺', '绍兴北站', '会展中心']);
assert.equal(roster.edition, '2026.05'); assert.equal(meta.edition, roster.edition);
assert.deepEqual(meta.crop, [3600, 2570, 5740, 4380]); assert.deepEqual([meta.width, meta.height], [2140, 1810]);
assert.deepEqual(new Set(roster.lines.flatMap(l => l.stations)), ids);
validateVisitedStations(read('visited-stations.json'), ids); validateStationNotes(read('station-notes.json'), ids);
for (const table of [symbols, labels, english, coordinates]) assert.deepEqual(new Set(Object.keys(table)), allIds);
for (const station of all) {
  assert(station.x >= 0 && station.x <= meta.width && station.y >= 0 && station.y <= meta.height, station.id);
  const verified = checked.stations.find(s => s.id === station.id); assert(verified);
  assert.equal(english[station.id], verified.englishName);
  assert.deepEqual(labels[station.id], verified.label);
  assert.deepEqual(new Set(symbols[station.id].parts.flatMap(p => p.lines)), new Set(station.lines));
  assert(english[station.id] && !/[\u4e00-\u9fff]/.test(english[station.id]));
  const label = labels[station.id]; assert(Number.isFinite(label.x) && Number.isFinite(label.y) && label.fontSize === 14);
  assert(['start', 'middle', 'end'].includes(label.anchor));
  const coordinate = coordinates[station.id]; assert(coordinate.lon > 120.3 && coordinate.lon < 121 && coordinate.lat > 29.8 && coordinate.lat < 30.3);
}
assert(stations.find(s => s.id === '人民医院总院').aliases.includes('镜湖医院'));
for (const line of roster.lines) {
  const route = paths.find(p => p.id === line.id); assert(route);
  assert.equal(route.paths.length, line.paths.length); assert.equal(route.color, colors[line.id]);
  assert(route.paths.every(p => p.startsWith('M ') && p.includes(' C ') && !/NaN|Infinity/.test(p)));
  assert(existsSync(new URL(`../public/lines/${line.id}.svg`, import.meta.url)));
}
const traces = report('route-tracing-report.json'); assert.equal(traces.length, 3);
assert.deepEqual(traces.map(t => t.stationCount), [27, 6, 9]);
assert.equal(traces.reduce((sum, t) => sum + t.segmentCount, 0), 39);
for (const trace of traces) {
  assert(trace.stationCoverage.every(s => s.curveDistance < 4.5));
  assert(trace.curveStats.maxTracedCorridorDeviation < 4.5);
  assert.deepEqual(trace.suspiciousSegments, []);
}
const coordinateReport = report('station-coordinates-report.json');
assert.equal(coordinateReport.stations.length, 41); assert.deepEqual(coordinateReport.missing, []);
assert.equal(coordinateReport.operatingRosterMatched, true);
assert.equal(coordinateReport.snapshotSHA256, createHash('sha256').update(readFileSync(new URL('amap-shaoxing-source.json', import.meta.url))).digest('hex'));
for (const station of coordinateReport.stations) {
  assert.equal(station.sourceCRS, 'gcj02'); assert.equal(station.outputCRS, 'WGS84'); assert(station.sourceId);
  assert.deepEqual(station.coordinate, coordinates[station.id]);
}
assert.deepEqual(report('label-collision-report.json').textOverlaps, []);
console.log('Verified Shaoxing: 40 operating + 1 deferred station, 2 lines / 3 continuous paths, 39 source-traced segments, 41 WGS84 coordinates, complete bilingual labels/symbols, no raster-review text overlaps.');
