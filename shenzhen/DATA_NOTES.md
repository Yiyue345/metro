# 数据说明

## 名录与底图

- `src/data/official-roster.json`：深圳市交通运输局《[深圳地铁线路信息](https://jtys.sz.gov.cn/ydmh/jtcx/dtcx_180970/dtxl/content/post_12601090.html)》，发布日期 2026-01-14。17 条线路包含 6 号线支线，线路内共有 432 个站点条目。
- 官网合列 2、8 号线，本项目拆为 2 号线赤湾至莲塘、8 号线梧桐山南至溪涌。原始站名保留在名录中；`aliases` 将「学城」对应为「大学城」、「人民」对应为「人民南」、「深圳北站」对应为「深圳北」。合并同站后共 351 站。
- `public/maps/shenzhen-reference.jpg`：用户提供的《深圳地铁3.0》2026.09 参考图，尺寸 **5950 × 4250**，作为数据来源保留原作者署名和水印，页面不再提供「原图」模式。「矢量」模式独立绘制线路、站点、中文站名及简化地理轮廓。线路颜色由 `scripts/sample-line-colors.py` 采样普通站圆芯，取稳健中位数，保存于 `src/data/line-colors.json`。

底图与名录的日期不同。底图中辅助展示的城际、有轨电车及香港线路未纳入 351 站名录，也不提供这些站点的搜索和去过记录。

## 静态矢量背景

`src/data/vector-basemap.json` 替代页面原先的参考图颜色提取背景，来自地图模式同一 [VersaTiles 公开 TileJSON](https://tiles.versatiles.org/tiles/osm/tiles.json)，格式为 Shortbread 1.0。其 OSM 快照时间为 **2026-06-07T23:59:58Z**，瓦片构建时间为 **2026-06-18T14:21:32.736Z**，实际下载时间记录在缓存 manifest 中。署名依据原始 TileJSON 保留 OpenStreetMap contributors（[ODbL 1.0](https://www.openstreetmap.org/copyright)）、ESA WorldCover 2021（CC BY 4.0）并补充 VersaTiles，不将所有绿地几何都宣称为 OSM。

`scripts/vector-basemap-source/` 保存 63 个 Z12 原始 `.pbf`、原始 `tilejson.json` 和 `manifest.json`（地址、字节数、SHA-256、下载时间），总计约 2.74 MB。`scripts/build-vector-basemap.mjs` 使用 `@mapbox/vector-tile` 2.0.5 和 `pbf` 4.0.2 解码，先用 `map-registration.mjs` 的同一整体等比变换反投影到 5950 × 4250 SVG 坐标，再裁剪瓦片缓冲区和画布边缘。静态背景约 2.35 MB，共六个 SVG path；多边形先区分外环与孔洞，统一外环顺时针、孔洞逆时针，再按同色层合并为 nonzero 填充，避免不同地块叠加时按 even-odd 异或挖空，也避免独立瓦片填充的抗锯齿接缝。

背景只读取 `land` 的 forest、park、grass、garden、recreation_ground、scrub、heath、meadow、wood、nature_reserve；`ocean`、`water_polygons`、非隧道的 river/canal/stream 水线；以及 `streets` 的 motorway、trunk、primary、secondary、tertiary（排除轨道）。不生成地名、不显示建筑或道路标签，也不凭站名编造公园/水域几何。

简化容差为 2 SVG 像素，锁定裁剪边界交点避免邻瓦片错位；仅过滤外环面积低于 40 SVG 平方像素的小面，park/garden/recreation_ground 使用 12 的较小阈值保留市区小公园。小孔洞可能随简化消失，背景不是测绘级数据。所有背景线宽随全图等比缩放。地铁线路、站点和标签保持原几何不变。

离线执行 `node scripts/build-vector-basemap.mjs` 可从缓存重建，`--check` 检查输出与缓存、当前配准完全一致并验证每个缓存 SHA-256；`node scripts/validate-vector-basemap.mjs` 检查图层、路径坐标范围、线宽及与共享配准的一致性。`--download` 只补齐缓存，`--refresh` 显式替换快照；下载最多 100 个瓦片，单个最多 2 MB。页面无需实时下载这些缓存，只有地图模式使用在线瓦片。

## 真实地图经纬度

`python scripts/build-station-coordinates.py` 按站名及别名匹配 351 个运营站，生成 `src/data/station-coordinates.json`（WGS84）和 `scripts/station-coordinates-report.json`。优先采用已有的 7 个 OpenStreetMap 站点坐标（WGS84，Overpass 部分响应，ODbL 1.0）；其余 343 个站点采用 [OpenMetro 深圳站点快照](https://github.com/Naptie/openmetro/blob/755fae239726120e7e7304b4bee29db5e1b64267/data/cn-shenzhen/stations.json)中的 GCJ-02 坐标。OpenMetro 快照共有 351 站，其中 350 站带坐标，坪山广场缺坐标。最后一站由[高德地图「坪山广场(地铁站)」POI](https://ditu.amap.com/place/BV10997914)补充；2026-09-29 核对其地铁站类型及 GCJ-02 坐标（纬度 22.700587，经度 114.348763），原始记录保存在 `scripts/amap-station-supplement.json`。

GCJ-02 坐标通过迭代逆解转换为 WGS84，每次反算前后均检查深圳区域边界；不使用示意图的像素坐标。报告逐站记录来源、原始站名、原坐标系及转换方法，并列出缺失站。当前运营站覆盖 **351/351**，未开通的西丽高铁站仍缺真实经纬度，不绘制到真实地图。坐标来源各有测绘和站位误差，转换精度不等于原始数据的实测精度。

地图模式现在直接复制矢量视图的 SVG 线路、站点、通道和双语标签，仅移除静态矢量背景层，让在线道路和建筑底图透出。`src/data/map-registration.mjs` 使用真实站点坐标拟合全局等比缩放和平移，线路和图标共用同一变换；站名直接复用矢量图的原始位置、字号、间距及双语排版，随整个图层等比缩放，不单独变换文字，低于 Z12 时隐藏，点击站点恢复原有缩放动画。不再使用薄板样条、站点吸附或换乘符号扩宽。地图保持朝北且不倾斜，最大缩放 Z14。原有图形比例优先，因此与真实地理位置的偏差可能超过此前的局部配准方案。

`node scripts/build-clean-routes.mjs` 从保留的 `scripts/route-polylines.json` 追踪样本生成矢量路径 `route-paths.json`；两种模式直接共用这一份路径。
2026-09-30 从 [OpenStreetMap 官方 API](https://api.openstreetmap.org/api/0.6/map?bbox=114.045,22.535,114.065,22.548) 取得福田小范围原始数据（ODbL 1.0）。原始 XML 为 `scripts/osm-futian-tracks-source.osm`，提取出的 30 条 subway ways 为 `scripts/osm-central-tracks-source.json`。核对的直线区段记录在 `src/data/route-straight-sections.json`：1 号线购物公园—岗厦、11 号线福田—岗厦北。11 号线两方向轨道约 1.5 km，原始节点相对端点弦线最大偏差约 9 m / 5 m；按示意图风格表达为直线。1 号线岗厦以东存在真实转弯，仍保留。此次 OSM 核对仅覆盖上述市区样例，不宣称全网采用 OSM 实测轨道。

旧的 `scripts/build-geographic-routes.mjs`、`src/data/geographic-routes.json`、配准报告和 `validate-geographic-routes.mjs` 保留为历史实验数据，不再进入页面渲染，也不再代表当前地图定位误差。

运行 `node scripts/validate-route-geometry.mjs` 验证矢量路径，运行 `node scripts/validate-map-registration.mjs` 验证统一配准保留全图比例。浏览器校验两种模式的路径、线宽、站点矩形和内部变换完全一致。通过 MapLibre 的 `maxBounds` 限制整个视口（东经 113.70–114.47°、北纬 22.40–22.86°），替代松手后限制中心点的方式；重置及窗口尺寸变化时重新计算缩放下限，不允许缩小至边界之外。窄屏或极宽屏优先保证范围，边缘线路可平移查看，不保证同时展示全网。

## 坐标提取与校准

1. `scripts/prepare-ocr.py` 将文字区域处理为黑白重叠裁片，放大后由 `scripts/ocr-map.ps1` 使用 Windows OCR 识别；`scripts/recognize-map.py` 使用本地 RapidOCR 补充标签及文字框。
2. `scripts/detect-nodes.py` 使用颜色、白圈和黑色轮廓检测候选站点节点，输出 `scripts/node-candidates.json`。
3. `scripts/generate-stations.py` 将官方名录、OCR 标签与附近节点匹配，应用 `src/data/calibrated-coordinates.json` 中的人工校准，生成 `src/data/stations.ts`、热点草稿和缺失名单。
4. `scripts/review-hotspots.py` 生成裁片联系表；结合原图放大检查站名与节点中心，校准错配和特殊换乘站。
5. `scripts/extract-station-symbols.py` 从黑边轮廓的内孔估计中心、长短轴和旋转角，生成 `src/data/station-symbols.json`；普通站使用圆形。特殊多节点站按参考图单独定义。
6. `scripts/extract-route-paths.py` 按线路颜色建立距离场，以有序站点约束追踪站间走向，再由 `scripts/route_curves.py` 对完整线路等弧采样、校正色带中心、平滑并生成共享切向的连续三次 Bézier，保存于 `src/data/route-paths.json`。过站处不再单独拼接圆角；换乘站按各线路在符号内部的接入位置定位。地上段附加细线不绘制；2、8 号线在莲塘衔接。逐段审查、曲线偏移及站点覆盖记录在 `scripts/route-tracing-report.json`。
7. `scripts/build-map-context.py` 从原图提取水域、山地大轮廓并简化为路径，站名就近匹配 OCR 文字框，再依据浏览器中的完整双语文字边界避让节点及相邻标签。输出 `map-geography.json`、`station-labels.json`。地理形状是示意轮廓，未保留道路及图例；`map-geography.json` 现仅保留为历史提取数据，页面使用上文的 `vector-basemap.json`，此脚本不会更新当前背景。

提取脚本需要 Python、Pillow、NumPy；轮廓检测需要 OpenCV，RapidOCR 需要 `rapidocr-onnxruntime`。相关脚本会读取项目内已有 OCR 中间结果；`generate-stations.py` 的 `SOURCE` 当前指向本机原始纯色底图，换机重建前需调整该路径。运行示例：

```powershell
python scripts/prepare-ocr.py '<原始底图路径>'
powershell -File scripts/ocr-map.ps1 -Image '<裁片绝对路径>' -Output '<OCR结果绝对路径>'
python scripts/recognize-map.py '<原始底图路径>'
python scripts/detect-nodes.py
python scripts/generate-stations.py
python scripts/review-hotspots.py
python scripts/extract-station-symbols.py
python scripts/extract-route-paths.py
node scripts/build-clean-routes.mjs
python scripts/build-map-context.py
node scripts/validate-map.mjs
```

Windows OCR 命令需对生成的各裁片运行；输出按 `<裁片文件名>.json` 放在 `scripts/ocr-clean-tiles/`。生成操作会覆盖相应数据和中间结果，人工复核后再采用。

线路追踪优先读取本机同坐标的「纯色底」版本；若该文件不存在，回退到项目内的参考图。图像提取和曲线简化会产生少量像素误差，不能视为测绘数据。`validate-map.mjs` 检查线路、站点、标签覆盖、颜色一致性及路径数据格式；视觉还原还需结合浏览器与原图对照。

## SVG 几何与连接含义

所有坐标使用原图像素：原点在左上，`x` 向右、`y` 向下；与 SVG 的 `viewBox` 共用坐标系。`stations.ts` 中的 `x/y` 用于搜索定位，符号的实际位置以 `station-symbols.json` 为准。

符号按站点 ID 索引。每个 `parts` 元素包含中心 `x/y`、宽高 `width/height`、旋转角 `angle`（度）、所属线路 `lines` 和换乘标记 `transfer`。多节点站可通过 `connections` 记录端点及类型：`corridor` 绘制通道，`out-of-station` 绘制虚线连接；可选 `points` 为 SVG 折线坐标序列，用于福民的折线路径。福民、红岭南、福田口岸和上屋等站保留图中的独立节点形态。双圆先统一绘制外轮廓，再绘制内层，避免重叠处出现内部黑边。

这些连接是参考图的视觉表达，不是实际步行路线、站内换乘政策或现实时刻运营状态的承诺。

## 线路牌与运营品牌

`public/lines/*.svg` 由 `scripts/generate-line-badges.mjs` 按用户提供的双语线路牌样式重绘，颜色沿用线路数据；这是界面重绘资产，并非下载的官方原文件。选择面板与站点卡片共用这些 SVG。

运营商图标直接取自官网公开资源：深圳地铁 `https://www.szmc.net/szmc_m/home/a/C1585280003525S.png`；港铁（深圳）`https://www.mtrsz.com.cn/frontend/default/img/logo.png`。保留品牌原貌和文字，只在界面缩放显示；标志权利归对应公司，不表示本项目获得官方背书。

线路对应关系见 `src/data/operators.ts`。深铁运营的管辖线路依据[深铁运营官网简介](https://www.szmc.net/szmc_m/jituangaikuang/jituanjianjie/zhuyaofenzigongsijianjie/szdtyyjtyxgs/)，4号线与13号线依据[港铁4号线介绍](https://www.mtrsz.com.cn/frontend/default/src/channel/line_introduce_4Line.html)及[13号线介绍](https://www.mtrsz.com.cn/frontend/default/src/channel/line_introduce_13Line.html)。13号线北延段按官网说明列港铁项目公司和深铁联合运营。卡片按乘客可识别的运营品牌去重，鼠标悬停图标可看公司说明；未开通站不显示正在运营的公司标志。

## 英文站名数据

`src/data/station-english.json` 按现有站点 ID 提供 351 个英文名称。来源为用户提供的 2026.09 参考图英文标注，使用 `scripts/labels-rapid.json` 的文字框与中文标注、实际站点节点就近关联。逐线检查后修正 OCR 的错拼、断行和粘连；长名称、缩写及难识名称另以原图放大裁片核对。原始 OCR 候选只保存在 `scripts/review/station-english-ocr-draft.json`，不会直接进入正式表。

保留图中的专用名称与写法，例如 `OCT`、`SIAT`、`Mission Hills`、`SZU Lihu Campus`、`Antuo Hill`、`Shenwai Senior Campus`。低碳城沿用图中的 `Lower Carbon City`，机场沿用 `Airport (T3)`；此表是参考图的英文转录及 OCR 校正，不宣称是另行核验的最新官方英文名录。统一单词间空格，普通名称首字母大写，`Rd`、`St` 等缩写按图保留。

经检查的完整字典在 `scripts/station-english-reviewed.json`。可重复生成正式表并核验其与现有 351 站完全一致：

```powershell
python scripts/extract-station-english.py
```

脚本只从经检查的字典生成正式数据；重新提取 OCR 不会自动替换人工校正结果。双语文字在现有中文标签下方以英文副行显示，长英文按单词折行；布局需使用浏览器测得的完整双语文字框检查碰撞，不能只依据字符数量估算。

红山站原始提取胶囊仅为 14.1 × 8.7，视觉小于邻近换乘站；现等比放大至 19.0 × 11.7，保持中心和角度不变。提取脚本同步保留该尺寸修正。线路文字名为传统/常用名称，不替代当前数字编号。
