# 东莞地铁足迹

按提供的 2026 年 8 月运营版制作，仅收录地铁 1 / 2 号线：分别 25 / 15 站，去重 39 个运营站，市民中心为唯一地铁换乘站。原图中的城际线路不纳入站点与线路筛选；未开通站列表为空。

## 使用

从 `../shenzhen/` 启动同一网站，访问 `/dongguan/`，或通过左上角城市列表切换。地图与矢量视图、搜索、线路筛选及站点详情复用深圳组件；东莞的数据和资源保留在本目录，与深圳、南宁独立维护，无需单独安装应用。

## 配置

- `data/visited-stations.json`：已去过站点的中文 id 数组，例如 `["市民中心", "东莞西站"]`，仅允许不重复的运营站。
- `data/station-notes.json`：以站点 id 为键的纯文本说明，例如 `{"市民中心":"可在此换乘 1、2 号线。"}`。支持换行，每条最多 5000 字符。
- `data/basemap.json`：公开瓦片地址、署名与缩放上限。东莞最大为 Z13；Z12 起显示站名，Z13 可直接点击，搜索定位遵守上限。
- `data/stations.ts`、`route-paths.json`、`station-symbols.json`、`station-labels.json`：线路、站点、图标和标签几何数据。

保存配置后开发服务器自动更新；静态网站需重新构建部署。重建几何数据不会覆盖已有到访记录、说明和底图配置。

## 数据来源与比例

参考图按 `data/source-meta.json` 统一裁剪至 2070×1500，线路与站点使用同一坐标系。39 个运营站的地理坐标来自高德公开地铁数据，由 GCJ-02 转换为 WGS84。地理显示对整张 SVG 等比缩放和平移，保持参考图比例，因此与真实道路可能存在位置偏差。

道路、水域和绿地底图来自 VersaTiles 的 OSM 矢量瓦片。地图模式需网络，矢量模式使用预生成的 `data/vector-basemap.json`。完整来源及重建流程见 [数据来源](scripts/source-notes.md)。

## 验证与更新底图

在 `shenzhen/` 下运行：

```powershell
node ../dongguan/scripts/validate-map.mjs
node scripts/validate-vector-basemap.mjs --city=dongguan
node scripts/build-vector-basemap.mjs --city=dongguan --check
npm run check
npm run build
```

首次获取缺少的底图缓存使用 `node scripts/build-vector-basemap.mjs --city=dongguan --download`；显式更新瓦片快照使用 `--refresh`。不带下载参数可使用本地缓存重建。
