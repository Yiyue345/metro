# 南宁地图数据来源与复现

本数据按用户提供的《公开版-南宁地铁线路3.0-a运营版（至2026年01月）》制作。运营范围由地理底图版和纯白底版交叉阅读确定，不以更新后的第三方站点状态替代 2026.01 版本。

- 原始尺寸：3220 × 2300。
- 统一裁剪：`[620, 60, 2680, 1420]`，导出尺寸 2060 × 1360。站点、文字、符号和线路全部使用裁剪后的坐标；原图点 `(x, y)` 转为 `(x - 620, y - 60)`。
- 运营线路 1 / 2 / 3 / 4 / 5 号线分别为 25 / 23 / 23 / 18 / 17 站；线路站次 106，去重运营站 95，换乘站 11。
- 五象火车站在参考图中为灰色未开通站，保留为 `plannedStations`，不计入运营站数。它不代表远期规划图的完整站点目录。
- 金象大道属于 4 号线，那洪立交属于 4 / 5 号线；按原图色带核对，不能仅按文字在图片中的列位置分组。
- 已到访站点及笔记为空，与深圳的数据文件独立。
- 车辆段、停车场、图例和标题均不进入线路路径。矢量线路只沿运营站点序列的色带重建。

`recognize-reference.py` 使用本地 RapidOCR 对标签取候选；`build-map-data.py` 使用颜色连通分量检测普通圆点、OpenCV 轮廓测量换乘胶囊，结合核对过的运营站序配对，生成地图数据。南湖和福建园的圆心在高清局部图中校准；OCR 将圆点误纳入首字的文字框会移至节点外侧。英文名称由 `station-english-reviewed.json` 保持，参照原图英语而非直接使用 OCR 错字。

`extract-route-paths.py` 复用深圳的色带 A* 算法：从每条线对应的换乘胶囊内取该线路色彩锚点，连接连续站点，然后生成切线连续的三次 Bézier 曲线。`route-tracing-report.json` 保留 101 个区段的颜色距离、异常判断以及每站到最终曲线的距离。最终曲线与原始走廊的最大允许偏离为 4.5 px。

埌东客运站的圆点因抗锯齿连接色带而未被连通分量单独识别，现按原图校准为裁剪坐标 `(1680.0, 611.5)`，与凤岭 `(1620.45, 609.58)` 分开。同类漏检的体育中心西校准为 `(1502.0, 952.5)`，不再重用体育中心东的站位。生成及验证均检查不同站点不得重用同一示意坐标，并拒绝相邻站点的零长度区段。

经纬度来源为高德公开地铁接口 [4501_drw_nanning.json](https://map.amap.com/service/subway?srhdata=4501_drw_nanning.json)，原始快照保存在 `amap-nanning-source.json`。已核对接口的五条运营线路与本图运营站点集合逐条一致。OpenMetro 的 `cn-nanning/stations.json` 不存在，返回 404，因此没有使用该来源。

`build-station-coordinates.py` 将 95 个有真实地理来源且在南宁边界内的 GCJ-02 坐标迭代转换为 WGS84。缺少来源匹配的运营站点会使构建失败，不从示意图估算真实经纬度。未开通的五象火车站没有接口坐标，仅保留图中的示意位置；它在源坐标报告的 `missing` 中明确列出。每个源记录、POI ID、坐标系及快照 SHA-256 保存于 `station-coordinates-report.json`。

本机使用 Codex bundled Python；OpenCV / RapidOCR 从项目现有 `shenzhen/.ocr-deps` 加载。运行顺序：

```powershell
& 'C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 nanning/scripts/recognize-reference.py
& 'C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 nanning/scripts/build-map-data.py
& 'C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 nanning/scripts/prepare-tracing.py
& 'C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 nanning/scripts/extract-route-paths.py
& 'C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 nanning/scripts/build-station-coordinates.py
node nanning/scripts/generate-line-badges.mjs
node nanning/scripts/validate-map.mjs
```

原始地图仅用于提取和复核，成品线路、圆点、标签都是独立 SVG 数据。线路徽章是根据参考图样式重建的 SVG，不声明为运营公司官方资产。参考图本身的署名、授权和使用限制保留在用户提供的源文件中。

## 线路标识复核（2026-11-02）

用户于 2026-11-02 提供导向标识参考图，明确指定底部线路标识样式：左侧彩色竖向小圆角矩形内放白色数字，右侧黑色“号线”，下方黑色“Line n”，其余区域透明；顶部 NNRT 运营方品牌不进入线路徽章。1 号线绿底按该图取样为 `#50bf5c`；2–5 号线沿用已逐项核查的[官网运营线网图](https://www.nngdjt.com/resources/image/2026/09/01/844215796805701.png)色彩并套用用户指定模板，四条线路不声称另有导向实拍依据。官网线网图中的圆形数字仅属图内标记，与本次用户选定的导向标识变体区分，4 号线保留深色数字，其余线路使用白色数字，宽高比 2.05:1。字形以常规无衬线路径重建，避免跨平台字体替换；未声称字体与官方原稿完全一致。不修改既有示意图线路色、路线和站点数据。逐线来源、差异和原图哈希见 `line-sign-research.json`，字形路径见 `line-sign-glyphs.json`，运行原有生成命令可离线复现。

## 站点详情的运营方图标

`shenzhen/public/operators/nanning-metro.png` 取自 [南宁轨道交通官网页头标识](https://www.nngdjt.com/img/icon/logo.png)，2026-10-18 下载。只裁取左侧蓝色图形，保留原始透明通道，不含中英文名称。官网另提供 [纯图形版本](https://www.nngdjt.com/img/icon/logo3.png)，已交叉核对图形。原始页头图 SHA-256：`1183dff0bfb3cff8d8d45df7dba2cb122a7b14e668ad2f721165ebddf9b65780`；原始裁剪范围 `[0, 0, 107, 86]`（右、下端不包含），紧裁后为 106 × 85 透明 PNG。

## 换乘站比例复核（2026-10-20）

逐项对照原图检查11个换乘站符号，没有杭州那种误取白色内圈而缩小的问题。总部基地的近圆归一化抹平了短横胶囊，保留原站位、宽度和角度，将高度从13.95修正为11.95；生成脚本同步专门覆盖。其余站点不调整，个人去过站点配置不参与此修复。
