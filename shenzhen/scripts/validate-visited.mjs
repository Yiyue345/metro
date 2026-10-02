import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateVisitedStations } from '../src/data/validate-visited.mjs';

const source = readFileSync(new URL('../src/data/stations.ts', import.meta.url), 'utf8');
const stations = JSON.parse(source.split('export const stations: Station[] = ')[1].trim().replace(/;$/, ''));
const ids = new Set(stations.map(station => station.id));
const visited = JSON.parse(readFileSync(new URL('../src/data/visited-stations.json', import.meta.url), 'utf8'));
validateVisitedStations(visited, ids);

assert.deepEqual(validateVisitedStations([], ids), []);
assert.deepEqual(validateVisitedStations(['罗湖', '车公庙'], ids), ['罗湖', '车公庙']);
for (const invalid of [null, {}, ['不存在的站'], ['西丽高铁站'], [123], ['罗湖', '罗湖']]) {
  assert.throws(() => validateVisitedStations(invalid, ids));
}
console.log(`Visited configuration validated: ${visited.length} stations; valid and invalid cases passed.`);
