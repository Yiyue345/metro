import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateVisitedStations } from '../../shenzhen/src/data/validate-visited.mjs';
import { validateStationNotes } from '../../shenzhen/src/data/validate-station-notes.mjs';
import { registerDiagram } from '../../shenzhen/src/data/map-registration.mjs';

const file = relative => new URL(relative, import.meta.url);
const json = relative => JSON.parse(readFileSync(file(relative), 'utf8').replace(/^\uFEFF/, ''));
const read = name => json(`../data/${name}`);
const source = readFileSync(file('../data/stations.ts'), 'utf8');
const parseStations = text => JSON.parse(text.split('export const stations: Station[] = ')[1].replace(/;\s*$/, ''));
const stations = parseStations(source), planned = read('planned-stations.json');
const roster = read('official-roster.json'), checked = json('reference-roster.json'), meta = read('source-meta.json');
const symbols = read('station-symbols.json'), labels = read('station-labels.json'), english = read('station-english.json');
const colors = read('line-colors.json'), routes = read('route-paths.json'), coordinates = read('station-coordinates.json');
const lineSigns = json('line-sign-research.json').lines;
const lineIds = [...Array.from({ length: 10 }, (_, i) => String(i + 1)), '16', '19', 'hh'];
const counts = [33, 33, 37, 33, 40, 36, 24, 9, 21, 12, 12, 17, 12];
const ids = new Set(stations.map(s => s.id)), all = [...stations, ...planned], allIds = new Set(all.map(s => s.id));
const failures = [];
const check = (name, test) => { try { test(); } catch (error) { failures.push(`${name}: ${error.message}`); } };
const finite = value => Number.isFinite(value);
const sameKeys = (object, expected) => assert.deepEqual(new Set(Object.keys(object)), expected);

