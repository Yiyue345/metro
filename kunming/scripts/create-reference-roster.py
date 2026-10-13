"""Reference roster and English spellings reviewed against the supplied 2026.07 map."""
import json
from pathlib import Path

base = Path(__file__).parent
source = json.loads((base / 'amap-kunming-source.json').read_text(encoding='utf-8-sig'))

def normalize(name):
    if name.startswith('环城南路'):
        return '环城南路'
    if name.startswith('大学城南'):
        return '大学城南'
    return {'市级行政中心清风': '市级行政中心', '金桂街·斗南花市': '金桂街'}.get(name, name)

english = dict(line.split('|', 1) for line in '''环城南路|South Ring Rd
昆明火车站|Kunming Railway Station
福德|Fude
日新路|Rixin Rd
巫家坝|Wujiaba
昌宏西路|Changhong West Rd
晓东村|Xiaodongcun
珥季路|Erji Rd
星耀路|Xingyao Rd
新亚洲体育城|New Asia Athletics Park
南部汽车站|South Coach Station
斗南|Dounan
春融街|Chunrong St
驼峰街|Tuofeng St
联大街|Lianda St
谊康南路|Yikang South Rd
大学城|University Town
大学城南|University Town South
市级行政中心|Municipal Administration Center
宜和路|Yihe Rd
白龙潭|Bailongtan
昆明南火车站|Kunming South Railway Station
塘子巷|Tangzixiang
东风广场|Dongfeng Square
交三桥|Jiaosanqiao
穿心鼓楼|Chuanxingulou
火车北站|North Railway Station
白云路|Baiyun Rd
金星|Jinxing
北辰|Beichen
霖雨桥|Linyuqiao
羊肠村|Yangchangcun
司家营|Sijiaying
龙头街|Longtou St
北部汽车站|North Coach Station
西山公园|Western Hills Park
车家壁|Chejiabi
普坪村|Pupingcun
石咀|Shizui
大渔路|Dayu Rd
西部汽车站|West Coach Station
眠山|Mianshan
昌源中路|Changyuan Central Rd
西苑|Xiyuan
梁家河|Liangjiahe
市体育馆|Municipal Gymnasium
潘家湾|Panjiawan
五一路|Wuyi Rd
拓东体育馆|Tuodong Stadium
大树营|Dashuying
金马寺|Jinmasi
太平村|Taipingcun
虹桥|Hongqiao
东部汽车站|East Coach Station
金川路|Jinchuan Rd
大河埂|Dahegeng
海屯路|Haitun Rd
小屯|Xiaotun
金鼎山北路|Jindingshan North Rd
苏家塘|Sujiatang
小菜园|Xiaocaiyuan
白龙路|Bailong Rd
菊花村|Juhuacun
菊华|Juhua
和甸营|Hedianying
牛街庄|Niujiezhuang
朱家村|Zhujiacun
羊甫头|Yangfutou
玉缘路|Yuyuan Rd
广卫|Guangwei
塔密|Tami
金桂街|Jingui St
梅子村|Meizicun
古城|Gucheng
可乐村|Kelecun
祥丰街|Xiangfeng St
牛头山|Niutoushan
吴家营|Wujiaying
世博园|World Horti-Expo Garden
白龙寺|Bailong Temple
石闸|Shizha
穿金路|Chuanjin Rd
圆通山|Yuantong Hill
华山西路|Huashan West Rd
弥勒寺|Milesi
严家地|Yanjiadi
金兰路|Jinlan Rd
福海|Fuhai
广福路西口|Guangfulu Xikou
大坝|Daba
迎海路|Yinghai Rd
渔户村|Yuhucun
兴体路|Xingti Rd
庄家塘立交桥|Zhuangjiatang Overpass
金家河|Jinjia River
福保|Fubao
滇池国际会展中心|Dianchi International Convention and Exhibition Center
宝丰|Baofeng
机场中心|Kunming Airport
机场前|Airport Front
大板桥|Dabanqiao
东郊路|Dongjiao Rd
岔街|Chajie'''.splitlines())

display = {'市级行政中心': '市级行政中心·清风', '金桂街': '金桂街·斗南花市'}
aliases = {
    '大学城南': ['大学城南·云南开放大学', '云南开放大学'],
    '市级行政中心': ['市级行政中心清风', '市级行政中心·清风', '清风'],
    '金桂街': ['金桂街·斗南花市', '斗南花市'],
    '昆明火车站': ['昆明站'], '昆明南火车站': ['昆明南站'],
    '机场中心': ['昆明长水国际机场', '长水机场'],
}
paths = {}
for line in source['l']:
    line_id = str(line['ln'][0])
    ids = [normalize(st['n']) for st in line['st']]
    if line_id in ['2', '6']:
        ids.reverse()
    paths.setdefault(line_id, []).append(ids)

stations = {}
for line_id, line_paths in paths.items():
    for ids in line_paths:
        for station_id in ids:
            station = stations.setdefault(station_id, {'id': station_id, 'name': display.get(station_id, station_id),
                'englishName': english[station_id], 'aliases': aliases.get(station_id, []), 'lines': []})
            if line_id not in station['lines']:
                station['lines'].append(line_id)

line_counts = {key: len(set(st for path in value for st in path)) for key, value in paths.items()}
assert line_counts == {'1': 22, '2': 14, '3': 20, '4': 29, '5': 22, '6': 8}, line_counts
assert len(stations) == 103 and set(stations) == set(english)
roster = {'edition': '2026.07', 'reference': '01.公开版-昆明地铁线路3.0-a运营版（至2026年07月）纯白底.jpg',
    'uniqueStationCount': 103, 'lineStationMembershipCount': 115, 'lineStationCounts': line_counts,
    'linePaths': paths, 'stations': list(stations.values()), 'english': english, 'displayNames': display, 'aliases': aliases,
    'notes': ['1号线主线18站、支线17站共享13站，共22个站ID；1、2号线贯通运营，环城南路只计一个站ID。',
        '英语按参考图逐站核对，统一大小写并去掉路名缩写句点；保留源图译法，非推测官方英语标准。',
        '大学城南显示名依参考图；AMap的云南开放大学后缀仅保留为搜索别名。',
        '市级行政中心·清风、金桂街·斗南花市保留参考中文显示名，canonical ID不重复建站。',
        '车辆段、停车场和机场内部捷运T1站不计入地铁6线路站点。']}
(base / 'reference-roster.json').write_text(json.dumps(roster, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(base / 'reference-english.json').write_text(json.dumps(english, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f"Verified {len(stations)} unique stations, counts={line_counts}")
