"""Build the 2026.05 operating roster and strict AMap-backed WGS84 coordinates.

The downloaded Hangzhou public subway response contains the complete cross-city
Hanghai line. No station is matched by substring or schematic pixel position.
"""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'scripts/amap-hangzhou-source.json'
URL = 'https://map.amap.com/service/subway?srhdata=3301_drw_hangzhou.json'
LINE_IDS = [str(i) for i in range(1, 11)] + ['16', '19', 'hh']
EXPECTED = dict(zip(LINE_IDS, [33, 33, 37, 33, 40, 36, 24, 9, 21, 12, 12, 17, 12]))
PLANNED_IDS = {'汤家村'}
REFERENCE = '01.公开版-杭州地铁线路3.0-a运营版（至2026年05月）纯色底.jpg'
# These are the public response's multilingual spellings; legacy `en` values
# are preserved for every other station. The legacy field at this renamed stop
# still says Zhipu Road and the Xiwen field contains a truncated word.
ENGLISH_FIELDS = {'之江文化中心': 'multilang', '西文街': 'multilang'}
REFERENCE_ENGLISH = {'奥体中心': 'Olympic Sports Center',
    '之江文化中心': 'Zhijiang Culture Center', '水澄桥': 'Shuicheng Bridge'}


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


# Same iterative GCJ-02 inverse and round-trip criterion as the existing Kunming
# coordinate builder; final coordinates are rounded to seven decimal places.
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
    raise ValueError('GCJ inverse failed')


