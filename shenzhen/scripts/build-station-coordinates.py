"""Build WGS84 station points from named OSM, OpenMetro and AMap records.

The optional --fetch command refreshes the source from Overpass. Only complete
JSON responses are accepted. Name matches outside Shenzhen are excluded.
"""
import argparse
import json
import math
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'scripts/osm-stations-confirmed-source.json'
OPENMETRO_SOURCE = ROOT / 'scripts/openmetro-shenzhen-source.json'
AMAP_SOURCE = ROOT / 'scripts/amap-station-supplement.json'
QUERY = '[out:json][timeout:45];nwr["station"="subway"](22.35,113.7,22.95,114.7);out center tags;'
ENDPOINT = 'https://overpass.kumi.systems/api/interpreter'
BOUNDS = (22.35, 22.95, 113.7, 114.7)


def normalize(value):
    return re.sub(r'(?:地铁站|站)$', '', value.strip())


def within_shenzhen(lat, lon):
    return all(math.isfinite(value) for value in (lat, lon)) and BOUNDS[0] < lat < BOUNDS[1] and BOUNDS[2] < lon < BOUNDS[3]


def transform_lat(x, y):
    value = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
    value += (20 * math.sin(6 * x * math.pi) + 20 * math.sin(2 * x * math.pi)) * 2 / 3
    value += (20 * math.sin(y * math.pi) + 40 * math.sin(y / 3 * math.pi)) * 2 / 3
    return value + (160 * math.sin(y / 12 * math.pi) + 320 * math.sin(y * math.pi / 30)) * 2 / 3


def transform_lon(x, y):
    value = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
    value += (20 * math.sin(6 * x * math.pi) + 20 * math.sin(2 * x * math.pi)) * 2 / 3
    value += (20 * math.sin(x * math.pi) + 40 * math.sin(x / 3 * math.pi)) * 2 / 3
    return value + (150 * math.sin(x / 12 * math.pi) + 300 * math.sin(x / 30 * math.pi)) * 2 / 3


def wgs84_to_gcj02(lat, lon):
    a, eccentricity = 6378245.0, 0.00669342162296594323
    dlat, dlon = transform_lat(lon - 105, lat - 35), transform_lon(lon - 105, lat - 35)
    rad_lat = lat / 180 * math.pi
    magic = 1 - eccentricity * math.sin(rad_lat) ** 2
    root_magic = math.sqrt(magic)
    dlat = dlat * 180 / ((a * (1 - eccentricity)) / (magic * root_magic) * math.pi)
    dlon = dlon * 180 / (a / root_magic * math.cos(rad_lat) * math.pi)
    return lat + dlat, lon + dlon


def gcj02_to_wgs84(lat, lon):
    if not within_shenzhen(lat, lon):
        raise ValueError(f'GCJ-02 coordinate outside Shenzhen bounds: {lat}, {lon}')
    wgs_lat, wgs_lon = lat, lon
    for _ in range(30):
        check_lat, check_lon = wgs84_to_gcj02(wgs_lat, wgs_lon)
        error_lat, error_lon = check_lat - lat, check_lon - lon
        wgs_lat -= error_lat
        wgs_lon -= error_lon
        if max(abs(error_lat), abs(error_lon)) < 1e-10:
            if not within_shenzhen(wgs_lat, wgs_lon):
                raise ValueError(f'WGS84 coordinate outside Shenzhen bounds: {wgs_lat}, {wgs_lon}')
            return round(wgs_lat, 7), round(wgs_lon, 7)
    raise ValueError(f'GCJ-02 inverse did not converge: {lat}, {lon}')


