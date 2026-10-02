import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { closestPoint } from './route-geometry.mjs';

const readData = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const routes = readData('route-paths');
const sourceCoordinates = readData('station-coordinates');
const geography = readData('geographic-routes');
const symbols = readData('station-symbols');
const world = ([lon, lat]) => [lon / 360 * 512 * 2 ** 14,
  (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2 * 512 * 2 ** 14];
const screenRoutes = Object.fromEntries(geography.features.map(feature => [feature.properties.lineId, feature.geometry.coordinates.map(world)]));
assert.equal(geography.type, 'FeatureCollection');
assert.deepEqual(Object.keys(geography.stationCoordinates).sort(), Object.keys(sourceCoordinates).sort());
assert.deepEqual(Object.keys(geography.stationSymbols).sort(), Object.keys(symbols).sort());
assert.deepEqual(geography.features.map(feature => feature.properties.lineId).sort(), routes.map(route => route.id).sort());

function distanceMeters(a, b) {
  const latitude = (a[1] + b[1]) / 2 * Math.PI / 180;
  return Math.hypot((a[0] - b[0]) * 111319.49 * Math.cos(latitude), (a[1] - b[1]) * 111319.49);
}

let pointCount = 0;
for (const feature of geography.features) {
  assert.equal(feature.type, 'Feature');
  assert.equal(feature.geometry.type, 'LineString');
  const source = routes.find(route => route.id === feature.properties.lineId);
  assert.equal(feature.properties.color, source.color);
  assert.equal(feature.properties.width, source.width);
  const points = feature.geometry.coordinates;
  assert(points.length >= 3, `Route ${source.id} is empty`);
  pointCount += points.length;
  for (let index = 0; index < points.length; index++) {
    const [lon, lat] = points[index];
    assert(Number.isFinite(lon) && Number.isFinite(lat), `Nonfinite coordinate on ${source.id}`);
    assert(lon > 113.5 && lon < 114.7 && lat > 22.3 && lat < 23, `Out-of-bounds route ${source.id}`);
    if (index) assert(distanceMeters(points[index - 1], points[index]) < 200, `Route ${source.id} has a jump`);
    if (index < 2) continue;
    const [before, middle, after] = points.slice(index - 2, index + 1);
    const first = [middle[0] - before[0], middle[1] - before[1]];
    const second = [after[0] - middle[0], after[1] - middle[1]];
    const lengths = Math.hypot(...first) * Math.hypot(...second);
    assert(lengths > 0 && (first[0] * second[0] + first[1] * second[1]) / lengths > -.7,
      `Route ${source.id} doubles back`);
  }
}

let maximumError = 0;
let contactCount = 0;
for (const [id, location] of Object.entries(geography.stationCoordinates)) {
  const actual = sourceCoordinates[id];
  assert(Number.isFinite(location.lon) && Number.isFinite(location.lat), `Nonfinite station ${id}`);
  const error = distanceMeters([location.lon, location.lat], [actual.lon, actual.lat]);
  maximumError = Math.max(maximumError, error);
  assert(error < 500, `Station registration too far from actual location: ${id} (${Math.round(error)} m)`);
  const geometry = geography.stationSymbols[id];
  assert.equal(geometry.parts.length, symbols[id].parts.length, `Lost platform part: ${id}`);
  geometry.parts.forEach((part, index) => {
    assert.deepEqual(part.lines, symbols[id].parts[index].lines, `Wrong platform lines: ${id}`);
    const angle = part.angle * Math.PI / 180;
    part.contacts.forEach(([x, y], lineIndex) => {
      const origin = world([location.lon, location.lat]);
      assert(closestPoint([origin[0] + x, origin[1] + y], screenRoutes[part.lines[lineIndex]]).distance < .02,
        `Platform contact does not touch rendered route: ${id}/${part.lines[lineIndex]}`);
      const u = (x - part.x) * Math.cos(angle) + (y - part.y) * Math.sin(angle);
      const v = -(x - part.x) * Math.sin(angle) + (y - part.y) * Math.cos(angle);
      // Test the rounded outline, not just its rectangular bounding box.
      const rx = part.width / 2, ry = part.height / 2;
      const cap = part.cornerRadius ? part.cornerRadius * part.width / symbols[id].parts[index].width : Math.min(rx, ry);
      const dx = Math.max(0, Math.abs(u) - (rx - cap));
      const dy = Math.max(0, Math.abs(v) - (ry - cap));
      assert(dx * dx + dy * dy <= cap * cap + .01, `Line misses station outline: ${id}`);
      contactCount++;
    });
  });
}
console.log(`Validated ${geography.features.length} geographic routes, ${pointCount} points, ${Object.keys(geography.stationCoordinates).length} stations, ${contactCount} platform contacts; maximum station offset ${Math.round(maximumError)} m.`);
