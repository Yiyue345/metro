import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { closestPoint, mix, roundedSegments, sampleSegments, simplify } from './route-geometry.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const corridors = read('../src/data/route-corridors.json');
const coverage = read('./route-tracing-report.json');
const sections = read('../src/data/route-straight-sections.json');
const osm = read('./osm-central-tracks-source.json');
// Pixel noise must not turn a straight corridor into a smoothed wave.
assert.deepEqual(simplify([[0, 0], [25, .8], [50, -.6], [75, .5], [100, 0]]), [[0, 0], [100, 0]]);
assert(simplify([[0, 0], [50, 0], [50, 50]]).length === 3, 'Must retain a real turn');
let maximum = 0;
for (const route of coverage) {
  const points = sampleSegments(roundedSegments(corridors[route.id], 10), .5);
  for (const station of route.stationCoverage) {
    const distance = closestPoint([station.x, station.y], points).distance;
    maximum = Math.max(maximum, distance);
    assert(distance < 4.5, `Cleaned route left its station: ${route.id}/${station.name}`);
  }
}
for (const section of sections) {
  assert(section.osmWayIds.every(id => osm.ways.some(way => way.id === id)), 'Missing OSM evidence');
  const anchors = coverage.find(route => route.id === section.lineId).stationCoverage;
  const corridor = corridors[section.lineId];
  const ends = [section.from, section.to].map(name => {
    const station = anchors.find(s => s.name === name);
    return closestPoint([station.x, station.y], corridor).point;
  });
  const samples = sampleSegments(roundedSegments(corridor, 10), .5);
  for (const t of [.25, .5, .75]) {
    assert(closestPoint(mix(...ends, t), samples).distance < .01, `Straight section bent: ${section.lineId}`);
  }
}
console.log(`Validated straight/turn handling, ${sections.length} OSM-reviewed sections and station coverage (max ${maximum.toFixed(2)} source pixels).`);
