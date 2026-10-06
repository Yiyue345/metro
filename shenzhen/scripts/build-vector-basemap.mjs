import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { VectorTile, classifyRings } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import { registerDiagram } from '../src/data/map-registration.mjs';

const args = process.argv.slice(2);
const city = args.find(arg => arg.startsWith('--city='))?.slice(7) ?? 'shenzhen';
assert(['shenzhen', 'nanning', 'dongguan'].includes(city), 'Unknown city');
const root = new URL(city === 'shenzhen' ? '../' : `../../${city}/`, import.meta.url);
const dataDirectory = city === 'shenzhen' ? 'src/data/' : 'data/';
const cache = new URL('scripts/vector-basemap-source/', root);
const output = new URL(`${dataDirectory}vector-basemap.json`, root);
const readJson = async url => JSON.parse(await readFile(url, 'utf8'));
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const flags = new Set(args.filter(arg => !arg.startsWith('--city=')));
assert([...flags].every(flag => ['--download', '--refresh', '--check'].includes(flag)), 'Unknown option');
assert(!(flags.has('--check') && (flags.has('--download') || flags.has('--refresh'))), 'Check is offline');
const source = await readFile(new URL(`${dataDirectory}stations.ts`, root), 'utf8');
const stations = JSON.parse(source.split('export const stations: Station[] = ')[1].trim().replace(/;$/, ''));
const [, widthText, heightText] = source.match(/mapMeta = \{ width: (\d+), height: (\d+)/);
const width = Number(widthText), height = Number(heightText), zoom = 12, tileCount = 2 ** zoom;
const registration = registerDiagram(stations, await readJson(new URL(`${dataDirectory}station-coordinates.json`, root)), width);
const project = ({ lon, lat }) => [lon / 360 + .5,
  (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2];
const origin = project(registration.origin);
const scale = (project(registration.east)[0] - origin[0]) / width;
const west = Math.floor(origin[0] * tileCount), north = Math.floor(origin[1] * tileCount);
const east = Math.floor((origin[0] + width * scale) * tileCount);
const south = Math.floor((origin[1] + height * scale) * tileCount);
assert((east - west + 1) * (south - north + 1) <= 100, 'Refusing a large tile download');
const basemap = await readJson(new URL(`${dataDirectory}basemap.json`, root));
const tileJsonUrl = basemap.tileset;
const manifestUrl = new URL('manifest.json', cache);
let manifest;
try { manifest = await readJson(manifestUrl); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const download = flags.has('--download') || flags.has('--refresh');
const refresh = flags.has('--refresh');
if (!manifest || refresh) {
  assert(download, 'Missing cache. First run: node scripts/build-vector-basemap.mjs --download');
  await mkdir(cache, { recursive: true });
  const response = await fetch(tileJsonUrl, { signal: AbortSignal.timeout(30000) });
  assert(response.ok, `TileJSON HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const tileJson = JSON.parse(bytes.toString('utf8'));
  assert.equal(tileJson.tile_schema, 'shortbread@1.0');
  assert(tileJson.maxzoom >= zoom && tileJson.tiles.length > 0);
  await writeFile(new URL('tilejson.json', cache), bytes);
  manifest = { tileJsonUrl, tileJsonSha256: hash(bytes), retrievedAt: new Date().toISOString(), zoom, tiles: [] };
}
assert.equal(manifest.tileJsonUrl, tileJsonUrl, 'Cache source changed; use --refresh');
assert.equal(manifest.zoom, zoom);
const tileJsonBytes = await readFile(new URL('tilejson.json', cache));
assert.equal(hash(tileJsonBytes), manifest.tileJsonSha256, 'TileJSON checksum mismatch');
const tileJson = JSON.parse(tileJsonBytes.toString('utf8'));
const tileUrl = new URL(tileJson.tiles[0], tileJsonUrl).href.replace(/%7B/g, '{').replace(/%7D/g, '}');
const layers = [
  { kind: 'park', fill: '#bde8cb', paths: [] },
  { kind: 'water', fill: '#a7cceb', paths: [] },
  { kind: 'waterway', fill: 'none', stroke: '#a7cceb', strokeWidth: 2.2, paths: [] },
  { kind: 'road-minor', fill: 'none', stroke: '#e9edeb', strokeWidth: 1.8, paths: [] },
  { kind: 'road-major', fill: 'none', stroke: '#dde3df', strokeWidth: 3.2, paths: [] },
  { kind: 'road-motorway', fill: 'none', stroke: '#d3dcd6', strokeWidth: 4.8, paths: [] },
];
const greenKinds = ['forest', 'park', 'grass', 'garden', 'recreation_ground', 'scrub', 'heath', 'meadow', 'wood', 'nature_reserve'];
const roadKinds = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];
const features = {}, vertices = { input: 0, output: 0 };
const tolerance = 2; // SVG pixels; metro geometry is never simplified.
const minimumArea = 40; // SVG square pixels; omit tiny background polygons.
const smallParkArea = 12; // Keep meaningful small city parks and gardens.

// Clip buffered tile geometry to its exact tile rectangle, then the SVG extent.
// This prevents duplicated roads and overlapping polygon fills at tile seams.
function polygonClip(points, box) {
  let result = points;
  for (const [axis, boundary, sign] of [[0, box[0], 1], [0, box[2], -1], [1, box[1], 1], [1, box[3], -1]]) {
    const input = result;
    result = [];
    if (!input.length) break;
    let previous = input.at(-1), previousInside = (previous[axis] - boundary) * sign >= 0;
    for (const point of input) {
      const inside = (point[axis] - boundary) * sign >= 0;
      if (inside !== previousInside) {
        const t = (boundary - previous[axis]) / (point[axis] - previous[axis]);
        const intersection = previous.map((value, i) => value + (point[i] - value) * t);
        intersection[axis] = boundary;
        result.push(intersection);
      }
      if (inside) result.push(point);
      previous = point; previousInside = inside;
    }
  }
  return result;
}
function segmentClip(a, b, box) {
  let start = 0, end = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const p = [-dx, dx, -dy, dy], q = [a[0] - box[0], box[2] - a[0], a[1] - box[1], box[3] - a[1]];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return; }
    else {
      const t = q[i] / p[i];
      if (p[i] < 0) start = Math.max(start, t);
      else end = Math.min(end, t);
      if (start > end) return;
    }
  }
  return [[a[0] + dx * start, a[1] + dy * start], [a[0] + dx * end, a[1] + dy * end]];
}
function lineClip(points, box) {
  const paths = [];
  let current;
  for (let i = 1; i < points.length; i++) {
    const segment = segmentClip(points[i - 1], points[i], box);
    if (!segment) { current = undefined; continue; }
    if (!current || Math.hypot(current.at(-1)[0] - segment[0][0], current.at(-1)[1] - segment[0][1]) > .001) {
      current = [segment[0]]; paths.push(current);
    }
    current.push(segment[1]);
  }
  return paths;
}
function simplify(points, box) {
  if (points.length <= 2) return points;
  const keep = new Set([0, points.length - 1]);
  // Keep exact clipping intersections so adjacent tiles meet at every zoom.
  points.forEach((point, index) => {
    if (box && [Math.abs(point[0] - box[0]), Math.abs(point[0] - box[2]), Math.abs(point[1] - box[1]), Math.abs(point[1] - box[3])].some(distance => distance < .000001)) keep.add(index);
  });
  const anchors = [...keep].sort((a, b) => a - b);
  const stack = anchors.slice(1).map((index, i) => [anchors[i], index]);
  while (stack.length) {
    const [first, last] = stack.pop(), a = points[first], b = points[last];
    const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
    let furthest = -1, distance = tolerance * tolerance;
    for (let i = first + 1; i < last; i++) {
      const t = length ? Math.max(0, Math.min(1, ((points[i][0] - a[0]) * dx + (points[i][1] - a[1]) * dy) / length)) : 0;
      const candidate = (points[i][0] - a[0] - t * dx) ** 2 + (points[i][1] - a[1] - t * dy) ** 2;
      if (candidate > distance) { distance = candidate; furthest = i; }
    }
    if (furthest >= 0) { keep.add(furthest); stack.push([first, furthest], [furthest, last]); }
  }
  return [...keep].sort((a, b) => a - b).map(index => points[index]);
}
const signedArea = points => points.reduce((sum, point, i) => {
  const next = points[(i + 1) % points.length];
  return sum + point[0] * next[1] - next[0] * point[1];
}, 0) / 2;
function svgPath(points, closed, box, exterior = true) {
  if (points.length < (closed ? 3 : 2)) return '';
  if (closed && (points[0][0] !== points.at(-1)[0] || points[0][1] !== points.at(-1)[1])) points = [...points, points[0]];
  vertices.input += points.length;
  const reduced = simplify(points, box);
  if (reduced.length < (closed ? 4 : 2)) return '';
  // Normalize exteriors clockwise and holes counterclockwise. The nonzero
  // fill then unions overlapping features and shared tile edges without XOR.
  if (closed && (signedArea(reduced) > 0) !== exterior) reduced.reverse();
  vertices.output += reduced.length;
  const formatted = reduced.map(point => point.map(value => Math.round(value * 10) / 10).join(','));
  return `M${formatted.join(' L')}${closed ? ' Z' : ''}`;
}

for (let y = north; y <= south; y++) for (let x = west; x <= east; x++) {
  const filename = `${zoom}-${x}-${y}.pbf`, url = tileUrl.replace('{z}', zoom).replace('{x}', x).replace('{y}', y);
  let entry = manifest.tiles.find(tile => tile.file === filename);
  if (!entry || refresh) {
    assert(download, `Missing tile ${filename}; use --download`);
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    assert(response.ok, `${filename}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(bytes.length > 0 && bytes.length < 2_000_000, 'Unexpected tile size');
    await writeFile(new URL(filename, cache), bytes);
    entry = { file: filename, url, bytes: bytes.length, sha256: hash(bytes) };
    manifest.tiles = manifest.tiles.filter(tile => tile.file !== filename);
    manifest.tiles.push(entry);
    await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const bytes = await readFile(new URL(filename, cache));
  assert.equal(bytes.length, entry.bytes, `${filename}: size mismatch`);
  assert.equal(hash(bytes), entry.sha256, `${filename}: checksum mismatch`);
  const tile = new VectorTile(new Pbf(bytes));
  const min = [(x / tileCount - origin[0]) / scale, (y / tileCount - origin[1]) / scale];
  const max = [((x + 1) / tileCount - origin[0]) / scale, ((y + 1) / tileCount - origin[1]) / scale];
  const box = [Math.max(0, min[0]), Math.max(0, min[1]), Math.min(width, max[0]), Math.min(height, max[1])];
  for (const name of ['land', 'ocean', 'water_polygons', 'water_lines', 'streets']) {
    const layer = tile.layers[name];
    if (!layer) continue;
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i), kind = feature.properties.kind;
      let destination;
      if (name === 'land' && greenKinds.includes(kind) && feature.type === 3) destination = 0;
      else if (['ocean', 'water_polygons'].includes(name) && feature.type === 3) destination = 1;
      else if (name === 'water_lines' && ['river', 'canal', 'stream'].includes(kind) && !feature.properties.tunnel && feature.type === 2) destination = 2;
      else if (name === 'streets' && roadKinds.includes(kind) && !feature.properties.rail && feature.type === 2) {
        destination = ['motorway', 'trunk'].includes(kind) ? 5 : ['primary', 'secondary'].includes(kind) ? 4 : 3;
      } else continue;
      const closed = feature.type === 3;
      const convert = ring => ring.map(point => [min[0] + point.x / layer.extent * (max[0] - min[0]), min[1] + point.y / layer.extent * (max[1] - min[1])]);
      const geometry = feature.loadGeometry();
      const paths = closed ? classifyRings(geometry).flatMap(polygon => {
        const rings = polygon.map(convert), outer = rings[0];
        const area = Math.abs(signedArea(outer));
        if (area < (name === 'land' && ['park', 'garden', 'recreation_ground'].includes(kind) ? smallParkArea : minimumArea)) return [];
        const clipped = rings.map((ring, index) => svgPath(polygonClip(ring, box), true, box, index === 0));
        // A clipped-away exterior must never leave its holes as filled islands.
        return clipped[0] ? clipped.filter(Boolean) : [];
      }) : geometry.flatMap(ring => lineClip(convert(ring), box).map(line => svgPath(line, false, box)));
      const validPaths = paths.filter(Boolean);
      if (!validPaths.length) continue;
      // Each feature retains its exterior/hole relationship before unioning.
      if (closed) layers[destination].paths.push(validPaths.join(' '));
      else layers[destination].paths.push(...validPaths);
      const key = `${name}:${kind ?? 'ocean'}`;
      features[key] = (features[key] ?? 0) + 1;
    }
  }
}
const pathSegments = Object.fromEntries(layers.map(layer => [layer.kind, layer.paths.length]));
// Normalized winding allows polygon union without per-tile antialiasing seams.
for (const layer of layers) layer.paths = [layer.paths.join(' ')];
const result = {
  version: 1, width, height,
  source: {
    tileJsonUrl, tileSchema: tileJson.tile_schema, zoom, tileCount: (east - west + 1) * (south - north + 1),
    retrievedAt: manifest.retrievedAt, osmSnapshot: tileJson['planetiler:osm:osmosisreplicationtime'],
    attribution: tileJson.attribution, manifest: 'scripts/vector-basemap-source/manifest.json',
  },
  registration: { origin: registration.origin, east: registration.east },
  simplification: { tolerance, minimumArea, smallParkArea, units: 'SVG pixels', vertices }, features, pathSegments, layers,
};
assert(layers.every(layer => layer.paths.length > 0), 'Missing background layer');
const text = `${JSON.stringify(result, null, 2)}\n`;
if (flags.has('--check')) assert.equal(await readFile(output, 'utf8'), text, 'Vector basemap is stale; rebuild it');
else await writeFile(output, text);
console.log(`${flags.has('--check') ? 'Verified' : 'Generated'} vector basemap: ${result.source.tileCount} tiles, ${layers.reduce((count, layer) => count + layer.paths.length, 0)} paths, ${vertices.output}/${vertices.input} vertices, ${Buffer.byteLength(text)} bytes.`);
