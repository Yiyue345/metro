import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateVisitedStations } from '../../shenzhen/src/data/validate-visited.mjs';
import { validateStationNotes } from '../../shenzhen/src/data/validate-station-notes.mjs';

const file = name => new URL(name, import.meta.url);
const bytes = name => readFileSync(file(name));
const json = name => JSON.parse(bytes(name).toString('utf8').replace(/^\uFEFF/, ''));
const read = name => json(`../data/${name}`);
const hash = name => createHash('sha256').update(bytes(name)).digest('hex');
const roster = read('official-roster.json'), reference = json('reference-roster.json');
const coordinates = read('station-coordinates.json'), english = read('station-english.json');
const report = json('station-coordinates-report.json'), inactive = read('planned-stations.json');
const operating = reference.stations, all = [...operating, ...inactive];
const ids = new Set(operating.map(s => s.id)), allIds = new Set(all.map(s => s.id));
const lineIds = [...Array.from({ length: 10 }, (_, i) => String(i + 1)), '13', '17', '18', '19', '27', '30', 's3', 'r2'];
const counts = [35, 33, 37, 30, 41, 56, 31, 32, 13, 19, 21, 21, 12, 22, 22, 22, 6, 35];
const restoredIds = ['大面铺', '连山坡', '界牌', '书房', '龙平路', '龙泉驿'];
const s3Physical = ['福田', '芦葭', '资阳临空', '幸福大道', '苌弘广场', '宝台', '资阳北站'];
const hiddenLineIds = ['r2'], visibleLineIds = lineIds.filter(id => !hiddenLineIds.includes(id));
const visibleIds = new Set(roster.lines.filter(line => visibleLineIds.includes(line.id)).flatMap(line => line.stations));
const failures = [], passed = [];
const check = (name, fn) => { try { fn(); passed.push(name); } catch (error) { failures.push(`${name}: ${error.message}`); } };
const sameSet = (a, b, message) => assert.deepEqual(new Set(a), new Set(b), message);
const sameKeys = (object, expected) => sameSet(Object.keys(object), expected);
const finite = Number.isFinite;
const paths = reference.linePaths;
const rosterOnly = process.argv.includes('--roster-only');
const metadata = stations => stations.map(({ x, y, labelBox, sourceNode, ...station }) => station);
const gcjForward = ({ lat, lon }) => {
  const x = lon - 105, y = lat - 35, pi = Math.PI;
  let dlat = -100 + 2*x + 3*y + .2*y*y + .1*x*y + .2*Math.sqrt(Math.abs(x));
  dlat += (20*Math.sin(6*x*pi) + 20*Math.sin(2*x*pi))*2/3;
  dlat += (20*Math.sin(y*pi) + 40*Math.sin(y/3*pi))*2/3;
  dlat += (160*Math.sin(y/12*pi) + 320*Math.sin(y*pi/30))*2/3;
  let dlon = 300 + x + 2*y + .1*x*x + .1*x*y + .1*Math.sqrt(Math.abs(x));
  dlon += (20*Math.sin(6*x*pi) + 20*Math.sin(2*x*pi))*2/3;
  dlon += (20*Math.sin(x*pi) + 40*Math.sin(x/3*pi))*2/3;
  dlon += (150*Math.sin(x/12*pi) + 300*Math.sin(x/30*pi))*2/3;
  const a = 6378245, e = .00669342162296594323, rad = lat/180*pi;
  const magic = 1 - e*Math.sin(rad)**2, root = Math.sqrt(magic);
  return { lat: lat + dlat*180/((a*(1-e))/(magic*root)*pi), lon: lon + dlon*180/(a/root*Math.cos(rad)*pi) };
};
const curveValues = path => {
  assert(/^M [-\d., ]+(?: C [-\d., ]+)+$/.test(path) && !/NaN|Infinity/.test(path));
  const values = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
  assert.equal((values.length - 2) % 6, 0);
  const meta = read('source-meta.json');
  assert(values.every((v, i) => finite(v) && v >= 0 && v <= (i % 2 ? meta.height : meta.width)));
  return values;
};

