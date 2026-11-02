"""Source-backed EAL/TML context roster; no product registration or UI writes."""
import csv
import hashlib
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
DATA.mkdir(parents=True, exist_ok=True)
CSV = DATA / 'mtr-lines-and-stations-source.csv'
SEARCH = 'https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q='
rows = list(csv.DictReader(CSV.open(encoding='utf-8-sig')))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def query(url):
    with urllib.request.urlopen(url, timeout=45) as response:
        return json.load(response)


paths = {
    'EAL': [[s['Station Code'] for s in rows if s['Line Code'] == 'EAL' and s['Direction'] == 'UT'],
        ['SHS', 'LMC'], ['SHT', 'RAC', 'UNI']],
    'TML': [[s['Station Code'] for s in rows if s['Line Code'] == 'TML' and s['Direction'] == 'DT']],
}
stations = {}
for line in ['EAL', 'TML']:
    for row in rows:
        if row['Line Code'] != line:
            continue
        code = row['Station Code']
        record = stations.setdefault(code, {'id': code, 'name': row['Chinese Name'],
            'englishName': row['English Name'], 'mtrStationId': row['Station ID'], 'lines': []})
        if line not in record['lines']:
            record['lines'].append(line)
stations['RAC'] = {'id': 'RAC', 'name': '馬場', 'englishName': 'Racecourse', 'lines': ['EAL'],
    'serviceNote': 'Racecourse branch; trains operate on race days and specified event days, not the regular Fo Tan service.',
    'nameSource': 'https://www.mtr.com.hk/en/customer/services/system_map.html',
    'stationCodeSource': 'https://www.mtr.com.hk/archive/ch/services/maps/rac.pdf'}
ordered = {code: stations[code] for line_paths in paths.values() for path in line_paths for code in path}
assert len(ordered) == 41 and len(set(sum(paths['EAL'], []))) == 16 and len(paths['TML'][0]) == 27
assert [code for code, station in ordered.items() if len(station['lines']) > 1] == ['HUH', 'TAW']
roster = {'edition': '2026.08', 'scope': 'Shenzhen view context only; East Rail Line and Tuen Ma Line; no Hong Kong selector entry.',
    'sources': {'roster': 'https://opendata.mtr.com.hk/data/mtr_lines_and_stations.csv',
        'systemMap': 'https://www.mtr.com.hk/en/customer/services/system_map.html'},
    'sourceCSVSnapshot': CSV.name, 'sourceCSVSnapshotSHA256': hashlib.sha256(CSV.read_bytes()).hexdigest(),
    'uniqueStationCount': 41, 'lineStationMembershipCount': 43,
    'lines': [{'id': line, 'name': '東鐵綫' if line == 'EAL' else '屯馬綫',
        'englishName': 'East Rail Line' if line == 'EAL' else 'Tuen Ma Line',
        'stations': list(dict.fromkeys(code for path in line_paths for code in path)), 'paths': line_paths}
        for line, line_paths in paths.items()], 'stations': list(ordered.values()),
    'notes': ['EAL physical paths encode the Sheung Shui–Lok Ma Chau fork and Sha Tin–Racecourse–University parallel branch; the regular route goes through Fo Tan.',
        'HUH and TAW are one station each with two line memberships. Lo Wu in Hong Kong remains code LOW; do not merge it with Shenzhen Luohu.',
        'Hong Kong traditional Chinese names and MTR official English are preserved. No planned Kwu Tung, Hung Shui Kiu or Tuen Mun South extension stations are included.']}
write(DATA / 'official-roster.json', roster)
print('Wrote 41-station official roster.', flush=True)

snapshot = ROOT / 'data/government-location-search-source.json'
records = json.loads(snapshot.read_text(encoding='utf-8')) if snapshot.exists() else query(SEARCH + 'MTR%20Station')
for station in ordered.values():
    expected = f"港鐵{station['name']}站"
    if any(record['nameZH'] == expected for record in records):
        continue
    url = SEARCH + urllib.parse.quote(expected)
    values = query(url)
    assert any(record['nameZH'] == expected for record in values), (expected, values)
    for record in values:
        record['queryURL'] = url
        if record not in records:
            records.append(record)
    write(snapshot, records)
    print('Fetched', expected, flush=True)
    time.sleep(1)
write(snapshot, records)

# Optional coordinate-research dependency; not needed to build the website.
from pyproj import Transformer
transform = Transformer.from_crs('EPSG:2326', 'EPSG:4326', always_xy=True)
coordinates, report = {}, []
for code, station in ordered.items():
    expected = f"港鐵{station['name']}站"
    matches = [record for record in records if record['nameZH'] == expected]
    points = {(record['x'], record['y']) for record in matches}
    assert len(points) == 1, (expected, points)
    x, y = next(iter(points))
    lon, lat = transform.transform(x, y)
    assert 113.9 < lon < 114.3 and 22.2 < lat < 22.6, (code, lat, lon)
    coordinates[code] = {'lat': round(lat, 8), 'lon': round(lon, 8)}
    report.append({'id': code, 'name': station['name'], 'sourceName': expected,
        'sourceCRS': 'EPSG:2326 (Hong Kong 1980 Grid System)', 'sourceLocation': {'x': x, 'y': y},
        'sourceURL': matches[0].get('queryURL', SEARCH + 'MTR%20Station'),
        'outputCRS': 'EPSG:4326 (WGS84)', 'coordinate': coordinates[code]})
sample = query('https://www.geodetic.gov.hk/transform/v2/?inSys=hkgrid&outSys=wgsgeog&e=829721&n=843105')
assert abs(coordinates['LOW']['lat'] - sample['wgsLat']) < 1e-6
assert abs(coordinates['LOW']['lon'] - sample['wgsLong']) < 1e-6
write(DATA / 'station-coordinates.json', coordinates)
write(ROOT / 'scripts/station-coordinates-report.json', {'source': SEARCH + 'MTR%20Station',
    'snapshot': snapshot.name, 'snapshotSHA256': hashlib.sha256(snapshot.read_bytes()).hexdigest(),
    'conversion': 'pyproj/PROJ EPSG:2326 to EPSG:4326, always_xy=True',
    'officialConversionCrosscheck': {'id': 'LOW', 'source': 'https://www.geodetic.gov.hk/transform/v2/?inSys=hkgrid&outSys=wgsgeog&e=829721&n=843105', 'result': sample, 'maximumErrorDegrees': 1e-6},
    'stations': report, 'missing': []})
print('Wrote 41 exact-name government-source WGS84 station coordinates.', flush=True)
