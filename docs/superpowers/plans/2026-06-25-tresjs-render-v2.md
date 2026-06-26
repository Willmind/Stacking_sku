# TresJS 3D 渲染 V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有手写 Three.js 3D 渲染层迁移为 TresJS + Cientos 的 Vue 组件化渲染原型，优先解决文字标签清晰度、3D 交互可维护性和后续坐标/箱号扩展问题。

**Architecture:** 保留现有码垛算法、Pinia 状态、坐标计算和 2D 渲染不变，只替换 3D 表达层。新增 `Cargo3DSceneV2.vue` 承载 TresJS 场景，`Cargo3DView.vue` 负责卡片、弹框和 V1/V2 切换边界，数据仍来自 `generateBoxPositions()` 和 `packingStore`。

**Tech Stack:** Vue 3、Vite、Pinia、Three.js、TresJS、Cientos、TypeScript、Vitest、Playwright。

**执行结果:** 已在 `codex/tresjs-render-v2` 分支完成第一阶段迁移：主 3D 卡片接入 TresJS V2，箱体数据通过 `cargoSceneModel` 适配，主图文字标识改为清晰 DOM 覆盖层；展开 3D 弹框和坐标弹框预览仍保留旧 `cargo3d.ts`，作为下一阶段迁移边界。

---

### Task 1: 依赖与 Vite 配置

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Test: `tests/app-visuals.test.ts`

- [x] **Step 1: 写失败测试**

在 `tests/app-visuals.test.ts` 增加配置守护：

```ts
it("configures TresJS for Vue-rendered 3D scenes", () => {
  assert.match(viteConfigSource, /templateCompilerOptions/);
  assert.match(viteConfigSource, /@tresjs\/core/);
  assert.match(packageSource, /"@tresjs\/core"/);
  assert.match(packageSource, /"@tresjs\/cientos"/);
});
```

- [x] **Step 2: 跑测试确认失败**

Run: `npm run test:unit -- tests/app-visuals.test.ts -t "TresJS"`

Expected: FAIL，提示 `templateCompilerOptions` 或 `@tresjs/core` 不存在。

- [x] **Step 3: 安装依赖**

Run: `npm install @tresjs/core @tresjs/cientos`

Expected: `package.json` 和 `package-lock.json` 出现 `@tresjs/core`、`@tresjs/cientos`。

- [x] **Step 4: 配置 Vite**

将 `vite.config.ts` 改为：

```ts
import { templateCompilerOptions } from "@tresjs/core";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "./",
  plugins: [vue({ ...templateCompilerOptions })],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [x] **Step 5: 验证**

Run: `npm run test:unit -- tests/app-visuals.test.ts -t "TresJS"`

Expected: PASS。

---

### Task 2: 提取 3D 数据适配层

**Files:**
- Create: `src/renderers/cargoSceneModel.ts`
- Test: `tests/cargo-scene-model.test.ts`

- [x] **Step 1: 写失败测试**

创建 `tests/cargo-scene-model.test.ts`：

```ts
import assert from "node:assert/strict";
import { describe, it } from "vitest";

describe("cargo scene model", () => {
  it("maps packing positions to Three/Tres scene coordinates", async () => {
    const module = await import("../src/renderers/cargoSceneModel");
    const box = module.toSceneBox(
      {
        x: 0,
        y: 0,
        z: 0,
        dx: 500,
        dy: 400,
        dz: 300,
        sequenceIndex: 0,
        skuLabel: "SKU-1",
        skuColor: "#d8923a",
      },
      { length: 12000, width: 2400, height: 2600 },
    );

    assert.deepEqual(box.position, [-5.75, -1.15, -1]);
    assert.deepEqual(box.scale, [0.496, 0.298, 0.397]);
    assert.equal(box.label, "SKU-1");
    assert.equal(box.color, "#d8923a");
  });
});
```

- [x] **Step 2: 跑测试确认失败**

Run: `npm run test:unit -- tests/cargo-scene-model.test.ts`

Expected: FAIL，提示找不到 `cargoSceneModel`。

- [x] **Step 3: 实现适配层**

创建 `src/renderers/cargoSceneModel.ts`：

```ts
import type { BoxPosition, PackingResult } from "../core/packing";

export interface SceneBoxModel {
  key: string;
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  label: string;
  loadingSequence: number;
}

