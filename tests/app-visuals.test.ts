import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";

const rendererSource = fs.readFileSync(path.join(__dirname, "..", "src/renderers/cargo3d.ts"), "utf8");
const plan2dSource = fs.readFileSync(path.join(__dirname, "..", "src/renderers/plan2d.ts"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "..", "src/App.vue"), "utf8");
const packageSource = fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8");
const viteConfigSource = fs.readFileSync(path.join(__dirname, "..", "vite.config.ts"), "utf8");
const tokensSource = fs.readFileSync(path.join(__dirname, "..", "src/styles/tokens.css"), "utf8");
const plan2dViewSource = fs.readFileSync(
  path.join(__dirname, "..", "src/components/visualizations/Plan2DView.vue"),
  "utf8",
);
const cargo3dViewSource = fs.readFileSync(
  path.join(__dirname, "..", "src/components/visualizations/Cargo3DView.vue"),
  "utf8",
);
const cargo3dSceneV2Path = path.join(__dirname, "..", "src/components/visualizations/Cargo3DSceneV2.vue");
const cargo3dSceneV2Source = fs.existsSync(cargo3dSceneV2Path) ? fs.readFileSync(cargo3dSceneV2Path, "utf8") : "";
const visualizationDialogSource = fs.existsSync(
  path.join(__dirname, "..", "src/components/visualizations/VisualizationDialog.vue"),
)
  ? fs.readFileSync(path.join(__dirname, "..", "src/components/visualizations/VisualizationDialog.vue"), "utf8")
  : "";
const batchImportDialogSource = fs.readFileSync(
  path.join(__dirname, "..", "src/components/controls/BatchImportDialog.vue"),
  "utf8",
);
const containerFormSource = fs.readFileSync(
  path.join(__dirname, "..", "src/components/controls/ContainerForm.vue"),
  "utf8",
);
const packingStoreSource = fs.readFileSync(path.join(__dirname, "..", "src/stores/packingStore.ts"), "utf8");
const packingTypesSource = fs.readFileSync(path.join(__dirname, "..", "src/core/packing/types.ts"), "utf8");
const packingValidationSource = fs.readFileSync(path.join(__dirname, "..", "src/core/packing/validation.ts"), "utf8");
const progressControlSource = fs.readFileSync(
  path.join(__dirname, "..", "src/components/controls/ProgressControl.vue"),
  "utf8",
);
const resultSummarySource = fs.readFileSync(
  path.join(__dirname, "..", "src/components/results/ResultSummary.vue"),
  "utf8",
);
const coordinateDialogPath = path.join(__dirname, "..", "src/components/results/CoordinateDialog.vue");
const coordinateDialogSource = fs.existsSync(coordinateDialogPath) ? fs.readFileSync(coordinateDialogPath, "utf8") : "";
const strategyDescriptionSource = fs.readFileSync(
  path.join(__dirname, "..", "src/core/packing/strategyDescription.ts"),
  "utf8",
);
const skuEditorSource = fs.readFileSync(path.join(__dirname, "..", "src/components/controls/SkuEditor.vue"), "utf8");
const baseSelectSource = fs.readFileSync(path.join(__dirname, "..", "src/components/ui/BaseSelect.vue"), "utf8");
const baseNumberFieldSource = fs.readFileSync(
  path.join(__dirname, "..", "src/components/ui/BaseNumberField.vue"),
  "utf8",
);
const baseDialogSource = fs.existsSync(path.join(__dirname, "..", "src/components/ui/BaseDialog.vue"))
  ? fs.readFileSync(path.join(__dirname, "..", "src/components/ui/BaseDialog.vue"), "utf8")
  : "";
const baseColorPickerSource = fs.existsSync(path.join(__dirname, "..", "src/components/ui/BaseColorPicker.vue"))
  ? fs.readFileSync(path.join(__dirname, "..", "src/components/ui/BaseColorPicker.vue"), "utf8")
  : "";
