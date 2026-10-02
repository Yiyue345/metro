import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { closestPoint, roundedSegments, sampleSegments } from './route-geometry.mjs';

const readData = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const stationsSource = readFileSync(new URL('../src/data/stations.ts', import.meta.url), 'utf8');
const stations = JSON.parse(stationsSource.split('export const stations: Station[] = ')[1].trim().replace(/;$/, ''));
const coordinates = readData('station-coordinates');
const routes = readData('route-paths');
const corridors = readData('route-corridors');
const symbols = readData('station-symbols');
const mercatorRadius = 6378137;
const referenceLon = 114;
const referenceLat = 22.6;
const originX = mercatorRadius * referenceLon * Math.PI / 180;
const originY = mercatorRadius * Math.log(Math.tan(Math.PI / 4 + referenceLat * Math.PI / 360));
const pixelScale = 1000;
const smoothing = 0.03;

function project({ lon, lat }) {
  return [
    (mercatorRadius * lon * Math.PI / 180 - originX) / 1000,
    (mercatorRadius * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) - originY) / 1000,
  ];
}

function unproject([x, y]) {
  const longitude = (originX + x * 1000) / mercatorRadius * 180 / Math.PI;
  const latitude = (2 * Math.atan(Math.exp((originY + y * 1000) / mercatorRadius)) - Math.PI / 2) * 180 / Math.PI;
  return [Number(longitude.toFixed(7)), Number(latitude.toFixed(7))];
}

function kernel(dx, dy) {
  const squared = dx * dx + dy * dy;
  return squared ? squared * Math.log(squared) / 2 : 0;
}

// The affine terms keep the overall map aligned; the regularized thin-plate
// correction bends it smoothly around the 351 measured station positions.
function fitTransform(control) {
  const n = control.length;
  const size = n + 3;
  const matrix = Array.from({ length: size }, () => new Float64Array(size + 2));
  for (let i = 0; i < n; i++) {
    const [x, y] = control[i].source;
    for (let j = 0; j < n; j++) {
      const [otherX, otherY] = control[j].source;
      matrix[i][j] = kernel(x - otherX, y - otherY) + (i === j ? smoothing : 0);
    }
    matrix[i][n] = 1;
    matrix[i][n + 1] = x;
    matrix[i][n + 2] = y;
    matrix[i][size] = control[i].target[0];
    matrix[i][size + 1] = control[i].target[1];
    matrix[n][i] = 1;
    matrix[n + 1][i] = x;
    matrix[n + 2][i] = y;
  }
  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    }
    assert(Math.abs(matrix[pivot][column]) > 1e-11, `Singular registration matrix at ${column}`);
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    const divisor = matrix[column][column];
    for (let col = column; col < size + 2; col++) matrix[column][col] /= divisor;
    for (let row = column + 1; row < size; row++) {
      const factor = matrix[row][column];
      if (!factor) continue;
      for (let col = column; col < size + 2; col++) matrix[row][col] -= factor * matrix[column][col];
    }
  }
  const coefficients = Array.from({ length: size }, () => [0, 0]);
  for (let row = size - 1; row >= 0; row--) {
    for (let axis = 0; axis < 2; axis++) {
      let value = matrix[row][size + axis];
      for (let col = row + 1; col < size; col++) value -= matrix[row][col] * coefficients[col][axis];
      coefficients[row][axis] = value;
    }
  }
  return (pixelX, pixelY) => {
    const x = pixelX / pixelScale;
    const y = pixelY / pixelScale;
    const result = [
      coefficients[n][0] + x * coefficients[n + 1][0] + y * coefficients[n + 2][0],
      coefficients[n][1] + x * coefficients[n + 1][1] + y * coefficients[n + 2][1],
    ];
    for (let i = 0; i < n; i++) {
      const influence = kernel(x - control[i].source[0], y - control[i].source[1]);
      result[0] += influence * coefficients[i][0];
      result[1] += influence * coefficients[i][1];
    }
    return result;
  };
}

const control = stations.map(station => {
  assert(coordinates[station.id], `Missing coordinate: ${station.id}`);
  return {
    id: station.id,
    source: [station.x / pixelScale, station.y / pixelScale],
    target: project(coordinates[station.id]),
  };
});
assert.equal(Object.keys(coordinates).length, stations.length, 'Coordinate roster mismatch');
const transform = fitTransform(control);
const stationCoordinates = Object.fromEntries(stations.map(station => {
  const [lon, lat] = unproject(transform(station.x, station.y));
  return [station.id, { lat, lon }];
}));
const errors = control.map(item => {
  const [x, y] = transform(item.source[0] * pixelScale, item.source[1] * pixelScale);
  return { id: item.id, meters: Math.round(Math.hypot(x - item.target[0], y - item.target[1]) * 1000) };
}).sort((a, b) => a.meters - b.meters);

