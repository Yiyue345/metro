# 东莞地图数据来源与复现

本数据按用户提供的《公开版-东莞地铁线路3.0-a运营版（至2026年08月）》制作。地理底图版用于对照，纯白底版用于提取线路与站点。运营范围遵循该 2026.08 版本，仅包含地铁 1 / 2 号线，不以更新后的第三方站点状态替代原图，也不收录图中的城际线路。

- 原始尺寸：3850 × 2750。
- `data/source-meta.json` 记录统一裁剪 `[650, 250, 2720, 1750]`，导出尺寸 2070 × 1500。站点、文字、符号和线路均使用裁剪后的像素坐标；原图点 `(x, y)` 转为 `(x - 650, y - 250)`。
- 1 / 2 号线分别为 25 / 15 站，线路站次 40，去重运营站 39，唯一地铁换乘站为市民中心。
- `planned-stations.json` 为空；未开通和城际站点不进入运营站集合。车辆段、停车场、图例和标题也不进入线路路径。
- 到访记录、站点说明与底图配置各自保存在东莞目录。首次生成为空记录，后续重建保留已有配置。

`recognize-reference.py` 使用本地 RapidOCR 提取标签候选并生成统一裁剪图；目前从 `E:/BaiduNetdiskDownload/32.*` 目录定位用户提供的原图，换机器时需调整源目录。`build-map-data.py` 使用颜色连通分量检测普通圆点，结合核对过的站序配对，生成站点、符号、标签及英文名。市民中心、西平、寮厦的标签框与市民中心换乘符号位置按原图校准。不同站点不得重用同一示意坐标。

`extract-route-paths.py` 复用色带 A* 追踪算法：从换乘符号内取对应线路的色彩锚点，按运营站序连接连续站点，生成切线连续的三次 Bézier 曲线。`route-tracing-report.json` 保留 38 个区段的颜色距离、异常判断以及每站到最终曲线的距离；最终曲线与原始走廊的最大允许偏离为 4.5 px。相邻站点的零长度区段会被验证拒绝。

经纬度来源为高德公开地铁接口 [4419_drw_dongguan.json](https://map.amap.com/service/subway?srhdata=4419_drw_dongguan.json)，原始快照保存在 `amap-dongguan-source.json`。构建时逐条核对接口中的 1 / 2 号线与本图运营站集合一致；其他线路不进入本站数据。

`build-station-coordinates.py` 将 39 个源坐标从 GCJ-02 迭代转换为 WGS84。缺少来源匹配的运营站点会使构建失败，不从示意图估算经纬度。每个源记录、POI ID、坐标系及快照 SHA-256 保存在 `station-coordinates-report.json`，当前缺失列表为空。

本机使用 Codex bundled Python；OpenCV / RapidOCR 从项目现有 `shenzhen/.ocr-deps` 加载。在仓库根目录运行：

```powershell
& 'C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 dongguan/scripts/recognize-reference.py
& 'C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 dongguan/scripts/build-map-data.py
& 'C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 dongguan/scripts/extract-route-paths.py
& 'C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 dongguan/scripts/build-station-coordinates.py
node dongguan/scripts/generate-line-badges.mjs
node dongguan/scripts/validate-map.mjs
```

道路、水域与绿地底图来自 VersaTiles 的 OSM 矢量瓦片，数据缓存位于 `scripts/vector-basemap-source/`。在 `shenzhen/` 下使用 `node scripts/build-vector-basemap.mjs --city=dongguan --download` 首次获取缺少的缓存，使用 `--refresh` 显式更新快照；不带下载参数可从缓存重建。随后运行 `node scripts/validate-vector-basemap.mjs --city=dongguan` 和 `node scripts/build-vector-basemap.mjs --city=dongguan --check` 校验。

原始地图仅用于提取和复核，成品线路、圆点、标签都是独立 SVG 数据。线路徽章按参考图样式重建，不声明为运营公司官方资产。参考图本身的署名、授权和使用限制保留在用户提供的源文件中。参考 JPG 和复核截图由仓库 `.gitignore` 排除；页面运行使用提取后的 SVG/JSON，不依赖参考图片。
