# 昆明地铁数据

使用用户提供的 2026.07 运营版两张 JPG。只包含地铁 1–6 号线、103 个运营站，1 号线含大学城南主线和昆明南火车站支线；规划站、车辆段、停车场及机场内部捷运不计入站点。

- `data/stations.ts`、`station-symbols.json`、`station-labels.json`、`route-paths.json` 的坐标同属裁切后的原图像素空间，画布为 1980 × 1960。地图叠加对完整 SVG 只做同一缩放和平移。
- `data/official-roster.json` 每条线路有去重后的 `stations` 和有序的 `paths`。1 号线有两条路径，不能把两个南端串为一条线路。
- 站名、英文、换乘归属见 `scripts/reference-roster.json`，已对提供的运营版逐段放大核对。英语保留参考图译法；中文显示名与内部 ID 分离，如市级行政中心·清风、金桂街·斗南花市。
- 103 个 `station-coordinates.json` 坐标来自[高德公开地铁数据](https://map.amap.com/service/subway?srhdata=5301_drw_kunming.json)的 GCJ-02 坐标，通过迭代反解输出 WGS84，保留 7 位小数。源快照 `scripts/amap-kunming-source.json` 及逐站匹配记录、POI ID、源坐标、SHA256 均保存在 `scripts/station-coordinates-report.json`。缺失匹配会导致生成失败；不以示意图像素推测经纬度。
- `source-meta.json` 记录原图名称、哈希、2940 × 2100 尺寸及裁切框 `[650,90,2630,2050]`。
- `scripts/route-tracing-report.json` 保存每段曲线的来源色带检查。四个由换乘胶囊遮罩产生的告警已经放大叠图目视核对；确切段名和原因见 `scripts/route-review.json`。
- `visited-stations.json` 为初始空数组，`station-notes.json` 为初始空对象；后续个人配置不会因重建而覆盖。`planned-stations.json` 为运营版的空数组。

从项目根目录执行 `node kunming/scripts/validate-map.mjs` 验证名册、分支顺序、坐标来源、完整覆盖、SVG 几何及线路资源。

页面入口为 `/kunming/`，城市列表按拼音排列。与其他城市一样，仅提供在线地图；参考 JPG 仅用于本地识别和审核，不作为网站底图发布。昆明没有邻城预览。

昆明火车站、昆明南火车站、机场中心分别显示国铁、高铁、航空标志。接驳配置与来源见共享的 [交通标志说明](../shenzhen/TRANSPORT_TRANSFERS.md)。运营企业按[昆明市司法局公布的行政执法主体](https://m.kunming.cn/news/c/2025-02-07/13913808.shtml)区分：1、2、3、5、6 号线为昆明地铁运营有限公司，4 号线为云南京建轨道交通投资建设有限公司；4 号线企业链接指向其母公司官网。

图片处理脚本复用本机 `shenzhen/.ocr-deps` 的 Pillow、OpenCV 和 RapidOCR，需要与这些本地依赖兼容的 Python 3.12。依次执行 `recognize-reference.py`、`build-map-data.py`、`build-station-coordinates.py`、`extract-route-paths.py`，最后执行 `node kunming/scripts/generate-line-badges.mjs`。普通重建保留已调整的站名坐标；只有显式传入 `build-map-data.py --refresh-labels` 才会用 OCR 坐标重置标签，随后需要重新核对中英文与交通标志的避让。
