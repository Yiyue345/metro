# 对外交通换乘标志

站名旁采用透明方框 SVG，方框内部、图形开口及曲线之间均不填白。国铁采用参考图中的红色路徽，高铁采用蓝色 CRH 五条曲线图形，广东城际采用最新参考图中的绿色三条弧带图形，航空与轮渡为黑色。图形按用户参考图用矢量路径重绘，不含位图或参考图中的文字。

`src/data/transport-transfers.json`、`../dongguan/data/transport-transfers.json`、`../nanning/data/transport-transfers.json` 分别维护三城配置：

- `mode`：`rail`（国铁）、`highSpeedRail`（高铁）、`airport`（航空）、`ferry`（轮渡）、`gdIntercity`（广东城际）。
- `destination`：接驳设施或车站名称，用于图标悬停提示、站点无障碍名称及详情弹窗；线路名称放在 `railways` 中。
- `access`：`direct`（通道换乘）、`walk`（出站步行）、`shuttle`（接驳巴士）。
- `railways`：铁路标志必填的接入铁路名称，用于核对分类及悬停提示；不是完整的铁路运行线路清单。普通国铁、高铁和广东城际分别列出对应类型的接入线路，由 `transport-transfers.mjs` 的 `railwayTransportModes` 校验。

分类按车站接入的铁路，包括共线进站段和枢纽联络线，不按站名、枢纽主用途或 G/D/C 车次判断。广深铁路上的深圳站、深圳东站、平湖站和东莞站使用国铁标志；广深港、赣深及厦深铁路使用高铁标志。南宁站接入湘桂、南昆等普通铁路，也接入南昆客专、南凭高铁等；南宁东站接入湘桂铁路及柳南客专等线路，两站均同时显示国铁和高铁。广东城际按其运营线路单独标示。

配置仅接受已收录的运营地铁站，拒绝未知站点、未开通站点、重复类型、缺少铁路分类依据及铁路与标志类型不匹配的配置。新增配置后运行 `node scripts/validate-transport-transfers.mjs`，再检查标签是否重叠。地图、矢量和邻城预览复用 `MetroDiagram.astro` / `TransportBadge.astro`，标志与站名一起缩放、淡出和筛选。

图标底边位于中文基线之上，避免遮住较长的英文副行。三城站名通过各自 `station-labels.json` 的坐标与锚点避让地铁线路、站点和其他标签；密集枢纽可选填 `englishLineLength`（5–24，默认 24）缩短英文分词换行长度，英文名称仍来自原有英文数据。地理图和邻城预览沿用同一套标签几何。

点击带换乘标志的站点，或从搜索结果选择该站，站点详情仅显示“可换乘：”及接驳目的地名称；广东城际目的地在站名后加“（城际站）”，相同显示名称合并。矢量图、地理图及城市切换后均复用对应城市的 `transport-transfers.json`；普通站不显示换乘区块。

## 当前配置与核对来源

| 城市 | 地铁站 | 标志 / 对外交通 |
| --- | --- | --- |
| 深圳 | 罗湖、布吉、平湖 | 国铁深圳站、深圳东站、平湖站 |
| 深圳 | 深圳北、福田、光明城、坪山 | 高铁深圳北站、福田站、光明城站、深圳坪山站 |
| 深圳 | 机场 | 宝安机场 T3、广东城际深圳机场站、机场码头（需接驳巴士） |
| 深圳 | 机场北、福海西 | 广东城际深圳机场北站、福海西站；福海西需出站步行 |
| 深圳 | 太子湾 | 蛇口邮轮中心（出站步行） |
| 东莞 | 东莞火车站 | 国铁东莞站 |
| 东莞 | 虎门火车站 | 高铁虎门站、广东城际虎门北站 |
| 东莞 | 西平、东城南站、东莞西站 | 广东城际西平西站、东城南站、东莞西站 |
| 南宁 | 火车站 | 南宁站，国铁与高铁双标志 |
| 南宁 | 火车东站 | 南宁东站，国铁与高铁双标志 |

共 18 个运营地铁站、23 个方形标志。核对日期为 2026-10-05；地铁站范围继续遵循项目已采用的各城市运营版。

- [深圳交通运输局：铁路车站分布](https://jtys.sz.gov.cn/jtzx/wycx/hccx/hczfb/)、[深圳东站](https://jtys.sz.gov.cn/ydmh/jtcx/hccx/hczfb/content/post_9979911.html)、[深圳地铁线路信息](https://jtys.sz.gov.cn/jtzx/wycx/dtcx/dtxl/content/post_12601089.html)。
- [深圳政府：高铁车次及福田、光明城接驳枢纽](https://www.sz.gov.cn/cn/xxgk/zfxxgj/gqdt/content/post_10663422.html)、[光明城高铁与地铁接驳](https://hmo.sz.gov.cn/zx/gqdt/content/post_1612276.html)。
- [深圳政府：赣深高铁经联络线转入广深铁路](https://www.sz.gov.cn/cn/xxgk/zfxxgj/zwdt/content/mpost_9181396.html)、[深圳交通运输局：厦深铁路提速至 250 公里/小时](https://jtys.sz.gov.cn/zwgk/jtzx/cxtx/content/post_8654677.html)。
- [深圳机场：地铁接驳](https://www.szairport.com/szairport/lwszsq/tiaoz.shtml)、[深圳交通运输局：机场 GTC 与码头摆渡车](https://jtys.sz.gov.cn/jtzx/wycx/fjcx/jcgk/content/post_8527191.html)、[机场空海联运接驳说明](https://www.szairport.com/szairport/kcxfz/202410/0e9df8f8e7c443c4be880a6654dc5c42/files/d793091ae22a4052b70069f8ff7fabfa.pdf)。
- [广东省政府：穗深城际与虎门高铁、深圳地铁接驳](https://www.gd.gov.cn/gdywdt/dsdt/content/post_2718760.html)、[广州国资委：广东城际运营图](https://gzw.gz.gov.cn/qy/qydt/content/post_10911971.html)。
- [东莞轨道交通局：地铁与城轨 / 铁路五处换乘枢纽](https://gdjt.dg.gov.cn/xwzx/tpxw/content/post_4472271.html)。
- 南宁两处接驳与本地 2026.01 参考图对照；[港铁南宁高铁出行指引](https://www.highspeed.mtr.com.hk/res/pdf/Attraction-Guide-Nanning_sc.pdf)载有南宁东站与地铁 1 号线接驳。太子湾及福海西的出入口邻接关系另与站点地图核对，均以出站步行标注。
- [广西政协：南凭高铁南崇段开通，南宁站为既有接入车站](https://www.gxzx.gov.cn/index.php?a=show&c=index&catid=22&id=44352&m=content)、[广西自然资源厅：湘桂、南昆、南防为普速铁路](https://dnr.gxzf.gov.cn/xwzx/zrzx/t16081219.shtml)、[国资委：南珠高铁南玉段从南宁东站引出](https://wap.sasac.gov.cn/n2588025/n2588129/c32497172/content.html)。
- [人民网：南宁车站 2025 年暑运运行图，南宁东站同时办理普速与动车组列车](https://gx.people.com.cn/n2/2025/0701/c179464-41277686-5.html)。
