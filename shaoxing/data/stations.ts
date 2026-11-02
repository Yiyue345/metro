export interface Station { id: string; name: string; x: number; y: number; lines: string[]; aliases?: string[]; status?: 'planned' }
export const plannedStations: Station[] = [{"id": "张墅", "name": "张墅", "lines": ["1"], "aliases": [], "x": 1412, "y": 848, "status": "planned"}];
export interface MetroLine { id: string; name: string; color: string }
export const mapMeta = { width: 2140, height: 1810, image: '/shaoxing/maps/shaoxing-reference.jpg', edition: '2026.05' };
export const lines: MetroLine[] = [{"id": "1", "name": "1号线", "color": "#bd0044"}, {"id": "2", "name": "2号线", "color": "#293d86"}];
export const stations: Station[] = [
  {
    "id": "姑娘桥",
    "name": "姑娘桥",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 170,
    "y": 60
  },
  {
    "id": "衙前",
    "name": "衙前",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 330.95,
    "y": 135.9
  },
  {
    "id": "杨汛桥",
    "name": "杨汛桥",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 361.56,
    "y": 260.5
  },
  {
    "id": "前梅",
    "name": "前梅",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 521.6,
    "y": 391.4
  },
  {
    "id": "钱清",
    "name": "钱清",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 621.5,
    "y": 403.71
  },
  {
    "id": "西沙路",
    "name": "西沙路",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 704.86,
    "y": 434.5
  },
  {
    "id": "临杭大道",
    "name": "临杭大道",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 785.0,
    "y": 479.17
  },
  {
    "id": "鉴水路",
    "name": "鉴水路",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 871.59,
    "y": 553.12
  },
  {
    "id": "越州大道",
    "name": "越州大道",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 999.5,
    "y": 621.5
  },
  {
    "id": "中国轻纺城",
    "name": "中国轻纺城",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1052.16,
    "y": 657.84
  },
  {
    "id": "明珠广场",
    "name": "明珠广场",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1088.11,
    "y": 675.72
  },
  {
    "id": "瓜渚湖",
    "name": "瓜渚湖",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1161.89,
    "y": 708.28
  },
  {
    "id": "镜水路",
    "name": "镜水路",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1230.94,
    "y": 746.22
  },
  {
    "id": "黄酒小镇",
    "name": "黄酒小镇",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1333,
    "y": 817
  },
  {
    "id": "奥体中心",
    "name": "奥体中心",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1499.0,
    "y": 823.79
  },
  {
    "id": "梅山广场",
    "name": "梅山广场",
    "lines": [
      "1",
      "2"
    ],
    "aliases": [],
    "x": 1539,
    "y": 864
  },
  {
    "id": "凤林",
    "name": "凤林",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1563.5,
    "y": 945.5
  },
  {
    "id": "大滩",
    "name": "大滩",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1569.12,
    "y": 1031.41
  },
  {
    "id": "火车站",
    "name": "火车站",
    "lines": [
      "1"
    ],
    "aliases": [
      "绍兴站"
    ],
    "x": 1563.16,
    "y": 1098.84
  },
  {
    "id": "城市广场",
    "name": "城市广场",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1561.76,
    "y": 1157.76
  },
  {
    "id": "鲁迅故里",
    "name": "鲁迅故里",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1557.76,
    "y": 1233.76
  },
  {
    "id": "城南大道",
    "name": "城南大道",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1557.11,
    "y": 1333.72
  },
  {
    "id": "凤凰山",
    "name": "凤凰山",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1542.12,
    "y": 1419.41
  },
  {
    "id": "劳家葑",
    "name": "劳家葑",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1537.5,
    "y": 1487.5
  },
  {
    "id": "南池",
    "name": "南池",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1532.0,
    "y": 1567.79
  },
  {
    "id": "栖湖",
    "name": "栖湖",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1529.62,
    "y": 1633.75
  },
  {
    "id": "芳泉",
    "name": "芳泉",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1502.0,
    "y": 1703.5
  },
  {
    "id": "绍兴一中",
    "name": "绍兴一中",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1322.5,
    "y": 755.8
  },
  {
    "id": "湖西",
    "name": "湖西",
    "lines": [
      "1"
    ],
    "aliases": [
      "越秀"
    ],
    "x": 1323.0,
    "y": 683.5
  },
  {
    "id": "大庆寺",
    "name": "大庆寺",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1323.5,
    "y": 619.5
  },
  {
    "id": "绍兴北站",
    "name": "绍兴北站",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1322.63,
    "y": 553.47
  },
  {
    "id": "会展中心",
    "name": "会展中心",
    "lines": [
      "1"
    ],
    "aliases": [],
    "x": 1209.88,
    "y": 539.59
  },
  {
    "id": "人民医院总院",
    "name": "人民医院总院",
    "lines": [
      "2"
    ],
    "aliases": [
      "镜湖医院"
    ],
    "x": 1438.62,
    "y": 900.76
  },
  {
    "id": "后墅路",
    "name": "后墅路",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1608.62,
    "y": 864.24
  },
  {
    "id": "袍谷",
    "name": "袍谷",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1673.0,
    "y": 865.0
  },
  {
    "id": "袍中路",
    "name": "袍中路",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1734.0,
    "y": 864.0
  },
  {
    "id": "洋泾湖",
    "name": "洋泾湖",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1818.62,
    "y": 865.24
  },
  {
    "id": "恂南",
    "name": "恂南",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1878.62,
    "y": 869.76
  },
  {
    "id": "豆姜",
    "name": "豆姜",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 1940.0,
    "y": 881.0
  },
  {
    "id": "檀渎",
    "name": "檀渎",
    "lines": [
      "2"
    ],
    "aliases": [],
    "x": 2019.0,
    "y": 905.14
  }
];
