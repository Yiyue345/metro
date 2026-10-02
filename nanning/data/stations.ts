import plannedData from './planned-stations.json';
export interface Station { id: string; name: string; x: number; y: number; lines: string[]; aliases?: string[]; status?: 'planned' }
export const plannedStations = plannedData as (Station & { status: 'planned'; englishName: string; label: { x: number; y: number; anchor: 'start' | 'middle' | 'end'; fontSize: number }; symbol: { parts: { x: number; y: number; width: number; height: number; angle: number; lines: string[]; transfer: boolean; planned: boolean }[] } })[];
export interface MetroLine { id: string; name: string; color: string }
export const mapMeta = { width: 2060, height: 1360, image: '/nanning/maps/nanning-reference.jpg', edition: '2026.01' };
export const lines: MetroLine[] = [{"id": "1", "name": "1号线", "color": "#2d9b44"}, {"id": "2", "name": "2号线", "color": "#ff3d3e"}, {"id": "3", "name": "3号线", "color": "#5e108e"}, {"id": "4", "name": "4号线", "color": "#d0dd01"}, {"id": "5", "name": "5号线", "color": "#395eaf"}];
export const stations: Station[] = [
  {
    "id": "石埠",
    "name": "石埠",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 72.34,
    "y": 514.0
  },
  {
    "id": "南职院",
    "name": "南职院",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 169.5,
    "y": 467.5
  },
  {
    "id": "鹏飞路",
    "name": "鹏飞路",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 235.37,
    "y": 466.63
  },
  {
    "id": "西乡塘客运站",
    "name": "西乡塘客运站",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 353.66,
    "y": 465.0
  },
  {
    "id": "民族大学",
    "name": "民族大学",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 439.79,
    "y": 431.91
  },
  {
    "id": "清川",
    "name": "清川",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 573.0,
    "y": 412.24
  },
  {
    "id": "动物园",
    "name": "动物园",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 671.63,
    "y": 431.37
  },
  {
    "id": "鲁班路",
    "name": "鲁班路",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 775.34,
    "y": 460.0
  },
  {
    "id": "广西大学",
    "name": "广西大学",
    "lines": [
      "1",
      "5"
    ],
    "aliases": [],
    "x": 835.0,
    "y": 481.0
  },
  {
    "id": "白苍岭",
    "name": "白苍岭",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 937.67,
    "y": 479.5
  },
  {
    "id": "火车站",
    "name": "火车站",
    "lines": [
      "1",
      "2"
    ],
    "aliases": [],
    "x": 996.87,
    "y": 527.66
  },
  {
    "id": "朝阳广场",
    "name": "朝阳广场",
    "lines": [
      "1",
      "2"
    ],
    "aliases": [],
    "x": 1025.31,
    "y": 579.08
  },
  {
    "id": "新民路",
    "name": "新民路",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1071.37,
    "y": 609.37
  },
  {
    "id": "民族广场",
    "name": "民族广场",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1128.29,
    "y": 608.29
  },
  {
    "id": "麻村",
    "name": "麻村",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1201.78,
    "y": 607.09
  },
  {
    "id": "南湖",
    "name": "南湖",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1305.7,
    "y": 601.7
  },
  {
    "id": "金湖广场",
    "name": "金湖广场",
    "lines": [
      "1",
      "3"
    ],
    "aliases": [],
    "x": 1360.0,
    "y": 610.5
  },
  {
    "id": "会展中心",
    "name": "会展中心",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1441.67,
    "y": 608.5
  },
  {
    "id": "万象城",
    "name": "万象城",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1495.55,
    "y": 608.58
  },
  {
    "id": "东盟商务区",
    "name": "东盟商务区",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1545.06,
    "y": 608.42
  },
  {
    "id": "凤岭",
    "name": "凤岭",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1620.45,
    "y": 609.58
  },
  {
    "id": "埌东客运站",
    "name": "埌东客运站",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1680.0,
    "y": 611.5
  },
  {
    "id": "百花岭",
    "name": "百花岭",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1738.9,
    "y": 573.32
  },
  {
    "id": "佛子岭",
    "name": "佛子岭",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1717.59,
    "y": 474.72
  },
  {
    "id": "火车东站",
    "name": "火车东站",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1646.0,
    "y": 419.66
  },
  {
    "id": "西津",
    "name": "西津",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 876.37,
    "y": 63.37
  },
  {
    "id": "安吉客运站",
    "name": "安吉客运站",
    "lines": [
      "2",
      "3"
    ],
    "aliases": [],
    "x": 871.3,
    "y": 131.88
  },
  {
    "id": "苏卢",
    "name": "苏卢",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 882.66,
    "y": 208.0
  },
  {
    "id": "三十三中",
    "name": "三十三中",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 901.82,
    "y": 288.82
  },
  {
    "id": "秀厢",
    "name": "秀厢",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 931.0,
    "y": 355.66
  },
  {
    "id": "明秀路",
    "name": "明秀路",
    "lines": [
      "2",
      "5"
    ],
    "aliases": [],
    "x": 968.15,
    "y": 417.19
  },
  {
    "id": "南宁剧场",
    "name": "南宁剧场",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 976.83,
    "y": 674.4
  },
  {
    "id": "福建园",
    "name": "福建园",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 962.0,
    "y": 728.5
  },
  {
    "id": "亭洪路",
    "name": "亭洪路",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 962.17,
    "y": 784.4
  },
  {
    "id": "石柱岭",
    "name": "石柱岭",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 962.63,
    "y": 837.63
  },
  {
    "id": "江南客运站",
    "name": "江南客运站",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 966.63,
    "y": 944.37
  },
  {
    "id": "大沙田",
    "name": "大沙田",
    "lines": [
      "2",
      "4"
    ],
    "aliases": [],
    "x": 997.69,
    "y": 984.12
  },
  {
    "id": "建设路",
    "name": "建设路",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1008.18,
    "y": 1047.82
  },
  {
    "id": "石子塘",
    "name": "石子塘",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1049.0,
    "y": 1125.66
  },
  {
    "id": "金象",
    "name": "金象",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1100.06,
    "y": 1194.42
  },
  {
    "id": "玉洞",
    "name": "玉洞",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1129.72,
    "y": 1257.59
  },
  {
    "id": "东风路",
    "name": "东风路",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1235.0,
    "y": 1278.5
  },
  {
    "id": "玉岭路",
    "name": "玉岭路",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1285.63,
    "y": 1264.37
  },
  {
    "id": "那福路",
    "name": "那福路",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1376.72,
    "y": 1239.59
  },
  {
    "id": "平良立交",
    "name": "平良立交",
    "lines": [
      "2",
      "3"
    ],
    "aliases": [],
    "x": 1444.69,
    "y": 1230.35
  },
  {
    "id": "坛泽",
    "name": "坛泽",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1529.58,
    "y": 1232.94
  },
  {
    "id": "科园大道",
    "name": "科园大道",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 682.42,
    "y": 139.94
  },
  {
    "id": "创业路",
    "name": "创业路",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 779.84,
    "y": 137.62
  },
  {
    "id": "北湖北路",
    "name": "北湖北路",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 995.61,
    "y": 156.52
  },
  {
    "id": "秀峰路",
    "name": "秀峰路",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 1098.09,
    "y": 140.21
  },
  {
    "id": "邕武路",
    "name": "邕武路",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 1153.91,
    "y": 157.79
  },
  {
    "id": "大鸡村",
    "name": "大鸡村",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 1228.38,
    "y": 179.16
  },
  {
    "id": "兴桂路",
    "name": "兴桂路",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 1262.21,
    "y": 234.91
  },
  {
    "id": "小鸡村",
    "name": "小鸡村",
    "lines": [
      "3",
      "5"
    ],
    "aliases": [],
    "x": 1259.5,
    "y": 296.0
  },
  {
    "id": "东沟岭",
    "name": "东沟岭",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 1251.5,
    "y": 374.12
  },
  {
    "id": "长堽路",
    "name": "长堽路",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 1263.94,
    "y": 435.42
  },
  {
    "id": "东葛路",
    "name": "东葛路",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 1284.09,
    "y": 484.21
  },
  {
    "id": "滨湖路",
    "name": "滨湖路",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 1348.24,
    "y": 521.0
  },
  {
    "id": "埌西",
    "name": "埌西",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 1334.5,
    "y": 647.5
  },
  {
    "id": "青竹立交",
    "name": "青竹立交",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 1315.55,
    "y": 706.42
  },
  {
    "id": "青秀山",
    "name": "青秀山",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 1342.5,
    "y": 752.5
  },
  {
    "id": "市博物馆",
    "name": "市博物馆",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 1393.16,
    "y": 880.62
  },
  {
    "id": "总部基地",
    "name": "总部基地",
    "lines": [
      "3",
      "4"
    ],
    "aliases": [],
    "x": 1394.12,
    "y": 932.16
  },
  {
    "id": "广西规划馆",
    "name": "广西规划馆",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 1404.25,
    "y": 1008.25
  },
  {
    "id": "庆歌路",
    "name": "庆歌路",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 1440.5,
    "y": 1056.5
  },
  {
    "id": "五象湖",
    "name": "五象湖",
    "lines": [
      "3"
    ],
    "aliases": [],
    "x": 1444.5,
    "y": 1141.5
  },
  {
    "id": "洪运路",
    "name": "洪运路",
    "lines": [
      "4"
    ],
    "aliases": [],
    "x": 501.09,
    "y": 948.7
  },
  {
    "id": "那历村",
    "name": "那历村",
    "lines": [
      "4"
    ],
    "aliases": [],
    "x": 611.65,
    "y": 983.26
  },
  {
    "id": "那洪立交",
    "name": "那洪立交",
    "lines": [
      "4",
      "5"
    ],
    "aliases": [],
    "x": 695.54,
    "y": 984.95
  },
  {
    "id": "金阳路",
    "name": "金阳路",
    "lines": [
      "4"
    ],
    "aliases": [],
    "x": 762.79,
    "y": 986.09
  },
  {
    "id": "通源路",
    "name": "通源路",
    "lines": [
      "4"
    ],
    "aliases": [],
    "x": 884.5,
    "y": 1002.5
  },
  {
    "id": "金象大道",
    "name": "金象大道",
    "lines": [
      "4"
    ],
    "aliases": [],
    "x": 1038.5,
    "y": 985.5
  },
  {
    "id": "五象岭",
    "name": "五象岭",
    "lines": [
      "4"
    ],
    "aliases": [],
    "x": 1139.18,
    "y": 979.82
  },
  {
    "id": "玉象路",
    "name": "玉象路",
    "lines": [
      "4"
    ],
    "aliases": [],
    "x": 1307.75,
    "y": 927.75
  },
  {
    "id": "飞龙路",
    "name": "飞龙路",
    "lines": [
      "4"
    ],
    "aliases": [],
    "x": 1460.91,
    "y": 943.79
  },
  {
    "id": "体育中心西",
    "name": "体育中心西",
    "lines": [
      "4"
    ],
    "aliases": [],
    "x": 1502.0,
    "y": 952.5
  },
  {
    "id": "体育中心东",
    "name": "体育中心东",
    "lines": [
      "4"
    ],
    "aliases": [],
    "x": 1546.94,
    "y": 985.58
  },
  {
    "id": "良庆大桥南",
    "name": "良庆大桥南",
    "lines": [
      "4"
    ],
    "aliases": [],
    "x": 1596.21,
    "y": 1037.55
  },
  {
    "id": "良庆圩",
    "name": "良庆圩",
    "lines": [
      "4"
    ],
    "aliases": [],
    "x": 1672.88,
    "y": 1042.5
  },
  {
    "id": "楞塘村",
    "name": "楞塘村",
    "lines": [
      "4"
    ],
    "aliases": [],
    "x": 1741.79,
    "y": 1032.91
  },
  {
    "id": "清平坡",
    "name": "清平坡",
    "lines": [
      "4"
    ],
    "aliases": [],
    "x": 1915.79,
    "y": 992.91
  },
  {
    "id": "龙岗",
    "name": "龙岗",
    "lines": [
      "4"
    ],
    "aliases": [],
    "x": 1990.21,
    "y": 964.09
  },
  {
    "id": "国凯大道",
    "name": "国凯大道",
    "lines": [
      "5"
    ],
    "aliases": [],
    "x": 695.71,
    "y": 1033.29
  },
  {
    "id": "金凯路",
    "name": "金凯路",
    "lines": [
      "5"
    ],
    "aliases": [],
    "x": 695.55,
    "y": 927.42
  },
  {
    "id": "江南公园",
    "name": "江南公园",
    "lines": [
      "5"
    ],
    "aliases": [],
    "x": 696.06,
    "y": 839.42
  },
  {
    "id": "周家坡",
    "name": "周家坡",
    "lines": [
      "5"
    ],
    "aliases": [],
    "x": 698.8,
    "y": 778.33
  },
  {
    "id": "五一立交",
    "name": "五一立交",
    "lines": [
      "5"
    ],
    "aliases": [],
    "x": 725.22,
    "y": 697.09
  },
  {
    "id": "新秀公园",
    "name": "新秀公园",
    "lines": [
      "5"
    ],
    "aliases": [],
    "x": 795.06,
    "y": 573.42
  },
  {
    "id": "秀灵路",
    "name": "秀灵路",
    "lines": [
      "5"
    ],
    "aliases": [],
    "x": 924.5,
    "y": 437.5
  },
  {
    "id": "北湖南路",
    "name": "北湖南路",
    "lines": [
      "5"
    ],
    "aliases": [],
    "x": 1031.63,
    "y": 385.63
  },
  {
    "id": "虎邱",
    "name": "虎邱",
    "lines": [
      "5"
    ],
    "aliases": [],
    "x": 1091.33,
    "y": 358.5
  },
  {
    "id": "狮山公园",
    "name": "狮山公园",
    "lines": [
      "5"
    ],
    "aliases": [],
    "x": 1157.5,
    "y": 318.5
  },
  {
    "id": "邕宾立交",
    "name": "邕宾立交",
    "lines": [
      "5"
    ],
    "aliases": [],
    "x": 1313.33,
    "y": 292.5
  },
  {
    "id": "降桥",
    "name": "降桥",
    "lines": [
      "5"
    ],
    "aliases": [],
    "x": 1378.5,
    "y": 249.5
  },
  {
    "id": "金桥客运站",
    "name": "金桥客运站",
    "lines": [
      "5"
    ],
    "aliases": [],
    "x": 1451.63,
    "y": 239.37
  }
];
