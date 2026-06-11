# Vue 3 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the static container packing calculator to a Vue 3 + Vite + TypeScript app while preserving all current packing behavior.

**Architecture:** Keep the current static app files during migration and add a Vue app under `src/`. Port the core packing logic to TypeScript as framework-independent modules, then build Vue components and renderer adapters around the typed core API. Use tests as the parity gate before replacing the old entry flow.

**Tech Stack:** Vue 3, Vite, TypeScript, Pinia, Vitest, Playwright, Three.js, Node.js.

---

## File Structure

- Create `package.json`: scripts and dependencies for Vite, Vue, TypeScript, Pinia, Vitest, Playwright, and Three.js.
- Create `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`: build configuration and Vue entry.
- Create `src/main.ts`, `src/App.vue`: Vue application bootstrap and shell.
- Create `src/core/packing/*`: TypeScript packing domain modules.
- Create `src/stores/packingStore.ts`: Pinia workflow state.
- Create `src/components/controls/*`: form, mode, SKU, and progress controls.
- Create `src/components/results/*`: summary and SKU breakdown components.
- Create `src/components/visualizations/*`: 2D and 3D canvas components.
- Create `src/renderers/plan2d.ts`, `src/renderers/cargo3d.ts`, `src/renderers/labels.ts`: imperative rendering adapters.
- Create `src/styles/*`: global CSS and design tokens.
- Create or migrate tests under `tests/*.test.ts` and `tests/*.spec.ts`.
- Preserve `app.js`, `packing-core.js`, `styles.css`, and the old static HTML content until Vue parity is verified.

## Task 1: Add Vite Vue Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Replace: `index.html`
- Create: `legacy/index.static.html`

- [ ] **Step 1: Move the current static HTML aside.**

Run: `mkdir -p legacy`

Run: `cp index.html legacy/index.static.html`

Expected: `legacy/index.static.html` contains the current static app shell for rollback/reference.

- [ ] **Step 2: Create `package.json`.**

```json
{
  "name": "stacking-sku",
  "version": "2.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test:unit": "vitest run",
    "test:e2e": "playwright test",
    "test": "npm run test:unit"
  },
  "dependencies": {
    "pinia": "latest",
    "three": "latest",
    "vue": "latest"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "latest",
    "@playwright/test": "latest",
    "@types/three": "latest",
    "jsdom": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest",
    "vue-tsc": "latest"
  }
}
```

- [ ] **Step 3: Create TypeScript config files.**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "tests/**/*.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`.**

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Replace `index.html` with the Vue entry.**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="纸箱装载量与排布可视化工具" />
    <link rel="icon" href="data:," />
    <title>智能集装箱装柜计算器</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Install dependencies.**

Run: `npm install`

Expected: `node_modules/` and `package-lock.json` are created.

- [ ] **Step 7: Commit tooling.**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts index.html legacy/index.static.html
git commit -m "chore: add vue vite tooling"
```

## Task 2: Port Packing Core to TypeScript

**Files:**
- Create: `src/core/packing/types.ts`
- Create: `src/core/packing/index.ts`
- Create: `tests/packing-core.test.ts`
- Keep: `packing-core.js`

- [ ] **Step 1: Create domain types in `src/core/packing/types.ts`.**

```ts
export type LoadingStrategy = "multi-destination" | "same-destination";

export interface ContainerSpec {
  id?: string;
  name?: string;
  length: number;
  width: number;
  height: number;
}

export interface CartonSpec {
  length: number;
  width: number;
  height: number;
}

export interface CornerBlockSpec {
  length: number;
  width: number;
  height: number;
}

export interface SkuInput extends CartonSpec {
  label: string;
  target: number;
  color: string;
}

export interface BoxPosition {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  orientation?: string;
  sequenceIndex?: number;
  faceIndex?: number;
  stackIndex?: number;
  skuLabel?: string;
  skuColor?: string;
}

export interface SkuSummary {
  label: string;
  target: number;
  loaded: number;
  shortfall: number;
  color: string;
}

export interface PackingOptions {
  cornerBlock?: CornerBlockSpec;
  strategy?: LoadingStrategy;
}

