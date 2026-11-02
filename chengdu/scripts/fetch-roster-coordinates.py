"""Build the 2026.11 Chengdu roster and source-backed WGS84 coordinates.

AMap's GCJ-02 station locations are inverted iteratively, never inferred from
the schematic. The downloaded subway snapshot is kept unchanged for auditing.
"""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'scripts/amap-chengdu-source-2026-11-02.json'
URL = 'https://map.amap.com/service/subway?srhdata=5101_drw_chengdu.json'
LINE_IDS = [str(i) for i in range(1, 11)] + ['13', '17', '18', '19', '27', '30', 's3']
HIDDEN_LINE_IDS = ['r2']
REFERENCE = '01.公开版-成都地铁线路3.0-a运营版（至2026年11月）纯色底.jpg'
EXPECTED = dict(zip(LINE_IDS, [35, 33, 37, 30, 41, 56, 31, 32, 13, 19, 21, 21, 12, 22, 22, 22, 6]))
SOURCE_LINE_IDS = {'S3(资阳)线': 's3'}
NAME_OVERRIDES = {
    '成都医学院(新都校区)': '成都医学院',
    '军区总医院(熊猫基地西大门)': '军区总医院',
    '熊猫大道(熊猫基地南大门)': '熊猫大道',
    '九道堰(凤凰山体育公园东)': '九道堰',
    '杜家碾(凤凰山体育公园西)': '杜家碾',
    '青岛路(法务区)': '青岛路',
    '新平(宝墩)': '新平',
    '浣花里(省医院草堂院区)': '浣花里',
    '威灵(西南财大天府学院)': '威灵',
    '交大兴业北街': '兴业北街',
    '电子科大建设北路': '建设北路',
}
REFERENCE_ENGLISH = {
    '军区总医院': 'Military Region General Hospital',
    '熊猫大道': 'Panda Avenue',
    '九道堰': 'Jiudaoyan',
    '杜家碾': 'Dujianian',
    '兴业北街': 'Xingye North Street',
    '青岛路': 'Qingdao Road',
    '新平': 'Xinping',
    '建设北路': 'Jianshe North Road',
}
PLANNED_IDS = {'芦葭'}
EXCLUDED_IDS = set()
SUSPENDED_IDS = set()
INACTIVE_IDS = PLANNED_IDS | SUSPENDED_IDS
INACTIVE_PATHS = {}


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def transform_lat(x, y):
    v = -100 + 2*x + 3*y + .2*y*y + .1*x*y + .2*math.sqrt(abs(x))
    v += (20*math.sin(6*x*math.pi) + 20*math.sin(2*x*math.pi))*2/3
    v += (20*math.sin(y*math.pi) + 40*math.sin(y/3*math.pi))*2/3
    return v + (160*math.sin(y/12*math.pi) + 320*math.sin(y*math.pi/30))*2/3


def transform_lon(x, y):
    v = 300 + x + 2*y + .1*x*x + .1*x*y + .1*math.sqrt(abs(x))
    v += (20*math.sin(6*x*math.pi) + 20*math.sin(2*x*math.pi))*2/3
    v += (20*math.sin(x*math.pi) + 40*math.sin(x/3*math.pi))*2/3
    return v + (150*math.sin(x/12*math.pi) + 300*math.sin(x/30*math.pi))*2/3


def forward(lat, lon):
    a, e = 6378245.0, .00669342162296594323
    dlat, dlon = transform_lat(lon-105, lat-35), transform_lon(lon-105, lat-35)
    rad = lat/180*math.pi
    magic = 1-e*math.sin(rad)**2
    root = math.sqrt(magic)
    return lat+dlat*180/((a*(1-e))/(magic*root)*math.pi), lon+dlon*180/(a/root*math.cos(rad)*math.pi)


def inverse(lat, lon):
    x, y = lat, lon
    for _ in range(30):
        gx, gy = forward(x, y)
        ex, ey = gx-lat, gy-lon
        x -= ex
        y -= ey
        if max(abs(ex), abs(ey)) < 1e-10:
            return round(x, 7), round(y, 7)
    raise ValueError('GCJ-02 inverse failed')


