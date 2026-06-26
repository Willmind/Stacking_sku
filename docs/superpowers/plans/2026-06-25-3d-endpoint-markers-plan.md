# 3D Endpoint Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 3D 货柜的 `柜门`、`角件端` 和坐标轴标识清晰、稳定，并通过端面颜色和图例提升方向识别效率。

**Architecture:** `cargoSceneModel.ts` 输出端点几何和标签锚点，`Cargo3DSceneV2.vue` 继续负责 TresJS 场景渲染，并新增 HTML/CSS 投影标签层和固定图例。首页卡片、放大弹框、坐标弹框继续复用同一个 3D 组件。

**Tech Stack:** Vue 3、TresJS、Three.js、TypeScript、Vitest、Playwright。

---

### Task 1: 场景模型端点数据

**Files:**
- Modify: `src/renderers/cargoSceneModel.ts`
- Test: `tests/cargo-scene-model.test.ts`

- [ ] **Step 1: Write the failing test**

在 `tests/cargo-scene-model.test.ts` 的容器测试中断言：

```ts
assert.deepEqual(
  container.endpointSurfaces.map((surface) => ({
    key: surface.key,
    label: surface.label,
    color: surface.color,
    position: surface.position,
  })),
  [
    { key: "inner-end-surface", label: "角件端", color: "#ffb24a", position: [-6.004, 0, 0] },
    { key: "door-end-surface", label: "柜门", color: "#42d6a4", position: [6.004, 0, 0] },
  ],
);
assert.deepEqual(container.endpointLegend, [
  { key: "door-end", label: "柜门", color: "#42d6a4" },
  { key: "inner-end", label: "角件端", color: "#ffb24a" },
]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/cargo-scene-model.test.ts`

Expected: FAIL because `endpointSurfaces` and `endpointLegend` do not exist.

- [ ] **Step 3: Write minimal implementation**

在 `SceneContainerModel` 中加入 `endpointSurfaces` 和 `endpointLegend`，并在 `toSceneContainer` 中输出两端半透明端面的位置、尺寸、颜色和图例。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/cargo-scene-model.test.ts`

Expected: PASS.

### Task 2: TresJS 端面和图例

**Files:**
- Modify: `src/components/visualizations/Cargo3DSceneV2.vue`
- Test: `tests/app-visuals.test.ts`

- [ ] **Step 1: Write the failing test**

在 `tests/app-visuals.test.ts` 中断言 `Cargo3DSceneV2.vue` 包含：

```ts
assert.match(cargo3dSceneV2Source, /endpoint-surface/);
assert.match(cargo3dSceneV2Source, /endpoint-legend/);
assert.match(cargo3dSceneV2Source, /projection-label-layer/);
assert.doesNotMatch(cargo3dSceneV2Source, /endpointLabels\.forEach\(\(label\) => addSpriteLabel/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/app-visuals.test.ts`

Expected: FAIL because the new endpoint surface, legend and projection label layer are not implemented.

- [ ] **Step 3: Write minimal implementation**

渲染 `sceneContainer.endpointSurfaces` 为半透明端面和细边框；添加右下角 `.endpoint-legend`；用绝对定位 `.projection-label-layer` 承载投影标签。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/app-visuals.test.ts`

Expected: PASS.

### Task 3: 交互和完整验证

**Files:**
- Test: `tests/packing-e2e.spec.ts`

- [ ] **Step 1: Run focused tests**

Run: `npm run test:unit -- tests/cargo-scene-model.test.ts tests/app-visuals.test.ts`

Expected: PASS.

- [ ] **Step 2: Run e2e coverage**

Run: `npm run test:e2e -- tests/packing-e2e.spec.ts -g "opens expanded dialogs for 2D and 3D visualizations|shows and downloads the carton coordinate table|calculates the 488 x 380 x 291 benchmark and renders both views"`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

