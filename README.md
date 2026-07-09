# 智能装柜助手

纸箱装载量计算与 2D/3D 排布可视化工具。当前分支已迁移到 Vue 3 + Vite，保留原有装柜算法，并把界面、状态管理、2D 平面图、3D 货柜渲染拆分为更适合后续 3.0/4.0 迭代的模块。

## 当前能力

- 支持 `20GP`、`40GP`、`40HQ` 三种预设集装箱规格；当前页面未开放自定义柜体长宽高输入。
- 支持单 SKU 码垛：只输入纸箱尺寸即可计算最大装载量。
- 支持多 SKU 分配：SKU 数量支持 2 到 5 个，每个 SKU 可独立配置长宽高、目标装载量、颜色和拖拽顺序。
- 多 SKU 默认只允许水平旋转，即 `长 x 宽 x 高` 与 `宽 x 长 x 高` 两种底面朝向，不支持侧放或倒放。
- 同尺寸多 SKU 保留两种策略：不同卸货地点按 A/B/C 依次装载，同一卸货地点尽量保持完整装载面；异尺寸多 SKU 第一版按拖拽后的 SKU 顺序沿柜长分区装载。
- 支持批量导入 Excel：读取人工码垛数量、纸箱尺寸、柜型，批量计算最大装载量和差值，并导出结果表。
- 批量导入时提供 loading 遮罩、旋转指示和无百分比线性进度条；导入耗时较长时会提示文件较大仍在继续计算。
- 计算时避让集装箱内侧顶部两个 `110 x 110 x 80 mm` 角件。
- 2D 平面图展示俯视排布、尺寸标注、占用空间和角件避让结果。
- 2D 视图支持俯视 / 侧视切换，并常驻端视图；2D 和 3D 都支持放大弹窗查看。
- 3D 视图展示货柜、纸箱、角件端和柜门位置，不同 SKU 使用不同颜色，并支持旋转、平移和缩放。
- 码垛进度条可控制 2D/3D 中显示的装载数量。

## 技术栈

- Vue 3
- Vite
- Pinia
- Three.js
- TypeScript
- Vitest
- Playwright

