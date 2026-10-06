export interface Station { id: string; name: string; x: number; y: number; lines: string[]; aliases?: string[]; status?: 'planned' }
export const plannedStations: Station[] = [];
export interface MetroLine { id: string; name: string; color: string }
export const mapMeta = { width: 2070, height: 1500, image: '/dongguan/maps/dongguan-reference.jpg', edition: '2026.08' };
export const lines: MetroLine[] = [{"id": "1", "name": "1号线", "color": "#398db8"}, {"id": "2", "name": "2号线", "color": "#e60012"}];
export const stations: Station[] = [
  {
    "id": "东莞西站",
    "name": "东莞西站",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 72.5,
    "y": 484.5
  },
  {
    "id": "厚德",
    "name": "厚德",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 241.22,
    "y": 487.91
  },
  {
    "id": "昌平",
    "name": "昌平",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 378.0,
    "y": 449.0
  },
  {
    "id": "人民医院",
    "name": "人民医院",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 436.41,
    "y": 395.72
  },
  {
    "id": "曲海",
    "name": "曲海",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 531.06,
    "y": 364.58
  },
  {
    "id": "坝头",
    "name": "坝头",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 576.9,
    "y": 415.52
  },
  {
    "id": "元美",
    "name": "元美",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 652.0,
    "y": 446.5
  },
  {
    "id": "中心广场",
    "name": "中心广场",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 715.5,
    "y": 460.21
  },
  {
    "id": "市民中心",
    "name": "市民中心",
    "lines": [
      "1",
      "2"
    ],
    "aliases": [],
    "x": 752,
    "y": 475
  },
  {
    "id": "立新",
    "name": "立新",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 815.55,
    "y": 517.58
  },
  {
    "id": "东城南站",
    "name": "东城南站",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 831.6,
    "y": 609.4
  },
  {
    "id": "同沙公园",
    "name": "同沙公园",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 827.58,
    "y": 702.55
  },
  {
    "id": "牛山",
    "name": "牛山",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 833.48,
    "y": 764.1
  },
  {
    "id": "连平",
    "name": "连平",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 987.48,
    "y": 938.1
  },
  {
    "id": "大岭山",
    "name": "大岭山",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1127.37,
    "y": 1022.37
  },
  {
    "id": "金桔",
    "name": "金桔",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1230.5,
    "y": 1036.21
  },
  {
    "id": "广东医大",
    "name": "广东医大",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1302.28,
    "y": 980.41
  },
  {
    "id": "松山湖",
    "name": "松山湖",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1337.5,
    "y": 936.21
  },
  {
    "id": "松佛",
    "name": "松佛",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1484.97,
    "y": 912.4
  },
  {
    "id": "大朗",
    "name": "大朗",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1610.4,
    "y": 941.5
  },
  {
    "id": "荔香公园",
    "name": "荔香公园",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1739.9,
    "y": 1001.52
  },
  {
    "id": "凤山",
    "name": "凤山",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1838.52,
    "y": 1048.1
  },
  {
    "id": "黄江",
    "name": "黄江",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1980.79,
    "y": 1130.5
  },
  {
    "id": "黄牛埔",
    "name": "黄牛埔",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1969.5,
    "y": 1250.0
  },
  {
    "id": "梅塘",
    "name": "梅塘",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1912.5,
    "y": 1415.0
  },
  {
    "id": "东莞火车站",
    "name": "东莞火车站",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1269.0,
    "y": 46.5
  },
  {
    "id": "茶山",
    "name": "茶山",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1194.5,
    "y": 96.5
  },
  {
    "id": "榴花公园",
    "name": "榴花公园",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1031.7,
    "y": 96.09
  },
  {
    "id": "下桥",
    "name": "下桥",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 896.42,
    "y": 191.42
  },
  {
    "id": "天宝",
    "name": "天宝",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 846.5,
    "y": 277.5
  },
  {
    "id": "东城",
    "name": "东城",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 834.61,
    "y": 359.48
  },
  {
    "id": "旗峰公园",
    "name": "旗峰公园",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 791.09,
    "y": 427.7
  },
  {
    "id": "西平",
    "name": "西平",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 682.5,
    "y": 573.5
  },
  {
    "id": "蛤地",
    "name": "蛤地",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 592.3,
    "y": 665.09
  },
  {
    "id": "陈屋",
    "name": "陈屋",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 392.5,
    "y": 776.5
  },
  {
    "id": "寮厦",
    "name": "寮厦",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 305.5,
    "y": 870.5
  },
  {
    "id": "珊美",
    "name": "珊美",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 258.3,
    "y": 948.91
  },
  {
    "id": "展览中心",
    "name": "展览中心",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 243.3,
    "y": 1085.91
  },
  {
    "id": "虎门火车站",
    "name": "虎门火车站",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 295.68,
    "y": 1324.32
  }
];
