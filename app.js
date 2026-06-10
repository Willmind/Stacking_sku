(function initPackingApp() {
  "use strict";

  const Packing = window.ContainerPacking;
  const $ = (selector) => document.querySelector(selector);

  const elements = {
    form: $("#packing-form"),
    containerType: $("#container-type"),
    containerLength: $("#container-length"),
    containerWidth: $("#container-width"),
    containerHeight: $("#container-height"),
    packingMode: document.querySelectorAll("input[name='packing-mode']"),
    skuCountRow: $("#sku-count-row"),
    skuCount: $("#sku-count"),
    skuCountValue: $("#sku-count-value"),
    skuStrategyRow: $("#sku-strategy-row"),
    skuStrategy: $("#sku-strategy"),
    singleSkuFields: $("#single-sku-fields"),
    skuList: $("#sku-list"),
    skuBreakdown: $("#sku-breakdown"),
    cartonLength: $("#carton-length"),
    cartonWidth: $("#carton-width"),
    cartonHeight: $("#carton-height"),
    cartonColor: $("#carton-color"),
    colorValue: $("#color-value"),
    totalBoxes: $("#total-boxes"),
    perLayerCount: $("#per-layer-count"),
    layerCount: $("#layer-count"),
    usedHeight: $("#used-height"),
    utilization: $("#utilization"),
    patternName: $("#pattern-name"),
    occupiedLength: $("#occupied-length"),
    occupiedWidth: $("#occupied-width"),
    blockedCount: $("#blocked-count"),
    progress: $("#stack-progress"),
    progressText: $("#progress-text"),
    statusChip: $("#status-chip"),
    planCanvas: $("#plan-canvas"),
    sceneCanvas: $("#scene-canvas"),
    calculateButton: $("#calculate-button"),
  };

  function createSkuId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `sku-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  const state = {
    result: null,
    visibleCount: 0,
    color: elements.cartonColor.value,
    mode: "single",
    skus: [
      { id: createSkuId(), length: 480, width: 320, height: 260, target: 100, color: "#d8923a" },
      { id: createSkuId(), length: 480, width: 320, height: 260, target: 100, color: "#42d6a4" },
    ],
    draggedSkuId: null,
    camera: {
      yaw: -0.72,
      pitch: 0.72,
      zoom: 1,
      panX: 0,
      panY: 4,
      mode: null,
      lastX: 0,
      lastY: 0,
    },
    three: null,
  };

  const MAX_3D_BOXES = 4200;

  function numberValue(input) {
    return Number(input.value);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("zh-CN").format(Math.round(value));
  }

  function formatMm(value) {
    return `${formatNumber(value)} mm`;
  }

  function hexToRgb(hex) {
    const normalized = hex.replace("#", "");
    const number = Number.parseInt(normalized, 16);
    return {
      r: (number >> 16) & 255,
      g: (number >> 8) & 255,
      b: number & 255,
    };
  }

  function shadeColor(rgb, factor) {
    const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
    return `rgb(${clamp(rgb.r * factor)}, ${clamp(rgb.g * factor)}, ${clamp(rgb.b * factor)})`;
  }

  function setContainerPreset(id) {
    const preset = Packing.CONTAINERS[id];
    elements.containerLength.value = preset.length;
    elements.containerWidth.value = preset.width;
    elements.containerHeight.value = preset.height;
  }

  function getContainerInput() {
    return {
      id: elements.containerType.value,
      name: elements.containerType.value,
      length: numberValue(elements.containerLength),
      width: numberValue(elements.containerWidth),
      height: numberValue(elements.containerHeight),
    };
  }

  function getCartonInput() {
    return {
      length: numberValue(elements.cartonLength),
      width: numberValue(elements.cartonWidth),
      height: numberValue(elements.cartonHeight),
    };
  }

  function updateSkuFromCard(card) {
    const sku = state.skus.find((item) => item.id === card.dataset.skuId);
    if (!sku) return;
    sku.length = Number(card.querySelector(".sku-length").value);
    sku.width = Number(card.querySelector(".sku-width").value);
    sku.height = Number(card.querySelector(".sku-height").value);
    sku.target = Number(card.querySelector(".sku-target").value);
    sku.color = card.querySelector(".sku-color").value;
  }

  function getSkuInputs() {
    elements.skuList.querySelectorAll(".sku-card").forEach(updateSkuFromCard);
    relabelSkus();
    return state.skus.map((sku) => ({
      label: sku.label,
      length: sku.length,
      width: sku.width,
      height: sku.height,
      target: sku.target,
      color: sku.color,
    }));
  }

  function relabelSkus() {
    state.skus = state.skus.map((sku, index) => ({
      ...sku,
      label: String.fromCharCode(65 + index),
    }));
  }

  function renderSkuList() {
    relabelSkus();
    elements.skuList.innerHTML = state.skus
      .map(
        (sku) => `
          <article class="sku-card" draggable="true" data-sku-id="${sku.id}">
            <div class="sku-card-header">
              <button class="drag-handle" type="button" aria-label="拖动 SKU ${sku.label}">☰</button>
              <strong>SKU ${sku.label}</strong>
              <input class="sku-color" type="color" value="${sku.color}" aria-label="SKU ${sku.label} 颜色" />
            </div>
            <div class="sku-fields">
              <label>长 mm<input class="sku-length" type="number" min="1" step="1" value="${sku.length}" /></label>
              <label>宽 mm<input class="sku-width" type="number" min="1" step="1" value="${sku.width}" /></label>
              <label>高 mm<input class="sku-height" type="number" min="1" step="1" value="${sku.height}" /></label>
              <label>目标量<input class="sku-target" type="number" min="1" step="1" value="${sku.target}" /></label>
            </div>
          </article>
        `,
      )
      .join("");
  }

  function setPackingMode(mode) {
    state.mode = mode;
    const multi = mode === "multi";
    elements.skuCountRow.classList.toggle("hidden", !multi);
    elements.skuStrategyRow.classList.toggle("hidden", !multi);
    elements.singleSkuFields.classList.toggle("hidden", multi);
    elements.skuList.classList.toggle("hidden", !multi);
    elements.skuBreakdown.classList.toggle("hidden", !multi);
    if (multi) renderSkuList();
    markNeedsCalculation();
  }

  function syncSkuCount() {
    const count = Number(elements.skuCount.value);
    elements.skuCountValue.textContent = String(count);
    while (state.skus.length < count) {
      const index = state.skus.length;
      state.skus.push({
        id: createSkuId(),
        label: String.fromCharCode(65 + index),
        length: 480,
        width: 320,
        height: 260,
        target: 100,
        color: ["#d8923a", "#42d6a4", "#6e8bff", "#ff7066", "#b7e35f"][index % 5],
      });
    }
    state.skus = state.skus.slice(0, count);
    renderSkuList();
    markNeedsCalculation();
  }

  function resizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(320, Math.floor(rect.width * dpr));
    const height = Math.max(280, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return {
      ctx,
      width: width / dpr,
      height: height / dpr,
    };
  }

  function updateSummary(result) {
    const pattern = result.pattern;
    const layersWithBoxes = result.layers.filter((layer) => layer.boxCount > 0).length;
    const patternName =
      pattern && pattern.family === "width-lanes"
        ? "按柜宽分区混排"
        : pattern
          ? "按柜长分区混排"
          : "-";

    elements.totalBoxes.textContent = formatNumber(result.totalBoxes);
    elements.perLayerCount.textContent = formatNumber(result.perLayerBoxCount);
    elements.layerCount.textContent = formatNumber(layersWithBoxes);
    elements.usedHeight.textContent = formatMm(result.usedHeight);
    elements.utilization.textContent = `${(result.utilizationRatio * 100).toFixed(1)}%`;
    elements.patternName.textContent = patternName;
    elements.occupiedLength.textContent = pattern ? formatMm(pattern.occupiedLength) : "0 mm";
    elements.occupiedWidth.textContent = pattern ? formatMm(pattern.occupiedWidth) : "0 mm";
    elements.blockedCount.textContent = `${formatNumber(result.blockedByCornerTotal)} 箱`;
    elements.statusChip.textContent = result.totalBoxes > 0 ? "已完成计算" : "无法装载";
  }

  function updateSkuBreakdown(result) {
    if (state.mode !== "multi" || !result.skuSummary) {
      elements.skuBreakdown.classList.add("hidden");
      elements.skuBreakdown.innerHTML = "";
      return;
    }

    elements.skuBreakdown.classList.remove("hidden");
    elements.skuBreakdown.innerHTML = result.skuSummary
      .map(
        (sku) => `
          <div class="sku-breakdown-row">
            <span class="sku-swatch" style="background:${sku.color}"></span>
            <strong>SKU ${sku.label}</strong>
            <span>${formatNumber(sku.loaded)} / ${formatNumber(sku.target)}${sku.shortfall ? ` · 差 ${formatNumber(sku.shortfall)}` : ""}</span>
          </div>
        `,
      )
      .join("");
  }

  function updateColorValue() {
    state.color = elements.cartonColor.value;
    const rgb = hexToRgb(state.color);
    elements.colorValue.textContent = `RGB ${rgb.r}, ${rgb.g}, ${rgb.b}`;
  }

  function markNeedsCalculation() {
    elements.statusChip.textContent = state.result ? "待重新计算" : "待计算";
  }

  function updateProgress(result, keepCurrent = false) {
    const previous = Number(elements.progress.value);
    elements.progress.max = String(result.totalBoxes);
    elements.progress.step = "1";
    state.visibleCount = keepCurrent ? Math.min(previous, result.totalBoxes) : result.totalBoxes;
    elements.progress.value = String(state.visibleCount);
    elements.progressText.textContent = `${formatNumber(state.visibleCount)} / ${formatNumber(result.totalBoxes)}`;
  }

  function clearCalculationState() {
    state.result = null;
    state.visibleCount = 0;
    elements.progress.max = "0";
    elements.progress.value = "0";
    elements.progressText.textContent = "0 / 0";
    updateSkuBreakdown({});
  }

  function calculateAndRender(options = {}) {
    try {
      updateColorValue();
      const result =
        state.mode === "multi"
          ? Packing.calculateMultiSkuPacking(getContainerInput(), getSkuInputs(), {
              strategy: elements.skuStrategy.value,
            })
          : Packing.calculatePacking(getContainerInput(), getCartonInput());
      state.result = result;
      updateSummary(result);
      updateSkuBreakdown(result);
      updateProgress(result, options.keepProgress);
      drawAll();
    } catch (error) {
      clearCalculationState();
      elements.statusChip.textContent = "参数错误";
      elements.totalBoxes.textContent = "0";
      drawError(error.message);
    }
  }

  function findCurrentLayer(result, visibleCount) {
    if (Array.isArray(result.orderedPositions)) {
      const visiblePositions = result.orderedPositions.slice(0, visibleCount);
      const lastPosition = visiblePositions[visiblePositions.length - 1];
      if (lastPosition) {
        const layer =
          result.layers.find((item) => item.index === lastPosition.stackIndex) ||
          result.layers[lastPosition.stackIndex] ||
          { index: 0, boxCount: 0, z: 0 };
        return {
          layer,
          countInLayer: visiblePositions.filter((position) => position.stackIndex === lastPosition.stackIndex).length,
        };
      }
    }

    let remaining = visibleCount;
    for (const layer of result.layers) {
      if (remaining <= layer.boxCount) {
        return { layer, countInLayer: remaining };
      }
      remaining -= layer.boxCount;
    }
    const last = result.layers[result.layers.length - 1] || { index: 0, boxCount: 0, z: 0 };
    return { layer: last, countInLayer: last.boxCount };
  }

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawCanvasMessage(ctx, width, height, message) {
    ctx.save();
    ctx.fillStyle = "rgba(245, 247, 251, 0.78)";
    ctx.font = "700 16px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, width / 2, height / 2);
    ctx.restore();
  }

  function drawError(message) {
    const { ctx, width, height } = resizeCanvas(elements.planCanvas);
    ctx.clearRect(0, 0, width, height);
    drawCanvasMessage(ctx, width, height, message);
    if (state.three) {
      clearThreeModel();
      state.three.renderer.render(state.three.scene, state.three.camera);
    }
  }

  function drawPlanView() {
    const result = state.result;
    const canvasState = resizeCanvas(elements.planCanvas);
    const { ctx, width, height } = canvasState;
    ctx.clearRect(0, 0, width, height);

    if (!result || !result.pattern) {
      drawCanvasMessage(ctx, width, height, "请输入可装载的纸箱尺寸");
      return;
    }

    const pad = 48;
    const container = result.container;
    const scale = Math.min((width - pad * 2) / container.length, (height - pad * 2) / container.width);
    const boxX = (width - container.length * scale) / 2;
    const boxY = (height - container.width * scale) / 2 + 10;
    const rgb = hexToRgb(state.color);
    const currentLayer = findCurrentLayer(result, state.visibleCount);

    ctx.save();
    ctx.translate(boxX, boxY);
    ctx.fillStyle = "rgba(20, 28, 37, 0.92)";
    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, 0, 0, container.length * scale, container.width * scale, 5);
    ctx.fill();
    ctx.stroke();

    const corner = result.cornerBlock;
    ctx.fillStyle = "rgba(255, 112, 102, 0.22)";
    ctx.strokeStyle = "rgba(255, 112, 102, 0.8)";
    ctx.lineWidth = 1;
    ctx.fillRect(0, 0, corner.length * scale, corner.width * scale);
    ctx.strokeRect(0, 0, corner.length * scale, corner.width * scale);
    ctx.fillRect(0, (container.width - corner.width) * scale, corner.length * scale, corner.width * scale);
    ctx.strokeRect(0, (container.width - corner.width) * scale, corner.length * scale, corner.width * scale);

    const layerPositions = result.layerPositions;
    const keyForPosition = (position) => `${position.x}:${position.y}:${position.dx}:${position.dy}`;
    const visiblePositionKeys = Array.isArray(result.orderedPositions)
      ? new Set(
          result.orderedPositions
            .slice(0, state.visibleCount)
            .filter((position) => position.stackIndex === currentLayer.layer.index)
            .map(keyForPosition),
        )
      : null;
    const visibleInLayer = Math.min(currentLayer.countInLayer, currentLayer.layer.boxCount || 0);
    let visibleDrawn = 0;

    for (const box of layerPositions) {
      const blocked = Packing.collidesCornerBlock(
        { ...box, z: currentLayer.layer.z || 0 },
        result.container,
        result.cornerBlock,
      );
      const isVisible = visiblePositionKeys
        ? !blocked && visiblePositionKeys.has(keyForPosition(box))
        : !blocked && visibleDrawn < visibleInLayer;
      if (!blocked && !visiblePositionKeys) visibleDrawn += 1;

      ctx.fillStyle = isVisible
        ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.82)`
        : blocked
          ? "rgba(255, 112, 102, 0.08)"
          : "rgba(255, 255, 255, 0.06)";
      ctx.strokeStyle = blocked ? "rgba(255, 112, 102, 0.55)" : "rgba(0, 0, 0, 0.9)";
      ctx.lineWidth = Math.max(0.65, Math.min(1.2, scale * 14));
      ctx.fillRect(box.x * scale, box.y * scale, box.dx * scale, box.dy * scale);
      ctx.strokeRect(box.x * scale, box.y * scale, box.dx * scale, box.dy * scale);
    }

    ctx.strokeStyle = "rgba(66, 214, 164, 0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, result.pattern.occupiedLength * scale, result.pattern.occupiedWidth * scale);
    drawPlanGroupLabels(ctx, result, scale);
    ctx.restore();

    drawOuterPlanLabels(ctx, result, boxX, boxY, scale, width, height, currentLayer);
  }

  function drawPlanGroupLabels(ctx, result, scale) {
    if (!result.pattern.groups.length) return;
    ctx.font = "700 12px Inter, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    if (result.pattern.family === "length-segments") {
      let x = 0;
      for (const group of result.pattern.groups) {
        const w = group.occupiedLength * scale;
        ctx.fillStyle = "rgba(3, 8, 14, 0.72)";
        ctx.fillRect(x * scale + 6, 7, Math.max(86, w - 12), 25);
        ctx.fillStyle = "#f5f7fb";
        ctx.fillText(`${group.label} ${group.count}列 · 占长 ${formatNumber(group.occupiedLength)}mm`, x * scale + w / 2, 20);
        x += group.occupiedLength;
      }
    } else {
      let y = 0;
      for (const group of result.pattern.groups) {
        const h = group.occupiedWidth * scale;
        ctx.save();
        ctx.translate(15, y * scale + h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = "rgba(3, 8, 14, 0.72)";
        ctx.fillRect(-72, -13, 144, 25);
        ctx.fillStyle = "#f5f7fb";
        ctx.fillText(`${group.label} ${group.count}排 · 占宽 ${formatNumber(group.occupiedWidth)}mm`, 0, 0);
        ctx.restore();
        y += group.occupiedWidth;
      }
    }
  }

  function drawOuterPlanLabels(ctx, result, boxX, boxY, scale, width, height, currentLayer) {
    const container = result.container;
    const planWidth = container.length * scale;
    const planHeight = container.width * scale;
    ctx.save();
    ctx.font = "700 12px Inter, sans-serif";
    ctx.fillStyle = "rgba(245, 247, 251, 0.92)";
    ctx.strokeStyle = "rgba(255,255,255,0.48)";
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(boxX, boxY + planHeight + 22);
    ctx.lineTo(boxX + planWidth, boxY + planHeight + 22);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillText(`柜长 ${formatNumber(container.length)}mm · 占用 ${formatNumber(result.pattern.occupiedLength)}mm`, boxX + planWidth / 2, boxY + planHeight + 42);

    ctx.beginPath();
    ctx.moveTo(boxX - 22, boxY);
    ctx.lineTo(boxX - 22, boxY + planHeight);
    ctx.stroke();
    ctx.save();
    ctx.translate(Math.max(16, boxX - 38), boxY + planHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`柜宽 ${formatNumber(container.width)}mm · 占用 ${formatNumber(result.pattern.occupiedWidth)}mm`, 0, 0);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(66, 214, 164, 0.96)";
    ctx.fillText(`第 ${currentLayer.layer.index + 1 || 0} 层：${formatNumber(currentLayer.countInLayer)} / ${formatNumber(currentLayer.layer.boxCount || 0)} 箱`, 18, 24);
    ctx.fillStyle = "rgba(255, 112, 102, 0.9)";
    ctx.fillText("红色区域为顶部角件避让区", 18, height - 20);
    ctx.fillStyle = "rgba(174, 184, 201, 0.9)";
    ctx.textAlign = "right";
    ctx.fillText("左侧为柜内最里面，右侧为柜门方向", width - 18, 24);
    ctx.restore();
  }

  function centeredPoint(point, container) {
    return {
      x: point.x - container.length / 2,
      y: point.y - container.width / 2,
      z: point.z - container.height / 2,
    };
  }

  function makeProjector(width, height, container) {
    const maxDimension = Math.max(container.length, container.width, container.height);
    const baseScale = (Math.min(width, height) * 0.74) / maxDimension;
    const sinY = Math.sin(state.camera.yaw);
    const cosY = Math.cos(state.camera.yaw);
    const sinP = Math.sin(state.camera.pitch);
    const cosP = Math.cos(state.camera.pitch);
    const scale = baseScale * state.camera.zoom;

    return function project(point) {
      const p = centeredPoint(point, container);
      const x1 = p.x * cosY - p.y * sinY;
      const y1 = p.x * sinY + p.y * cosY;
      const z1 = p.z;
      const y2 = y1 * cosP - z1 * sinP;
      const z2 = y1 * sinP + z1 * cosP;
      return {
        x: width / 2 + state.camera.panX + x1 * scale,
        y: height / 2 + state.camera.panY - z2 * scale,
        depth: y2,
      };
    };
  }

  function cuboidCorners(box) {
    const x0 = box.x;
    const y0 = box.y;
    const z0 = box.z;
    const x1 = box.x + box.dx;
    const y1 = box.y + box.dy;
    const z1 = box.z + box.dz;
    return [
      { x: x0, y: y0, z: z0 },
      { x: x1, y: y0, z: z0 },
      { x: x1, y: y1, z: z0 },
      { x: x0, y: y1, z: z0 },
      { x: x0, y: y0, z: z1 },
      { x: x1, y: y0, z: z1 },
      { x: x1, y: y1, z: z1 },
      { x: x0, y: y1, z: z1 },
    ];
  }

  function createCuboidFaces(box, project, fills, stroke, lineWidth) {
    const corners = cuboidCorners(box).map(project);
    const faceSets = [
      { indices: [0, 1, 2, 3], fill: fills.bottom },
      { indices: [4, 5, 6, 7], fill: fills.top },
      { indices: [0, 1, 5, 4], fill: fills.front },
      { indices: [1, 2, 6, 5], fill: fills.right },
      { indices: [2, 3, 7, 6], fill: fills.back },
      { indices: [3, 0, 4, 7], fill: fills.left },
    ];

    return faceSets.map((face) => {
      const points = face.indices.map((index) => corners[index]);
      const depth = points.reduce((sum, point) => sum + point.depth, 0) / points.length;
      return { points, depth, fill: face.fill, stroke, lineWidth };
    });
  }

  function drawFace(ctx, face) {
    ctx.beginPath();
    face.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fillStyle = face.fill;
    ctx.fill();
    if (face.stroke) {
      ctx.strokeStyle = face.stroke;
      ctx.lineWidth = face.lineWidth;
      ctx.stroke();
    }
  }

  function samplePositions(positions) {
    if (positions.length <= MAX_3D_BOXES) return positions;
    const step = positions.length / MAX_3D_BOXES;
    const sampled = [];
    for (let index = 0; index < MAX_3D_BOXES; index += 1) {
      sampled.push(positions[Math.floor(index * step)]);
    }
    return sampled;
  }

  function drawScene3d() {
    const result = state.result;
    if (!window.THREE) {
      const { ctx, width, height } = resizeCanvas(elements.sceneCanvas);
      ctx.clearRect(0, 0, width, height);
      drawCanvasMessage(ctx, width, height, "3D 渲染库未加载");
      return;
    }

    ensureThreeScene();
    resizeThreeRenderer();
    clearThreeModel();

    if (!result || !result.pattern) {
      renderThreeFrame();
      return;
    }

    const positions = Packing.generateBoxPositions(result, Math.min(state.visibleCount, MAX_3D_BOXES));
    addThreeContainer(result);
    addThreeBoxes(result, positions);
    updateThreeCamera(result.container);
    renderThreeFrame();
  }

  function ensureThreeScene() {
    if (state.three) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x071016);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);
    const renderer = new THREE.WebGLRenderer({
      canvas: elements.sceneCanvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const model = new THREE.Group();
    const ambient = new THREE.AmbientLight(0xffffff, 0.72);
    const key = new THREE.DirectionalLight(0xffffff, 1.18);
    const fill = new THREE.DirectionalLight(0x42d6a4, 0.4);
    key.position.set(5, 8, 6);
    fill.position.set(-4, 3, -5);
    scene.add(ambient, key, fill, model);

    state.three = {
      scene,
      camera,
      renderer,
      model,
      target: new THREE.Vector3(),
    };
  }

  function resizeThreeRenderer() {
    if (!state.three) return;
    const rect = elements.sceneCanvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    state.three.renderer.setSize(width, height, false);
    state.three.camera.aspect = width / height;
    state.three.camera.updateProjectionMatrix();
  }

  function clearThreeModel() {
    if (!state.three) return;
    while (state.three.model.children.length) {
      const child = state.three.model.children.pop();
      disposeThreeObject(child);
    }
  }

  function disposeThreeObject(object) {
    if (object.children) object.children.forEach(disposeThreeObject);
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material.dispose();
    }
  }

  function addThreeContainer(result) {
    const { container, cornerBlock } = result;
    const length = container.length * 0.001;
    const height = container.height * 0.001;
    const width = container.width * 0.001;

    const shellGeometry = new THREE.BoxGeometry(length, height, width);
    const shell = new THREE.Mesh(
      shellGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x42d6a4,
        transparent: true,
        opacity: 0.065,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const shellEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(shellGeometry),
      new THREE.LineBasicMaterial({ color: 0xe7f8f5, transparent: true, opacity: 0.72 }),
    );
    state.three.model.add(shell, shellEdges);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(length, width),
      new THREE.MeshBasicMaterial({
        color: 0x172a30,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -height / 2;
    state.three.model.add(floor);

    const blockGeometry = new THREE.BoxGeometry(
      cornerBlock.length * 0.001,
      cornerBlock.height * 0.001,
      cornerBlock.width * 0.001,
    );
    const blockMaterial = new THREE.MeshBasicMaterial({
      color: 0xff7066,
      transparent: true,
      opacity: 0.58,
    });
    const blockEdgeGeometry = new THREE.EdgesGeometry(blockGeometry);
    const blockEdgeMaterial = new THREE.LineBasicMaterial({ color: 0x050505 });
    const zPositions = [
      -width / 2 + (cornerBlock.width * 0.001) / 2,
      width / 2 - (cornerBlock.width * 0.001) / 2,
    ];

    for (const z of zPositions) {
      const block = new THREE.Mesh(blockGeometry, blockMaterial.clone());
      block.position.set(
        -length / 2 + (cornerBlock.length * 0.001) / 2,
        height / 2 - (cornerBlock.height * 0.001) / 2,
        z,
      );
      const edges = new THREE.LineSegments(blockEdgeGeometry, blockEdgeMaterial.clone());
      edges.position.copy(block.position);
      state.three.model.add(block, edges);
    }
  }

  function addThreeBoxes(result, positions) {
    if (!positions.length) return;

    const { container } = result;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({
      color: new THREE.Color(state.color),
      transparent: true,
      opacity: 0.92,
    });
    const edgeMaterial = new THREE.MeshBasicMaterial({
      color: 0x020202,
      wireframe: true,
      transparent: true,
      opacity: 0.88,
    });
    const boxes = new THREE.InstancedMesh(geometry, material, positions.length);
    const wires = new THREE.InstancedMesh(geometry, edgeMaterial, positions.length);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();

    positions.forEach((box, index) => {
      const position = new THREE.Vector3(
        (box.x + box.dx / 2 - container.length / 2) * 0.001,
        (box.z + box.dz / 2 - container.height / 2) * 0.001,
        (box.y + box.dy / 2 - container.width / 2) * 0.001,
      );
      const scale = new THREE.Vector3(
        Math.max(box.dx * 0.001 * 0.965, 0.001),
        Math.max(box.dz * 0.001 * 0.965, 0.001),
        Math.max(box.dy * 0.001 * 0.965, 0.001),
      );
      matrix.compose(position, quaternion, scale);
      boxes.setMatrixAt(index, matrix);
      wires.setMatrixAt(index, matrix);
    });

    boxes.instanceMatrix.needsUpdate = true;
    wires.instanceMatrix.needsUpdate = true;
    state.three.model.add(boxes, wires);
  }

  function updateThreeCamera(container) {
    const maxDimension = Math.max(container.length, container.width, container.height) * 0.001;
    const distance = Math.max(3, (maxDimension * 1.36) / state.camera.zoom);
    const targetScale = maxDimension / 780;
    state.three.target.set(state.camera.panX * targetScale, state.camera.panY * targetScale, 0);
    const cosPitch = Math.cos(state.camera.pitch);
    state.three.camera.position.set(
      state.three.target.x + distance * Math.sin(state.camera.yaw) * cosPitch,
      state.three.target.y + distance * Math.sin(state.camera.pitch),
      state.three.target.z + distance * Math.cos(state.camera.yaw) * cosPitch,
    );
    state.three.camera.lookAt(state.three.target);
  }

  function renderThreeFrame() {
    if (!state.three) return;
    state.three.renderer.render(state.three.scene, state.three.camera);
  }

  function drawContainerWireframe(ctx, result, project) {
    const container = result.container;
    const corners = cuboidCorners({
      x: 0,
      y: 0,
      z: 0,
      dx: container.length,
      dy: container.width,
      dz: container.height,
    }).map(project);
    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ];

    ctx.save();
    ctx.strokeStyle = "rgba(245, 247, 251, 0.72)";
    ctx.lineWidth = 1.4;
    for (const [start, end] of edges) {
      ctx.beginPath();
      ctx.moveTo(corners[start].x, corners[start].y);
      ctx.lineTo(corners[end].x, corners[end].y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(245, 247, 251, 0.75)";
    ctx.font = "700 12px Inter, sans-serif";
    ctx.textAlign = "center";
    const door = project({ x: container.length, y: container.width / 2, z: 0 });
    ctx.fillText("柜门", door.x, door.y + 18);
    const inner = project({ x: 0, y: container.width / 2, z: container.height });
    ctx.fillText("顶部角件", inner.x, inner.y - 12);
    ctx.restore();
  }

  function draw3dOverlay(ctx, width, height, visible, rendered) {
    ctx.save();
    ctx.fillStyle = "rgba(3, 8, 14, 0.66)";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    drawRoundedRect(ctx, 14, 14, 214, rendered < visible ? 64 : 42, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(245, 247, 251, 0.92)";
    ctx.font = "700 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`当前显示 ${formatNumber(visible)} 箱`, 26, 39);
    if (rendered < visible) {
      ctx.fillStyle = "rgba(255, 190, 85, 0.92)";
      ctx.fillText(`视图抽样 ${formatNumber(rendered)} 箱`, 26, 61);
    }
    ctx.fillStyle = "rgba(174, 184, 201, 0.88)";
    ctx.textAlign = "right";
    ctx.fillText("滚轮缩放 · 左键拖曳 · 中键旋转", width - 18, height - 18);
    ctx.restore();
  }

  function drawAll() {
    drawPlanView();
    drawScene3d();
  }

  function handleProgressInput() {
    state.visibleCount = Number(elements.progress.value);
    if (state.result) {
      elements.progressText.textContent = `${formatNumber(state.visibleCount)} / ${formatNumber(state.result.totalBoxes)}`;
    }
    drawAll();
  }

  function setupSceneControls() {
    const canvas = elements.sceneCanvas;
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.1 : 0.9;
      state.camera.zoom = Math.max(0.28, Math.min(4.5, state.camera.zoom * factor));
      drawScene3d();
    });

    canvas.addEventListener("mousedown", (event) => {
      event.preventDefault();
      state.camera.mode = event.button === 1 ? "rotate" : "pan";
      state.camera.lastX = event.clientX;
      state.camera.lastY = event.clientY;
      canvas.classList.toggle("rotating", state.camera.mode === "rotate");
      canvas.classList.toggle("panning", state.camera.mode === "pan");
    });

    window.addEventListener("mousemove", (event) => {
      if (!state.camera.mode) return;
      const dx = event.clientX - state.camera.lastX;
      const dy = event.clientY - state.camera.lastY;
      state.camera.lastX = event.clientX;
      state.camera.lastY = event.clientY;
      if (state.camera.mode === "rotate") {
        state.camera.yaw += dx * 0.01;
        state.camera.pitch = Math.max(0.18, Math.min(1.36, state.camera.pitch + dy * 0.006));
      } else {
        state.camera.panX += dx;
        state.camera.panY += dy;
      }
      drawScene3d();
    });

    window.addEventListener("mouseup", () => {
      state.camera.mode = null;
      canvas.classList.remove("rotating", "panning");
    });
    canvas.addEventListener("auxclick", (event) => event.preventDefault());
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  function bindEvents() {
    elements.containerType.addEventListener("change", () => {
      setContainerPreset(elements.containerType.value);
      markNeedsCalculation();
    });
    elements.form.addEventListener("input", (event) => {
      if (event.target === elements.cartonColor) return;
      markNeedsCalculation();
    });
    elements.form.addEventListener("submit", (event) => {
      event.preventDefault();
      calculateAndRender();
    });
    elements.calculateButton.addEventListener("click", () => calculateAndRender());
    elements.cartonColor.addEventListener("input", () => {
      updateColorValue();
      drawAll();
    });
    elements.packingMode.forEach((input) => {
      input.addEventListener("change", () => setPackingMode(input.value));
    });
    elements.skuCount.addEventListener("input", syncSkuCount);
    elements.skuStrategy.addEventListener("change", markNeedsCalculation);
    elements.skuList.addEventListener("input", (event) => {
      const card = event.target.closest(".sku-card");
      if (card) updateSkuFromCard(card);
      markNeedsCalculation();
    });
    elements.skuList.addEventListener("dragstart", (event) => {
      const card = event.target.closest(".sku-card");
      if (!card) return;
      state.draggedSkuId = card.dataset.skuId;
      event.dataTransfer.effectAllowed = "move";
    });
    elements.skuList.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    elements.skuList.addEventListener("drop", (event) => {
      event.preventDefault();
      const targetCard = event.target.closest(".sku-card");
      if (!targetCard || !state.draggedSkuId) return;
      const fromIndex = state.skus.findIndex((sku) => sku.id === state.draggedSkuId);
      const toIndex = state.skus.findIndex((sku) => sku.id === targetCard.dataset.skuId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
      const [moved] = state.skus.splice(fromIndex, 1);
      state.skus.splice(toIndex, 0, moved);
      state.draggedSkuId = null;
      renderSkuList();
      markNeedsCalculation();
    });
    elements.skuList.addEventListener("dragend", () => {
      state.draggedSkuId = null;
    });
    elements.progress.addEventListener("input", handleProgressInput);
    window.addEventListener("resize", drawAll);
    setupSceneControls();
  }

  setContainerPreset(elements.containerType.value);
  renderSkuList();
  bindEvents();
  calculateAndRender();
})();