## 快速开始

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:5173/
```

## 构建与运行 dist

生成静态构建产物：

```bash
npm run build
```

构建完成后会生成 `dist/` 目录。推荐用 Vite preview 预览真实构建产物：

```bash
npm run preview
```

默认预览地址通常是：

```text
http://127.0.0.1:4173/
```

也可以直接用任意静态服务器运行 `dist/`：

```bash
cd dist
python3 -m http.server 8080
```

然后访问：

```text
http://127.0.0.1:8080/
```

注意：交付给别人时需要提供整个 `dist/` 文件夹，不能只提供 `index.html`，因为页面还依赖 `dist/assets/` 下的 JS 和 CSS 文件。

## 批量导入 Excel

页面提供“下载模版”和“批量导入 Excel”两个入口。当前只支持 `.xlsx` 文件，表头需要与模板一致：

| 列名 | 示例 | 说明 |
| --- | --- | --- |
| `人工码垛数量（原始）` | `1470` | 作为人工装载结果对比值 |
| `尺寸（长宽高 mm）` | `465*360*291` | 支持 `*`、`x`、`X`、`×` 分隔 |
| `柜型` | `40HQ` | 只支持 `20GP`、`40GP`、`40HQ` |

导入后会弹出结果表，展示最大装载量和差值；点击“下载结果”可导出新的 `.xlsx` 结果文件。空白行会跳过，单行解析失败会在结果中标记为异常。

## 静态部署

`dist/` 是纯静态文件，可以部署到：

- Vercel
- Netlify
- Nginx
- 宝塔静态站点
- 阿里云 OSS / 腾讯云 COS 静态网站
- 公司内网静态服务器
- 任意支持静态 HTML/CSS/JS 的文件服务器

项目已在 `vite.config.ts` 中设置：

```ts
base: "./"
```

因此构建后的资源路径是相对路径，`dist/` 放在域名根目录或子目录下都能正常加载。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动本地开发服务器 |
| `npm run build` | 类型检查并构建静态产物到 `dist/` |
| `npm run preview` | 预览 `dist/` 构建产物 |
| `npm run test:unit` | 运行 Vitest 单元测试 |
| `npm run test:e2e` | 运行 Playwright 端到端测试 |
| `npm run test` | 运行默认单元测试 |

## 验证基准

当前测试覆盖两组实际码垛数据：

| 纸箱尺寸 | 集装箱 | 实际装载量 | 说明 |
| --- | --- | ---: | --- |
| `488 x 380 x 291 mm` | `40HQ` | `1,349` 箱 | 尾部局部补位后，前部角件干涉区域少 1 箱 |
| `488 x 360 x 291 mm` | `40HQ` | `1,403` 箱 | 前空 1 箱，后部满放 |

完整验证命令：

```bash
npm run test:unit
npm run test:e2e
npm run build
```

`npm run test:e2e` 会自动启动或复用本地 Vite 服务，并用浏览器验证页面输入、计算结果、2D 画布、3D 画布和柜门标识。

当前端到端测试还覆盖批量导入、结果文件下载、导入 loading 进度条、2D/3D 放大弹窗、颜色选择、下拉选择、桌面和移动视口布局。

`npm run build` 当前可能输出两类非阻塞警告：Rolldown 忽略第三方依赖中的 `/* #__PURE__ */` 注释，以及主 JS chunk 超过 500 kB。只要命令退出码为 0，静态产物仍会生成到 `dist/`。

## 当前实现边界

- 异尺寸多 SKU 当前是启发式分区算法：按 SKU 顺序从柜内端到柜门方向依次分区装载，不做跨 SKU 全局最优混装；如果要追求更高装载率，后续需要迭代剩余空间填充和混装搜索策略。
- 单 SKU 和多 SKU 算法都只考虑纸箱底面长 / 宽两种水平朝向，不考虑高向旋转、承重、重心、层间稳定、装卸通道、纸箱压缩、公差和人工操作安全距离。
- 页面目前只开放预设柜型选择，自定义柜体长宽高输入仍在代码中保留过痕迹，但未作为当前功能暴露。
- 3D 渲染为前端实时展示，超大装载量场景会优先保证交互性能，不应把 3D 画面当作唯一交付依据；关键数量仍以算法结果和 2D 排布为准。
- `src/core/packing/index.ts`、`src/renderers/plan2d.ts`、`src/renderers/cargo3d.ts` 仍有 `// @ts-nocheck`，后续重构时应逐步恢复类型检查。

## 目录结构

```text
.
├── src/
│   ├── components/
│   │   ├── controls/          # 集装箱、SKU、进度条等输入组件
│   │   ├── results/           # 装载结果和 SKU 明细
│   │   └── visualizations/    # 2D/3D 可视化组件
│   ├── core/packing/          # 装柜算法 TypeScript 模块
│   ├── renderers/             # Canvas 2D 与 Three.js 渲染逻辑
│   ├── stores/                # Pinia 状态管理
│   └── styles/                # 全局样式与设计 token
├── tests/                     # 单元测试、可视化守卫测试、E2E 测试
├── dist/                      # 构建产物，运行 build 后生成
└── README.md
```

## 开发注意事项

- 核心装柜算法在 `src/core/packing/`，改动算法时需要同步跑两组实际数据回归测试。
- 2D 渲染在 `src/renderers/plan2d.ts`，3D 渲染在 `src/renderers/cargo3d.ts`。
- 页面状态集中在 `src/stores/packingStore.ts`，新增业务输入优先从 store 扩展。
- 多 SKU 颜色会传递到 2D/3D 渲染，不同 SKU 应保持颜色可区分。
- 批量导入逻辑在 `src/core/batchImport.ts`，结果导出逻辑在 `src/core/batchExport.ts`，入口组件在 `src/components/controls/BatchImportDialog.vue`。

## 常见问题

### 双击 dist/index.html 能不能用？

部分浏览器可以打开，但不建议作为正式交付方式。更稳定的方式是用 `npm run preview`、`python3 -m http.server`、Nginx 或对象存储静态站点访问。

### 为什么 build 后不能只发 index.html？

因为 Vite 会把 JS/CSS 打包到 `dist/assets/`。只发 `index.html` 会导致页面加载不到资源。

### Vercel 访问不稳定怎么办？

直接把 `dist/` 部署到其他静态服务即可。这个项目不依赖后端接口，构建产物是纯静态文件。