export interface PackingResult {
  container: ContainerSpec;
  carton: CartonSpec;
  cornerBlock: CornerBlockSpec;
  totalBoxes: number;
  perLayerBoxCount: number;
  usedHeight: number;
  utilizationRatio: number;
  blockedByCornerTotal: number;
  pattern: Record<string, unknown> | null;
  layers: Array<Record<string, unknown>>;
  orderedPositions?: BoxPosition[];
  skuSummary?: SkuSummary[];
  strategy?: LoadingStrategy;
}
```

- [ ] **Step 2: Port current `packing-core.js` into `src/core/packing/index.ts`.**

Use the existing implementation as the source of truth. Remove the UMD wrapper, export the public constants and functions, and add the types from `types.ts`.

Required exports:

```ts
export const CONTAINERS: Record<string, ContainerSpec> = {
  "20GP": { id: "20GP", name: "20GP", length: 5898, width: 2352, height: 2393 },
  "40GP": { id: "40GP", name: "40GP", length: 12032, width: 2352, height: 2393 },
  "40HQ": { id: "40HQ", name: "40HQ", length: 12032, width: 2352, height: 2698 },
};

export const LOADING_STRATEGIES = {
  MULTI_DESTINATION: "multi-destination",
  SAME_DESTINATION: "same-destination",
} as const;
```

The function signatures must be:

```ts
export function calculatePacking(
  containerInput: ContainerSpec,
  cartonInput: CartonSpec,
  options?: PackingOptions,
): PackingResult;

export function calculateMultiSkuPacking(
  containerInput: ContainerSpec,
  skus: SkuInput[],
  options?: PackingOptions,
): PackingResult;

export function generateBoxPositions(result: PackingResult, visibleCount?: number): BoxPosition[];

export function collidesCornerBlock(
  position: BoxPosition,
  container: ContainerSpec,
  cornerBlock: CornerBlockSpec,
): boolean;
```

- [ ] **Step 3: Port core tests to `tests/packing-core.test.ts`.**

Start from `tests/packing-core.test.js` and replace CommonJS imports with:

```ts
import { describe, expect, it } from "vitest";
import {
  CONTAINERS,
  calculateMultiSkuPacking,
  calculatePacking,
  collidesCornerBlock,
  generateBoxPositions,
} from "../src/core/packing";
```

Use `expect(...).toBe(...)`, `expect(...).toEqual(...)`, and `expect(() => ...).toThrow(...)`.

- [ ] **Step 4: Run TypeScript unit tests.**

Run: `npm run test:unit -- tests/packing-core.test.ts`

Expected: all ported packing tests pass, including `1340` and `1403`.

- [ ] **Step 5: Commit core port.**

```bash
git add src/core/packing tests/packing-core.test.ts
git commit -m "feat: port packing core to typescript"
```

## Task 3: Create Store and App Shell

**Files:**
- Create: `src/main.ts`
- Create: `src/App.vue`
- Create: `src/stores/packingStore.ts`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`

- [ ] **Step 1: Create `src/main.ts`.**

```ts
import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import "./styles/tokens.css";
import "./styles/global.css";

createApp(App).use(createPinia()).mount("#app");
```

- [ ] **Step 2: Create `src/stores/packingStore.ts`.**