def build():
    source = json.loads(SOURCE.read_text(encoding='utf-8-sig'))
    paths, stations, records, english_sources = {}, {}, {}, {}
    for line in source['l']:
        line_id = SOURCE_LINE_IDS.get(line['ln'], line['ln'].removesuffix('号线'))
        if line_id not in LINE_IDS:
            continue
        path = []
        for record in line['st']:
            source_name = record['n']
            if source_name in EXCLUDED_IDS:
                continue
            station_id = NAME_OVERRIDES.get(source_name, source_name)
            # The public response repeats the exact same Fengxihe record twice.
            if path and path[-1] == station_id:
                continue
            path.append(station_id)
            source_english = record.get('multilang', {}).get('n', {}).get('en') or record.get('en')
            assert source_english, f'Missing source English: {station_id}'
            english = REFERENCE_ENGLISH.get(station_id, source_english)
            station = stations.setdefault(station_id, {'id': station_id, 'name': station_id,
                'englishName': english, 'aliases': [source_name] if source_name != station_id else [], 'lines': []})
            if line_id not in station['lines']:
                station['lines'].append(line_id)
            records.setdefault(station_id, record)
            english_sources.setdefault(station_id, {'sourceField': 'multilang.n.en',
                'sourceEnglish': source_english, 'displayEnglish': english,
                'referenceEnglishOverride': station_id in REFERENCE_ENGLISH})
        paths.setdefault(line_id, []).append(path)
    # The engineering name refers to the same operating station, not a second
    # future stop. Lujia is the single reserved S3 station shown in the map.
    stations['资阳临空']['aliases'] = ['临空经济区']
    reference_paths = {line_id: [path.copy() for path in pp] for line_id, pp in paths.items()}
    planned = [{**stations.pop(s), 'status': 'suspended' if s in SUSPENDED_IDS else 'planned'}
        for s in sorted(INACTIVE_IDS)]
    paths = {line_id: [[s for s in p if s not in INACTIVE_IDS] for p in paths[line_id]] for line_id in LINE_IDS}
    # A circle's closing edge is explicit, as in other city builders.
    paths['7'][0].append(paths['7'][0][0])
    reference_paths['7'] = [path.copy() for path in paths['7']]
    counts = {line_id: len(set(s for p in pp for s in p)) for line_id, pp in paths.items()}
    assert counts == EXPECTED, counts
    aliases = {s['id']: s['aliases'] for s in stations.values() if s['aliases']}
    notes = [
        '2026.11参考范围包含1—10、13、17、18、19、27、30号线及S3资阳线；S3的灰色为线路本色，不表示全线未运营。',
        '蓉2号线原始35站及两支路径完整保留，hiddenLineIds明确隐藏r2；其独有站点不计可见站数。',
        '1号线保留五根松—韦家碾24站、科学城—韦家碾33站两条运营路径，共35个不同站点。',
        '7号线31站，最后一站显式连接首站形成环线。',
        'AMap 4号线凤溪河完全重复记录已去重。',
        '2号线东段六站自2026.09.28恢复运营；2026.11图新增龙泉驿火车站独立橙色站圈，完整收录犀浦—龙泉驿33站。',
        'S3资阳线7个参考站中6站运营，芦葭为灰字灰圈预留站；资阳临空的旧工程名是临空经济区，不是额外预留站。',
        '19号线保留AMap通往天府机场北的贯通路径；18/19号线共享天府站至天府机场北站点。',
    ]
    r2_path = ROOT / 'scripts/r2-research.json'
    r2 = json.loads(r2_path.read_text(encoding='utf-8'))
    r2_snapshot = ROOT / 'scripts' / r2['sourceSnapshot']
    r2_nodes = {str(n['id']): n for n in json.loads(r2_snapshot.read_text(encoding='utf-8'))['elements']}
    if r2:
        paths['r2'] = r2['paths']
        reference_paths['r2'] = r2['paths']
        counts['r2'] = len(set(s for p in paths['r2'] for s in p))
        assert counts['r2'] == 35 and list(map(len, paths['r2'])) == [22, 14]
        for record in r2['stations']:
            node = r2_nodes[record['sourceId'].split(':')[-1]]
            assert record['sourceCRS'] == 'WGS84'
            assert record['coordinate'] == {'lat': node['lat'], 'lon': node['lon']}
            station_id = record['id']
            station = stations.setdefault(station_id, {'id': station_id, 'name': station_id,
                'englishName': record['englishName'], 'aliases': [], 'lines': []})
            station['lines'].append('r2')
        notes.extend(r2.get('notes', []))
    assert len(stations) == 396 and len(planned) == 1
    line_order = {line_id: i for i, line_id in enumerate(paths)}
    for station in [*stations.values(), *planned]:
        station['lines'].sort(key=line_order.__getitem__)
    visible_line_ids = [line_id for line_id in paths if line_id not in HIDDEN_LINE_IDS]
    visible_ids = {s for line_id in visible_line_ids for path in paths[line_id] for s in path}
    visible_memberships = sum(counts[line_id] for line_id in visible_line_ids)
    assert len(visible_ids) == 364 and visible_memberships == 453
    roster = {'edition': '2026.11', 'reference': REFERENCE,
        'uniqueStationCount': len(stations), 'lineStationMembershipCount': sum(counts.values()),
        'hiddenLineIds': HIDDEN_LINE_IDS, 'visibleLineIds': visible_line_ids,
        'visibleStationCount': len(visible_ids), 'retainedHiddenStationCount': len(set(stations) - visible_ids),
        'visibleLineStationMembershipCount': visible_memberships,
        'lineStationCounts': counts, 'linePaths': paths, 'stations': list(stations.values()),
        'referenceLinePaths': reference_paths,
        'inactivePaths': INACTIVE_PATHS,
        'plannedStations': planned, 'plannedStationCount': len(planned),
        'inactiveStationCounts': {'planned': len(PLANNED_IDS), 'suspended': len(SUSPENDED_IDS)},
        'english': {s['id']: s['englishName'] for s in list(stations.values()) + planned},
        'aliases': aliases, 'notes': notes}
    write(ROOT / 'scripts/reference-roster.json', roster)
    write(ROOT / 'data/official-roster.json', {'edition': '2026.11', 'source': REFERENCE,
        'hiddenLineIds': HIDDEN_LINE_IDS, 'visibleLineIds': visible_line_ids,
        'visibleStationCount': len(visible_ids), 'visibleLineStationMembershipCount': visible_memberships,
        'referenceLinePaths': reference_paths,
        'aliases': aliases, 'plannedStations': planned, 'inactivePaths': INACTIVE_PATHS,
        'lines': [{'id': line_id, 'name': '蓉2号线' if line_id == 'r2' else 'S3资阳线' if line_id == 's3' else f'{line_id}号线',
            'stations': list(dict.fromkeys(s for p in pp for s in p)), 'paths': pp} for line_id, pp in paths.items()]})
    coordinates, report = {}, []
    for station_id, record in records.items():
        lon, lat = map(float, record['sl'].split(','))
        assert 30.0 < lat < 31.1 and 103.5 < lon < 104.7, station_id
        outlat, outlon = inverse(lat, lon)
        error = max(abs(a-b) for a, b in zip((lat, lon), forward(outlat, outlon)))
        assert error < 1e-7, {'station': station_id, 'error': error}
        coordinates[station_id] = {'lat': outlat, 'lon': outlon}
        report.append({'id': station_id, 'name': station_id, 'sourceName': record['n'],
            'status': 'suspended' if station_id in SUSPENDED_IDS else 'planned' if station_id in PLANNED_IDS else 'operating',
            'source': URL, 'sourceId': record.get('poiid', record.get('si')),
            'sourceStationStatus': record.get('su'), 'sourceLineIds': record.get('r', '').split('|'),
            'sourceCRS': 'gcj02', 'sourceLocation': {'lat': lat, 'lon': lon, 'crs': 'gcj02'},
            'outputCRS': 'WGS84', 'coordinate': coordinates[station_id],
            'roundTripErrorDegrees': error, **english_sources[station_id]})
    if r2:
        for record in r2['stations']:
            station_id = record['id']
            # Prefer the subway point for shared IDs; both modes are audited.
            if station_id not in coordinates:
                coordinates[station_id] = record['coordinate']
                report.append({**record, 'status': 'operating', 'outputCRS': 'WGS84'})
    assert set(coordinates) == set(stations) | INACTIVE_IDS
    write(ROOT / 'data/station-coordinates.json', coordinates)
    write(ROOT / 'data/station-english.json', roster['english'])
    if not (ROOT / 'data/station-notes.json').exists():
        write(ROOT / 'data/station-notes.json', {})
    write(ROOT / 'data/planned-stations.json', planned)
    write(ROOT / 'scripts/station-coordinates-report.json', {'edition': '2026.11', 'source': URL,
        'snapshot': SOURCE.name, 'snapshotSHA256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'additionalSourceSnapshots': [{'snapshot': r2_snapshot.name,
            'sha256': hashlib.sha256(r2_snapshot.read_bytes()).hexdigest(),
            'sourceUrls': r2['sourceUrls'], 'sourceCRS': 'WGS84'}],
        'r2SourceStations': r2['stations'],
        's3SourceStations': [next(record for record in report if record['id'] == station_id)
            for station_id in reference_paths['s3'][0]],
        'operatingRosterMatched': True, 'matchRule': 'Exact source name plus explicit reference-name aliases.',
        'uniqueStationCount': len(coordinates), 'operatingStationCount': len(stations),
        'hiddenLineIds': HIDDEN_LINE_IDS, 'visibleOperatingStationCount': len(visible_ids),
        'visibleLineStationMembershipCount': visible_memberships,
        'plannedStationCount': len(planned),
        'inactiveStationCounts': {'planned': len(PLANNED_IDS), 'suspended': len(SUSPENDED_IDS)},
        'lineStationMembershipCount': sum(counts.values()),
        'lineStationCounts': counts, 'stations': report, 'missing': []})
    print(f'{len(stations)} operating + {len(PLANNED_IDS)} planned + {len(SUSPENDED_IDS)} suspended; '
        f'{sum(counts.values())} memberships; {len(coordinates)} source-backed coordinates.')


if __name__ == '__main__':
    build()