const singleSkuFormSource = fs.readFileSync(
  path.join(__dirname, "..", "src/components/controls/SingleSkuForm.vue"),
  "utf8",
);
const skuCardSource = fs.readFileSync(path.join(__dirname, "..", "src/components/controls/SkuCard.vue"), "utf8");
const allVueAndCssSource = fs
  .readdirSync(path.join(__dirname, "..", "src"), { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(vue|css)$/.test(entry.name))
  .map((entry) => {
    const parentPath = entry.parentPath || entry.path;
    return fs.readFileSync(path.join(parentPath, entry.name), "utf8");
  })
  .join("\n");

describe("3D visual rendering source guards", () => {
  it("configures TresJS for Vue-rendered 3D scenes", () => {
    assert.match(viteConfigSource, /templateCompilerOptions/);
    assert.match(viteConfigSource, /@tresjs\/core/);
    assert.match(packageSource, /"@tresjs\/core"/);
    assert.match(packageSource, /"@tresjs\/cientos"/);
  });

  it("renders the cargo scene through a TresJS V2 component", () => {
    assert.match(cargo3dViewSource, /Cargo3DSceneV2/);
    assert.match(cargo3dSceneV2Source, /TresCanvas/);
    assert.match(cargo3dSceneV2Source, /OrbitControls/);
    assert.match(cargo3dSceneV2Source, /:enable-zoom="true"/);
    assert.doesNotMatch(cargo3dSceneV2Source, /Html/);
    assert.match(cargo3dSceneV2Source, /toSceneBox/);
    assert.match(cargo3dSceneV2Source, /endpointLabels/);
    assert.match(cargo3dSceneV2Source, /endpointSurfaces/);
    assert.match(cargo3dSceneV2Source, /endpoint-legend/);
    assert.match(cargo3dSceneV2Source, /projection-label-layer/);
    assert.doesNotMatch(cargo3dSceneV2Source, /endpointLabels\.forEach\(\(label\) => addSpriteLabel/);
    assert.doesNotMatch(cargo3dViewSource, /scene-label--inner/);
    assert.doesNotMatch(cargo3dViewSource, /door-marker/);
  });

  it("uses the TresJS cargo scene for both compact and expanded 3D views", () => {
    assert.doesNotMatch(cargo3dViewSource, /createCargoScene/);
    assert.doesNotMatch(cargo3dViewSource, /expandedCanvasRef/);
    assert.doesNotMatch(cargo3dViewSource, /<canvas id="expanded-scene-canvas"/);
    assert.match(cargo3dSceneV2Source, /canvasId/);
    assert.match(cargo3dViewSource, /canvas-id="scene-canvas"/);
    assert.match(cargo3dViewSource, /canvas-id="expanded-scene-canvas"/);
  });

  it("uses the TresJS cargo scene for coordinate previews", () => {
    assert.match(coordinateDialogSource, /Cargo3DSceneV2/);
    assert.doesNotMatch(coordinateDialogSource, /createCargoScene/);
    assert.doesNotMatch(coordinateDialogSource, /previewCanvasRef/);
    assert.doesNotMatch(coordinateDialogSource, /<canvas\s+[\s\S]*coordinate-preview-canvas/);
    assert.match(coordinateDialogSource, /canvas-id="coordinate-preview-canvas"/);
    assert.match(coordinateDialogSource, /show-coordinate-axes/);
    assert.match(coordinateDialogSource, /selected-loading-sequence/);
  });

  it("keeps TresJS cargo boxes visually separable with scene context", () => {
    assert.match(cargo3dSceneV2Source, /wireframe/);
    assert.match(cargo3dSceneV2Source, /box-edge/);
    assert.match(cargo3dSceneV2Source, /container-shell/);
    assert.match(cargo3dSceneV2Source, /container-floor/);
    assert.match(cargo3dSceneV2Source, /corner-block/);
  });

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

  it("uses deliberate default camera framing for notebook-height canvases", () => {
    assert.match(rendererSource, /CARGO_CAMERA_DISTANCE_FACTOR/);
    assert.match(rendererSource, /CARGO_DEFAULT_ZOOM = 0\.9/);
    assert.match(rendererSource, /CARGO_DEFAULT_PAN_Y = -8/);
    assert.match(rendererSource, /CARGO_DEFAULT_PITCH = 0\.66/);
    assert.doesNotMatch(rendererSource, /panY:\s*4/);
    assert.doesNotMatch(rendererSource, /maxDimension \* 1\.36/);
  });
});

describe("control panel layout source guards", () => {
  it("exposes persisted container clearance inputs for real cargo spacing", () => {
    assert.match(containerFormSource, /车厢公差/);
    assert.match(containerFormSource, /按站在柜口正视柜内为基准/);
    assert.match(containerFormSource, /`clearance-\$\{field\.key\}`/);
    for (const field of ["front", "rear", "left", "right", "top"]) {
      assert.match(containerFormSource, new RegExp(`key: "${field}"`));
      assert.match(packingStoreSource, new RegExp(`${field}:\\s*0`));
    }
    for (const label of ["前 mm", "后 mm", "左 mm", "右 mm", "顶部 mm"]) {
      assert.match(containerFormSource, new RegExp(label));
    }

    assert.match(packingStoreSource, /STACKING_SKU_CLEARANCE/);
    assert.match(packingStoreSource, /loadStoredContainerClearance/);
    assert.match(packingStoreSource, /persistContainerClearance/);
    assert.match(packingStoreSource, /updateContainerClearance/);
    assert.match(packingStoreSource, /clearance:\s*containerClearance\.value/);
    assert.match(packingTypesSource, /ContainerClearanceSpec/);
    assert.match(packingTypesSource, /effectiveContainer/);
    assert.match(packingTypesSource, /clearance/);
    assert.match(packingValidationSource, /normalizeContainerClearance/);
  });

  it("keeps container clearance inputs aligned with three-column spec inputs", () => {
    assert.match(containerFormSource, /\.clearance-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    assert.doesNotMatch(containerFormSource, /\.clearance-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
    assert.doesNotMatch(containerFormSource, /clearance-number-field--top/);
    assert.doesNotMatch(containerFormSource, /grid-column:\s*1\s*\/\s*-1/);
  });

  it("keeps number field stepper icons centered in compact controls", () => {
    assert.match(baseNumberFieldSource, /\.base-number-actions\s*\{[\s\S]*min-height:\s*0/);
    assert.match(baseNumberFieldSource, /\.base-number-actions\s*\{[\s\S]*align-items:\s*stretch/);
    assert.match(baseNumberFieldSource, /\.base-number-actions\s*\{[\s\S]*justify-items:\s*stretch/);
    assert.match(baseNumberFieldSource, /\.base-number-stepper\s*\{[\s\S]*display:\s*grid/);
    assert.match(baseNumberFieldSource, /\.base-number-stepper\s*\{[\s\S]*width:\s*100%/);
    assert.match(baseNumberFieldSource, /\.base-number-stepper\s*\{[\s\S]*min-width:\s*0/);
    assert.match(baseNumberFieldSource, /\.base-number-stepper\s*\{[\s\S]*min-height:\s*0/);
    assert.match(baseNumberFieldSource, /\.base-number-stepper\s*\{[\s\S]*place-items:\s*center/);
    assert.match(baseNumberFieldSource, /\.base-number-stepper\s*\{[\s\S]*line-height:\s*0/);
    assert.match(baseNumberFieldSource, /\.base-number-stepper svg\s*\{[\s\S]*display:\s*block/);
    assert.doesNotMatch(baseNumberFieldSource, /\.base-number-stepper\s*\{[\s\S]*min-width:\s*26px/);
    assert.doesNotMatch(baseNumberFieldSource, /\.base-number-stepper\s*\{[\s\S]*min-height:\s*20px/);
  });

  it("keeps the primary result summary above batch import actions", () => {
    const resultIndex = appSource.indexOf("<ResultSummary />");
    const batchIndex = appSource.indexOf("<BatchImportDialog />");

    assert.ok(resultIndex > -1, "ResultSummary should be rendered in the control panel");
    assert.ok(batchIndex > -1, "BatchImportDialog should be rendered in the control panel");
    assert.ok(resultIndex < batchIndex, "Primary result summary should appear before batch import actions");
    assert.match(resultSummarySource, /summary-card--primary/);
    assert.match(resultSummarySource, /metric-grid--compact/);
  });

  it("exposes the first-stage carton coordinate table after calculation", () => {
    assert.doesNotMatch(appSource, /CoordinateDialog/);
    assert.match(cargo3dViewSource, /CoordinateDialog/);
    assert.match(cargo3dViewSource, /<CoordinateDialog \/>/);
    assert.match(coordinateDialogSource, /查看坐标/);
    assert.match(coordinateDialogSource, /导出 CSV/);
    assert.match(coordinateDialogSource, /坐标系/);
    assert.match(coordinateDialogSource, /柜门面X/);
    assert.match(coordinateDialogSource, /上表面X/);
    assert.match(coordinateDialogSource, /createBoxCoordinateRows/);
    assert.match(coordinateDialogSource, /createBoxCoordinateCsv/);
    assert.match(coordinateDialogSource, /Cargo3DSceneV2/);
    assert.match(coordinateDialogSource, /show-coordinate-axes/);
    assert.match(coordinateDialogSource, /selectedRow/);
    assert.match(coordinateDialogSource, /coordinate-preview-canvas/);
    assert.match(coordinateDialogSource, /当前选中/);
    assert.match(coordinateDialogSource, /size="fullscreen"/);
    assert.match(coordinateDialogSource, /grid-template-columns:\s*minmax\(340px,\s*0\.72fr\)\s*minmax\(560px,\s*1\.55fr\)/);
    assert.doesNotMatch(coordinateDialogSource, /grid-template-columns:\s*minmax\(0,\s*1\.45fr\)\s*minmax\(300px,\s*0\.7fr\)/);
    assert.match(baseDialogSource, /base-dialog-content--fullscreen/);
    assert.match(baseDialogSource, /width:\s*min\(97vw,\s*1680px\)/);
    assert.match(baseDialogSource, /height:\s*min\(92dvh,\s*1080px\)/);
    assert.match(rendererSource, /getCargoCoordinateAxes/);
    assert.match(rendererSource, /addCoordinateAxes/);
  });

  it("uses distinct status-chip tones for calculation states", () => {
    assert.match(appSource, /statusToneByLabel/);
    assert.match(appSource, /:class="statusChipClass"/);
    assert.match(appSource, /aria-live="polite"/);
    assert.match(appSource, /#status-chip::before/);

    for (const statusLabel of ["待计算", "待重新计算", "已完成计算", "无法装载", "计算失败"]) {
      assert.match(appSource, new RegExp(statusLabel));
    }

    for (const tone of ["idle", "dirty", "success", "empty", "error"]) {
      assert.match(appSource, new RegExp(`\\.status-chip--${tone}`));
    }
  });

  it("shows a loading state while calculation is running", () => {
    assert.match(appSource, /isCalculating/);
    assert.match(appSource, /handleCalculate/);
    assert.match(appSource, /:disabled="isCalculating"/);
    assert.match(appSource, /aria-busy/);
    assert.match(appSource, /计算中/);
    assert.match(appSource, /calculate-button--loading/);
    assert.match(appSource, /calculate-button__spinner/);
  });

  it("shows reusable packing strategy notes in the result summary", () => {
    assert.match(resultSummarySource, /describePackingStrategy/);
    assert.match(resultSummarySource, /strategy-notes/);
    assert.match(resultSummarySource, /本次排布说明/);
    assert.match(strategyDescriptionSource, /朝向规则/);
    assert.match(strategyDescriptionSource, /角件避让/);
    assert.match(strategyDescriptionSource, /空位回填/);
    assert.match(strategyDescriptionSource, /SKU 策略/);
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

  it("keeps group summary logic available while hiding the summary area by default", () => {
    assert.match(plan2dViewSource, /const showGroupSummary = false/);
    assert.match(plan2dViewSource, /showGroupSummary && groupSummary\.length/);
    assert.match(plan2dViewSource, /groupSummary/);
    assert.match(plan2dViewSource, /占长|占宽/);
  });

  it("keeps top and side views switchable next to the persistent front view", () => {
    assert.match(appSource, /\.views-grid\s*\{[\s\S]*grid-template-rows:/);
    assert.match(appSource, /grid-template-rows:\s*minmax\(360px,\s*1\.18fr\)\s*minmax\(220px,\s*0\.82fr\)/);
    assert.match(appSource, /\.views-grid\s*\{[\s\S]*overflow:\s*hidden/);
    assert.doesNotMatch(appSource, /grid-template-rows:\s*minmax\(620px,\s*1\.22fr\)\s*minmax\(380px,\s*0\.78fr\)/);
    assert.doesNotMatch(appSource, /\.views-grid\s*\{[\s\S]*overflow-y:\s*auto/);
    assert.match(appSource, /clamp\(420px,\s*58dvh,\s*640px\)\s*clamp\(300px,\s*38dvh,\s*420px\)/);
    assert.doesNotMatch(appSource, /minmax\(640px,\s*auto\)\s*minmax\(520px,\s*auto\)/);
    assert.match(plan2dViewSource, /plan-view-grid/);
    assert.match(plan2dViewSource, /activePlanView/);
    assert.match(plan2dViewSource, /frontPlanView/);
    assert.match(plan2dViewSource, /plan-view-card--switchable/);
    assert.match(plan2dViewSource, /plan-view-switch/);
    assert.match(plan2dViewSource, /plan-canvas-top/);
    assert.match(plan2dViewSource, /plan-canvas-side/);
    assert.match(plan2dViewSource, /plan-canvas-front/);
    assert.doesNotMatch(plan2dViewSource, /plan-view-card--top/);
    assert.doesNotMatch(plan2dViewSource, /plan-view-card--side/);
  });

  it("keeps the front view switchable between corner and door endpoints", () => {
    assert.match(plan2dViewSource, /frontViewSides/);
    assert.match(plan2dViewSource, /activeFrontViewSide/);
    assert.match(plan2dViewSource, /plan-view-switch--front/);
    assert.match(plan2dViewSource, /角件端/);
    assert.match(plan2dViewSource, /柜门/);
    assert.match(plan2dViewSource, /frontViewSide:/);
    assert.match(plan2dSource, /Plan2DFrontViewSide/);
    assert.match(plan2dSource, /getFrontEndpointDrawingPositions/);
  });

  it("keeps auxiliary labels compact on short 2D canvases", () => {
    assert.match(plan2dSource, /isCompactCanvas/);
    assert.match(plan2dSource, /showMeasurementLabels/);
    assert.match(plan2dSource, /if \(showMeasurementLabels\)/);
  });

  it("keeps 2D view status and dimensions outside canvas drawings", () => {
    assert.match(plan2dViewSource, /plan-view-status/);
    assert.match(plan2dViewSource, /plan-view-measure/);
    assert.match(plan2dViewSource, /\.plan-view-status\s*\{[\s\S]*grid-column:\s*1 \/ -1/);
    assert.match(plan2dViewSource, /\.plan-view-measure\s*\{[\s\S]*grid-column:\s*1 \/ -1/);
    assert.match(plan2dViewSource, /showLabels:\s*false/);
    assert.match(plan2dSource, /showLabels\?:\s*boolean/);
    assert.match(plan2dSource, /if \(showLabels\)/);
  });

  it("keeps top-view status aligned to the current loading progress", () => {
    assert.match(plan2dViewSource, /当前显示/);
    assert.doesNotMatch(plan2dViewSource, /getTopViewLayerProgress/);
    assert.doesNotMatch(plan2dViewSource, /lastPosition\.stackIndex/);
    assert.doesNotMatch(plan2dViewSource, /visiblePositions\.filter\(\(position\) => position\.stackIndex ===/);
  });

  it("does not draw a separate occupied boundary over 2D cargo views", () => {
    assert.doesNotMatch(plan2dSource, /function getOccupiedProjectionRect/);
    assert.doesNotMatch(plan2dSource, /rgba\(66,\s*214,\s*164,\s*0\.95\)/);
    assert.doesNotMatch(plan2dSource, /plane\.occupiedWidth \* scale,\s*plane\.occupiedHeight \* scale/);
  });

  it("draws effective loading space boundaries when container clearance is applied", () => {
    assert.match(plan2dSource, /getEffectiveSpaceProjectionRect/);
    assert.match(plan2dSource, /drawEffectiveSpaceBoundary/);
    assert.match(plan2dSource, /有效装载空间/);
    assert.match(rendererSource, /createEffectiveSpaceFrame/);
    assert.match(rendererSource, /有效装载空间/);
  });

  it("draws the container outline after cargo boxes", () => {
    const boxLoopIndex = plan2dSource.indexOf("for (const drawingPosition of sortedDrawingPositions)");
    const outlineIndex = plan2dSource.indexOf("drawContainerOutline(ctx, plane, scale)", boxLoopIndex);

    assert.ok(boxLoopIndex > -1, "2D renderer should draw cargo boxes in one predictable loop");
    assert.ok(outlineIndex > boxLoopIndex, "container outline should sit above cargo boxes");
  });

  it("uses straight container rectangles for technical 2D views", () => {
    assert.match(plan2dSource, /ctx\.fillRect\(0,\s*0,\s*plane\.width \* scale,\s*plane\.height \* scale\)/);
    assert.match(plan2dSource, /ctx\.strokeRect\(0,\s*0,\s*plane\.width \* scale,\s*plane\.height \* scale\)/);
    assert.doesNotMatch(plan2dSource, /function drawRoundedRect/);
    assert.doesNotMatch(plan2dSource, /drawRoundedRect\(ctx,\s*0,\s*0,\s*plane\.width \* scale/);
  });

  it("does not draw corner-block overlays in 2D views", () => {
    assert.doesNotMatch(plan2dSource, /getCornerProjectionRects/);
    assert.doesNotMatch(plan2dSource, /collidesCornerBlock/);
    assert.doesNotMatch(plan2dSource, /255,\s*112,\s*102/);
    assert.doesNotMatch(plan2dSource, /红色区域为顶部角件避让区/);
  });

  it("draws axis guide annotations outside the 2D container rectangle", () => {
    assert.match(plan2dSource, /function drawOuterAxisGuides/);
    assert.match(plan2dSource, /showLabels \? \(compactCanvas \? 34 : 48\) : \(compactCanvas \? 54 : 68\)/);
    assert.doesNotMatch(plan2dSource, /function drawInnerAxisGuides/);
  });

  it("uses an upright compact label for the vertical axis guide", () => {
    assert.match(plan2dSource, /function drawStackedGuideLabel/);
    assert.match(plan2dSource, /function formatAxisGuideLines/);
    assert.match(plan2dSource, /getPlan2DVerticalGuideLabelLayout/);
    assert.match(plan2dSource, /yGuideX,\s*yStart:\s*y1,\s*yEnd:\s*y2/);
    assert.doesNotMatch(plan2dSource, /boxX \+ 6,\s*boxY - 58/);
    assert.doesNotMatch(plan2dSource, /formatAxisGuideText\(model\.y\),\s*yGuideX[^)]*-\s*Math\.PI\s*\/\s*2/);
  });

  it("provides expanded dialogs for detailed 2D and 3D inspection", () => {
    assert.match(baseDialogSource, /DialogRoot/);
    assert.match(baseDialogSource, /<DialogPortal v-if="dialogOpen">/);
    assert.match(baseDialogSource, /base-dialog-overlay/);
    assert.match(baseDialogSource, /DIALOG_ANIMATION_MS = 240/);
    assert.match(baseDialogSource, /isClosing/);
    assert.match(baseDialogSource, /base-dialog-content--closing/);
    assert.match(baseDialogSource, /@keyframes base-dialog-content-in/);
    assert.match(baseDialogSource, /@keyframes base-dialog-content-out/);
    assert.match(baseDialogSource, /base-dialog-content--fullscreen/);
    assert.match(baseDialogSource, /stableHeight/);
    assert.match(baseDialogSource, /base-dialog-content--stable-height/);
    assert.match(baseDialogSource, /\.base-dialog-content--stable-height\s*\{[\s\S]*height:\s*min\(720px,\s*calc\(100dvh - 36px\)\)/);
    assert.match(baseDialogSource, /\.base-dialog-body--default\s*\{[\s\S]*align-content:\s*start/);
    assert.match(visualizationDialogSource, /BaseDialog/);
    assert.match(visualizationDialogSource, /open:\s*boolean/);
    assert.match(plan2dViewSource, /Maximize2/);
    assert.match(plan2dViewSource, /VisualizationDialog/);
    assert.match(plan2dViewSource, /:open="expandedPlanViewMode !== null"/);
    assert.doesNotMatch(plan2dViewSource, /<VisualizationDialog\s+v-if/);
    assert.match(plan2dViewSource, /expanded-plan-canvas/);
    assert.match(cargo3dViewSource, /Maximize2/);
    assert.match(cargo3dViewSource, /VisualizationDialog/);
    assert.match(cargo3dViewSource, /:open="isExpanded"/);
    assert.doesNotMatch(cargo3dViewSource, /<VisualizationDialog\s+v-if/);
    assert.match(cargo3dViewSource, /expanded-scene-canvas/);
  });
});

describe("batch import UI source guards", () => {
  it("keeps loading feedback and dialog motion on the batch import flow", () => {
    assert.match(batchImportDialogSource, /const isImporting = ref\(false\)/);
    assert.match(batchImportDialogSource, /:disabled="isImporting"/);
    assert.match(batchImportDialogSource, /解析中\.\.\./);
    assert.match(batchImportDialogSource, /const MIN_IMPORT_LOADING_MS = 700/);
    assert.match(batchImportDialogSource, /function waitForLoadingPaint/);
    assert.match(batchImportDialogSource, /await waitForLoadingPaint\(\)/);
    assert.match(batchImportDialogSource, /batch-import-spinner/);
    assert.match(batchImportDialogSource, /@keyframes batch-import-spin/);
    assert.match(batchImportDialogSource, /<Transition name="batch-import-loading"/);
    assert.match(batchImportDialogSource, /v-if="isImporting" class="batch-import-loading"/);
    assert.match(batchImportDialogSource, /role="status"/);
    assert.match(batchImportDialogSource, /正在解析 Excel/);
    assert.match(batchImportDialogSource, /calculateBatchPackingAsync/);
    assert.match(batchImportDialogSource, /importProgress/);
    assert.match(batchImportDialogSource, /cancelImport/);
    assert.match(batchImportDialogSource, /取消导入/);
    assert.match(batchImportDialogSource, /aria-valuenow/);
    assert.match(batchImportDialogSource, /\.batch-import-loading\s*\{/);
    assert.match(batchImportDialogSource, /position:\s*fixed/);
    assert.match(batchImportDialogSource, /\.batch-import-loading-card/);
    assert.match(batchImportDialogSource, /\.batch-import-cancel/);
    assert.match(batchImportDialogSource, /\.batch-import-loading-enter-active/);
    assert.match(batchImportDialogSource, /BaseDialog/);
    assert.doesNotMatch(batchImportDialogSource, /DialogRoot/);
    assert.doesNotMatch(batchImportDialogSource, /batch-dialog-content-enter-active/);
  });

  it("keeps batch import result filtering and review-row export controls", () => {
    assert.match(batchImportDialogSource, /BaseSelect/);
    assert.match(batchImportDialogSource, /statusFilter/);
    assert.match(batchImportDialogSource, /errorFilter/);
    assert.match(batchImportDialogSource, /differenceFilter/);
    assert.match(batchImportDialogSource, /reviewOnly/);
    assert.match(batchImportDialogSource, /filteredResults/);
    assert.match(batchImportDialogSource, /sortedResults/);
    assert.match(batchImportDialogSource, /remainingLength/);
    assert.match(batchImportDialogSource, /remainingWidth/);
    assert.match(batchImportDialogSource, /remainingHeight/);
    assert.match(batchImportDialogSource, /余量（长）/);
    assert.match(batchImportDialogSource, /余量（宽）/);
    assert.match(batchImportDialogSource, /余量（高）/);
    assert.match(batchImportDialogSource, /sortKey/);
    assert.match(batchImportDialogSource, /sortDirection/);
    assert.match(batchImportDialogSource, /按导入状态筛选/);
    assert.match(batchImportDialogSource, /按失败原因筛选/);
    assert.match(batchImportDialogSource, /按差值筛选/);
    assert.match(batchImportDialogSource, /只看需复核/);
    assert.match(batchImportDialogSource, /density="compact"/);
    assert.match(batchImportDialogSource, /导出需复核行/);
    assert.match(batchImportDialogSource, /导出当前筛选/);
    assert.match(batchImportDialogSource, /downloadCurrentFilteredResults/);
    assert.match(batchImportDialogSource, /reviewResults/);
    assert.match(batchImportDialogSource, /negativeDifferenceResults/);
    assert.match(batchImportDialogSource, /isReviewItem/);
    assert.match(batchImportDialogSource, /toggleSort/);
    assert.match(batchImportDialogSource, /includeErrorDetails/);
    assert.match(batchImportDialogSource, /stable-height/);
    assert.match(batchImportDialogSource, /body-variant="flush"/);
    assert.match(batchImportDialogSource, /--batch-result-stable-height/);
    assert.match(batchImportDialogSource, /\.batch-result-layout\s*\{[\s\S]*height:\s*100%/);
    assert.match(batchImportDialogSource, /\.batch-result-layout\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*1fr\)/);
    assert.match(batchImportDialogSource, /\.batch-result-region\s*\{[\s\S]*min-height:\s*0/);
    assert.match(batchImportDialogSource, /\.result-table-shell\s*\{[\s\S]*height:\s*100%/);
    assert.match(batchImportDialogSource, /\.dialog-empty\s*\{[\s\S]*height:\s*100%/);
    assert.match(batchImportDialogSource, /\.dialog-error\s*\{[\s\S]*height:\s*100%/);
    assert.doesNotMatch(batchImportDialogSource, /导出失败行/);
    assert.doesNotMatch(batchImportDialogSource, /导出负差值/);
    assert.doesNotMatch(batchImportDialogSource, /<select/);
    assert.match(batchImportDialogSource, /aria-sort/);
  });

  it("uses the current container clearance when calculating batch imports", () => {
    assert.match(batchImportDialogSource, /usePackingStore/);
    assert.match(batchImportDialogSource, /store\.containerClearance/);
    assert.match(batchImportDialogSource, /公差：/);
    assert.match(batchImportDialogSource, /calculateBatchPackingAsync\(rows,\s*\{/);
    assert.match(batchImportDialogSource, /clearance:\s*store\.containerClearance/);
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
    assert.match(baseSelectSource, /ariaLabel/);
    assert.match(baseSelectSource, /density/);
    assert.match(baseSelectSource, /base-select-item--compact/);
    assert.match(baseSelectSource, /\.base-select-item--compact\)\s*\{[\s\S]*min-height:\s*34px/);
    assert.match(baseSelectSource, /z-index:\s*110/);
    assert.match(baseSelectSource, /function deferValueUpdate/);
    assert.match(baseSelectSource, /window\.setTimeout/);
    assert.doesNotMatch(baseSelectSource, /animation:\s*select-pop/);
  });
});

describe("shadow token source guards", () => {
  it("keeps controls free of top inset highlight lines", () => {
    assert.match(tokensSource, /--control-inner-shadow:\s*0 0 0 0 transparent;/);
    assert.doesNotMatch(tokensSource, /--popover-shadow:[^;]*inset\s+0\s+1px\s+0/);
    assert.doesNotMatch(allVueAndCssSource, /box-shadow:\s*var\(--focus-ring\),\s*var\(--control-inner-shadow\)/);
    assert.doesNotMatch(allVueAndCssSource, /\/\*\s*box-shadow:\s*var\(--control-inner-shadow\);\s*\*\//);
  });
});

describe("range progress source guards", () => {
  it("renders sliders with filled and remaining track colors", () => {
    assert.match(tokensSource, /--range-track-filled:/);
    assert.match(tokensSource, /--range-track-rest:/);
    assert.match(allVueAndCssSource, /var\(--range-progress,\s*0%\)/);
    assert.match(progressControlSource, /progressPercent/);
    assert.match(progressControlSource, /--range-progress/);
    assert.match(skuEditorSource, /skuCountProgressPercent/);
    assert.match(skuEditorSource, /--range-progress/);
  });

  it("keeps range track endpoints aligned with the thumb", () => {
    assert.match(progressControlSource, /class="range-control"/);
    assert.match(skuEditorSource, /class="range-control"/);
    assert.match(allVueAndCssSource, /range-control__rail/);
    assert.match(allVueAndCssSource, /range-control__track/);
    assert.match(allVueAndCssSource, /range-control__fill/);
    assert.match(allVueAndCssSource, /range-control__thumb/);
    assert.match(allVueAndCssSource, /\.range-control input\[type="range"\]\s*\{[\s\S]*opacity:\s*0/);
    assert.match(allVueAndCssSource, /--range-thumb-size:\s*19px/);
    assert.match(allVueAndCssSource, /--range-track-height:\s*7px/);
    assert.match(allVueAndCssSource, /padding-inline:\s*calc\(var\(--range-thumb-size\) \/ 2\)/);
    assert.match(
      allVueAndCssSource,
      /margin-top:\s*calc\(\(var\(--range-track-height\) - var\(--range-thumb-size\)\) \/ 2\)/,
    );
    assert.doesNotMatch(allVueAndCssSource, /margin-top:\s*-7px/);
  });
});

describe("color picker source guards", () => {
  it("uses the same carton color picker class for single and multi SKU controls", () => {
    assert.match(singleSkuFormSource, /BaseColorPicker/);
    assert.match(skuCardSource, /BaseColorPicker/);
    assert.match(baseColorPickerSource, /class="carton-color"/);
    assert.match(baseColorPickerSource, /carton-color__input/);
    assert.match(baseColorPickerSource, /carton-color__swatch/);
    assert.match(baseColorPickerSource, /carton-color__value/);
    assert.match(baseColorPickerSource, /--carton-color-value/);
    assert.match(baseColorPickerSource, /\.carton-color__input\s*\{[\s\S]*opacity:\s*0/);
    assert.match(baseColorPickerSource, /PopoverRoot/);
    assert.match(baseColorPickerSource, /PopoverTrigger/);
    assert.match(baseColorPickerSource, /PopoverContent/);
    assert.match(baseColorPickerSource, /carton-color-popover/);
    assert.match(baseColorPickerSource, /carton-color-palette/);
    assert.match(baseColorPickerSource, /carton-color-swatch-button/);
    assert.match(baseColorPickerSource, /carton-color-hex-input/);
    assert.match(baseColorPickerSource, /更多颜色/);
    assert.match(baseColorPickerSource, /nativeInputRef/);
    assert.match(baseColorPickerSource, /openNativePicker/);
    assert.doesNotMatch(singleSkuFormSource, /\.carton-color\s*\{/);
    assert.doesNotMatch(skuCardSource, /\.carton-color\s*\{/);
    assert.doesNotMatch(skuCardSource, /sku-color/);
  });
});
