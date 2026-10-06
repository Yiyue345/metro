import assert from 'node:assert/strict';
import { surroundingTileUrls } from '../src/data/tile-prefetch.mjs';

const source = { tiles: ['https://example.test/tiles/osm/{z}/{x}/{y}'], minzoom: 0, maxzoom: 14 };
const bounds = [113.98, 22.53, 114.02, 22.57];
const urls = surroundingTileUrls(source, bounds, 13.8);
assert.ok(urls.length > 0 && urls.length <= 16);
assert.equal(new Set(urls).size, urls.length);
const x = lon => Math.floor((lon + 180) / 360 * 8192);
const y = lat => Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 8192);
for (const url of urls) {
  const [z, tx, ty] = new URL(url).pathname.split('/').slice(-3).map(Number);
  assert.equal(z, 13);
  assert.ok(tx >= x(bounds[0]) - 1 && tx <= x(bounds[2]) + 1);
  assert.ok(ty >= y(bounds[3]) - 1 && ty <= y(bounds[1]) + 1);
  assert.ok(tx < x(bounds[0]) || tx > x(bounds[2]) || ty < y(bounds[3]) || ty > y(bounds[1]));
}
assert.equal(surroundingTileUrls(source, bounds, 13, 2).length, 2);
assert.ok(surroundingTileUrls(source, bounds, 25).every(url => url.includes('/14/')));
assert.deepEqual(surroundingTileUrls(source, [-180, -90, 180, 90], 2), []);
assert.deepEqual(surroundingTileUrls(source, bounds, NaN), []);
assert.deepEqual(surroundingTileUrls(source, bounds, 13, 0), []);
assert.deepEqual(surroundingTileUrls({}, bounds, 13), []);
const edge = surroundingTileUrls(source, [179.99, 85, 180, 90], 4);
assert.ok(edge.every(url => new URL(url).pathname.split('/').slice(-2).every(n => +n >= 0 && +n < 16)));
const tms = surroundingTileUrls({ ...source, scheme: 'tms' }, bounds, 13);
urls.forEach((url, i) => assert.equal(+url.split('/').at(-1) + +tms[i].split('/').at(-1), 8191));
console.log('Validated bounded adjacent-tile prefetch, zoom limits, XYZ/TMS and world edges.');
