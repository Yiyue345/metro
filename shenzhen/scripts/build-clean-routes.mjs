import { readFileSync, writeFileSync } from 'node:fs';
import { closestPoint, simplify, roundedSegments, svgPath } from './route-geometry.mjs';

// The traced samples remain the immutable input; do not repeatedly simplify outputs.
const samples = JSON.parse(readFileSync(new URL('./route-polylines.json', import.meta.url), 'utf8'));
const routesUrl = new URL('../src/data/route-paths.json', import.meta.url);
const routes = JSON.parse(readFileSync(routesUrl, 'utf8'));
const corridors = Object.fromEntries(Object.entries(samples).map(([id, points]) => [id, simplify(points)]));
const sections = JSON.parse(readFileSync(new URL('../src/data/route-straight-sections.json', import.meta.url), 'utf8'));
const coverage = JSON.parse(readFileSync(new URL('./route-tracing-report.json', import.meta.url), 'utf8'));
for (const section of sections) {
  const anchors = coverage.find(route => route.id === section.lineId).stationCoverage;
  const points = corridors[section.lineId];
  const ends = [section.from, section.to].map(name => {
    const anchor = anchors.find(station => station.name === name);
    return closestPoint([anchor.x, anchor.y], points);
  }).sort((a, b) => a.index + a.t - b.index - b.t);
  corridors[section.lineId] = [...points.slice(0, ends[0].index + 1), ends[0].point, ends[1].point, ...points.slice(ends[1].index + 1)];
}
for (const route of routes) route.paths = [svgPath(roundedSegments(corridors[route.id], 10))];
writeFileSync(routesUrl, `${JSON.stringify(routes, null, 2)}\n`);
writeFileSync(new URL('../src/data/route-corridors.json', import.meta.url), `${JSON.stringify(corridors)}\n`);
console.log(`Cleaned ${routes.length} routes: exact straight spans with tangent-continuous rounded joins.`);
