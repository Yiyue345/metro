import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerDiagram } from '../src/data/map-registration.mjs';

const city = process.argv.find(arg => arg.startsWith('--city='))?.slice(7) ?? 'shenzhen';
assert(['shenzhen', 'nanning'].includes(city), 'Unknown city');
const root = new URL(city === 'nanning' ? '../../nanning/' : '../', import.meta.url);
const data = city === 'nanning' ? 'data' : 'src/data';
const read = path => readFileSync(new URL(`${data}/${path}`, root), 'utf8');
const background = JSON.parse(read('vector-basemap.json'));
const source = read('stations.ts');
const stations = JSON.parse(source.split('export const stations: Station[] = ')[1].trim().replace(/;$/, ''));
const [, widthText, heightText] = source.match(/mapMeta = \{ width: (\d+), height: (\d+)/);
assert.equal(background.width, Number(widthText));
assert.equal(background.height, Number(heightText));
assert.deepEqual(background.registration, (({ origin, east }) => ({ origin, east }))(
  registerDiagram(stations, JSON.parse(read('station-coordinates.json')), background.width),
), 'Background registration must match the shared geographic overlay');
assert.equal(background.version, 1);
assert.equal(background.source.tileSchema, 'shortbread@1.0');
assert.equal(background.source.zoom, 12);
assert(background.source.tileCount > 0 && background.source.tileCount <= 100);
assert.equal(background.layers.length, 6);
assert.deepEqual(background.layers.map(layer => layer.kind), ['park', 'water', 'waterway', 'road-minor', 'road-major', 'road-motorway']);
let count = 0;
for (const layer of background.layers) {
  assert(layer.paths.length > 0);
  assert.equal(layer.paths.length, 1, 'Background layers should use compound paths');
  assert(/^#[0-9a-f]{6}$/.test(layer.fill) || layer.fill === 'none');
  if (layer.fill === 'none') {
    assert(/^#[0-9a-f]{6}$/.test(layer.stroke));
    assert(layer.strokeWidth > 0 && layer.strokeWidth < 6, 'Roads must remain narrower than metro routes');
  }
  for (const path of layer.paths) {
    assert.match(path, /^M/);
    assert.match(path, /^[MLZ\d.,\s-]+$/);
    const values = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.equal(values.length % 2, 0);
    for (let i = 0; i < values.length; i += 2) {
      assert(values[i] >= 0 && values[i] <= background.width, 'Background x outside SVG extent');
      assert(values[i + 1] >= 0 && values[i + 1] <= background.height, 'Background y outside SVG extent');
    }
    if (layer.fill !== 'none') {
      assert(path.endsWith(' Z'), 'Water and green areas must be closed');
    }
    count++;
  }
}
if (city === 'shenzhen') assert(background.layers.find(layer => layer.kind === 'water').paths.some(path => /M0,4250|L0,4250/.test(path)), 'Coastal water must cover the southwest SVG corner');
console.log(`Validated ${count} vector background paths, six layers, clipped bounds and shared uniform registration.`);
