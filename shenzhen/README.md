# 深圳地铁足迹

用 Astro 构建的深圳地铁足迹地图，覆盖官方名录中的 351 个运营站点、17 条线路（含 6 号线支线），并以灰色单独标注未开通的西丽高铁站。支持地图浏览、站名搜索、线路站点高亮、站点详情和「去过」标记。

矢量模式使用独立 SVG 绘制线路、站点、中英文站名，沿用户提供的 2026.09 参考图还原线路走向。背景由与地图模式同源的 VersaTiles 矢量瓦片生成，包含浅灰分级道路、蓝色海岸/水域/河道与绿色公园/林地，构建后可离线显示。地上段和地下段统一为单条色带，直线区段保持笔直，仅转角使用切向连续的三次曲线连接。普通站为线路色白圈，换乘站为加粗黑边渐变胶囊或双圆，部分站点保留多个节点及连接线。选择线路后，其他线路、站名和节点会淡化。

页面提供「矢量 / 地图」两种模式，首次打开默认进入地图模式。点击左上角图标打开城市侧边栏，可在深圳（`/`）与南宁（`/nanning/`）之间切换；点击当前城市、关闭按钮、侧栏外遮罩或按 Esc 可关闭，保留当前地图视野。参考图仅作为项目数据来源保留，不再提供原图浏览模式。矢量背景不显示建筑和道路名，城际和香港线路未纳入。英文名采用参考图标注，支持中英文搜索，英文查询不区分大小写。

两座城市共用 `src/components/MetroPage.astro`、`MetroMap.astro` 与 `map.ts`，统一从本目录启动、检查和构建。深圳数据与资源仍位于 `src/data/` 和 `public/`；南宁独立维护在同级 `../nanning/data/`、`../nanning/scripts/` 和 `../nanning/public/`。`src/data/nanning-city.ts` 将南宁数据传入共用页面，`astro.config.mjs` 在开发时提供 `/nanning/` 资源，并在构建后将南宁资源目录复制到 `dist/nanning/`，保留该路径生成的页面。部署完整 `dist/` 即可同时访问两城，不需要部署两个应用。南宁的去过站点、说明分别修改 `../nanning/data/visited-stations.json` 与 `station-notes.json`。

```powershell
npm install
npm run dev
```

打开终端显示的本地地址。使用滚轮或右下角按钮缩放，拖动平移；触屏支持双指缩放。搜索站名可定位并查看所属线路。地图比例低于每图像像素 0.6 个屏幕像素时，暂停直接选站；搜索仍可定位，再放大选择。两种视图的站点悬停、聚焦和选中时均有缩放动画；矢量图缩小至不可直接选站的全景时，站名淡出隐藏。地图模式从 Z12 起显示站名，低于 Z12 隐藏；站名直接沿用矢量图的字号、位置和间距，与线路及站点整体等比缩放。站名显示与 Z13 起可直接点击站点的阈值分开，线路与图标仍整体等比缩放。

去过的站点由 `src/data/visited-stations.json` 配置，使用 `stations.ts` 中的中文 `id`，例如：

```json
["罗湖", "车公庙"]
```

右上角根据该配置自动显示已去过数量、运营站总数和百分比（保留一位小数），换乘站只计一次，未开通站不计入总数。网页仅显示黄色标记和「已去过」状态，不再提供修改按钮，也不读取浏览器的旧记录。保存配置后开发服务器会自动更新；静态部署需要重新构建。未知 id、重复 id、非字符串和未开通站点会在构建时被拒绝。

站点说明填写在 `src/data/station-notes.json`，以中文站点 id 为键，支持运营站和已收录的未开通站。文件默认留空，按需添加，例如：

```json
{
  "车公庙": "这里填写你的站点说明。\n这里是第二行。"
}
```

说明以纯文本显示在站点详情中，支持换行，不解析 HTML 或 Markdown。空白内容隐藏；未知站名、非字符串和超过 5000 字符的说明会在构建时被拒绝。静态部署后修改配置需要重新构建。

地图最大缩放由 `src/data/basemap.json` 的 `maxZoom` 控制，当前限制为 **Z14**，搜索定位同样遵循此上限。缩放下限随屏幕大小计算，并受深圳线网周边边界约束，不能继续缩小到珠三角全景。地图直接复制矢量图的线路、站点和双语标签作为同一 SVG 图层，只对整体等比缩放和平移；线宽、站点大小和换乘通道的相对比例与矢量图一致；文字的位置、字号和间距也与矢量图一致，不再单独计算偏移或缩放。

