import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateTransportTransfers, transportModeLabels } from '../src/data/transport-transfers.mjs';

const cities = [
  ['深圳', new URL('../src/data/', import.meta.url)],
  ['东莞', new URL('../../dongguan/data/', import.meta.url)],
  ['南宁', new URL('../../nanning/data/', import.meta.url)],
  ['昆明', new URL('../../kunming/data/', import.meta.url)],
];
const modes = new Set();
let stationCount = 0, badgeCount = 0;
for (const [city, directory] of cities) {
  const source = readFileSync(new URL('stations.ts', directory), 'utf8');
  const stations = JSON.parse(source.split('export const stations: Station[] = ')[1].replace(/;\s*$/, ''));
  const transfers = JSON.parse(readFileSync(new URL('transport-transfers.json', directory), 'utf8'));
  validateTransportTransfers(transfers, new Set(stations.map(station => station.id)));
  if (city === '南宁') for (const id of ['火车站', '火车东站']) {
    assert.deepEqual(transfers[id].map(item => item.mode), ['rail', 'highSpeedRail'], `${id} 对应的铁路站同时接入普速铁路和高速铁路`);
  }
  if (city === '深圳') assert.equal(transfers['罗湖'][0].mode, 'rail', '深圳站的广深铁路不能因开行动车而改标高铁');
  if (city === '东莞') assert.equal(transfers['东莞火车站'][0].mode, 'rail', '东莞站的广深铁路不能因开行动车而改标高铁');
  for (const items of Object.values(transfers)) for (const transfer of items) modes.add(transfer.mode);
  const count = Object.values(transfers).reduce((sum, items) => sum + items.length, 0);
  stationCount += Object.keys(transfers).length;
  badgeCount += count;
  console.log(`${city}: ${Object.keys(transfers).length} transfer stations, ${count} badges.`);
}
assert.deepEqual([...modes].sort(), Object.keys(transportModeLabels).sort(), 'All five transport modes must be represented');
const valid = { mode: 'rail', destination: '铁路站', access: 'walk', railways: ['广深铁路'] };
const ids = new Set(['地铁站']);
for (const invalid of [[], null, { 未开通站: [valid] }, { 地铁站: [] },
  { 地铁站: [valid, valid] }, { 地铁站: [{ ...valid, mode: 'unknown' }] },
  { 地铁站: [{ ...valid, access: 'unknown' }] }, { 地铁站: [{ ...valid, destination: '' }] },
  { 地铁站: [{ ...valid, destination: 'x'.repeat(101) }] },
  { 地铁站: [{ ...valid, mode: 'highSpeedRail' }] },
  { 地铁站: [{ ...valid, railways: ['广深港高速铁路'] }] },
  { 地铁站: [{ ...valid, railways: undefined }] }, { 地铁站: [{ ...valid, railways: [] }] },
  { 地铁站: [{ ...valid, railways: ['未知铁路'] }] },
  { 地铁站: [{ ...valid, railways: ['广深铁路', '广深铁路'] }] }]) {
  assert.throws(() => validateTransportTransfers(invalid, ids));
}
validateTransportTransfers({ 地铁站: [valid, { ...valid, mode: 'highSpeedRail', railways: ['广深港高速铁路'] }] }, ids);
console.log(`Validated ${stationCount} transfer stations and ${badgeCount} badges, including invalid configuration checks.`);