check('2026.11 reference roster and exact source scope', () => {
  assert.equal(reference.edition, '2026.11'); assert.equal(roster.edition, reference.edition);
  assert.equal(operating.length, 396); assert.equal(ids.size, operating.length);
  assert.equal(all.length, 397); assert.equal(allIds.size, all.length);
  assert.equal(reference.uniqueStationCount, operating.length);
  assert.equal(reference.lineStationMembershipCount, 488);
  assert.equal(operating.reduce((sum, s) => sum + s.lines.length, 0), 488);
  assert.deepEqual(roster.lines.map(l => l.id), lineIds);
  assert.deepEqual(roster.lines.map(l => l.stations.length), counts);
  assert.deepEqual(reference.lineStationCounts, Object.fromEntries(lineIds.map((id, i) => [id, counts[i]])));
  sameSet(roster.lines.flatMap(l => l.stations), ids);
  assert(ids.has('龙泉驿火车站'), '2026.11 reference adds the operating line 2 station');
  assert(ids.has('龙泉驿火车站南'), 'Operating line 30 terminus is a distinct station');
  assert(ids.has('建设北路') && ids.has('兴业北街'));
  assert(!allIds.has('电子科大建设北路') && !allIds.has('交大兴业北街'));
  assert(reference.aliases['建设北路'].includes('电子科大建设北路'));
  assert(reference.aliases['兴业北街'].includes('交大兴业北街'));
  for (const station of operating) {
    assert.equal(station.name, station.id); assert(station.englishName.trim());
    assert(!station.status || station.status === 'operating');
    assert.deepEqual(station.lines, roster.lines.filter(l => l.stations.includes(station.id)).map(l => l.id));
  }
  if (!rosterOnly || existsSync(file('../data/visited-stations.json'))) validateVisitedStations(read('visited-stations.json'), ids);
  validateStationNotes(read('station-notes.json'), ids);
});

check('Preserved tram archive and explicit visibility scope', () => {
  assert.deepEqual(reference.hiddenLineIds, hiddenLineIds); assert.deepEqual(roster.hiddenLineIds, hiddenLineIds);
  assert.deepEqual(reference.visibleLineIds, visibleLineIds); assert.deepEqual(roster.visibleLineIds, visibleLineIds);
  assert.equal(visibleLineIds.length, 17); assert.equal(visibleIds.size, 364);
  assert.equal(reference.visibleStationCount, visibleIds.size); assert.equal(roster.visibleStationCount, visibleIds.size);
  assert.equal(reference.retainedHiddenStationCount, 32);
  assert.equal(reference.visibleLineStationMembershipCount, 453); assert.equal(roster.visibleLineStationMembershipCount, 453);
  assert.equal(roster.lines.filter(line => visibleLineIds.includes(line.id)).reduce((sum, line) => sum + line.stations.length, 0), 453);
  const tram = roster.lines.find(line => line.id === 'r2');
  assert.equal(tram.stations.length, 35); assert.equal(tram.paths.length, 2);
  assert.equal(operating.filter(station => !visibleIds.has(station.id)).length, 32);
  assert(operating.filter(station => !visibleIds.has(station.id)).every(station => station.lines.every(id => hiddenLineIds.includes(id))));
});

check('Restored eastern line 2 and single planned Lujia station', () => {
  assert.deepEqual(metadata(inactive), reference.plannedStations);
  assert.deepEqual(roster.plannedStations, reference.plannedStations);
  sameSet(inactive.map(s => s.id), ['芦葭']);
  assert(inactive.every(s => s.status === 'planned' && s.lines.length === 1 && s.lines[0] === 's3'));
  assert(inactive.every(s => !ids.has(s.id)));
  assert.equal(reference.plannedStationCount, inactive.length);
  assert.deepEqual(reference.inactiveStationCounts, { planned: 1, suspended: 0 });
  assert.deepEqual(roster.inactivePaths, reference.inactivePaths);
  assert.deepEqual(roster.inactivePaths, {});
  assert.equal(paths['2'][0].at(-1), '龙泉驿');
  assert.deepEqual(paths['2'][0].slice(-8), ['成都行政学院', '龙泉驿火车站', ...restoredIds]);
  assert(restoredIds.every(id => ids.has(id) && !inactive.some(s => s.id === id)));
  assert(roster.lines.every(line => !line.paths.flat().includes('芦葭')));
  assert.deepEqual(reference.referenceLinePaths.s3, [s3Physical]);
  assert.deepEqual(roster.referenceLinePaths.s3, [s3Physical]);
  assert.deepEqual(paths.s3, [s3Physical.filter(id => id !== '芦葭')]);
  assert(reference.aliases['资阳临空'].includes('临空经济区'));
  assert(!allIds.has('临空经济区'), 'Engineering name must not create a separate future station');
});

