# OSM 矢量瓦片代理

这个目录提供一个固定上游的代理示例。它只转发 VersaTiles 的 OSM TileJSON 和 `z/x/y` 瓦片路径，不接受任意 URL，因此不会变成开放代理。代理应部署在国内可访问的域名，并配置 HTTPS。

## Node 部署

```powershell
$env:TILE_ALLOWED_ORIGIN = 'https://你的站点域名'
node tile-proxy/server.mjs
```

默认监听 `127.0.0.1:8787`，可用反向代理（Nginx、Caddy 或云负载均衡）绑定域名。代理缓存应开启，避免每次都回源。`TILE_UPSTREAM_ORIGIN` 只能填写 HTTPS 的固定源，默认是 `https://tiles.versatiles.org`。

## EdgeOne Pages（当前项目最适合）

仓库根目录的 `edge-functions/tiles/[[default]].js` 已按 EdgeOne Pages 官方 Edge Functions 路由格式提供入口。将当前仓库按根目录部署到 EdgeOne Pages 后，它会把以下地址映射到代理：

```text
https://你的站点域名/tiles/osm/tiles.json
https://你的站点域名/tiles/osm/{z}/{x}/{y}
```

此时构建网站时把代理 origin 设置为网站自身即可：

```powershell
$env:PUBLIC_TILE_PROXY_BASE = 'https://你的站点域名'
npm --prefix shenzhen run build
```

EdgeOne 文档：[Edge Functions](https://pages.edgeone.ai/zh/document/edge-functions)。首次发布后应在国内网络实际请求上面两个地址，确认状态码、`Content-Type` 和缓存头。

## 其他 Edge Runtime

`worker.mjs` 使用标准 Fetch API，可按所用边缘函数平台的入口约定部署。它不读取请求中的目标地址，平台只需要把请求转发到该入口。

## 前端配置

构建网站时设置 `PUBLIC_TILE_PROXY_BASE` 为代理的 origin，例如：

```powershell
$env:PUBLIC_TILE_PROXY_BASE = 'https://tiles.example.cn'
npm --prefix shenzhen run build
```

配置后，浏览器访问 `https://tiles.example.cn/tiles/osm/tiles.json` 和对应的瓦片，页面不会直接请求 `tiles.versatiles.org`。未设置该变量时仍使用原始公开地址，方便本地开发和回退。代理失败时，页面仍可切换到“矢量”模式使用仓库内的静态底图。

OpenStreetMap、ESA WorldCover 和 VersaTiles 的署名继续由页面保留；部署时需遵守各数据源和瓦片服务的使用条款及流量限制。
