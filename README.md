# 地铁足迹

成都、东莞、杭州、昆明、南宁、绍兴与深圳共用一个 Astro 网站，只提供在线地图，通过左上角按城市名拼音排序的城市列表切换。

| 城市 | 页面 | 独立数据与资源 |
| --- | --- | --- |
| 成都 | `/chengdu/` | `chengdu/data/`、`chengdu/public/` |
| 东莞 | `/dongguan/` | `dongguan/data/`、`dongguan/public/` |
| 杭州 | `/hangzhou/` | `hangzhou/data/`、`hangzhou/public/` |
| 昆明 | `/kunming/` | `kunming/data/`、`kunming/public/` |
| 南宁 | `/nanning/` | `nanning/data/`、`nanning/public/` |
| 绍兴 | `/shaoxing/` | `shaoxing/data/`、`shaoxing/public/` |
| 深圳 | `/` | `shenzhen/src/data/`、`shenzhen/public/` |

另有 `/about/` 关于页，正文由 `shenzhen/src/content/about.md` 编辑，支持 Markdown。七城地图与关于页共八个页面。

**新增城市或更新参考图前，必须完整阅读 [参考图地图实现流程](docs/NEW_CITY_WORKFLOW.md)。** 该文档涵盖范围、坐标、图面提取、换乘拓扑、标签、三类标识、共享接入和交付检查；执行入口见 [AGENTS.md](AGENTS.md)。

线路选择使用紧凑自适应网格，按图标原始比例排列，横向标牌占两格。深圳以外六城的46份线徽已逐条复核，南宁采用用户指定的导向版式；来源、重建方式和验证记录见 [线路标识说明](shenzhen/LINE_SIGNS.md)。

## 启动与构建

```powershell
cd shenzhen
npm install
npm run dev -- --port 4322
npm run check
npm run build
```

构建输出为 `shenzhen/dist/`，包含七城地图、关于页及资源。各城无需单独安装或启动应用。共享界面位于 `shenzhen/src/components/`；深圳适配器为 `shenzhen/src/data/metro-city.ts`，其他城市适配器为同目录的 `chengdu-city.ts`、`dongguan-city.ts`、`hangzhou-city.ts`、`kunming-city.ts`、`nanning-city.ts` 与 `shaoxing-city.ts`。昆明仅收录 2026.07 运营版，已去过站点配置初始化为空。

成都依据2026.11参考图，完整保留18条线路、396个运营站及预留芦葭，共397个真实 WGS84 坐标；蓉2暂时隐藏后显示17条线路、364个运营站及1个预留站。2号线东段六站恢复运营并新增龙泉驿火车站，S3资阳线补入6个运营站，芦葭不计运营。S3 inset配准后总canvas为5660×5130，区别于4800×4030主图裁切；1号分支、7号闭环、18／19共线及蓉2原始数据均保留。新版已通过数据、浏览器与构建检查，详见 [成都说明](chengdu/README.md)。

深圳和东莞会淡化显示彼此的地铁线网。拖近邻城站点所在区域时，对应地图边缘会浮出城市切换入口；点击后在同一页面内复用地图实例、平滑移向邻城并更新城市界面，浏览器地址和前进后退同步更新。每城拖动范围保持原有配置，邻城只在边界附近露出；只有点击切换后的动画可以跨过边界。邻城预览不参与本城的搜索、线路筛选和到访统计；昆明与南宁不显示邻城预览。

邻接关系维护于 `shenzhen/src/data/neighbor-cities.ts`，预览与本城线网复用 `MetroDiagram.astro` 和统一等比配准。新增邻接城市时，先接入城市数据与页面，再配置双向邻接关系。导航校验可运行 `node shenzhen/scripts/validate-city-navigation.mjs`。

深圳另显示香港东铁线、屯马线作为邻区背景，包含罗湖、落马洲与马场支线，暂不增加香港城市入口。罗湖—羅湖、福田口岸—落馬洲之间显示参考图式的通关连接标记；数据不进入深圳的搜索与到访统计。图面、名录、坐标来源和重建方式见 [香港邻区线网说明](hongkong-context/README.md)。

可接驳国铁、高铁、航空、轮渡和广东城际的地铁站，在站名旁显示方形标志。各城独立维护 `transport-transfers.json`；标志提示接驳目的地及通道、出站步行或接驳巴士方式，详见 [换乘标志配置与来源](shenzhen/TRANSPORT_TRANSFERS.md)。

## EdgeOne Pages

仓库根目录的 `edgeone.json` 已配置静态部署，安装时通过 `package-lock.json` 锁定依赖。在 EdgeOne Pages 导入 Git 仓库时，使用以下设置：

| 配置 | 值 |
| --- | --- |
| 生产分支 | `main` |
| 框架预设 | Other（静态网站） |
| 根目录 | 仓库根目录，留空或填写 `./` |
| 安装命令 | `npm --prefix shenzhen ci` |
| 构建命令 | `npm --prefix shenzhen run build` |
| 输出目录 | `shenzhen/dist` |
| Node.js | 22 LTS |

## 国内网络下的在线底图

在线地图默认直接请求 VersaTiles 的公开 OSM 矢量瓦片，线路、站点和标签作为同一 SVG 图层等比叠加。历史静态矢量背景 JSON 和生成脚本仍保留，页面不再加载。当前项目最省事的做法是继续使用 EdgeOne Pages，并启用仓库中的 `edge-functions/tiles/[[default]].js`；它和静态页面共用一个域名。也可以把 `tile-proxy/` 中的固定上游代理部署到其他国内边缘函数或服务器，再设置 `PUBLIC_TILE_PROXY_BASE`：

```powershell
$env:PUBLIC_TILE_PROXY_BASE = 'https://tiles.example.cn'
npm --prefix shenzhen run build
```

代理只接受 `/tiles/osm/tiles.json` 和限定缩放级别的 `/tiles/osm/{z}/{x}/{y}` 路径，不接受任意目标地址；应在代理前配置 HTTPS、缓存和来源限制。完整部署说明见 [tile-proxy/README.md](tile-proxy/README.md)。没有配置代理时仍使用原始地址；地图初始化失败后，点击重置视野按钮重试加载。

城市的数据、已去过站点和站点说明独立维护，详见 [成都说明](chengdu/README.md)、[东莞说明](dongguan/README.md)、[杭州说明](hangzhou/README.md)、[昆明说明](kunming/README.md)、[南宁说明](nanning/README.md)、[绍兴说明](shaoxing/README.md) 与 [深圳说明](shenzhen/README.md)。
