import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const source = readFileSync(new URL('../src/data/stations.ts', import.meta.url), 'utf8');
const stations = JSON.parse(source.split('export const stations: Station[] = ')[1].trim().replace(/;$/, ''));
const routes = data('route-paths');
const symbols = data('station-symbols');
const labels = data('station-labels');
const colors = data('line-colors');
const geography = data('map-geography');
const english = data('station-english');
const plannedStations = data('planned-stations');
const ids = stations.map(station => station.id).sort();
assert.deepEqual(Object.keys(symbols).sort(), ids, 'Station symbols must cover the station roster');
assert.deepEqual(Object.keys(labels).sort(), ids, 'Labels must cover the station roster');
assert.deepEqual(Object.keys(english).sort(), ids, 'English names must cover the station roster');
assert.deepEqual(routes.map(route => route.id).sort(), Object.keys(colors).sort(), 'Routes must cover every line exactly once');

function validatePath(path) {
  assert.equal(typeof path, 'string');
  assert.match(path, /^M/i, 'SVG paths must start with a move');
  assert.match(path, /^[MLCQZHVSAmlcqzhvsa\d.,\s+eE-]+$/, 'Invalid SVG path data');
  assert(!/NaN|Infinity/.test(path));
}
for (const route of routes) {
  assert(route.paths.length > 0, `Missing route ${route.id}`);
  assert(route.width > 0 && route.width <= 20, `Invalid stroke width for ${route.id}`);
  assert.equal(route.color, colors[route.id], `Line color mismatch for ${route.id}`);
  route.paths.forEach(validatePath);
  // The full route shares a tangent at every cubic join, including stations.
  for (const path of route.paths) {
    assert(!/[LQ]/i.test(path), `Unsmooth segment in route ${route.id}`);
    const parts = path.split(' C ');
    let end = parts[0].slice(2).split(',').map(Number);
    let incoming;
    for (const part of parts.slice(1)) {
      const [x1, y1, x2, y2, x3, y3] = part.split(/[ ,]+/).map(Number);
      const outgoing = [x1 - end[0], y1 - end[1]];
      if (incoming) {
        const norm = Math.hypot(...incoming) * Math.hypot(...outgoing);
        assert(norm > 0, `Degenerate curve in route ${route.id}`);
        const dot = (incoming[0] * outgoing[0] + incoming[1] * outgoing[1]) / norm;
        assert(dot > Math.cos(Math.PI / 180), `Tangent discontinuity in route ${route.id}`);
      }
      incoming = [x3 - x2, y3 - y2];
      end = [x3, y3];
    }
  }
}
for (const station of stations) {
  assert(typeof english[station.id] === 'string' && english[station.id].trim(), `Missing English name: ${station.id}`);
  const label = labels[station.id];
  assert(Number.isFinite(label.x) && label.x >= 0 && label.x <= 5950, station.id);
  assert(Number.isFinite(label.y) && label.y >= 0 && label.y <= 4250, station.id);
  assert(['start', 'middle', 'end'].includes(label.anchor), station.id);
  assert(label.fontSize > 0 && label.fontSize <= 30, station.id);
  const parts = symbols[station.id].parts;
  assert.deepEqual([...new Set(parts.flatMap(part => part.lines))].sort(), [...station.lines].sort(), `Platform line mismatch: ${station.id}`);
}
for (const layer of geography) {
  assert(['water', 'park'].includes(layer.kind));
  layer.paths.forEach(validatePath);
}
for (const station of plannedStations) {
  assert.equal(station.status, 'planned', station.id);
  assert(!ids.includes(station.id), `Planned station must not enter the operating roster: ${station.id}`);
  assert(station.englishName.trim(), station.id);
  assert(station.lines.every(id => Object.hasOwn(colors, id)), station.id);
  assert(Number.isFinite(station.x) && station.x >= 0 && station.x <= 5950, station.id);
  assert(Number.isFinite(station.y) && station.y >= 0 && station.y <= 4250, station.id);
  assert(['start', 'middle', 'end'].includes(station.label.anchor), station.id);
  assert(station.symbol.parts.every(part => part.planned), station.id);
  assert.deepEqual([...new Set(station.symbol.parts.flatMap(part => part.lines))].sort(), [...station.lines].sort(), station.id);
}
const chegongmiao = symbols['车公庙'].parts[0];
assert.equal(chegongmiao.width, chegongmiao.height, 'Chegongmiao must be square');
assert(chegongmiao.cornerRadius > 1.8 && chegongmiao.cornerRadius < chegongmiao.width / 2, 'Chegongmiao must have rounded corners');
console.log(`Validated ${routes.length} routes, ${stations.length} stations and labels, ${geography.reduce((n, layer) => n + layer.paths.length, 0)} geography paths.`);
