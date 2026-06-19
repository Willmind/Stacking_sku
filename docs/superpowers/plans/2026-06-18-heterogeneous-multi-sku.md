# 多 SKU 异尺寸装载 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 让多 SKU 支持每个 SKU 独立配置长宽高，并按真实尺寸输出 2D/3D 装载结果。

**Architecture:** 保留单 SKU 既有水平旋转算法和同尺寸多 SKU 分配逻辑；当 SKU 尺寸不一致时，启用异尺寸多 SKU 分区算法，按拖拽后的 SKU 顺序沿柜长分区装载，每个 SKU 在自己的剩余柜长空间里使用水平旋转计算位置。UI 从公共长宽高改为每个 SKU 独立长宽高的卡片式编辑。

**Tech Stack:** Vue 3、Pinia、TypeScript、Vite、Three.js、Playwright、Vitest。

---

### Task 1: 异尺寸算法红灯测试

**Files:**
- Modify: `tests/packing-core.test.ts`

- [x] 新增测试：`calculateMultiSkuPacking` 接受不同尺寸 SKU，不再抛“同尺寸”错误。
- [x] 新增测试：异尺寸结果里的 A/B 箱体使用各自真实 `dx/dy/dz`，并且总装载数、SKU 汇总、体积利用率按各 SKU 真实体积计算。
- [x] 运行 `npm run test:unit -- tests/packing-core.test.ts`，预期因为当前 `assertSameSkuDimensions` 失败。

### Task 2: 异尺寸算法实现

**Files:**
- Modify: `src/core/packing/index.ts`

- [x] 抽出同尺寸判断，仅同尺寸时走现有单 SKU 位置生成加 SKU 分配逻辑。
- [x] 新增异尺寸路径：按 SKU 顺序从柜内端到柜门方向分区；每个 SKU 用当前剩余柜长调用既有 `calculatePacking`，截取目标数量或可装载数量，并把位置整体加上当前分区的 `x` 偏移。
- [x] 每个异尺寸 SKU 只使用既有两种水平朝向：`长 x 宽 x 高` 与 `宽 x 长 x 高`。
- [x] 合并所有位置，重新生成 `sequenceIndex`、`faceIndex`、`stackIndex`、`layerPositions`、`layers`、`pattern.occupiedLength/occupiedWidth`、`usedHeight`、`utilizationRatio` 和 `skuSummary`。
- [x] 运行核心单测，保持两组实际基准 `1340`、`1403` 不回退。

### Task 3: Store 数据流改为 SKU 独立尺寸

**Files:**
- Modify: `src/stores/packingStore.ts`

- [x] 移除多 SKU 公共尺寸强制同步。
- [x] 新增 SKU 时以当前单 SKU 默认尺寸作为初始值，但后续每个 SKU 独立更新。
- [x] 计算多 SKU 时直接传入 `skus.value`，不再映射成公共尺寸。

### Task 4: 多 SKU UI 改为卡片式异尺寸编辑

**Files:**
- Modify: `src/components/controls/SkuEditor.vue`
- Modify: `src/components/controls/SkuCard.vue`

- [x] 移除公共长宽高输入区。
- [x] 每个 SKU 卡片展示拖拽按钮、`SKU A/B/C/D/E`、目标数量、长、宽、高、颜色。
- [x] 桌面端一行一个卡片，数字字段在卡片内横向排布，窄屏下自动换成两列，保持文本不截断。
- [x] 保留浮动拖拽预览和 drop target 反馈，拖拽预览保持水平并显示 `SKU A` 文案。

### Task 5: 回归测试、README 与验证

**Files:**
- Modify: `tests/packing-e2e.spec.ts`
- Modify: `README.md`

- [x] 更新 E2E：断言多 SKU 下不存在公共尺寸输入，每个 SKU 行都有长宽高；拖拽后 A/B/C/D/E 与目标数量、长宽高一起移动。
- [x] 更新 README：多 SKU 改为支持异尺寸，最多 5 个，第一版只允许水平旋转。
- [x] 运行 `npm run test:unit`、`npm run build`、`npm run test:e2e`、`node tests/packing-core.test.js`、`node tests/app-visuals.test.js`、`git diff --check`。

### Task 6: 异尺寸结果统计修正

**Files:**
- Modify: `src/core/packing/index.ts`
- Modify: `src/components/results/ResultSummary.vue`
- Modify: `tests/packing-core.test.ts`
- Modify: `tests/packing-e2e.spec.ts`

- [x] 修正异尺寸路径的 `blockedByCornerTotal`，累加各 SKU 分区的角件避让数量。
- [x] 异尺寸结果面板将“每层数量 / 层数”改为“最大层级箱数 / 堆叠层级”，避免把不同 SKU 高度误解成统一物理层。
- [x] 补充核心算法和 E2E 回归测试。