def named_points(records, label):
    points = {}
    for record in records:
        name = normalize(record['name'])
        if name in points:
            raise ValueError(f'Duplicate {label} station name: {name}')
        point = record.get('location')
        if point:
            if point.get('crs') != 'gcj02':
                raise ValueError(f'Unexpected {label} CRS for {name}: {point.get("crs")}')
            if not within_shenzhen(point['lat'], point['lon']):
                raise ValueError(f'{label} coordinate outside Shenzhen bounds: {name}')
        points[name] = record
    return points


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true')
    parser.add_argument('--recover-partial', action='store_true', help='Recover complete objects only from interrupted JSON; report remains partial')
    args = parser.parse_args()
    if args.fetch:
        url = ENDPOINT + '?data=' + urllib.parse.quote(QUERY)
        with urllib.request.urlopen(url, timeout=60) as response:
            data = json.load(response)
        SOURCE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if args.recover_partial:
        raw = (ROOT / 'scripts/osm-stations-source.json').read_text(encoding='utf-8')
        index = raw.index('[', raw.index('"elements"')) + 1
        elements = []
        decoder = json.JSONDecoder()
        while True:
            index += len(raw[index:]) - len(raw[index:].lstrip(' ,\r\n'))
            try:
                element, consumed = decoder.raw_decode(raw[index:])
            except json.JSONDecodeError:
                break
            elements.append(element)
            index += consumed
        data = {'elements': elements, 'source_partial': True,
                'timestamp_osm_base': re.search(r'"timestamp_osm_base":\s*"([^"]+)"', raw)[1]}
        SOURCE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    data = json.loads(SOURCE.read_text(encoding='utf-8'))
    openmetro = json.loads(OPENMETRO_SOURCE.read_text(encoding='utf-8'))
    amap = json.loads(AMAP_SOURCE.read_text(encoding='utf-8'))
    text = (ROOT / 'src/data/stations.ts').read_text(encoding='utf-8')
    stations = json.loads(text.split('export const stations: Station[] = ', 1)[1].strip().rstrip(';'))
    openmetro_points = named_points(openmetro['records'], 'OpenMetro')
    amap_points = named_points(amap['records'], 'AMap')
    candidates = {}
    for element in data['elements']:
        tags = element.get('tags', {})
        if tags.get('station') != 'subway' and tags.get('subway') != 'yes':
            continue
        point = element.get('center', element)
        if not within_shenzhen(point.get('lat', 0), point.get('lon', 0)):
            continue
        for key in ['name', 'name:zh', 'name:zh-Hans', 'alt_name', 'short_name']:
            for name in tags.get(key, '').split(';'):
                if name:
                    candidates.setdefault(normalize(name), []).append((element, point))
    coordinates, matched, missing = {}, {}, []
    for station in stations:
        choices = []
        names = [normalize(name) for name in [station['id'], *station.get('aliases', [])]]
        for name in names:
            choices.extend(candidates.get(normalize(name), []))
        source_record = next((openmetro_points[name] for name in names if name in openmetro_points), None)
        supplement = next((amap_points[name] for name in names if name in amap_points), None)
        if choices:
            # Prefer the mapped station node over a station-area bounding-box center.
            element, point = sorted(choices, key=lambda item: (item[0]['type'] != 'node', item[0]['id']))[0]
            coordinates[station['id']] = {'lat': point['lat'], 'lon': point['lon']}
            matched[station['id']] = {'source': 'osm', 'source_id': f"{element['type']}/{element['id']}",
                                      'name': element['tags'].get('name'), 'source_crs': 'WGS84', 'transform': 'none'}
        elif source_record and source_record.get('location'):
            point = source_record['location']
            lat, lon = gcj02_to_wgs84(point['lat'], point['lon'])
            coordinates[station['id']] = {'lat': lat, 'lon': lon}
            matched[station['id']] = {'source': 'openmetro', 'source_id': source_record['id'],
                                      'name': source_record['name'], 'source_crs': 'GCJ-02',
                                      'transform': 'gcj02_to_wgs84_iterative'}
        elif supplement and supplement.get('location'):
            point = supplement['location']
            lat, lon = gcj02_to_wgs84(point['lat'], point['lon'])
            coordinates[station['id']] = {'lat': lat, 'lon': lon}
            matched[station['id']] = {'source': 'amap', 'source_id': supplement['id'],
                                      'name': supplement['name'], 'url': supplement['url'],
                                      'source_crs': 'GCJ-02', 'transform': 'gcj02_to_wgs84_iterative'}
        else:
            missing.append(station['id'])
    roster_names = {normalize(name) for station in stations for name in [station['id'], *station.get('aliases', [])]}
    unknown = (set(openmetro_points) | set(amap_points)) - roster_names
    if unknown:
        raise ValueError(f'Source names absent from station roster: {sorted(unknown)}')
    if len(coordinates) + len(missing) != len(stations):
        raise ValueError('Station coordinate coverage does not match roster')
    counts = {source: sum(match['source'] == source for match in matched.values())
              for source in ('osm', 'openmetro', 'amap')}
    planned = json.loads((ROOT / 'src/data/planned-stations.json').read_text(encoding='utf-8'))
    report = {'sources': {'osm': {'url': ENDPOINT, 'query': QUERY, 'license': 'ODbL-1.0'},
                          'openmetro': {'url': openmetro['source'], 'sha': openmetro['sha']},
                          'amap': {'url': amap['source'], 'checked_at': amap['checked_at']}},
              'crs': 'WGS84', 'source_counts': counts,
              'source_partial': data.get('source_partial', False), 'source_element_count': len(data['elements']),
              'station_count': len(stations), 'matched_count': len(coordinates), 'missing': missing,
              'matches': matched, 'planned_missing': [item['id'] for item in planned if item['id'] not in coordinates]}
    for path, value in [(ROOT / 'src/data/station-coordinates.json', coordinates),
                        (ROOT / 'scripts/station-coordinates-report.json', report)]:
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"WGS84 station coordinates: {len(coordinates)}/{len(stations)}; sources: {counts}; missing: {len(missing)}")


if __name__ == '__main__':
    main()
