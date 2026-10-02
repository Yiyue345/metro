# 地铁足迹

深圳与南宁共用一个 Astro 网站，通过左上角城市列表切换。

| 城市 | 页面 | 独立数据与资源 |
| --- | --- | --- |
| 深圳 | `/` | `shenzhen/src/data/`、`shenzhen/public/` |
| 南宁 | `/nanning/` | `nanning/data/`、`nanning/public/` |

## 启动与构建

```powershell
cd shenzhen
npm install
npm run dev -- --port 4322
npm run check
npm run build
```

统一部署 `shenzhen/dist/`，其中包含两个城市页面和资源。南宁无需单独安装或启动应用。共享界面位于 `shenzhen/src/components/`，城市适配器位于 `shenzhen/src/data/metro-city.ts` 与 `nanning-city.ts`。

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

不要把根目录设为 `shenzhen`：应用需要读取同级的 `nanning/` 数据。构建后的 `/` 与 `/nanning/` 都有独立 HTML，无需添加 SPA 回退规则。配置字段与目录约定见 [EdgeOne 配置说明](https://pages.edgeone.ai/document/edgeone-json) 和 [构建指南](https://pages.edgeone.ai/document/build-guide)。

参考 JPG、OCR 图片和复核截图均由 `.gitignore` 排除。网站运行所需的线路 SVG、JSON 数据、静态矢量底图和运营方图片仍会提交；参考图只在本地数据提取和复现脚本阶段使用。

本地仓库分支为 `main`。发布前需要将它推送到自己的远程 Git 仓库，再在 EdgeOne Pages 中关联该仓库；远程仓库地址和上线操作需按实际账户配置。

城市的数据、已去过站点和站点说明独立维护，详见 [深圳说明](shenzhen/README.md) 与 [南宁说明](nanning/README.md)。