「地图」使用 MapLibre GL JS 与 VersaTiles 的公开 OSM 矢量瓦片，进入地图模式时加载地图库和底图（包括页面首次打开），需要网络连接。底图采用白底、蓝色水域和绿色公园，保留浅灰道路与建筑（建筑从 Z14 起显示），隐藏额外的 OSM 轨道、道路标签和公交站，突出彩色地铁线路；静态矢量背景使用同源几何与更淡的色彩。样式由 `@versatiles/style` 的 `osm()` 生成，并通过 `inlineSources()` 解析 TileJSON 的相对瓦片地址。底图资源根地址、瓦片源、主题、署名和最大缩放级别配置在 `src/data/basemap.json`。瓦片源自[VersaTiles 公开服务](https://docs.versatiles.org/guides/use_tiles_versatiles_org.html)；页面保留 OpenStreetMap、ESA WorldCover 和 VersaTiles 的署名，高流量部署应使用适用的瓦片服务或自托管。

经纬度来自 `src/data/station-coordinates.json` 的 WGS84 数据，现覆盖全部 351 个运营站；7 站来自 OSM，343 站来自 OpenMetro 的 GCJ-02 坐标转换，坪山广场由高德地铁站 POI 补充。未开通的西丽高铁站保留在整个矢量叠加层中，仍标记为未开通，其显示位置不是实测站位。地图模式使用 `src/data/map-registration.mjs` 根据已有站点坐标拟合全图统一的缩放和平移，不单独拉伸线路、不重新计算图标宽高。优先保持原有示意图比例，因此线网与真实道路、建筑可能有位置偏差。运行 `node scripts/build-clean-routes.mjs` 更新矢量线路后，两种视图自动使用同一份 SVG。旧的 `geographic-routes.json` 和生成脚本仅保留为历史数据，页面不再加载。整个地图视口限制在东经 113.70–114.47°、北纬 22.40–22.86°，拖动时实时约束边缘。重置尽量展示线网；窄屏或极宽屏优先保持地理范围，部分边缘线路需平移查看；缩放级别 13 以下暂停直接选站，搜索可定位并放大，线路筛选和去过标记与示意图共用。逐站来源与转换方法见 `scripts/station-coordinates-report.json`，采集说明见 [DATA_NOTES.md](./DATA_NOTES.md)。

按 `/` 聚焦搜索、`Esc` 关闭详情。地图获得键盘焦点后，可用方向键移动、`+` / `-` 缩放、`0` 复位；放大后可通过 Tab 和 Enter 访问站点。

```powershell
npm run check
node scripts/validate-map.mjs
node scripts/validate-route-geometry.mjs
node scripts/validate-map-registration.mjs
node scripts/validate-vector-basemap.mjs
node scripts/build-vector-basemap.mjs --check
node scripts/validate-visited.mjs
npm run build
npm run preview
```

地图数据位于 `src/data/`：`stations.ts` 为运营名录，`planned-stations.json` 为未开通站点，`station-coordinates.json` 为真实经纬度，`visited-stations.json` 为去过的站点，`station-symbols.json` 为站点符号，`route-paths.json` 为线路路径，`station-labels.json` 为站名位置，`vector-basemap.json` 为静态矢量背景；旧 `map-geography.json` 仅保留参考图提取轮廓。参考图位于 `public/maps/shenzhen-reference.jpg`。来源、提取方法和覆盖范围见 [DATA_NOTES.md](./DATA_NOTES.md)。

更新静态矢量背景：

```powershell
# 从已保存、校验 SHA-256 的 63 个 Z12 瓦片离线重建
node scripts/build-vector-basemap.mjs
# 首次补齐缺失缓存，或显式刷新公开服务快照（需网络）
node scripts/build-vector-basemap.mjs --download
node scripts/build-vector-basemap.mjs --refresh
```

刷新后需复核背景并重新构建页面。生成器沿用地图模式的统一坐标配准，真实道路与示意线路仍可能有位置偏差；不会修改线路、站点或标签。

站点详情中的线路徽标悬停显示编号与传统/常用文字名，例如 `1 号线 / 罗宝线`，名称维护在 `src/data/line-names.ts`。运营公司提示根据本站实际线路显示，4 号线与 13 号线分别显示对应的港铁运营公司。
