# 地铁足迹

深圳、南宁与东莞共用一个 Astro 网站，通过左上角城市列表切换。

| 城市 | 页面 | 独立数据与资源 |
| --- | --- | --- |
| 深圳 | `/` | `shenzhen/src/data/`、`shenzhen/public/` |
| 南宁 | `/nanning/` | `nanning/data/`、`nanning/public/` |
| 东莞 | `/dongguan/` | `dongguan/data/`、`dongguan/public/` |

## 启动与构建

```powershell
cd shenzhen
npm install
npm run dev -- --port 4322
npm run check
npm run build
```

统一部署 `shenzhen/dist/`，其中包含三个城市页面和资源。南宁与东莞无需单独安装或启动应用。共享界面位于 `shenzhen/src/components/`，城市适配器位于 `shenzhen/src/data/metro-city.ts`、`nanning-city.ts` 与 `dongguan-city.ts`。

地图模式下，深圳和东莞会淡化显示彼此的地铁线网。拖近邻城站点所在区域时，对应地图边缘会浮出城市切换入口；点击后在同一页面内复用地图实例、平滑移向邻城并更新城市界面，浏览器地址和前进后退同步更新。每城拖动范围保持原有配置，邻城只在边界附近露出；只有点击切换后的动画可以跨过边界。矢量模式仍只显示本城，邻城预览不参与本城的搜索、线路筛选和到访统计；南宁保持独立。

邻接关系维护于 `shenzhen/src/data/neighbor-cities.ts`，预览与本城线网复用 `MetroDiagram.astro` 和统一等比配准。新增邻接城市时，先接入城市数据与页面，再配置双向邻接关系。导航校验可运行 `node shenzhen/scripts/validate-city-navigation.mjs`。

可接驳国铁、高铁、航空、轮渡和珠三角城际的地铁站，在站名旁显示方形标志。三城各自维护 `transport-transfers.json`；标志提示接驳目的地及通道、出站步行或接驳巴士方式，详见 [换乘标志配置与来源](shenzhen/TRANSPORT_TRANSFERS.md)。

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

地图模式默认直接请求 VersaTiles 的公开 OSM 矢量瓦片。当前项目最省事的做法是继续使用 EdgeOne Pages，并启用仓库中的 `edge-functions/tiles/[[default]].js`；它和静态页面共用一个域名。也可以把 `tile-proxy/` 中的固定上游代理部署到其他国内边缘函数或服务器，再设置 `PUBLIC_TILE_PROXY_BASE`：

```powershell
$env:PUBLIC_TILE_PROXY_BASE = 'https://tiles.example.cn'
npm --prefix shenzhen run build
```

代理只接受 `/tiles/osm/tiles.json` 和限定缩放级别的 `/tiles/osm/{z}/{x}/{y}` 路径，不接受任意目标地址；应在代理前配置 HTTPS、缓存和来源限制。完整部署说明见 [tile-proxy/README.md](tile-proxy/README.md)。没有配置代理时仍使用原始地址；在线底图不可用时可切换到页面内置的“矢量”模式。

城市的数据、已去过站点和站点说明独立维护，详见 [深圳说明](shenzhen/README.md)、[南宁说明](nanning/README.md) 与 [东莞说明](dongguan/README.md)。
