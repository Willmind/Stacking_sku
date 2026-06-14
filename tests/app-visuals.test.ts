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