```ts
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  CONTAINERS,
  LOADING_STRATEGIES,
  calculateMultiSkuPacking,
  calculatePacking,
  type CartonSpec,
  type ContainerSpec,
  type LoadingStrategy,
  type PackingResult,
  type SkuInput,
} from "../core/packing";

export type PackingMode = "single" | "multi";

export const usePackingStore = defineStore("packing", () => {
  const containerType = ref("20GP");
  const container = ref<ContainerSpec>({ ...CONTAINERS["20GP"] });
  const mode = ref<PackingMode>("single");
  const singleCarton = ref<CartonSpec>({ length: 480, width: 320, height: 260 });
  const singleColor = ref("#d8923a");
  const skuCount = ref(2);
  const strategy = ref<LoadingStrategy>(LOADING_STRATEGIES.MULTI_DESTINATION);
  const skus = ref<SkuInput[]>([
    { label: "A", length: 480, width: 320, height: 260, target: 100, color: "#d8923a" },
    { label: "B", length: 480, width: 320, height: 260, target: 100, color: "#42d6a4" },
  ]);
  const result = ref<PackingResult | null>(null);
  const visibleCount = ref(0);
  const status = ref("待计算");
  const error = ref("");

  const progressText = computed(() => {
    const total = result.value?.totalBoxes ?? 0;
    return `${visibleCount.value.toLocaleString("zh-CN")} / ${total.toLocaleString("zh-CN")}`;
  });

  function relabelSkus() {
    skus.value = skus.value.map((sku, index) => ({
      ...sku,
      label: String.fromCharCode(65 + index),
    }));
  }

  function setSkuCount(nextCount: number) {
    const count = Math.max(2, Math.min(10, Math.round(nextCount)));
    skuCount.value = count;
    while (skus.value.length < count) {
      const index = skus.value.length;
      skus.value.push({
        label: String.fromCharCode(65 + index),
        length: 480,
        width: 320,
        height: 260,
        target: 100,
        color: ["#d8923a", "#42d6a4", "#6e8bff", "#ff7066", "#b7e35f"][index % 5],
      });
    }
    skus.value = skus.value.slice(0, count);
    relabelSkus();
    markDirty();
  }

  function setContainerType(type: string) {
    containerType.value = type;
    container.value = { ...CONTAINERS[type] };
    markDirty();
  }

  function markDirty() {
    status.value = result.value ? "待重新计算" : "待计算";
  }

  function calculate() {
    error.value = "";
    try {
      const next =
        mode.value === "single"
          ? calculatePacking(container.value, singleCarton.value)
          : calculateMultiSkuPacking(container.value, skus.value, { strategy: strategy.value });
      result.value = next;
      visibleCount.value = next.totalBoxes;
      status.value = next.totalBoxes > 0 ? "已完成计算" : "无法装载";
    } catch (caught) {
      result.value = null;
      visibleCount.value = 0;
      status.value = "计算失败";
      error.value = caught instanceof Error ? caught.message : "计算失败";
    }
  }

  return {
    containerType,
    container,
    mode,
    singleCarton,
    singleColor,
    skuCount,
    strategy,
    skus,
    result,
    visibleCount,
    status,
    error,
    progressText,
    calculate,
    markDirty,
    relabelSkus,
    setContainerType,
    setSkuCount,
  };
});
```

- [ ] **Step 3: Create minimal global styles.**

`src/styles/tokens.css`:

```css
:root {
  color-scheme: dark;
  --bg: #0a1118;
  --panel: #151d27;
  --panel-strong: #101821;
  --line: rgba(255, 255, 255, 0.14);
  --text: #f5f7fb;
  --muted: #aeb8c9;
  --accent: #42d6a4;
  --warning: #ffbe55;
  --danger: #ff7066;
}
```

`src/styles/global.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button,
input,
select {
  font: inherit;
}

canvas {
  display: block;
}
```

- [ ] **Step 4: Create `src/App.vue` with the migration shell.**

```vue
<script setup lang="ts">
import { usePackingStore } from "./stores/packingStore";

const store = usePackingStore();
</script>

<template>
  <main class="app-shell">
    <aside class="control-panel">
      <h1>智能装柜助手</h1>
      <p>Vue 迁移版正在保持旧版功能等价。</p>
      <button type="button" @click="store.calculate">计算装载</button>
      <p v-if="store.error" class="error">{{ store.error }}</p>
    </aside>
    <section class="workbench">
      <header>
        <span>{{ store.status }}</span>
        <strong>{{ store.progressText }}</strong>
      </header>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr);
  gap: 18px;
  padding: 18px;
}

.control-panel,
.workbench {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  padding: 18px;
}

.error {
  color: var(--danger);
}
</style>
```

- [ ] **Step 5: Run build and tests.**

Run: `npm run build`

Expected: TypeScript and Vite build succeed.

Run: `npm run test:unit`

Expected: packing tests pass.

- [ ] **Step 6: Commit shell.**

```bash
git add src
git commit -m "feat: add vue app shell"
```

## Task 4: Build Control and Result Components

**Files:**
- Create: `src/components/controls/ContainerForm.vue`
- Create: `src/components/controls/PackingModeSwitch.vue`
- Create: `src/components/controls/SingleSkuForm.vue`
- Create: `src/components/controls/SkuEditor.vue`
- Create: `src/components/controls/SkuCard.vue`
- Create: `src/components/controls/ProgressControl.vue`
- Create: `src/components/results/ResultSummary.vue`
- Create: `src/components/results/SkuBreakdown.vue`
- Modify: `src/App.vue`
- Modify: `src/stores/packingStore.ts`

- [ ] **Step 1: Implement controlled form components.**

Each component should read and mutate the Pinia store directly for this parity release. Keep inputs equivalent to the current static app.

`ContainerForm.vue` must expose the `20GP`, `40GP`, and `40HQ` presets, and editable length/width/height fields.

