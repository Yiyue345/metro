# 南宁地铁足迹

按提供的 2026 年 1 月运营版制作：1–5 号线，95 个运营站、11 个换乘站。五象火车站保留灰色未开通标记，不计入运营站数。初始已去过站点为 0。

## 使用

从 `../shenzhen/` 启动网站，访问 `/nanning/`，或通过左上角城市列表切换。四城只提供在线地图，搜索、线路筛选及站点详情复用深圳组件；南宁数据和资源保留在本目录中，不显示邻城预览。

## 配置

- `data/visited-stations.json`：已去过站点的中文 id 数组，例如 `["朝阳广场", "金湖广场"]`，仅允许不重复的运营站。
- `data/station-notes.json`：以站点 id 为键的纯文本说明，例如 `{"朝阳广场":"可在此换乘。"}`。支持换行，每条最多 5000 字符，也可为已收录的未开通站添加说明。
- `data/basemap.json`：公开瓦片地址、署名与缩放上限。南宁最大为 Z13，避免较小线网在 Z14 下出现过大的图标与站名。Z12 起显示站名，Z13 可直接点击，搜索定位遵守上限。
- `data/stations.ts`、`route-paths.json`、`station-symbols.json`、`station-labels.json`：线路、站点、图标和标签几何数据。

保存配置后开发服务器自动更新；静态网站需重新构建部署。重建几何数据不会覆盖已有到访记录、说明和底图配置。

## 数据来源与比例

参考图统一裁剪至 2060×1360，线路与站点使用同一坐标系。95 个运营站的地理坐标来自高德公开地铁数据，由 GCJ-02 转换为 WGS84。地理显示只对整张 SVG 等比缩放和平移，保持参考图比例，因此与真实道路可能存在位置偏差。五象火车站无已核实经纬度，仅展示示意位置。

道路、水域和绿地底图来自 VersaTiles 的在线 OSM 矢量瓦片，需要网络连接。地图初始化失败后，点击重置视野按钮重试加载。历史静态背景 `data/vector-basemap.json` 及其生成脚本仍保留，页面不再加载。完整来源及历史重建流程见 [数据来源](scripts/source-notes.md)。

## 验证与历史底图

在 `shenzhen/` 下运行：

```powershell
node ../nanning/scripts/validate-map.mjs
npm run check
npm run build
```

以下命令仅维护历史静态背景，不影响当前页面：

```powershell
node scripts/validate-vector-basemap.mjs --city=nanning
node scripts/build-vector-basemap.mjs --city=nanning --check
```

首次获取缺少的历史底图缓存使用 `node scripts/build-vector-basemap.mjs --city=nanning --download`；显式更新瓦片快照使用 `--refresh`。不带下载参数可使用本地缓存重建。