check('2026.05 operating and planned roster', () => {
  assert.equal(stations.length, 270); assert.equal(ids.size, 270);
  assert.equal(all.length, 271); assert.equal(allIds.size, 271);
  assert.equal(new Set(all.map(s => `${s.x},${s.y}`)).size, 271, 'Duplicate station anchors');
  assert.equal(planned.length, 1); assert.equal(planned[0].id, '汤家村');
  assert.equal(planned[0].status, 'planned'); assert.deepEqual(planned[0].lines, ['3']);
  assert(!ids.has('汤家村')); assert(stations.every(s => s.status !== 'planned'));
  assert.equal(checked.uniqueStationCount, 270); assert.equal(checked.plannedStationCount, 1);
  assert.deepEqual(new Set(checked.stations.map(s => s.id)), ids);
  assert.deepEqual(roster.plannedStations, checked.plannedStations);
  assert.deepEqual(checked.plannedStations.map(s => s.id), ['汤家村']);
  const exported = source.match(/export const plannedStations: Station\[\] = ([\s\S]*?);\s*export interface MetroLine/);
  assert(exported, 'Missing explicit plannedStations export');
  if (exported[1].trim() === 'planned as Station[]') {
    assert.match(source, /import planned from ['"]\.\/planned-stations\.json['"]/);
  } else assert.deepEqual(JSON.parse(exported[1]), planned);
  assert.equal(roster.edition, '2026.05'); assert.equal(meta.edition, roster.edition);
  assert.equal(checked.edition, roster.edition);
  assert.deepEqual(meta.sourceDimensions, [6300, 4500]);
  assert.deepEqual([meta.width, meta.height], [5910, 3200]);
  assert.deepEqual(meta.crop, [120, 400, 6030, 3600]);
  assert.match(source, /mapMeta = \{ width: 5910, height: 3200,/);
  for (const value of Object.values(meta.sourceSHA256)) assert.match(value, /^[0-9a-f]{64}$/);
  assert.deepEqual(roster.lines.map(l => l.id), lineIds);
  assert.deepEqual(roster.lines.map(l => l.stations.length), counts);
  assert.deepEqual(checked.lineStationCounts, Object.fromEntries(lineIds.map((id, i) => [id, counts[i]])));
  assert.deepEqual(new Set(roster.lines.flatMap(l => l.stations)), ids);
  assert.equal(stations.reduce((sum, s) => sum + s.lines.length, 0), 319);
  assert.equal(checked.lineStationMembershipCount, 319);
  assert(ids.has('火车东站') && ids.has('火车东站(东广场)'));
  assert.deepEqual(stations.find(s => s.id === '火车东站').lines, ['1', '4']);
  assert.deepEqual(stations.find(s => s.id === '火车东站(东广场)').lines, ['6', '19']);
  validateVisitedStations(read('visited-stations.json'), ids);
  validateStationNotes(read('station-notes.json'), ids);
});

check('Complete symbols, labels, English, coordinates and lines', () => {
  for (const entries of [symbols, labels, english, coordinates]) sameKeys(entries, allIds);
  sameKeys(colors, new Set(lineIds));
  assert.equal(lineSigns.length, lineIds.length);
  assert.deepEqual(new Set(lineSigns.map(sign => sign.id)), new Set(lineIds));
  sameKeys(json('reference-english.json'), allIds);
  assert.equal(routes.length, 13); assert.deepEqual(new Set(routes.map(r => r.id)), new Set(lineIds));
});

for (const station of all) check(`Station ${station.id}`, () => {
  const verified = [...checked.stations, ...checked.plannedStations].find(s => s.id === station.id);
  assert(verified); assert.equal(station.name, verified.name);
  assert.equal(english[station.id], verified.englishName);
  const memberships = station.status === 'planned' ? ['3'] : roster.lines.filter(l => l.stations.includes(station.id)).map(l => l.id);
  assert.deepEqual(station.lines, memberships);
  assert(finite(station.x) && finite(station.y) && station.x >= 0 && station.x <= meta.width && station.y >= 0 && station.y <= meta.height);
  assert(english[station.id].trim() && !/[\u4e00-\u9fff]/.test(english[station.id]));
  const parts = symbols[station.id].parts;
  assert(parts.length > 0); assert.deepEqual(new Set(parts.flatMap(p => p.lines)), new Set(memberships));
  for (const part of parts) {
    assert([part.x, part.y, part.width, part.height, part.angle].every(finite));
    assert(part.width > 0 && part.height > 0 && part.width <= 80 && part.height <= 80);
    assert(part.x >= 0 && part.x <= meta.width && part.y >= 0 && part.y <= meta.height);
    assert.equal(typeof part.transfer, 'boolean'); assert(part.lines.length > 0);
  }
  const label = labels[station.id];
  assert(finite(label.x) && finite(label.y) && label.fontSize > 0);
  assert(label.x >= 0 && label.x <= meta.width && label.y >= 0 && label.y <= meta.height);
  assert(['start', 'middle', 'end'].includes(label.anchor));
  const coordinate = coordinates[station.id];
  assert(finite(coordinate.lon) && finite(coordinate.lat));
  assert(coordinate.lon > 119.4 && coordinate.lon < 120.9 && coordinate.lat > 29.7 && coordinate.lat < 30.7);
});

for (const line of roster.lines) check(`Line ${line.id} paths and badge`, () => {
  assert.equal(new Set(line.stations).size, line.stations.length);
  assert.deepEqual(line.paths, checked.linePaths[line.id]);
  assert.deepEqual(new Set(line.paths.flat()), new Set(line.stations));
  assert(line.paths.every(p => p.length > 1 && p.every(id => ids.has(id)) && new Set(p).size === p.length));
  assert.equal(line.paths.length, ['3', '6'].includes(line.id) ? 2 : 1);
  assert.match(colors[line.id], /^#[0-9a-f]{6}$/i);
  const route = routes.find(r => r.id === line.id);
  assert.equal(route.color, colors[line.id]); assert.equal(route.paths.length, line.paths.length);
  for (const path of route.paths) {
    assert(path.startsWith('M ') && path.includes(' C ') && !/NaN|Infinity/.test(path));
    assert.match(path, /^M [-\d., ]+(?: C [-\d., ]+)+$/);
    const values = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert(values.every((v, i) => finite(v) && v >= 0 && v <= (i % 2 ? meta.height : meta.width)));
  }
  const badge = file(`../public/lines/${line.id}.svg`); assert(existsSync(badge));
  const svg = readFileSync(badge, 'utf8');
  const sign = lineSigns.find(sign => sign.id === line.id);
  assert(sign?.source && sign.status === 'corrected', 'Missing source-audited line sign');
  for (const color of [sign.background, sign.foreground]) assert.match(color, /^#[0-9a-f]{6}$/i);
  assert.match(svg, /<svg\s/);
  assert(svg.match(/<rect\b[^>]*>/)?.[0].includes(`fill="${sign.background}"`), 'Badge background differs from its source');
  const foreground = svg.match(/<g\b[^>]*\bfill="([^"]+)"/)?.[1].toLowerCase();
  assert.equal(({ white: '#ffffff', black: '#000000' })[foreground] ?? foreground, sign.foreground.toLowerCase(), 'Badge foreground differs from its source');
  const root = svg.match(/<svg\b[^>]*>/)[0];
  const viewBox = root.match(/\bviewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
  assert(viewBox?.length === 4 && viewBox.every(finite));
  assert.deepEqual(viewBox.slice(0, 2), [0, 0]);
  const width = Number(root.match(/\bwidth="([^"]+)"/)?.[1]);
  const height = Number(root.match(/\bheight="([^"]+)"/)?.[1]);
  assert(width > 0 && height > 0);
  assert.deepEqual([width, height], viewBox.slice(2));
  const ratio = sign.aspectRatio.split(':').map(Number);
  assert(ratio.length === 2 && ratio.every(value => finite(value) && value > 0));
  assert(Math.abs(width / height - ratio[0] / ratio[1]) < 1e-8, 'Badge aspect ratio differs from its source');
  assert.doesNotMatch(svg, /\b(?:textLength|lengthAdjust)\s*=|font-stretch|(?:scale|matrix)\s*\(/i, 'Badge glyphs must retain natural proportions');
  assert(svg.includes(`aria-label="${line.name}"`));
});

check('Exact branch topology', () => {
  const three = checked.linePaths['3'], six = checked.linePaths['6'];
  assert.deepEqual(three.map(p => p.length), [33, 28]);
  assert.deepEqual(three.map(p => [p[0], p.at(-1)]), [['吴山前村', '星桥'], ['星桥', '石马']]);
  assert.deepEqual(three[1].slice(-5), ['西溪湿地南', '留下', '屏峰', '小和山', '石马']);
  assert.equal(three[0].filter(id => three[1].includes(id)).length, 24);
  assert(three.every(p => !p.includes('汤家村')));
  assert.deepEqual(six.map(p => p.length), [33, 25]);
  assert.deepEqual(six.map(p => [p[0], p.at(-1)]), [['枸桔弄', '桂花西路'], ['枸桔弄', '双浦']]);
  assert.deepEqual(six[1].slice(-4), ['美院象山', '霞鸣街', '科海路', '双浦']);
  assert.equal(six[0].filter(id => six[1].includes(id)).length, 22);
});

check('AMap snapshot and exact coordinate provenance', () => {
  const report = json('station-coordinates-report.json'), snapshot = readFileSync(file('amap-hangzhou-source.json'));
  assert.equal(report.operatingRosterMatched, true); assert.deepEqual(report.missing, []);
  assert.equal(report.operatingStationCount, 270); assert.equal(report.plannedStationCount, 1);
  assert.equal(report.uniqueStationCount, 271); assert.equal(report.stations.length, 271);
  assert.equal(report.lineStationMembershipCount, 319);
  assert.equal(report.snapshotSHA256, createHash('sha256').update(snapshot).digest('hex'));
  assert.deepEqual(new Set(report.stations.map(s => s.id)), allIds);
  const sourceStations = JSON.parse(snapshot.toString('utf8')).l.flatMap(l => l.st);
  for (const station of report.stations) {
    assert.equal(station.sourceCRS, 'gcj02'); assert.equal(station.outputCRS, 'WGS84'); assert(station.sourceId);
    assert.equal(station.status, station.id === '汤家村' ? 'planned' : 'operating');
    assert.equal(station.sourceName, station.id);
    const match = sourceStations.find(s => s.n === station.sourceName && (s.poiid ?? s.si) === station.sourceId);
    assert(match, station.id);
    const [lon, lat] = match.sl.split(',').map(Number);
    assert.deepEqual(station.sourceLocation, { lat, lon, crs: 'gcj02' });
    assert.deepEqual(station.coordinate, coordinates[station.id]);
    assert.equal(station.displayEnglish, english[station.id]);
  }
});

check('Continuous routes and reviewed suspicious segments', () => {
  const traces = json('route-tracing-report.json'), polylines = json('route-polylines.json');
  const review = json('route-review.json'), reviews = review.reviewedSegments;
  assert(review.method?.trim() && Array.isArray(reviews));
  const sequences = roster.lines.flatMap(line => line.paths.map(path => ({ id: line.id, stations: path })));
  assert.equal(traces.length, 15); assert.equal(sequences.length, 15);
  assert.equal(Object.keys(polylines).length, 15);
  for (const [index, trace] of traces.entries()) {
    const sequence = sequences[index]; assert.equal(trace.id, sequence.id);
    assert.equal(trace.stationCount, sequence.stations.length); assert.equal(trace.segmentCount, sequence.stations.length - 1);
    assert.deepEqual(trace.stationCoverage.map(s => s.name), sequence.stations);
    assert.equal(trace.segments.length, trace.segmentCount);
    assert(trace.curveStats.maxTracedCorridorDeviation >= 0 && trace.curveStats.maxTracedCorridorDeviation < 4.5);
    assert(trace.curveStats.p95TracedCorridorDeviation <= trace.curveStats.maxTracedCorridorDeviation);
    const points = polylines[`${trace.id}-${index}`]; assert(points?.length > 1);
    assert(points.every(p => p.length === 2 && p.every(finite)));
    const curve = routes.find(route => route.id === trace.id).paths[roster.lines.find(line => line.id === trace.id).paths.indexOf(sequence.stations)];
    assert.equal(trace.curveStats.cubicCount, (curve.match(/ C /g) ?? []).length);
    for (const station of trace.stationCoverage) {
      assert(station.curveDistance >= 0 && station.curveDistance < 4.5, `${trace.id}: ${station.name} curve coverage`);
      const distance = Math.min(...points.map(([x, y]) => Math.hypot(x - station.x, y - station.y)));
      assert(Math.abs(distance - station.curveDistance) < .01, `${trace.id}: ${station.name} stale coverage report`);
      assert(symbols[station.name].parts.some(part => part.lines.includes(trace.id) && Math.hypot(part.x - station.x, part.y - station.y) <= part.width / 2 + 3));
    }
    assert.deepEqual(trace.suspiciousSegments, trace.segments.filter(s => s.suspicious));
    for (const [i, segment] of trace.segments.entries()) {
      assert.equal(segment.from, sequence.stations[i]); assert.equal(segment.to, sequence.stations[i + 1]);
      assert(segment.directLength > 0 && segment.length >= segment.directLength - .2);
      assert(segment.maxColorDistance >= 0 && segment.offBandFraction >= 0 && segment.offBandFraction <= 1);
      const suspicious = segment.offBandFraction > .15 || segment.maxColorDistance > 22 || segment.length > segment.directLength * 2.2;
      assert.equal(segment.suspicious, suspicious);
      if (suspicious) {
        assert(reviews.some(r => r.line === trace.id && r.from === segment.from && r.to === segment.to && r.reason?.trim()), `Unreviewed ${trace.id}: ${segment.from} → ${segment.to}`);
        assert(segment.maxColorDistance < 14 && segment.offBandFraction < .28 && segment.length < segment.directLength * 1.4,
          `Out of corridor bounds ${trace.id}: ${segment.from} → ${segment.to}: color=${segment.maxColorDistance}, offBand=${segment.offBandFraction}, length/direct=${segment.length / segment.directLength}`);
      }
    }
  }
  for (const review of reviews) assert(traces.some(trace => trace.id === review.line && trace.segments.some(s => s.from === review.from && s.to === review.to)), `Unknown review segment: ${review.line} ${review.from} → ${review.to}`);
});

check('Shared source registration at Guniangqiao', () => {
  const ownReference = read('diagram-registration.json'), otherMeta = json('../../shaoxing/data/source-meta.json');
  const otherStations = parseStations(readFileSync(file('../../shaoxing/data/stations.ts'), 'utf8'));
  const otherReference = json('../../shaoxing/data/diagram-registration.json');
  const project = ({ lon, lat }) => [lon / 360 + .5, (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2];
  const start = project(ownReference.origin), end = project(ownReference.east), otherStart = project(otherReference.origin);
  const scale = (end[0] - start[0]) / meta.width;
  const otherScale = (project(otherReference.east)[0] - otherStart[0]) / otherMeta.width;
  assert(finite(scale) && scale > 0); assert(Math.abs(end[1] - start[1]) < 1e-12);
  assert(Math.abs(scale - otherScale) < 1e-12);
  assert(Math.abs(start[0] - meta.crop[0] * scale - otherStart[0] + otherMeta.crop[0] * otherScale) < 1e-12);
  assert(Math.abs(start[1] - meta.crop[1] * scale - otherStart[1] + otherMeta.crop[1] * otherScale) < 1e-12);
  const own = registerDiagram(stations, coordinates, meta.width, ownReference);
  const other = registerDiagram(otherStations, json('../../shaoxing/data/station-coordinates.json'), otherMeta.width, otherReference);
  const a = project(own.stationCoordinates['姑娘桥']), b = project(other.stationCoordinates['姑娘桥']);
  assert(Math.hypot(a[0] - b[0], a[1] - b[1]) / scale < 1, 'Cross-city interchange differs by at least one source pixel');
});

if (failures.length) {
  console.error(`Hangzhou validation failed (${failures.length} checks):\n${failures.map(f => `- ${f}`).join('\n')}`);
  process.exitCode = 1;
} else console.log('Verified 270 operating + 1 planned stations, 319 operating memberships, 13 lines, 271 source-backed coordinates, complete symbols/labels/English/badges, 15 continuous route paths and shared Hangzhou–Shaoxing registration.');
