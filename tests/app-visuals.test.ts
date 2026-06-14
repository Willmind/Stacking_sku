import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";

const rendererSource = fs.readFileSync(path.join(__dirname, "..", "src/renderers/cargo3d.ts"), "utf8");
const plan2dSource = fs.readFileSync(path.join(__dirname, "..", "src/renderers/plan2d.ts"), "utf8");
const plan2dViewSource = fs.readFileSync(
  path.join(__dirname, "..", "src/components/visualizations/Plan2DView.vue"),
  "utf8",
);
const batchImportDialogSource = fs.readFileSync(
  path.join(__dirname, "..", "src/components/controls/BatchImportDialog.vue"),
  "utf8",
);
const baseSelectSource = fs.readFileSync(path.join(__dirname, "..", "src/components/ui/BaseSelect.vue"), "utf8");
const singleSkuFormSource = fs.readFileSync(
  path.join(__dirname, "..", "src/components/controls/SingleSkuForm.vue"),
  "utf8",
);
const skuCardSource = fs.readFileSync(path.join(__dirname, "..", "src/components/controls/SkuCard.vue"), "utf8");

describe("3D visual rendering source guards", () => {
  it("keeps cargo colors visible in 3D", () => {
    const edgeMaterialMatch = rendererSource.match(
      /const edgeMaterial = new THREE\.MeshBasicMaterial\(\{([\s\S]*?)\n  \}\);/,
    );
    const shellMaterialMatch = rendererSource.match(
      /const shell = new THREE\.Mesh\([\s\S]*?new THREE\.MeshBasicMaterial\(\{([\s\S]*?)\n    \}\),/,
    );
    const boxMaterialMatch = rendererSource.match(
      /const material = new THREE\.MeshBasicMaterial\(\{([\s\S]*?)\n    \}\);/,
    );

    assert.ok(edgeMaterialMatch, "3D box edge material should be present");
    assert.ok(shellMaterialMatch, "3D container shell material should be present");
    assert.ok(boxMaterialMatch, "3D box face material should be present");

    const edgeMaterialSource = edgeMaterialMatch[1];
    const shellMaterialSource = shellMaterialMatch[1];
    const boxMaterialSource = boxMaterialMatch[1];
    const colorMatch = edgeMaterialSource.match(/color:\s*0x([0-9a-fA-F]{6})/);
    const opacityMatch = edgeMaterialSource.match(/opacity:\s*([0-9.]+)/);
    const shellOpacityMatch = shellMaterialSource.match(/opacity:\s*([0-9.]+)/);

    assert.ok(colorMatch, "3D box edge material should declare a color");
    assert.ok(opacityMatch, "3D box edge material should declare opacity");
    assert.ok(shellOpacityMatch, "3D container shell should declare opacity");
    assert.notEqual(colorMatch[1].toLowerCase(), "020202", "3D box edges should not be near-black");
    assert.ok(Number(opacityMatch[1]) <= 0.12, "3D box edges should not overpower SKU colors");
    assert.ok(Number(shellOpacityMatch[1]) <= 0.02, "3D container shell should not darken cargo colors");
    assert.match(boxMaterialSource, /side:\s*THREE\.DoubleSide/);
    assert.doesNotMatch(boxMaterialSource, /vertexColors:\s*true/);
    assert.doesNotMatch(boxMaterialSource, /transparent:\s*true/);
  });
});

describe("2D plan source guards", () => {
  it("keeps group labels out of the cargo drawing area", () => {
    assert.doesNotMatch(
      plan2dSource,
      /ctx\.fillText\(`\$\{group\.label\}[^`]*(?:占长|占宽)/,
      "2D group labels should not be drawn over cargo boxes",
    );
  });

  it("shows group labels in an external summary area", () => {
    assert.match(plan2dViewSource, /plan-group-summary/);
    assert.match(plan2dViewSource, /groupSummary/);
    assert.match(plan2dViewSource, /占长|占宽/);
  });
});

describe("batch import UI source guards", () => {
  it("keeps loading feedback and dialog motion on the batch import flow", () => {
    assert.match(batchImportDialogSource, /const isImporting = ref\(false\)/);
    assert.match(batchImportDialogSource, /:disabled="isImporting"/);
    assert.match(batchImportDialogSource, /解析中\.\.\./);
    assert.match(batchImportDialogSource, /batch-import-spinner/);
    assert.match(batchImportDialogSource, /@keyframes batch-import-spin/);
    assert.match(batchImportDialogSource, /<Transition name="batch-import-loading"/);
    assert.match(batchImportDialogSource, /v-if="isImporting" class="batch-import-loading"/);
    assert.match(batchImportDialogSource, /role="status"/);
    assert.match(batchImportDialogSource, /正在解析 Excel/);
    assert.match(batchImportDialogSource, /\.batch-import-loading\s*\{/);
    assert.match(batchImportDialogSource, /position:\s*fixed/);
    assert.match(batchImportDialogSource, /\.batch-import-loading-card/);
    assert.match(batchImportDialogSource, /\.batch-import-loading-enter-active/);
    assert.match(batchImportDialogSource, /<Transition name="batch-dialog-overlay"/);
    assert.match(batchImportDialogSource, /<Transition name="batch-dialog-content"/);
    assert.match(batchImportDialogSource, /\.batch-dialog-content-enter-active/);
    assert.match(batchImportDialogSource, /\.batch-dialog-content-leave-active/);
  });

  it("highlights only negative batch import differences as danger chips", () => {
    assert.match(batchImportDialogSource, /item\.difference !== null && item\.difference < 0/);
    assert.match(batchImportDialogSource, /negative-difference-chip/);
    assert.match(batchImportDialogSource, /\.negative-difference-chip\s*\{/);
    assert.match(batchImportDialogSource, /rgba\(255,\s*112,\s*102,\s*0\.1\)/);
    assert.match(batchImportDialogSource, /#ff8a80/);
  });
});

describe("select UI source guards", () => {
  it("keeps described select triggers visually stable while options are selected", () => {
    assert.match(baseSelectSource, /base-select-trigger--with-description/);
    assert.match(baseSelectSource, /\.base-select-trigger--with-description\s*\{[\s\S]*height:\s*58px/);
    assert.match(baseSelectSource, /\.base-select-trigger-description\s*\{[\s\S]*min-height:\s*14px/);
    assert.doesNotMatch(
      baseSelectSource,
      /\.base-select-trigger:active\s*\{[^}]*transform:\s*translateY/,
      "Select trigger active state should not shift vertically during option selection",
    );
    assert.doesNotMatch(
      baseSelectSource,
      /\bSelectValue\b/,
      "Select trigger should render its own stable label instead of mirroring SelectItemText during close",
    );
    assert.match(baseSelectSource, /function deferValueUpdate/);
    assert.match(baseSelectSource, /window\.setTimeout/);
    assert.doesNotMatch(baseSelectSource, /animation:\s*select-pop/);
  });
});

describe("color picker source guards", () => {
  it("uses the same carton color picker class for single and multi SKU controls", () => {
    assert.match(singleSkuFormSource, /class="carton-color"/);
    assert.match(skuCardSource, /class="carton-color"/);
    assert.match(singleSkuFormSource, /\.carton-color\s*\{/);
    assert.match(skuCardSource, /\.carton-color\s*\{/);
    assert.doesNotMatch(skuCardSource, /sku-color/);
  });
});
