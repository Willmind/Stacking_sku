# 纸箱坐标表第一阶段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增“查看坐标”第一阶段能力，输出每个纸箱的编号、柜门面中心点坐标、上表面中心点坐标和基础属性，并支持 CSV 导出。

**Architecture:** 坐标计算放在 `src/core/boxCoordinates.ts`，只依赖最终 `PackingResult`，不改装载算法。界面新增 `CoordinateDialog.vue`，通过 Pinia store 读取当前结果，弹窗展示坐标表并导出 CSV。3D 高亮、机器人姿态、路径规划暂不进入第一阶段。

**Tech Stack:** Vue 3、Pinia、TypeScript、现有 `BaseDialog`、Vitest、Playwright。

---

### Task 1: 核心坐标数据

**Files:**
- Create: `src/core/boxCoordinates.ts`
- Test: `tests/box-coordinates.test.ts`

- [ ] **Step 1: Write the failing test**

新增测试：使用无角件自定义柜体 `400 x 200 x 200 mm` 和纸箱 `200 x 100 x 100 mm`，断言坐标序号按“长度靠里到柜门、底层到上层、左到右”输出；第 1 箱的朝柜门面中心点为 `X=50, Y=200, Z=50`，上表面中心点为 `X=50, Y=100, Z=100`。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/box-coordinates.test.ts`
Expected: FAIL，因为 `src/core/boxCoordinates.ts` 不存在。

- [ ] **Step 3: Write minimal implementation**

实现：
- `createBoxCoordinateRows(result)`：返回坐标行。
- `createBoxCoordinateCsv(rows)`：返回带 UTF-8 BOM 的 CSV 字符串。
- 坐标系：站在柜门外面向柜内，X 向右，Y 向柜门，Z 向上，单位 mm。
- 朝柜门面中心点：`X = box.y + box.dy / 2`，`Y = box.x + box.dx`，`Z = box.z + box.dz / 2`。
- 上表面中心点：`X = box.y + box.dy / 2`，`Y = box.x + box.dx / 2`，`Z = box.z + box.dz`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/box-coordinates.test.ts`
Expected: PASS。

### Task 2: 查看坐标弹窗

**Files:**
- Create: `src/components/results/CoordinateDialog.vue`
- Modify: `src/App.vue`
- Test: `tests/app-visuals.test.ts`

- [ ] **Step 1: Write the failing source guard**

在 `tests/app-visuals.test.ts` 中断言：
- `App.vue` 渲染 `<CoordinateDialog />`
- `CoordinateDialog.vue` 包含 `查看坐标`、`导出 CSV`、`坐标系`、`createBoxCoordinateRows`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/app-visuals.test.ts -t "coordinate"`
Expected: FAIL，因为组件还不存在且 App 未引用。

- [ ] **Step 3: Write minimal implementation**

实现坐标弹窗：
- 结果存在且 `totalBoxes > 0` 时可点击“查看坐标”。
- 弹窗展示坐标表，包含序号、装载顺序、SKU、柜门面 X/Y/Z、上表面 X/Y/Z、中心点 X/Y/Z、层、排、列、朝向。
- 支持“导出 CSV”。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/app-visuals.test.ts -t "coordinate"`
Expected: PASS。

### Task 3: 浏览器流程验证

**Files:**
- Modify: `tests/packing-e2e.spec.ts`

- [ ] **Step 1: Write failing e2e test**

新增或扩展计算结果测试：
- 点击“计算装载”。
- 点击“查看坐标”。
- 断言弹窗可见，表格包含 `序号`、`X`、`Y`、`Z`。
- 点击“导出 CSV”，断言下载文件包含坐标表头。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- tests/packing-e2e.spec.ts -g "coordinate"`
Expected: FAIL，直到弹窗和下载实现完成。

- [ ] **Step 3: Complete implementation and polish**

确保弹窗在桌面和窄屏下表格可滚动，按钮文案明确，不引入 3D 全量编号。

- [ ] **Step 4: Run targeted and full verification**

Run:
- `npm run test:unit`
- `npm run build`
- `npm run test:e2e -- tests/packing-e2e.spec.ts -g "coordinate"`

Expected:
- unit/build/targeted e2e PASS。
- 如果完整 e2e 仍有既有无关失败，最终说明失败项和本次功能关系。
