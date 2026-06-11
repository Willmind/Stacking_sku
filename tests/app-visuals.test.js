const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

const edgeMaterialMatch = appSource.match(
  /const edgeMaterial = new THREE\.MeshBasicMaterial\(\{([\s\S]*?)\n    \}\);/,
);

assert.ok(edgeMaterialMatch, "3D box edge material should be present");

const edgeMaterialSource = edgeMaterialMatch[1];
const colorMatch = edgeMaterialSource.match(/color:\s*0x([0-9a-fA-F]{6})/);
const opacityMatch = edgeMaterialSource.match(/opacity:\s*([0-9.]+)/);
const shellMaterialMatch = appSource.match(
  /const shell = new THREE\.Mesh\([\s\S]*?new THREE\.MeshBasicMaterial\(\{([\s\S]*?)\n      \}\),/,
);

assert.ok(colorMatch, "3D box edge material should declare a color");
assert.ok(opacityMatch, "3D box edge material should declare opacity");
assert.ok(shellMaterialMatch, "3D container shell material should be present");
const shellOpacityMatch = shellMaterialMatch[1].match(/opacity:\s*([0-9.]+)/);
assert.ok(shellOpacityMatch, "3D container shell should declare opacity");
assert.notEqual(colorMatch[1].toLowerCase(), "020202", "3D box edges should not be near-black");
assert.ok(Number(opacityMatch[1]) <= 0.12, "3D box edges should not overpower SKU colors");
assert.ok(Number(shellOpacityMatch[1]) <= 0.02, "3D container shell should not darken cargo colors");
assert.match(
  appSource,
  /const material = new THREE\.MeshBasicMaterial/,
  "3D box faces should render SKU colors without lighting darkening them",
);
const boxMaterialMatch = appSource.match(
  /const material = new THREE\.MeshBasicMaterial\(\{([\s\S]*?)\n    \}\);/,
);

assert.ok(boxMaterialMatch, "3D box face material should be present");
const boxMaterialSource = boxMaterialMatch[1];
assert.match(
  boxMaterialSource,
  /side:\s*THREE\.DoubleSide/,
  "3D box faces should remain visible from the default viewing angle",
);
assert.doesNotMatch(
  boxMaterialSource,
  /vertexColors:\s*true/,
  "3D box faces should use direct material colors instead of fragile instance vertex colors",
);
assert.doesNotMatch(
  boxMaterialSource,
  /transparent:\s*true/,
  "3D box faces should not blend into the dark container background",
);

console.log("app visual tests passed");