export function toSceneBox(box: BoxPosition, container: Pick<PackingResult["container"], "length" | "width" | "height">): SceneBoxModel {
  return {
    key: `${box.sequenceIndex ?? 0}-${box.x}-${box.y}-${box.z}`,
    position: [
      Math.round((box.x + box.dx / 2 - container.length / 2) * 1000) / 1000000,
      Math.round((box.z + box.dz / 2 - container.height / 2) * 1000) / 1000000,
      Math.round((box.y + box.dy / 2 - container.width / 2) * 1000) / 1000000,
    ],
    scale: [
      Math.max(box.dx * 0.001 * 0.992, 0.001),
      Math.max(box.dz * 0.001 * 0.992, 0.001),
      Math.max(box.dy * 0.001 * 0.992, 0.001),
    ],
    color: box.skuColor || "#d8923a",
    label: box.skuLabel || "",
    loadingSequence: (box.sequenceIndex ?? 0) + 1,
  };
}
```

- [x] **Step 4: 验证**

Run: `npm run test:unit -- tests/cargo-scene-model.test.ts`

Expected: PASS。

---

### Task 3: 新增 TresJS 场景组件骨架

**Files:**
- Create: `src/components/visualizations/Cargo3DSceneV2.vue`
- Modify: `src/components/visualizations/Cargo3DView.vue`
- Test: `tests/app-visuals.test.ts`

- [x] **Step 1: 写失败测试**

在 `tests/app-visuals.test.ts` 增加源码守护：

```ts
it("renders the cargo scene through a TresJS V2 component", () => {
  assert.match(cargo3dViewSource, /Cargo3DSceneV2/);
  assert.match(cargo3dSceneV2Source, /TresCanvas/);
  assert.match(cargo3dSceneV2Source, /OrbitControls|CameraControls/);
  assert.match(cargo3dSceneV2Source, /Html/);
});
```

- [x] **Step 2: 跑测试确认失败**

Run: `npm run test:unit -- tests/app-visuals.test.ts -t "TresJS V2"`

Expected: FAIL，提示 `Cargo3DSceneV2` 不存在。

- [x] **Step 3: 创建组件骨架**

`Cargo3DSceneV2.vue` 先只渲染背景、灯光、一个空场景和清晰 DOM 标签锚点：

```vue
<script setup lang="ts">
import { computed } from "vue";
import { TresCanvas } from "@tresjs/core";
import { Html, OrbitControls } from "@tresjs/cientos";
import type { PackingResult } from "../../core/packing";

const props = defineProps<{
  result: PackingResult | null;
  visibleCount: number;
}>();

const hasResult = computed(() => Boolean(props.result?.pattern));
</script>

<template>
  <TresCanvas clear-color="#071016" class="cargo-scene-v2-canvas">
    <TresPerspectiveCamera :position="[8, 5, 8]" :look-at="[0, 0, 0]" />
    <OrbitControls />
    <TresAmbientLight :intensity="0.72" />
    <TresDirectionalLight :position="[5, 8, 6]" :intensity="1.18" />
    <Html v-if="hasResult" :position="[0, 0, 0]" center>
      <span class="cargo-scene-v2-label">3D V2</span>
    </Html>
  </TresCanvas>
</template>
```

- [x] **Step 4: 接入主卡片**

在 `Cargo3DView.vue` 中临时替换主 canvas 为：

```vue
<Cargo3DSceneV2 :result="store.result" :visible-count="store.visibleCount" />
```

保留旧版 `VisualizationDialog` 暂不迁移，确保迁移范围可控。

- [x] **Step 5: 验证**

Run: `npm run test:unit -- tests/app-visuals.test.ts -t "TresJS V2"`

Expected: PASS。

---

### Task 4: 浏览器验证 V2 不空白

**Files:**
- Modify: `tests/packing-e2e.spec.ts`

- [x] **Step 1: 写失败测试**

将现有主 3D canvas 检查从 `#scene-canvas` 扩展为兼容 `.cargo-scene-v2-canvas canvas`：

```ts
await expect(page.locator(".cargo-scene-v2-canvas canvas")).toHaveCount(1);
```

- [x] **Step 2: 跑测试确认失败或通过现状**

Run: `npm run test:e2e -- tests/packing-e2e.spec.ts -g "488 x 380"`

Expected: 在组件接入前 FAIL；接入后 PASS。

- [x] **Step 3: 验证构建**

Run: `npm run build`

Expected: `vue-tsc --noEmit && vite build` exit 0。

---

### Task 5: 停止点与评审

**Files:**
- Modify: `docs/superpowers/plans/2026-06-25-tresjs-render-v2.md`

- [x] **Step 1: 汇总迁移状态**

在最终回复中说明：

```text
已完成独立分支、依赖接入、Vite 配置、V2 场景骨架和最小浏览器验证。
旧版坐标弹框与展开 3D 暂未迁移。
下一阶段再迁移箱体实例、DOM 标签、坐标轴和坐标弹框预览。
```

- [x] **Step 2: 验证命令**

Run:

```bash
npm run test:unit
npm run build
npm run test:e2e -- tests/packing-e2e.spec.ts -g "488 x 380|carton coordinate"
```

Expected: 单元和构建通过；目标 e2e 通过。

- [x] **Step 3: 提交**

```bash
git add package.json package-lock.json vite.config.ts src/components/visualizations/Cargo3DSceneV2.vue src/components/visualizations/Cargo3DView.vue src/renderers/cargoSceneModel.ts tests/app-visuals.test.ts tests/cargo-scene-model.test.ts tests/packing-e2e.spec.ts docs/superpowers/plans/2026-06-25-tresjs-render-v2.md
git commit -m "feat(render): 启动 TresJS 3D 渲染 V2"
```

---

## 自检

- 覆盖范围：依赖、Vite 配置、数据适配层、V2 场景骨架、浏览器非空验证。
- 不做范围：不重写码垛算法，不迁移 2D，不一次性删除 `cargo3d.ts`，不一次性完成坐标弹框 V2。
- 风险：TresJS/Cientos 依赖体积和 API 细节需要通过构建验证；若 Cientos `Html` API 与示例不同，优先按官方文档调整组件。