const projectedRoutes = {};
const features = routes.flatMap(route => route.paths.map((_path, index) => {
  const pixelPoints = corridors[route.id];
  // Transform corridor vertices, not every point of a straight span: a nonlinear
  // registration must not turn a straight track into a bow.
  const projected = sampleSegments(roundedSegments(pixelPoints.map(([x, y]) => transform(x, y)), .10), .025);
  projectedRoutes[route.id] = projected;
  const transformed = projected.map(unproject);
  const lineStations = stations.filter(station => station.lines.includes(route.id));
  const endpoints = [pixelPoints[0], pixelPoints.at(-1)].map(([x, y]) =>
    Math.min(...lineStations.map(station => Math.hypot(x - station.x, y - station.y))));
  assert(endpoints.every(distance => distance <= 120), `Route ${route.id} endpoint outside station area`);
  return {
    type: 'Feature',
    properties: { lineId: route.id, color: route.color, width: route.width, pathIndex: index },
    geometry: { type: 'LineString', coordinates: transformed },
  };
}));

for (const feature of features) {
  assert(feature.geometry.coordinates.length >= 3, `Empty route ${feature.properties.lineId}`);
  for (const [lon, lat] of feature.geometry.coordinates) {
    assert(Number.isFinite(lon) && Number.isFinite(lat), 'Nonfinite geographic route point');
    assert(lon > 113.5 && lon < 114.7 && lat > 22.3 && lat < 23.0,
      `Route ${feature.properties.lineId} escaped Shenzhen bounds: ${lon},${lat}`);
  }
}
// Symbols and lines share world coordinates and therefore the same zoom scale.
// Separate platform parts stay separate. A transfer capsule covers the actual
// line contacts instead of assuming every line crosses the station centroid.
const pixelsPerKm = 512 * 2 ** 14 / (2 * Math.PI * mercatorRadius / 1000);
const stationSymbols = Object.fromEntries(stations.map(station => {
  const origin = transform(station.x, station.y);
  const toLocal = point => [(point[0] - origin[0]) * pixelsPerKm, -(point[1] - origin[1]) * pixelsPerKm];
  const source = symbols[station.id];
  const parts = source.parts.map(part => {
    const contacts = part.lines.map(id => closestPoint(transform(part.x, part.y), projectedRoutes[id]).point).map(toLocal);
    let ends = [contacts[0], contacts[0]], spread = 0;
    for (const a of contacts) for (const b of contacts) {
      const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (distance > spread) { spread = distance; ends = [a, b]; }
    }
    const x = (ends[0][0] + ends[1][0]) / 2, y = (ends[0][1] + ends[1][1]) / 2;
    const angle = spread > .5 ? Math.atan2(ends[1][1] - ends[0][1], ends[1][0] - ends[0][0]) * 180 / Math.PI : part.angle;
    const radians = angle * Math.PI / 180;
    const cross = Math.max(...contacts.map(p => Math.abs(-(p[0] - x) * Math.sin(radians) + (p[1] - y) * Math.cos(radians))));
    const height = part.transfer ? Math.max(part.height, cross * 2 + 12) : part.height;
    if (part.cornerRadius) {
      const size = Math.max(part.width, ...contacts.flatMap(p => [Math.abs(p[0] - x) * 2 + 14, Math.abs(p[1] - y) * 2 + 14]));
      return { ...part, x, y, angle: 0, width: size, height: size, contacts };
    }
    return { ...part, x, y, angle, width: Math.max(part.width, spread + height), height, contacts };
  });
  const connections = source.connections?.map(connection => {
    const points = (connection.points ?? `${connection.x1},${connection.y1} ${connection.x2},${connection.y2}`)
      .split(/\s+/).map(pair => pair.split(',').map(Number));
    const local = points.map(([x, y]) => toLocal(transform(x, y)));
    for (const index of [0, points.length - 1]) {
      const nearest = source.parts.map((part, i) => ({ i, distance: Math.hypot(part.x - points[index][0], part.y - points[index][1]) })).sort((a, b) => a.distance - b.distance)[0];
      local[index] = [parts[nearest.i].x, parts[nearest.i].y];
    }
    return { ...connection, points: local.map(p => p.join(',')).join(' ') };
  });
  return [station.id, { parts, ...(connections ? { connections } : {}) }];
}));
const output = { type: 'FeatureCollection', features, stationCoordinates, stationSymbols };
const report = {
  method: 'regularized thin-plate spline in Web Mercator',
  smoothing,
  stationCount: stations.length,
  routeCount: routes.length,
  pointCount: features.reduce((sum, feature) => sum + feature.geometry.coordinates.length, 0),
  stationErrorMeters: {
    distanceMeasure: 'EPSG:3857 projected meters; not ground distance',
    median: errors[Math.floor(errors.length / 2)].meters,
    p95: errors[Math.floor(errors.length * .95)].meters,
    maximum: errors.at(-1),
  },
  largestStationErrors: errors.slice(-12).reverse(),

};
writeFileSync(new URL('../src/data/geographic-routes.json', import.meta.url), `${JSON.stringify(output)}\n`);
writeFileSync(new URL('./geographic-routes-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Generated ${report.routeCount} geographic routes, ${report.pointCount} points, ${report.stationCount} station positions.`);
console.log(`Station error: median ${report.stationErrorMeters.median} m; p95 ${report.stationErrorMeters.p95} m; maximum ${report.stationErrorMeters.maximum.meters} m (${report.stationErrorMeters.maximum.id}).`);