for (const line of roster.lines) check(`Operating path ${line.id}`, () => {
  assert.deepEqual(line.paths, paths[line.id]);
  assert.equal(new Set(line.stations).size, line.stations.length);
  sameSet(line.paths.flat(), line.stations);
  assert.equal(line.paths.length, ['1', 'r2'].includes(line.id) ? 2 : 1);
  for (const path of line.paths) {
    assert(path.length > 1 && path.every(id => ids.has(id)));
    assert(path.every((id, i) => !i || id !== path[i - 1]), 'Consecutive duplicate station');
    assert.equal(new Set(path).size, path.length - (line.id === '7' ? 1 : 0));
  }
});

check('Line 1 branches, line 7 circle and tram Y topology', () => {
  const one = paths['1'], seven = paths['7'][0], tram = paths.r2;
  assert.deepEqual(one.map(p => p.length), [24, 33]);
  assert.deepEqual(one.map(p => [p[0], p.at(-1)]), [['五根松', '韦家碾'], ['科学城', '韦家碾']]);
  assert.deepEqual(one[0].slice(one[0].indexOf('四河')), one[1].slice(one[1].indexOf('四河')));
  assert.deepEqual(one[0].slice(0, 3), ['五根松', '广都', '四河']);
  assert.equal(seven.length, 32); assert.equal(seven[0], seven.at(-1));
  assert.deepEqual(seven.slice(0, 3), ['火车北站', '北站西二路', '九里堤']);
  assert.equal(seven.at(-2), '驷马桥');
  assert.deepEqual(tram.map(p => p.length), [22, 14]);
  assert.deepEqual(tram.map(p => [p[0], p.at(-1)]), [['成都西站', '郫县西站'], ['新业路', '仁和']]);
  assert.deepEqual(tram[0].filter(id => tram[1].includes(id)), ['新业路']);
  assert(ids.has('交大犀浦校区') && ids.has('兴业北街'));
  assert.deepEqual(operating.find(s => s.id === '交大犀浦校区').lines, ['r2']);
  for (const id of ['成都西站', '天河路', '望丛祠']) assert(operating.find(s => s.id === id).lines.includes('r2'));
});

check('18/19 shared airport operation', () => {
  const airport = ['天府站', '三岔', '福田', '天府机场1号2号航站楼', '天府机场北'];
  assert.deepEqual(paths['18'][0].slice(-5), airport);
  assert.deepEqual(paths['19'][0].slice(0, 5), [...airport].reverse());
  assert.equal(paths['18'][0][0], '火车南站');
  assert.equal(paths['19'][0].at(-1), '金星');
  for (const id of airport) assert(operating.find(s => s.id === id).lines.includes('18') && operating.find(s => s.id === id).lines.includes('19'));
});