`PackingModeSwitch.vue` must expose radio controls for `single` and `multi`.

`SingleSkuForm.vue` must expose length/width/height and color inputs, with no target quantity.

`SkuEditor.vue` must expose SKU count `2-10`, strategy select, and `SkuCard` list.

`SkuCard.vue` must expose length/width/height/target/color and drag handle.

`ProgressControl.vue` must expose range input from `0` to `result.totalBoxes`.

- [ ] **Step 2: Implement drag sorting in `SkuEditor.vue`.**

Use HTML drag events and the store's `relabelSkus()` after every reorder. The displayed order must remain `SKU A`, `SKU B`, `SKU C`.

- [ ] **Step 3: Implement result components.**

`ResultSummary.vue` must show total boxes, per-layer count, layer count, used height, utilization, pattern, occupied length, occupied width, and corner avoidance count.

`SkuBreakdown.vue` must show loaded/target/shortfall and color swatches when `mode === "multi"`.

- [ ] **Step 4: Wire components into `App.vue`.**

The app shell should contain the same functional areas as the static app:

- Control panel
- Calculate button
- Result summary
- Progress strip
- 2D panel placeholder
- 3D panel placeholder

- [ ] **Step 5: Run build and unit tests.**

Run: `npm run build && npm run test:unit`

Expected: build succeeds and core tests pass.

- [ ] **Step 6: Commit controls and results.**

```bash
git add src/components src/App.vue src/stores/packingStore.ts
git commit -m "feat: add vue controls and result panels"
```

## Task 5: Port 2D Renderer

**Files:**
- Create: `src/renderers/plan2d.ts`
- Create: `src/components/visualizations/Plan2DView.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Extract the current 2D drawing behavior into `src/renderers/plan2d.ts`.**

The exported function must be:

```ts
import type { PackingResult } from "../core/packing";

export interface Plan2DRenderOptions {
  canvas: HTMLCanvasElement;
  result: PackingResult | null;
  visibleCount: number;
  devicePixelRatio?: number;
}

export function renderPlan2D(options: Plan2DRenderOptions): void;
```

Port these existing `app.js` responsibilities into private helpers inside `plan2d.ts`:

- `resizeCanvas`
- `drawRoundedRect`
- `drawCanvasMessage`
- `colorForBox`
- the 2D portions of `drawPlanView`

The resulting `renderPlan2D` must draw an empty state when no result exists, current layer label, door direction, inner-corner direction, corner-fitting avoidance zone, visible boxes by SKU color, and length/width dimension labels.

- [ ] **Step 2: Create `Plan2DView.vue`.**

It should watch `store.result` and `store.visibleCount`, resize the canvas to the panel, and call `renderPlan2D`.

- [ ] **Step 3: Add `Plan2DView` to `App.vue`.**

Replace the 2D placeholder panel with the component.

- [ ] **Step 4: Browser-check the canvas manually.**

Run: `npm run dev -- --host 127.0.0.1`

Open local app and confirm the 2D canvas is nonblank after calculation.

- [ ] **Step 5: Commit 2D renderer.**

```bash
git add src/renderers/plan2d.ts src/components/visualizations/Plan2DView.vue src/App.vue
git commit -m "feat: port 2d plan renderer"
```

## Task 6: Port 3D Renderer

**Files:**
- Create: `src/renderers/cargo3d.ts`
- Create: `src/renderers/labels.ts`
- Create: `src/components/visualizations/Cargo3DView.vue`
- Modify: `src/App.vue`
- Modify: `tests/app-visuals.test.ts`

- [ ] **Step 1: Extract Three.js label helpers into `src/renderers/labels.ts`.**

Export:

```ts
import * as THREE from "three";

export function makeSpriteLabel(
  text: string,
  color = "#f5f7fb",
  scaleWidth = 1.5,
  scaleHeight = 0.38,
): THREE.Sprite;
```

Port the current `makeThreeLabel` canvas texture implementation from `app.js`, including disabled depth testing and `renderOrder = 30`.

- [ ] **Step 2: Extract Three.js rendering into `src/renderers/cargo3d.ts`.**

Export:

```ts
import type { PackingResult } from "../core/packing";

export interface CargoScene {
  dispose(): void;
  render(result: PackingResult | null, visibleCount: number): void;
  resize(): void;
}

