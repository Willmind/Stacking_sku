# Agent 协作指南

本文件是仓库级 agent 约定，适用于 Codex 或其他自动化编码助手在本项目中的后续工作。除非用户在对话中明确给出不同要求，否则优先遵守这里的规则。

## 默认语言

- 面向用户的回复、阶段性说明、问题澄清、最终总结默认使用中文。
- `docs/superpowers/` 下由 agent 新生成或更新的规格文档、计划文档、设计说明默认使用中文。
- Git commit 信息默认使用中文。
- 代码标识符、文件名、包名、命令、API 名称、环境变量、错误堆栈、第三方库名称保持原文，不要为了中文化而翻译。
- 如果用户明确要求英文，或外部工具/平台强制英文格式，则按用户或平台要求执行。

## Superpowers 文档规范

- 规格文档放在 `docs/superpowers/specs/`，计划文档放在 `docs/superpowers/plans/`。
- 文件名可以继续使用日期加英文短 slug，例如 `2026-06-11-vue3-migration-design.md`，方便排序和跨平台识别。
- 文档标题、章节名、正文、验收标准、风险说明默认中文。
- 技术名词首次出现时可以保留英文原词，例如 `Vue 3`、`Vite`、`Pinia`、`Three.js`、`Playwright`。
- 文档要写清楚“为什么做、做什么、不做什么、如何验证”，避免只写口号式计划。
- 涉及码垛业务规则时，优先使用用户提供的中文业务表述，并保留关键数值和公式。

## Git 提交规范

- Commit 信息必须使用以下格式：

  ```text
  <type>(<scope>): <subject>

  <body>

  <footer>
  ```

- `type` 只能使用：`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`chore`、`revert`。
- `scope` 使用简短英文标识，表示影响范围，例如：`packing`、`ui`、`render`、`test`、`docs`、`agent`、`build`、`release`。
- `subject` 必须为中文，简短、明确，使用祈使句或动宾结构。
- `body` 使用中文列表或段落简述本次改动要点；简单改动可以省略。
- `footer` 可选，用于描述本次改动的背景、目的、影响、关联版本或破坏性变更。
- Commit 标题示例：
  - `feat(packing): 新增多 SKU 装载策略`
  - `fix(render): 修正 3D 货物颜色渲染`
  - `docs(agent): 完善 agent 协作规范`
  - `test(packing): 补充实际码垛基准用例`
- 一次提交只包含一个清晰主题；无关改动分开提交。
- 如果需要提交正文，正文也使用中文，说明背景、影响范围和验证方式。
- 不要把临时文件、测试产物、无关构建缓存加入提交。

## 项目上下文

- 当前前端技术栈是 Vue 3 + Vite + Pinia + Three.js + TypeScript。
- 核心装柜算法在 `src/core/packing/`。
- 页面状态集中在 `src/stores/packingStore.ts`。
- 2D 渲染在 `src/renderers/plan2d.ts`。
- 3D 渲染在 `src/renderers/cargo3d.ts`。
- 旧版静态入口和 CommonJS 算法已经清理，后续以 `src/` 下的 Vue 3 / TypeScript 实现为准。

## 开发原则

- 优先保持现有 Vue 组件、Pinia store、渲染器、算法模块的边界清晰。
- 不为小改动引入过度抽象；有真实复用或降低复杂度时再抽象。
- UI 改动要兼顾业务操作效率，避免把工具做成营销页。
- 改动算法时必须关注角件避让、装载顺序、多 SKU 策略和两组实际码垛数据。
- 新增可视化逻辑时，确认 2D/3D 都能正确表达 SKU 颜色、柜门位置和角件端。

## 验证要求

根据改动范围选择验证命令。算法、页面、渲染相关改动完成前，优先运行：

```bash
npm run test:unit
npm run test:e2e
npm run build
```

至少确认两组实际基准不回退：

- `488 x 380 x 291 mm`，`40HQ`，装载量 `1,349` 箱。
- `488 x 360 x 291 mm`，`40HQ`，装载量 `1,403` 箱。

如果某个验证命令因为本地环境限制无法运行，需要在最终回复中明确说明原因和已完成的替代检查。

## 静态交付

- `npm run build` 产物位于 `dist/`。
- `dist/` 是纯静态文件，可以部署到 Vercel、Netlify、Nginx、对象存储静态站点或公司内网静态服务器。
- 交付给别人时要提供整个 `dist/` 文件夹，不要只提供 `index.html`。