check('Real coordinates, snapshot hashes and exact provenance', () => {
  sameKeys(coordinates, allIds); sameKeys(english, allIds);
  assert.equal(report.edition, '2026.11'); assert.equal(report.snapshot, 'amap-chengdu-source-2026-11-02.json');
  assert.equal(report.snapshotSHA256, hash(report.snapshot));
  assert.equal(report.operatingRosterMatched, true); assert.deepEqual(report.missing, []);
  assert.equal(report.operatingStationCount, operating.length); assert.equal(report.uniqueStationCount, all.length);
  assert.equal(report.plannedStationCount, inactive.length); assert.equal(report.lineStationMembershipCount, 488);
  assert.equal(report.visibleOperatingStationCount, 364); assert.equal(report.visibleLineStationMembershipCount, 453);
  assert.deepEqual(report.hiddenLineIds, hiddenLineIds);
  assert.equal(report.stations.length, all.length); sameSet(report.stations.map(s => s.id), allIds);
  const amap = json(report.snapshot);
  const sourceStations = amap.l.flatMap(line => line.st);
  const aliasIds = new Map(all.flatMap(station => [station.id, ...(station.aliases ?? [])].map(name => [name, station.id])));
  const sourceMetroIds = amap.l.filter(line => lineIds.includes(line.ln === 'S3(资阳)线' ? 's3' : line.ln.replace(/号线$/, '')))
    .flatMap(line => line.st).map(station => {
      assert(aliasIds.has(station.n), `Unreviewed AMap source station: ${station.n}`);
      return aliasIds.get(station.n);
    });
  sameSet(sourceMetroIds, all.filter(station => station.lines.some(id => id !== 'r2')).map(station => station.id));
  const osm = json('r2-osm-mail.json'), osmNodes = new Map(osm.elements.map(node => [String(node.id), node]));
  const r2 = json('r2-research.json');
  assert.equal(r2.stations.length, 35); assert.deepEqual(r2.paths, paths.r2);
  sameSet(osm.elements.map(node => node.tags.name), r2.stations.map(station => station.id));
  assert.deepEqual(report.r2SourceStations, r2.stations);
  assert.equal(report.additionalSourceSnapshots[0].sha256, hash('r2-osm-mail.json'));
  sameSet(r2.stations.map(s => s.id), paths.r2.flat());
  for (const station of all) {
    const coordinate = coordinates[station.id];
    assert(finite(coordinate.lat) && finite(coordinate.lon));
    assert(coordinate.lat > 30 && coordinate.lat < 31.1 && coordinate.lon > 103.5 && coordinate.lon < 104.7);
    assert.equal(english[station.id], station.englishName);
    assert(english[station.id].trim() && !/[\u4e00-\u9fff]/.test(english[station.id]));
    const record = report.stations.find(s => s.id === station.id);
    assert.equal(record.outputCRS, 'WGS84'); assert.deepEqual(record.coordinate, coordinate);
    assert.equal(record.status, station.id === '芦葭' ? 'planned' : 'operating');
    if (record.sourceCRS === 'gcj02') {
      const match = sourceStations.find(s => s.n === record.sourceName && (s.poiid ?? s.si) === record.sourceId);
      assert(match, station.id); const [lon, lat] = match.sl.split(',').map(Number);
      assert.deepEqual(record.sourceLocation, { lat, lon, crs: 'gcj02' });
      assert(record.roundTripErrorDegrees >= 0 && record.roundTripErrorDegrees < 1e-7);
      const converted = gcjForward(coordinate);
      const residual = Math.max(Math.abs(converted.lat - lat), Math.abs(converted.lon - lon));
      assert(residual < 1e-7, `Wrong GCJ-02 inverse: ${station.id}`);
      assert(Math.abs(residual - record.roundTripErrorDegrees) < 1e-12);
      assert.equal(record.displayEnglish, english[station.id]);
    } else {
      assert.equal(record.sourceCRS, 'WGS84');
      const node = osmNodes.get(record.sourceId.split(':').at(-1)); assert(node, station.id);
      assert.equal(node.tags.name, record.sourceName);
      assert.deepEqual(coordinate, { lat: node.lat, lon: node.lon });
    }
  }
  for (const station of r2.stations) {
    const node = osmNodes.get(station.sourceId.split(':').at(-1)); assert(node);
    assert.equal(node.tags.name, station.id);
    assert.deepEqual(station.coordinate, { lat: node.lat, lon: node.lon });
    assert.deepEqual(station.sourceLocation, { lat: node.lat, lon: node.lon, crs: 'WGS84' });
  }
  assert.deepEqual(report.s3SourceStations.map(station => station.id), s3Physical);
  for (const station of report.s3SourceStations) {
    assert.equal(station.sourceCRS, 'gcj02'); assert.equal(station.outputCRS, 'WGS84');
    assert.equal(station.sourceStationStatus, station.id === '芦葭' ? '3' : '1');
    assert.deepEqual(station.coordinate, coordinates[station.id]);
  }
});