export function createCargoScene(canvas: HTMLCanvasElement): CargoScene {
  // Public factory; private helpers inside the file own scene setup and updates.
}
```

Port these existing `app.js` responsibilities into private helpers inside `cargo3d.ts`:

- `ensureThreeScene`
- `resizeThreeRenderer`
- `clearThreeModel`
- `disposeThreeObject`
- `addThreeDoorMarker`
- `addThreeContainer`
- `addThreeBoxes`
- `updateThreeCamera`
- `renderThreeFrame`
- `setupSceneControls`

Keep the confirmed color behavior:

- Cargo boxes grouped by direct material color.
- Cargo faces use double-sided basic material.
- Cargo wireframe is pale and low opacity.
- Container shell opacity does not darken cargo.
- Door marker remains visible.

- [ ] **Step 3: Create `Cargo3DView.vue`.**

It should create the scene on mount, call `scene.render(...)` when result or visible count changes, call `scene.resize()` on resize, and dispose on unmount.

- [ ] **Step 4: Update `tests/app-visuals.test.ts`.**

Port the existing static source checks so they inspect `src/renderers/cargo3d.ts`.

- [ ] **Step 5: Run tests and browser-check 3D.**

Run: `npm run test:unit`

Run: `npm run dev -- --host 127.0.0.1`

Confirm 3D shows SKU-colored cargo, door marker, and red corner fittings.

- [ ] **Step 6: Commit 3D renderer.**

```bash
git add src/renderers/cargo3d.ts src/renderers/labels.ts src/components/visualizations/Cargo3DView.vue src/App.vue tests/app-visuals.test.ts
git commit -m "feat: port 3d cargo renderer"
```

## Task 7: Add E2E Parity Tests

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/packing-e2e.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Create `playwright.config.ts`.**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.ts/,
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```

- [ ] **Step 2: Create `tests/packing-e2e.spec.ts`.**

Use this test shape and adjust selectors only if component markup names differ:

```ts
import { expect, test } from "@playwright/test";

test("matches core packing parity cases and renders canvases", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "智能装柜助手" })).toBeVisible();

  await page.locator("#container-type").selectOption("40HQ");
  await page.locator("#carton-length").fill("488");
  await page.locator("#carton-width").fill("380");
  await page.locator("#carton-height").fill("291");
  await page.getByRole("button", { name: "计算装载" }).click();
  await expect(page.locator("#total-boxes")).toHaveText("1,340");

  await page.locator("#carton-width").fill("360");
  await page.getByRole("button", { name: "计算装载" }).click();
  await expect(page.locator("#total-boxes")).toHaveText("1,403");

  await page.locator("input[name='packing-mode'][value='multi']").check();
  await page.locator("#sku-count").fill("3");
  await page.locator("#sku-count").dispatchEvent("input");
  await expect(page.locator(".sku-card")).toHaveCount(3);

  await expect(page.locator("#plan-canvas")).toBeVisible();
  await expect(page.locator("#scene-canvas")).toBeVisible();
  expect(pageErrors).toEqual([]);
});
```

- [ ] **Step 3: Run E2E tests.**

Run: `npm run test:e2e`

Expected: all browser tests pass.

- [ ] **Step 4: Commit E2E tests.**

```bash
git add playwright.config.ts tests/packing-e2e.spec.ts package.json package-lock.json
git commit -m "test: add vue parity browser tests"
```

## Task 8: Static Build Verification and Cleanup

**Files:**
- Modify: `README.md` if it exists, otherwise create `docs/vue-build-and-deploy.md`
- Keep: legacy static files until final parity review

- [ ] **Step 1: Run full verification.**

Run: `npm run build`

Run: `npm run test:unit`

Run: `npm run test:e2e`

Expected: build and all tests pass.

- [ ] **Step 2: Preview production build.**

Run: `npm run preview -- --host 127.0.0.1`

Open `http://127.0.0.1:4173` or the printed preview URL.

Expected: built app works and returns the same parity results.

- [ ] **Step 3: Document static deployment.**

Create `docs/vue-build-and-deploy.md`:

```md
# Vue Build and Static Deployment

Run:

```bash
npm install
npm run build
```

The static app is generated in `dist/`.

Deploy the contents of `dist/` to any static host:

- Nginx
- OSS/COS + CDN
- Cloudflare Pages
- GitHub Pages
- Netlify
- Vercel

The app does not require a server runtime.
```

- [ ] **Step 4: Commit final verification docs.**

```bash
git add docs/vue-build-and-deploy.md
git commit -m "docs: add vue static deployment notes"
```