def build():
    source = json.loads(SOURCE.read_text(encoding='utf-8-sig'))
    paths, stations, records, english_sources = {}, {}, {}, {}
    for line in source['l']:
        line_id = 'hh' if line['ln'] == '杭海城际' else line['ln'].removesuffix('号线')
        if line_id not in LINE_IDS:
            continue
        path = []
        for record in line['st']:
            station_id = record['n']
            path.append(station_id)
            multilingual = record.get('multilang', {}).get('n', {}).get('en')
            field = 'multilang.n.en' if ENGLISH_FIELDS.get(station_id) or not record.get('en') else 'en'
            english = multilingual if field == 'multilang.n.en' else record['en']
            assert english, f'Missing source English: {station_id}'
            english = english.replace('jingchang Road', 'Jingchang Road')
            english = REFERENCE_ENGLISH.get(station_id, english)
            station = stations.setdefault(station_id, {'id': station_id, 'name': station_id,
                'englishName': english, 'aliases': [], 'lines': []})
            if line_id not in station['lines']:
                station['lines'].append(line_id)
            # Prefer the first exact-name record, as for other city builders.
            records.setdefault(station_id, record)
            english_sources.setdefault(station_id, {'sourceField': field,
                'sourceEnglish': multilingual if field == 'multilang.n.en' else record['en'],
                'displayEnglish': english,
                'referenceEnglishOverride': station_id in REFERENCE_ENGLISH})
        paths.setdefault(line_id, []).append(path)
    # The public response is current; edition status comes from the supplied
    # 2026.05 map, where Tangjiacun has a gray symbol and gray bilingual label.
    planned = [{**stations.pop(station_id), 'status': 'planned'} for station_id in sorted(PLANNED_IDS)]
    paths = {line_id: [[s for s in path if s not in PLANNED_IDS] for path in paths[line_id]]
        for line_id in LINE_IDS}
    counts = {line_id: len(set(s for p in pp for s in p)) for line_id, pp in paths.items()}
    assert counts == EXPECTED, counts
    assert len(stations) == 270 and len(planned) == 1, (len(stations), len(planned))
    aliases = {'之江文化中心': ['之浦路'], '临平南高铁站': ['临平南站', '余杭高铁站'],
        '海宁高铁西站': ['海宁西站'], '长安(东方学院)': ['长安（东方学院）'],
        '火车东站(东广场)': ['火车东站（东广场）']}
    for station_id, values in aliases.items():
        stations[station_id]['aliases'] = values
    roster = {'edition': '2026.05', 'reference': REFERENCE,
        'uniqueStationCount': len(stations), 'lineStationMembershipCount': sum(counts.values()),
        'lineStationCounts': counts, 'linePaths': paths, 'stations': list(stations.values()),
        'plannedStations': planned, 'plannedStationCount': len(planned),
        'english': {v['id']: v['englishName'] for v in list(stations.values()) + planned}, 'aliases': aliases,
        'notes': ['仅包含参考图的1—10、16、19号线和杭海城际；不包含绍兴地铁或在建线路。',
            '3号线运营37站：吴山前村—星桥33站、星桥—石马28站；共享西溪湿地南—星桥24站。',
            '汤家村在2026.05参考图以灰色站圈和灰字标为未运营；只列plannedStations，不计入运营站数和运营站序。',
            '6号线36站：枸桔弄—桂花西路33站、枸桔弄—双浦25站；共享枸桔弄—美院象山22站。',
            '火车东站与火车东站(东广场)为两个ID，禁止因括号归一化合并。',
            '杭海城际12站由杭州AMap响应的完整跨市线路获取；临平南高铁站与9号线使用相同ID。']}
    write(ROOT / 'scripts/reference-roster.json', roster)
    write(ROOT / 'scripts/reference-english.json', roster['english'])
    write(ROOT / 'data/official-roster.json', {'edition': '2026.05', 'source': REFERENCE,
        'aliases': aliases, 'plannedStations': planned,
        'lines': [{'id': line_id, 'name': '杭海城际' if line_id == 'hh' else f'{line_id}号线',
            'stations': list(dict.fromkeys(s for p in pp for s in p)), 'paths': pp} for line_id, pp in paths.items()]})
    write(ROOT / 'scripts/amap-haining-source.json', {'source': URL,
        'parentSnapshot': SOURCE.name, 'parentSnapshotSHA256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'note': 'Extracted complete cross-city Hanghai line from the official Hangzhou public subway response; not a separately downloaded Haining endpoint.',
        'l': [line for line in source['l'] if line['ln'] == '杭海城际']})
    coordinates, report = {}, []
    for station_id, record in records.items():
        lon, lat = map(float, record['sl'].split(','))
        assert 29.7 < lat < 30.7 and 119.4 < lon < 120.9, station_id
        outlat, outlon = inverse(lat, lon)
        error = max(abs(a-b) for a, b in zip((lat, lon), forward(outlat, outlon)))
        assert error < 1e-7, {'station': station_id, 'error': error}
        coordinates[station_id] = {'lat': outlat, 'lon': outlon}
        report.append({'id': station_id, 'name': station_id, 'sourceName': record['n'],
            'status': 'planned' if station_id in PLANNED_IDS else 'operating',
            'sourceId': record.get('poiid', record.get('si')), 'sourceCRS': 'gcj02',
            'sourceLocation': {'lat': lat, 'lon': lon, 'crs': 'gcj02'}, 'outputCRS': 'WGS84',
            'coordinate': coordinates[station_id], **english_sources[station_id]})
    assert set(coordinates) == set(stations) | PLANNED_IDS
    write(ROOT / 'data/station-coordinates.json', coordinates)
    write(ROOT / 'scripts/station-coordinates-report.json', {'source': URL, 'snapshot': SOURCE.name,
        'snapshotSHA256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'operatingRosterMatched': True,
        'matchRule': 'Exact full Chinese station name, without stripping parentheses.',
        'uniqueStationCount': len(coordinates), 'operatingStationCount': len(stations),
        'plannedStationCount': len(planned), 'lineStationMembershipCount': sum(counts.values()),
        'lineStationCounts': counts, 'stations': report, 'missing': []})
    print(f'{len(stations)} operating + {len(planned)} planned stations; {sum(counts.values())} operating line memberships; {len(coordinates)} source-backed coordinates.')


if __name__ == '__main__':
    build()