if (!rosterOnly) {
  check('Final station anchors, symbols and labels', () => {
    const source = bytes('../data/stations.ts').toString('utf8');
    const stations = JSON.parse(source.split('export const stations: Station[] = ')[1].replace(/;\s*$/, ''));
    const symbols = read('station-symbols.json'), labels = read('station-labels.json'), meta = read('source-meta.json');
    sameSet(stations.map(s => s.id), ids); assert.equal(stations.length, ids.size);
    assert.equal(meta.edition, '2026.11'); assert.deepEqual(meta.crop, [1250, 400, 6050, 4430]);
    assert.deepEqual([meta.cropWidth, meta.cropHeight], [4800, 4030]); assert.deepEqual(meta.sourceDimensions, [6300, 4500]);
    assert(finite(meta.width) && finite(meta.height) && meta.width >= meta.cropWidth && meta.height >= meta.cropHeight);
    const exportedMeta = source.match(/export const mapMeta\s*=\s*\{([^}]+)\}/s)?.[1];
    assert(exportedMeta, 'Missing exported map canvas metadata');
    assert.equal(Number(exportedMeta.match(/\bwidth['"]?\s*:\s*([\d.]+)/)?.[1]), meta.width);
    assert.equal(Number(exportedMeta.match(/\bheight['"]?\s*:\s*([\d.]+)/)?.[1]), meta.height);
    assert.match(exportedMeta, /\bedition['"]?\s*:\s*['"]2026\.11['"]/);
    assert.deepEqual(meta.sourceSHA256, {
      reference: '5ca86a6591c07e2a9b62ac32ac983011ec0ee9703fa3bb5cd6bd4e1fd2f1ecc6',
      geometry: 'cb6bb6575bb293398cf3aaf8e05551da11353e3e7d0fcfee0cbb0106b766784a',
    });
    sameKeys(symbols, allIds); sameKeys(labels, allIds);
    const rendered = [...stations, ...inactive];
    assert.equal(new Set(rendered.map(s => `${s.x},${s.y}`)).size, rendered.length);
    for (const station of rendered) {
      assert(finite(station.x) && finite(station.y) && station.x >= 0 && station.x <= meta.width && station.y >= 0 && station.y <= meta.height);
      const checked = all.find(s => s.id === station.id);
      assert.equal(station.name, checked.name);
      if (station.englishName !== undefined) assert.equal(station.englishName, english[station.id]);
      assert.deepEqual(station.lines, checked.lines);
      const parts = symbols[station.id].parts;
      assert(parts.length > 0); sameSet(parts.flatMap(p => p.lines), station.lines);
      for (const part of parts) {
        assert([part.x, part.y, part.width, part.height, part.angle].every(finite));
        assert(part.width > 0 && part.height > 0 && part.width <= 80 && part.height <= 80);
        assert(part.x >= 0 && part.x <= meta.width && part.y >= 0 && part.y <= meta.height);
        assert.equal(typeof part.transfer, 'boolean');
      }
      const label = labels[station.id];
      assert([label.x, label.y, label.fontSize].every(finite) && label.fontSize > 0);
      assert(['start', 'middle', 'end'].includes(label.anchor));
    }
  });

  check('Final route geometry, badges and station coverage', () => {
    const routes = read('route-paths.json'), colors = read('line-colors.json');
    const traces = json('route-tracing-report.json'), polylines = json('route-polylines.json');
    const sequences = roster.lines.flatMap(line => line.paths.map(stations => ({ id: line.id, stations })));
    sameKeys(colors, lineIds); sameSet(routes.map(r => r.id), lineIds); assert.equal(routes.length, lineIds.length);
    for (const line of roster.lines) {
      assert.match(colors[line.id], /^#[0-9a-f]{6}$/i);
      const route = routes.find(r => r.id === line.id);
      assert.equal(route.color, colors[line.id]); assert.equal(route.paths.length, line.paths.length);
      for (const path of route.paths) curveValues(path);
      const badge = file(`../public/lines/${line.id}.svg`); assert(existsSync(badge));
      const svg = readFileSync(badge, 'utf8');
      const sign = json('line-sign-research.json').lines.find(value => value.id === line.id);
      assert(sign, `${line.id}: missing individual line-sign audit`);
      assert.equal(hash(sign.sourceFile), sign.sourceSHA256);
      assert(svg.includes('<svg ') && svg.includes(`viewBox="${sign.viewBox}"`));
      assert(svg.includes('preserveAspectRatio="xMidYMid meet"') && !svg.includes('<text'), `${line.id}: preserve source artwork without font substitution`);
    }
    assert(routes.every(route => !route.inactivePaths?.length), 'Restored line 2 must not retain a suspended grey route');
    for (const route of routes) for (const path of route.branchPaths ?? []) curveValues(path);
    const circle = curveValues(routes.find(route => route.id === '7').paths[0]);
    assert(Math.hypot(circle[0]-circle.at(-2), circle[1]-circle.at(-1)) < .01, 'Line 7 curve must close');
    assert.equal(traces.length, sequences.length);
    for (const [index, sequence] of sequences.entries()) {
      const trace = traces[index]; assert.equal(trace.id, sequence.id);
      assert.deepEqual(trace.stationCoverage.map(s => s.name), sequence.stations);
      assert.equal(trace.stationCount, sequence.stations.length); assert.equal(trace.segmentCount, sequence.stations.length - 1);
      assert.equal(trace.segments.length, trace.segmentCount);
      const points = polylines[`${sequence.id}-${index}`]; assert(points?.length > 1);
      assert(points.every(p => p.length === 2 && p.every(finite)));
      for (const station of trace.stationCoverage) {
        assert(station.curveDistance >= 0 && station.curveDistance < 4.5, `${sequence.id} ${station.name}`);
        const measured = Math.min(...points.map(([x, y]) => Math.hypot(x - station.x, y - station.y)));
        assert(Math.abs(measured - station.curveDistance) < .01, `Stale coverage: ${station.name}`);
      }
      for (const [i, segment] of trace.segments.entries()) {
        assert.equal(segment.from, sequence.stations[i]); assert.equal(segment.to, sequence.stations[i + 1]);
        assert(segment.directLength > 0 && segment.length >= segment.directLength - .2);
      }
    }
  });

  check('No stale suspended-route trace', () => {
    const traces = existsSync(file('inactive-route-tracing-report.json')) ? json('inactive-route-tracing-report.json') : [];
    const polylines = existsSync(file('inactive-route-polylines.json')) ? json('inactive-route-polylines.json') : {};
    const sequences = Object.entries(roster.inactivePaths).flatMap(([id, paths]) => paths.map(stations => ({ id, stations })));
    assert.equal(traces.length, sequences.length); assert.equal(Object.keys(polylines).length, sequences.length);
    for (const [index, sequence] of sequences.entries()) {
      const trace = traces[index]; assert.equal(trace.id, sequence.id);
      assert.deepEqual(trace.stationCoverage.map(s => s.name), sequence.stations);
      assert.equal(trace.stationCount, sequence.stations.length); assert.equal(trace.segmentCount, sequence.stations.length - 1);
      assert.equal(trace.segments.length, trace.segmentCount);
      const points = polylines[`${sequence.id}-${index}`] ?? polylines[`${sequence.id}-inactive-${index}`] ??
        (sequences.length === 1 ? Object.values(polylines)[0] : undefined);
      assert(points?.length > 1 && points.every(p => p.length === 2 && p.every(finite)));
      for (const station of trace.stationCoverage) {
        assert(station.curveDistance >= 0 && station.curveDistance < 4.5, `Inactive ${station.name}`);
        const measured = Math.min(...points.map(([x, y]) => Math.hypot(x - station.x, y - station.y)));
        assert(Math.abs(measured - station.curveDistance) < .01, `Stale inactive coverage: ${station.name}`);
      }
      for (const [i, segment] of trace.segments.entries()) {
        assert.equal(segment.from, sequence.stations[i]); assert.equal(segment.to, sequence.stations[i + 1]);
        assert(segment.directLength > 0 && segment.length >= segment.directLength - .2);
      }
    }
  });

  check('S3 six operating stops and seven physical reference stops', () => {
    const review = json('s3-geometry-review.json'), routes = read('route-paths.json');
    const meta = read('source-meta.json'), route = routes.find(route => route.id === 's3');
    assert.equal(review.source.edition, '2026.11');
    assert.deepEqual(review.stationOrder, s3Physical);
    assert.deepEqual(review.operatingStationOrder, paths.s3[0]);
    assert.deepEqual(route.paths, review.route.paths);
    assert.equal(review.source.geographic.sha256, meta.sourceSHA256.reference);
    assert.equal(review.source.pure.sha256, meta.sourceSHA256.geometry);
    assert(meta.width >= review.recommendedCanvas.width && meta.height >= review.recommendedCanvas.height);
    const physical = review.verification.physicalStationCoverage, points = review.route.polyline;
    assert.deepEqual(physical.map(station => station.name), s3Physical);
    assert.deepEqual(review.verification.operatingStationCoverage.map(station => station.name), paths.s3[0]);
    assert(physical.every(station => station.status === (station.name === '芦葭' ? 'planned' : 'operating')));
    for (const station of physical) {
      assert(station.curveDistance >= 0 && station.curveDistance < 4.5);
      const measured = Math.min(...points.map(([x, y]) => Math.hypot(x - station.x, y - station.y)));
      assert(Math.abs(measured - station.curveDistance) < .01, `Stale physical S3 coverage: ${station.name}`);
    }
  });
}

if (failures.length) {
  console.error(`Chengdu validation failed (${failures.length} checks):\n${failures.map(f => `- ${f}`).join('\n')}`);
  process.exitCode = 1;
} else console.log(`Verified ${operating.length} retained operating + ${inactive.length} planned stations, ${lineIds.length} retained lines and ${all.length} source-backed coordinates; visible scope ${visibleIds.size} operating stations, ${visibleLineIds.length} lines and 453 memberships (${passed.length} checks${rosterOnly ? ', roster only' : ', including final geometry'}).`);
