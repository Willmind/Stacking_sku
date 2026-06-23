import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { strToU8, zipSync } from "fflate";
import { readSheet } from "read-excel-file/node";

declare global {
  interface Window {
    __cartonColorClickCount: number;
  }
}

async function selectDropdownOption(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).click();
}

async function expectNumberStepperIconsCentered(field: Locator) {
  const deltas = await field.locator(".base-number-actions").evaluate((actions) => {
    const actionsRect = actions.getBoundingClientRect();
    return Array.from(actions.querySelectorAll<HTMLElement>(".base-number-stepper")).map((stepper, index) => {
      const svg = stepper.querySelector("svg");
      if (!svg) throw new Error("Number stepper icon is missing");
      const svgRect = svg.getBoundingClientRect();
      const expectedX = actionsRect.left + actionsRect.width / 2;
      const expectedY = actionsRect.top + (actionsRect.height * (index + 0.5)) / 2;
      return {
        x: Math.abs(svgRect.left + svgRect.width / 2 - expectedX),
        y: Math.abs(svgRect.top + svgRect.height / 2 - expectedY),
      };
    });
  });

  for (const delta of deltas) {
    expect(delta.x).toBeLessThanOrEqual(0.75);
    expect(delta.y).toBeLessThanOrEqual(0.75);
  }
}

async function calculateSingleSku(page: Page, length: string, width: string, height: string) {
  await page.goto("/");
  await selectDropdownOption(page, "柜型", "40HQ");
  await page.fill("#carton-length", length);
  await page.fill("#carton-width", width);
  await page.fill("#carton-height", height);
  await page.getByRole("button", { name: "计算装载" }).click();
}

type WorkbookCell = string | number | null;

const batchImportHeaders = ["人工码垛数量（原始）", "尺寸（长宽高 mm）", "柜型"];

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index: number) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function workbookCellXml(value: WorkbookCell, columnIndex: number, rowIndex: number) {
  const reference = `${columnName(columnIndex)}${rowIndex}`;
  if (value === null || value === "") return `<c r="${reference}"/>`;
  if (typeof value === "number") return `<c r="${reference}"><v>${value}</v></c>`;
  return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function workbookSheetXml(rows: WorkbookCell[][]) {
  const lastRow = Math.max(1, rows.length);
  const lastColumn = columnName(batchImportHeaders.length - 1);
  const rowXml = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      return `<row r="${rowNumber}">${row.map((value, columnIndex) => workbookCellXml(value, columnIndex, rowNumber)).join("")}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function createBatchImportWorkbook(rows: WorkbookCell[][]) {
  const worksheetRows = [batchImportHeaders, ...rows];
  return Buffer.from(
    zipSync(
      {
        "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`),
        "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
        "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="批量导入" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
        "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`),
        "xl/worksheets/sheet1.xml": strToU8(workbookSheetXml(worksheetRows)),
      },
      { level: 6 },
    ),
  );
}

async function readSceneCanvasScreenshotFrame(page: Page) {
  const screenshot = await page.locator("#scene-canvas").screenshot();
  const dataUrl = `data:image/png;base64,${screenshot.toString("base64")}`;
  const frame = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Screenshot canvas context is missing");
    context.drawImage(image, 0, 0);

    const width = canvas.width;
    const height = canvas.height;
    const { data: pixels } = context.getImageData(0, 0, width, height);
    let litPixels = 0;
    let cargoPixels = 0;
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    let cargoMinY = height;
    let cargoMaxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const alpha = pixels[index + 3];
        const isContent = alpha > 0 && (red > 30 || green > 34 || blue > 34);
        if (!isContent) continue;
        litPixels += 1;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);

        const isCargo = red > 120 && green > 70 && green < 190 && blue < 90;
        if (!isCargo) continue;
        cargoPixels += 1;
        cargoMinY = Math.min(cargoMinY, y);
        cargoMaxY = Math.max(cargoMaxY, y);
      }
    }

    return {
      width,
      height,
      litPixels,
      cargoPixels,
      leftMargin: minX,
      rightMargin: width - 1 - maxX,
      topMargin: minY,
      bottomMargin: height - 1 - maxY,
      cargoTopMargin: cargoMinY,
      cargoBottomMargin: height - 1 - cargoMaxY,
    };
  }, dataUrl);
  return { ...frame, screenshotBytes: screenshot.byteLength };
}

test("calculates the 488 x 380 x 291 benchmark and renders both views", async ({ page }) => {
  await calculateSingleSku(page, "488", "380", "291");

  await expect(page.locator("#total-boxes")).toHaveText("1,340");
  await expect(page.locator("#status-chip")).toHaveText("已完成计算");
  await expect(page.locator("#status-chip")).toHaveClass(/status-chip--success/);
  await expect(page.locator("#strategy-notes")).toContainText("水平旋转");
  await expect(page.locator("#strategy-notes")).toContainText("角件避让");
  await expect(page.locator("#strategy-notes")).toContainText("空位回填");
  await expect(page.locator("#strategy-notes")).toContainText("SKU 策略");
  await expect(page.locator(".plan-view-card")).toHaveCount(2);
  await expect(page.locator(".plan-view-card--switchable")).toContainText("俯视图");
  await expect(page.locator(".plan-view-card--switchable .plan-view-status")).toContainText("当前显示");
  await expect(page.locator(".plan-view-card--switchable .plan-view-measure")).toContainText("柜长");
  await expect(page.locator(".plan-view-card--switchable .plan-view-switch")).toHaveCount(1);
  await expect(page.locator("#plan-canvas-top")).toHaveCount(1);
  await expect(page.locator("#plan-canvas-side")).toHaveCount(0);
  await expect(page.locator("#plan-canvas-front")).toHaveCount(1);
  await expect(page.locator(".plan-view-card--front")).toContainText("端视图");
  await expect(page.locator(".plan-view-card--front .plan-view-measure")).toContainText("柜宽");
  await expect(page.locator(".plan-group-summary")).toHaveCount(0);
  await expect(page.locator(".plan-view-switch")).toHaveCount(2);
  await expect(page.locator(".plan-view-card--front .plan-view-switch")).toHaveAttribute("aria-label", "切换端视图视角");
  await expect(page.locator(".plan-view-card--front .plan-view-switch")).toContainText("角件端");
  await expect(page.locator(".plan-view-card--front .plan-view-switch")).toContainText("柜门");
  await expect(page.locator(".plan-view-card--front .plan-view-switch").getByRole("button", { name: "角件端" })).toHaveClass(/is-active/);
  await page.locator(".plan-view-card--front .plan-view-switch").getByRole("button", { name: "柜门" }).click();
  await expect(page.locator(".plan-view-card--front .plan-view-switch").getByRole("button", { name: "柜门" })).toHaveClass(/is-active/);
  await page.locator(".plan-view-switch").getByRole("button", { name: "侧视" }).click();
  await expect(page.locator(".plan-view-card--switchable")).toContainText("侧视图");
  await expect(page.locator("#plan-canvas-top")).toHaveCount(0);
  await expect(page.locator("#plan-canvas-side")).toHaveCount(1);
  await expect(page.locator("#plan-canvas-front")).toHaveCount(1);
  await expect(page.locator("#scene-canvas")).toHaveCount(1);
  await expect(page.locator(".door-marker")).toHaveText("柜门");
});

test("calculates the 488 x 360 x 291 benchmark", async ({ page }) => {
  await calculateSingleSku(page, "488", "360", "291");

  await expect(page.locator("#total-boxes")).toHaveText("1,403");
  await expect(page.locator("#blocked-count")).toHaveText("1 箱");
});

test("sets the progress slider to full after the initial calculation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "计算装载" }).click();

  await expect(page.locator("#total-boxes")).toHaveText("755");
  await expect(page.locator("#progress-text")).toHaveText("755 / 755");
  await expect(page.locator("#stack-progress")).toHaveValue("755");
  await expect(page.locator("#stack-progress")).toHaveAttribute("style", /--range-progress:\s*100%/);
});

test("opens expanded dialogs for 2D and 3D visualizations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "计算装载" }).click();

  await page.locator(".plan-view-card--switchable").getByRole("button", { name: "放大俯视图" }).click();
  const planDialog = page.getByRole("dialog", { name: "放大查看 俯视图" });
  await expect(planDialog).toBeVisible();
  await expect(planDialog.locator("#expanded-plan-canvas")).toHaveCount(1);
  await planDialog.getByRole("button", { name: "关闭放大视图" }).click();
  await expect(planDialog).toHaveCount(0);

  await page.locator(".three-d-panel").getByRole("button", { name: "放大 3D 货柜渲染" }).click();
  const sceneDialog = page.getByRole("dialog", { name: "放大查看 3D 货柜渲染" });
  await expect(sceneDialog).toBeVisible();
  await expect(sceneDialog.locator("#expanded-scene-canvas")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(sceneDialog).toHaveCount(0);
});

test("scopes the carton color picker trigger and redraws canvas with the selected color", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => {
    const input = document.querySelector("#carton-color");
    if (!input) throw new Error("carton color input is missing");
    window.__cartonColorClickCount = 0;
    input.addEventListener("click", () => {
      window.__cartonColorClickCount += 1;
    });
  });

  await page.locator(".color-row strong").click();
  await expect.poll(() => page.evaluate(() => window.__cartonColorClickCount)).toBe(0);

  await page.locator("#carton-color").evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "#6e8bff";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByRole("button", { name: "计算装载" }).click();
  await expect(page.locator("#status-chip")).toHaveText("已完成计算");

  const pixelCounts = await page.locator("#plan-canvas-top").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D canvas context is missing");
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let bluePixels = 0;
    let orangePixels = 0;
    for (let index = 0; index < data.length; index += 16) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const alpha = data[index + 3];
      if (alpha < 180) continue;
      if (blue > red + 30 && blue > green + 20 && blue > 110) bluePixels += 1;
      if (red > green + 25 && green > blue + 15 && red > 120) orangePixels += 1;
    }
    return { bluePixels, orangePixels };
  });

  expect(pixelCounts.bluePixels).toBeGreaterThan(1000);
  expect(pixelCounts.bluePixels).toBeGreaterThan(pixelCounts.orangePixels);
});

test("opens the custom carton color popover and selects a swatch", async ({ page }) => {
  await page.goto("/");

  await page.locator(".color-row .carton-color").click();
  await expect(page.locator(".carton-color-popover")).toBeVisible();

  await page.getByRole("button", { name: "选择颜色 #6E8BFF" }).click();

  await expect(page.locator(".color-row .carton-color__value")).toHaveText("#6E8BFF");
  await expect(page.locator(".carton-color-popover")).toBeHidden();
});

test("adjusts number fields with styled steppers", async ({ page }) => {
  await page.goto("/");
  const cartonSection = page.locator('section[aria-label="纸箱规格"]');
  const cartonLength = page.locator("#carton-length");

  await expect(cartonLength).toHaveValue("480");
  const cartonLengthBox = await cartonLength.boundingBox();
  const cartonLengthStepperBox = await cartonSection.locator(".base-number-actions").first().boundingBox();
  expect(cartonLengthBox?.width).toBeGreaterThan(80);
  expect(cartonLengthStepperBox?.width).toBeLessThanOrEqual(32);

  await cartonSection.getByRole("button", { name: "增加 长 mm" }).click();
  await expect(cartonLength).toHaveValue("481");

  await page.getByRole("button", { name: "计算装载" }).click();
  await expect(page.locator("#status-chip")).toHaveText("已完成计算");
  await expect(page.locator("#status-chip")).toHaveClass(/status-chip--success/);

  await cartonSection.getByRole("button", { name: "减少 长 mm" }).click();
  await expect(cartonLength).toHaveValue("480");
  await expect(page.locator("#status-chip")).toHaveText("待重新计算");
  await expect(page.locator("#status-chip")).toHaveClass(/status-chip--dirty/);

  await cartonLength.fill("1");
  await cartonLength.blur();
  await expect(cartonSection.getByRole("button", { name: "减少 长 mm" })).toBeDisabled();
  await expect(cartonLength).toHaveValue("1");
});

test("keeps compact number field stepper icons visually centered", async ({ page }) => {
  await page.goto("/");

  await expectNumberStepperIconsCentered(page.locator(".clearance-number-field").first());

  await page.getByLabel("多 SKU").check();
  await expectNumberStepperIconsCentered(page.locator(".sku-number-field").first());
});

test("applies and persists container clearance inputs", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("STACKING_SKU_CLEARANCE"));
  await page.reload();

  await expect(page.getByText("车厢公差")).toBeVisible();
  await expect(page.getByText("按站在柜口正视柜内为基准")).toBeVisible();
  await expect(page.locator("#clearance-front")).toHaveValue("0");
  await page.locator("#clearance-front").fill("100");
  await page.locator("#clearance-front").blur();
  await page.locator("#carton-length").fill("2900");
  await page.locator("#carton-length").blur();
  await page.locator("#carton-width").fill("1150");
  await page.locator("#carton-width").blur();
  await page.locator("#carton-height").fill("1150");
  await page.locator("#carton-height").blur();

  await page.getByRole("button", { name: "计算装载" }).click();

  await expect(page.locator("#total-boxes")).toHaveText("4");
  await expect(page.locator("#effective-size")).toContainText("5,798 × 2,352 × 2,393 mm");
  await expect(page.locator("#strategy-notes")).toContainText("车厢公差");

  await page.reload();
  await expect(page.locator("#clearance-front")).toHaveValue("100");
});

test("uses styled dropdown popovers for container and strategy selection", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("combobox", { name: "柜型" }).click();
  await expect(page.getByRole("listbox")).toBeVisible();
  const compactContainerLabel = page.locator(".base-select-item-label", { hasText: "20GP" });
  const compactContainerBox = await compactContainerLabel.boundingBox();
  expect(compactContainerBox?.width).toBeGreaterThan(40);
  await expect(page.locator(".base-select-item", { hasText: "20GP" })).toContainText("5898 × 2352 × 2393 mm");
  await expect(page.locator(".base-select-item", { hasText: "40GP" })).toContainText("12032 × 2352 × 2393 mm");
  await expect(page.locator(".base-select-item", { hasText: "40HQ" })).toContainText("12032 × 2352 × 2698 mm");
  await page.getByRole("option", { name: "40HQ" }).click();
  const containerCombobox = page.getByRole("combobox", { name: "柜型" });
  await expect(containerCombobox).toContainText("40HQ");
  await expect(containerCombobox).toContainText("12032 × 2352 × 2698 mm");

  await page.getByRole("button", { name: "计算装载" }).click();
  await expect(page.locator("#total-boxes")).toHaveText("1,750");

  await page.getByLabel("多 SKU").check();
  await expect(page.locator("#sku-count")).toHaveAttribute("max", "5");
  await expect(page.locator("#sku-shared-length")).toHaveCount(0);
  await expect(page.locator("#sku-shared-width")).toHaveCount(0);
  await expect(page.locator("#sku-shared-height")).toHaveCount(0);
  await expect(page.locator("#sku-A-length")).toBeVisible();
  await expect(page.locator("#sku-A-width")).toBeVisible();
  await expect(page.locator("#sku-A-height")).toBeVisible();
  await expect(page.locator("#sku-B-length")).toBeVisible();
  await expect(page.locator("#sku-B-width")).toBeVisible();
  await expect(page.locator("#sku-B-height")).toBeVisible();
  await expect(page.locator(".sku-table-header")).toHaveCount(0);
  const skuCards = page.locator("#sku-list .sku-card");
  const firstSkuCardBox = await skuCards.nth(0).boundingBox();
  const secondSkuCardBox = await skuCards.nth(1).boundingBox();
  expect(firstSkuCardBox).not.toBeNull();
  expect(secondSkuCardBox).not.toBeNull();
  expect(firstSkuCardBox?.height).toBeLessThan(180);
  expect((secondSkuCardBox?.y ?? 0)).toBeGreaterThan((firstSkuCardBox?.y ?? 0) + (firstSkuCardBox?.height ?? 0) * 0.7);
  expect(Math.abs((firstSkuCardBox?.x ?? 0) - (secondSkuCardBox?.x ?? 0))).toBeLessThan(4);
  await expect(skuCards.first()).not.toHaveAttribute("draggable", "true");
  await expect(skuCards.first().locator(".drag-handle")).not.toHaveAttribute("draggable", "true");
  const firstSkuTitle = page.locator("#sku-list .sku-card strong").first();
  await expect(firstSkuTitle).toHaveText("SKU A");
  await expect(skuCards.first().locator(".base-number-input")).toHaveCount(4);
  const firstSkuTarget = page.locator("#sku-A-target");
  const secondSkuTarget = page.locator("#sku-B-target");
  const firstSkuTargetBox = await firstSkuTarget.boundingBox();
  const firstSkuColorBox = await skuCards.first().locator(".card-color-field .carton-color").boundingBox();
  const firstSkuLengthBox = await page.locator("#sku-A-length").boundingBox();
  const firstSkuWidthBox = await page.locator("#sku-A-width").boundingBox();
  const firstSkuHeightBox = await page.locator("#sku-A-height").boundingBox();
  const firstSkuControlWidths = await skuCards.first().locator(".sku-fields .base-number-control").evaluateAll((controls) =>
    controls.map((control) => Math.round(control.getBoundingClientRect().width)),
  );
  expect(firstSkuControlWidths).toHaveLength(4);
  expect(Math.min(...firstSkuControlWidths)).toBeGreaterThan(70);
  expect(firstSkuTargetBox?.width).toBeGreaterThan(38);
  expect(firstSkuColorBox?.width).toBeGreaterThanOrEqual(48);
  expect(Math.abs((firstSkuCardBox?.x ?? 0) + (firstSkuCardBox?.width ?? 0) - 16 - ((firstSkuColorBox?.x ?? 0) + (firstSkuColorBox?.width ?? 0)))).toBeLessThanOrEqual(3);
  expect(firstSkuLengthBox?.width).toBeGreaterThan(38);
  expect(firstSkuWidthBox?.width).toBeGreaterThan(38);
  expect(firstSkuHeightBox?.width).toBeGreaterThan(38);
  expect(Math.abs((firstSkuLengthBox?.y ?? 0) - (firstSkuWidthBox?.y ?? 0))).toBeLessThan(4);
  expect(Math.abs((firstSkuWidthBox?.y ?? 0) - (firstSkuHeightBox?.y ?? 0))).toBeLessThan(4);
  expect(Math.abs((firstSkuHeightBox?.y ?? 0) - (firstSkuTargetBox?.y ?? 0))).toBeLessThan(4);
  await firstSkuTarget.fill("111");
  await firstSkuTarget.blur();
  await secondSkuTarget.fill("222");
  await secondSkuTarget.blur();
  await page.locator("#sku-A-length").fill("240");
  await page.locator("#sku-A-length").blur();
  await page.locator("#sku-A-width").fill("100");
  await page.locator("#sku-A-width").blur();
  await page.locator("#sku-A-height").fill("100");
  await page.locator("#sku-A-height").blur();
  await page.locator("#sku-B-length").fill("120");
  await page.locator("#sku-B-length").blur();
  await page.locator("#sku-B-width").fill("180");
  await page.locator("#sku-B-width").blur();
  await page.locator("#sku-B-height").fill("100");
  await page.locator("#sku-B-height").blur();
  await expect(firstSkuTarget).toHaveValue("111");
  await expect(secondSkuTarget).toHaveValue("222");
  const firstSkuCardBoxAfterEdit = await skuCards.nth(0).boundingBox();
  const secondSkuCardBoxAfterEdit = await skuCards.nth(1).boundingBox();
  expect(firstSkuCardBoxAfterEdit).not.toBeNull();
  expect(secondSkuCardBoxAfterEdit).not.toBeNull();
  const firstHandleBox = await skuCards.nth(0).locator(".drag-handle").boundingBox();
  expect(firstHandleBox).not.toBeNull();
  await page.mouse.move((firstHandleBox?.x ?? 0) + 8, (firstHandleBox?.y ?? 0) + 8);
  await page.mouse.down();
  await page.mouse.move((firstSkuCardBoxAfterEdit?.x ?? 0) + 42, (firstSkuCardBoxAfterEdit?.y ?? 0) + 42);
  const dragPreview = page.locator(".sku-drag-preview");
  await expect(dragPreview).toBeVisible();
  await expect(dragPreview).toContainText("SKU A");
  const dragPreviewRotation = await dragPreview.evaluate((element) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { b: matrix.b, c: matrix.c };
  });
  expect(Math.abs(dragPreviewRotation.b)).toBeLessThan(0.001);
  expect(Math.abs(dragPreviewRotation.c)).toBeLessThan(0.001);
  const dragPreviewBox = await dragPreview.boundingBox();
  expect(dragPreviewBox?.width).toBeGreaterThan((firstSkuCardBoxAfterEdit?.width ?? 0) * 0.7);
  await page.mouse.move(
    (secondSkuCardBoxAfterEdit?.x ?? 0) + (secondSkuCardBoxAfterEdit?.width ?? 0) / 2,
    (secondSkuCardBoxAfterEdit?.y ?? 0) + (secondSkuCardBoxAfterEdit?.height ?? 0) / 2,
  );
  await expect(skuCards.nth(1)).toHaveClass(/sku-card--drop-target/);
  await page.mouse.up();
  await expect(skuCards.nth(0).locator("strong")).toHaveText("SKU B");
  await expect(skuCards.nth(1).locator("strong")).toHaveText("SKU A");
  await expect(skuCards.nth(0).locator(".base-number-input").nth(0)).toHaveValue("120");
  await expect(skuCards.nth(0).locator(".base-number-input").nth(1)).toHaveValue("180");
  await expect(skuCards.nth(0).locator(".base-number-input").nth(2)).toHaveValue("100");
  await expect(skuCards.nth(0).locator(".base-number-input").nth(3)).toHaveValue("222");
  await expect(skuCards.nth(1).locator(".base-number-input").nth(0)).toHaveValue("240");
  await expect(skuCards.nth(1).locator(".base-number-input").nth(1)).toHaveValue("100");
  await expect(skuCards.nth(1).locator(".base-number-input").nth(2)).toHaveValue("100");
  await expect(skuCards.nth(1).locator(".base-number-input").nth(3)).toHaveValue("111");
  await page.getByRole("combobox", { name: "装载策略" }).click();
  await expect(page.getByRole("listbox")).toBeVisible();
  const sameDestinationOption = page.getByRole("option", { name: "同卸货地/完整面优先" });
  const sameDestinationLabel = page.locator(".base-select-item-label", { hasText: "同卸货地/完整面优先" });
  const sameDestinationBox = await sameDestinationOption.boundingBox();
  const sameDestinationLabelBox = await sameDestinationLabel.boundingBox();
  expect(sameDestinationBox?.width).toBeGreaterThan(240);
  expect(sameDestinationBox?.height).toBeLessThan(72);
  expect(sameDestinationLabelBox?.width).toBeGreaterThan(150);
  await page.getByRole("option", { name: "同卸货地/完整面优先" }).click();
  await expect(page.getByRole("combobox", { name: "装载策略" })).toContainText("同卸货地/完整面优先");
});

test("labels heterogeneous multi SKU stack metrics without implying uniform layers", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("多 SKU").check();
  await page.locator("#sku-A-target").fill("2");
  await page.locator("#sku-A-target").blur();
  await page.locator("#sku-A-length").fill("3000");
  await page.locator("#sku-A-length").blur();
  await page.locator("#sku-A-width").fill("1000");
  await page.locator("#sku-A-width").blur();
  await page.locator("#sku-A-height").fill("900");
  await page.locator("#sku-A-height").blur();
  await page.locator("#sku-B-target").fill("2");
  await page.locator("#sku-B-target").blur();
  await page.locator("#sku-B-length").fill("2500");
  await page.locator("#sku-B-length").blur();
  await page.locator("#sku-B-width").fill("900");
  await page.locator("#sku-B-width").blur();
  await page.locator("#sku-B-height").fill("800");
  await page.locator("#sku-B-height").blur();

  await page.getByRole("button", { name: "计算装载" }).click();

  await expect(page.locator("#pattern-name")).toHaveText("异尺寸按 SKU 顺序分区");
  await expect(page.locator("#per-layer-count").locator("xpath=preceding-sibling::dt")).toHaveText("最大层级箱数");
  await expect(page.locator("#layer-count").locator("xpath=preceding-sibling::dt")).toHaveText("堆叠层级");
});

test("calculates heterogeneous multi SKU after face-first loading order", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("多 SKU").check();
  await page.locator("#sku-A-length").fill("250");
  await page.locator("#sku-A-length").blur();
  await page.locator("#sku-A-width").fill("320");
  await page.locator("#sku-A-width").blur();
  await page.locator("#sku-A-height").fill("260");
  await page.locator("#sku-A-height").blur();
  await page.locator("#sku-A-target").fill("100");
  await page.locator("#sku-A-target").blur();
  await page.locator("#sku-B-length").fill("500");
  await page.locator("#sku-B-length").blur();
  await page.locator("#sku-B-width").fill("320");
  await page.locator("#sku-B-width").blur();
  await page.locator("#sku-B-height").fill("260");
  await page.locator("#sku-B-height").blur();
  await page.locator("#sku-B-target").fill("100");
  await page.locator("#sku-B-target").blur();

  await page.getByRole("button", { name: "计算装载" }).click();

  await expect(page.locator("#total-boxes")).toHaveText("200");
  await expect(page.locator("#pattern-name")).toHaveText("异尺寸按 SKU 顺序分区");
  await expect(page.locator("#strategy-notes")).toContainText("水平旋转");
  await expect(page.locator("#strategy-notes")).toContainText("SKU 策略");
});

test("imports an Excel batch and shows calculated packing results in a dialog", async ({ page }) => {
  await page.goto("/");

  await page.setInputFiles("#batch-excel-input", "tests/fixtures/batch-import-sample.xlsx");
  await expect(page.getByRole("status")).toContainText("正在解析 Excel");
  await expect(page.getByRole("progressbar", { name: "Excel 导入进度" })).toBeVisible();

  const dialog = page.getByRole("dialog", { name: "批量导入结果" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("tbody tr")).toHaveCount(4);
  await expect(dialog).toContainText("共 4 条");
  await expect(dialog).toContainText("465*360*291");
  await expect(dialog).toContainText("40HQ");
  await expect(dialog).toContainText("1,740");
  await expect(dialog).toContainText("1,493");
  await expect(dialog).toContainText("1,200");
  await expect(dialog).toContainText("-247");
  await expect(dialog).toContainText("2");
  await expect(dialog).not.toContainText("每层数量");
  await expect(dialog).not.toContainText("占用高度");
  await expect(dialog.getByLabel("按导入状态筛选")).toBeVisible();
  await expect(dialog.getByLabel("按失败原因筛选")).toBeDisabled();
  await expect(dialog.getByLabel("按差值筛选")).toBeVisible();
  await expect(dialog.getByLabel("只看需复核")).toBeVisible();
  await expect(dialog).toContainText("状态");
  await expect(dialog).toContainText("失败原因");
  await expect(dialog).not.toContainText("导出失败行");
  await expect(dialog).not.toContainText("导出负差值");
  await expect(dialog.getByRole("button", { name: "导出需复核行" })).toBeVisible();

  const fileToFilterGap = await dialog.evaluate((element) => {
    const fileLine = element.querySelector(".file-line");
    const statusLabel = element.querySelector("#batch-status-filter-label");
    if (!fileLine || !statusLabel) throw new Error("Batch import filter layout anchors are missing");
    return Math.round(statusLabel.getBoundingClientRect().top - fileLine.getBoundingClientRect().bottom);
  });
  expect(fileToFilterGap).toBeLessThanOrEqual(24);

  const tableToFooterGap = await dialog.evaluate((element) => {
    const tableShell = element.querySelector(".result-table-shell");
    const footer = element.querySelector(".base-dialog-footer");
    if (!tableShell || !footer) throw new Error("Batch import table layout anchors are missing");
    return Math.round(footer.getBoundingClientRect().top - tableShell.getBoundingClientRect().bottom);
  });
  expect(tableToFooterGap).toBeLessThanOrEqual(24);

  const initialDialogHeight = await dialog.evaluate((element) => Math.round(element.getBoundingClientRect().height));

  await dialog.getByRole("button", { name: "按差值排序" }).click();
  await expect(dialog.locator("tbody tr").first()).toContainText("-247");
  await dialog.getByRole("button", { name: "按差值排序" }).click();
  await expect(dialog.locator("tbody tr").first()).toContainText("2");

  await dialog.getByLabel("按差值筛选").click();
  await page.getByRole("option", { name: "负差值" }).click();
  await expect(dialog.locator("tbody tr")).toHaveCount(1);
  await expect(dialog).toContainText("当前显示 1 条");
  await expect(dialog.locator("tbody tr").first()).toContainText("-247");
  await expect(dialog.getByRole("button", { name: "导出当前筛选" })).toBeVisible();

  const filteredDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "导出当前筛选" }).click();
  const filteredDownload = await filteredDownloadPromise;
  expect(filteredDownload.suggestedFilename()).toBe("batch-import-sample-当前筛选结果.xlsx");
  const filteredDownloadedPath = await filteredDownload.path();
  if (!filteredDownloadedPath) throw new Error("Downloaded filtered batch file is missing");
  const filteredRows = await readSheet(filteredDownloadedPath);
  expect(filteredRows[0]?.[0]).toBe("批量导入当前筛选结果");
  expect(filteredRows[1]).toEqual(["人工码垛数量（原始）", "尺寸（长宽高 mm）", "柜型", "最大装载量", "差值", "状态", "失败原因"]);
  expect(filteredRows).toHaveLength(3);
  expect(filteredRows[2]?.[1]).toBe("465*360*291");
  expect(filteredRows[2]?.[4]).toBe(-247);

  await dialog.getByRole("button", { name: "清除筛选" }).click();
  await expect(dialog.locator("tbody tr")).toHaveCount(4);
  await dialog.getByLabel("只看需复核").check();
  await expect(dialog.locator("tbody tr")).toHaveCount(1);
  await expect(dialog.locator("tbody tr").first()).toContainText("-247");
  await dialog.getByLabel("只看需复核").uncheck();
  await expect(dialog.locator("tbody tr")).toHaveCount(4);

  await dialog.getByLabel("按导入状态筛选").click();
  await page.getByRole("option", { name: "解析失败" }).click();
  await expect(dialog).toContainText("当前筛选没有结果");
  const emptyFilterDialogHeight = await dialog.evaluate((element) => Math.round(element.getBoundingClientRect().height));
  expect(Math.abs(emptyFilterDialogHeight - initialDialogHeight)).toBeLessThanOrEqual(8);
  await dialog.getByLabel("按导入状态筛选").click();
  await page.getByRole("option", { name: "全部", exact: true }).click();
  await expect(dialog.locator("tbody tr")).toHaveCount(4);

  const negativeDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "导出需复核行" }).click();
  const negativeDownload = await negativeDownloadPromise;
  expect(negativeDownload.suggestedFilename()).toBe("batch-import-sample-需复核行.xlsx");
  const negativeDownloadedPath = await negativeDownload.path();
  if (!negativeDownloadedPath) throw new Error("Downloaded negative-difference file is missing");
  const negativeRows = await readSheet(negativeDownloadedPath);
  expect(negativeRows[0]?.[0]).toBe("批量导入需复核行");
  expect(negativeRows[1]).toEqual(["人工码垛数量（原始）", "尺寸（长宽高 mm）", "柜型", "最大装载量", "差值", "状态", "失败原因"]);
  expect(negativeRows[2]?.[1]).toBe("465*360*291");
  expect(negativeRows[2]?.[4]).toBe(-247);
  expect(negativeRows[2]?.[5]).toBe("成功");
  expect(negativeRows).toHaveLength(3);

  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "下载结果" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("batch-import-sample-装载结果.xlsx");
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error("Downloaded batch result file is missing");
  const downloadedRows = await readSheet(downloadedPath);
  expect(downloadedRows[0]?.[0]).toBe("批量导入结果");
  expect(downloadedRows[1]).toEqual(["人工码垛数量（原始）", "尺寸（长宽高 mm）", "柜型", "最大装载量", "差值"]);
  expect(downloadedRows[2]?.[0]).toBe(1740);
  expect(downloadedRows[2]?.[1]).toBe("465*360*291");
  expect(downloadedRows[2]?.[3]).toBe(1493);
  expect(downloadedRows[2]?.[4]).toBe(-247);
  expect(downloadedRows[4]?.[4]).toBe(2);

  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(dialog).toBeHidden();
});

test("keeps the batch import dialog height stable for empty and large results", async ({ page }) => {
  await page.goto("/");

  const largeWorkbook = createBatchImportWorkbook(
    Array.from({ length: 80 }, (_, index) => [
      3300 + index,
      index % 2 === 0 ? "315*258*250" : "385*260*255",
      "40HQ",
    ]),
  );
  await page.setInputFiles("#batch-excel-input", {
    name: "large-batch.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: largeWorkbook,
  });

  const dialog = page.getByRole("dialog", { name: "批量导入结果" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("tbody tr")).toHaveCount(80);
  const largeDialogHeight = await dialog.evaluate((element) => Math.round(element.getBoundingClientRect().height));
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(dialog).toBeHidden();

  const emptyWorkbook = createBatchImportWorkbook([]);
  await page.setInputFiles("#batch-excel-input", {
    name: "empty-batch.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: emptyWorkbook,
  });

  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("没有读取到可计算的数据");
  const emptyDialogHeight = await dialog.evaluate((element) => Math.round(element.getBoundingClientRect().height));
  expect(Math.abs(emptyDialogHeight - largeDialogHeight)).toBeLessThanOrEqual(8);
});

test("downloads the batch import template workbook", async ({ page }) => {
  await page.goto("/");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载模版" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("模版文件.xlsx");
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error("Downloaded template file is missing");
  const templateRows = await readSheet(downloadedPath);
  expect(templateRows[0]).toEqual(["人工码垛数量（原始）", "尺寸（长宽高 mm）", "柜型"]);
  expect(templateRows[1]).toEqual([1470, "465*360*291", "40HQ"]);
});

test("keeps the visualization workspace stable while the control panel scrolls", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("多 SKU").check();
  await page.locator("#sku-count").evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = input.max;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await expect(page.locator("#sku-count-value")).toHaveText("5");
  await expect(page.locator("#sku-count")).toHaveAttribute("style", /--range-progress:\s*100%/);

  const layout = await page.evaluate(() => {
    const controlPanel = document.querySelector(".control-panel") as HTMLElement | null;
    const workbench = document.querySelector(".workbench") as HTMLElement | null;
    const planPanel = document.querySelector(".two-d-panel") as HTMLElement | null;
    const scenePanel = document.querySelector(".three-d-panel") as HTMLElement | null;
    if (!controlPanel || !workbench || !planPanel || !scenePanel) {
      throw new Error("Layout elements are missing");
    }
    return {
      viewportHeight: window.innerHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      bodyScrollHeight: document.body.scrollHeight,
      controlClientHeight: controlPanel.clientHeight,
      controlScrollHeight: controlPanel.scrollHeight,
      workbenchBottom: workbench.getBoundingClientRect().bottom,
      planTop: Math.round(planPanel.getBoundingClientRect().top),
      sceneTop: Math.round(scenePanel.getBoundingClientRect().top),
      planHeight: Math.round(planPanel.getBoundingClientRect().height),
      sceneHeight: Math.round(scenePanel.getBoundingClientRect().height),
    };
  });

  expect(layout.documentScrollHeight).toBeLessThanOrEqual(layout.viewportHeight + 2);
  expect(layout.bodyScrollHeight).toBeLessThanOrEqual(layout.viewportHeight + 2);
  expect(layout.controlScrollHeight).toBeGreaterThan(layout.controlClientHeight + 20);
  expect(layout.workbenchBottom).toBeLessThanOrEqual(layout.viewportHeight - 18 + 2);
  expect(layout.planTop).toBeLessThan(layout.sceneTop);
  expect(layout.planHeight).toBeGreaterThanOrEqual(360);
  expect(layout.sceneHeight).toBeGreaterThan(200);
  expect(layout.planHeight).toBeGreaterThan(layout.sceneHeight);
});

test("keeps 2D and 3D panels visible within a 14-inch notebook viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "计算装载" }).click();

  const layout = await page.evaluate(() => {
    const viewsGrid = document.querySelector(".views-grid") as HTMLElement | null;
    const planPanel = document.querySelector(".two-d-panel") as HTMLElement | null;
    const scenePanel = document.querySelector(".three-d-panel") as HTMLElement | null;
    const resultStack = document.querySelector(".result-stack") as HTMLElement | null;
    const batchImport = document.querySelector(".batch-import") as HTMLElement | null;
    if (!viewsGrid || !planPanel || !scenePanel) {
      throw new Error("Visualization panels are missing");
    }
    if (!resultStack || !batchImport) {
      throw new Error("Control panel result elements are missing");
    }
    const gridRect = viewsGrid.getBoundingClientRect();
    const planRect = planPanel.getBoundingClientRect();
    const sceneRect = scenePanel.getBoundingClientRect();
    const resultRect = resultStack.getBoundingClientRect();
    const batchRect = batchImport.getBoundingClientRect();
    return {
      gridClientHeight: viewsGrid.clientHeight,
      gridScrollHeight: viewsGrid.scrollHeight,
      gridBottom: Math.round(gridRect.bottom),
      planHeight: Math.round(planRect.height),
      sceneHeight: Math.round(sceneRect.height),
      sceneBottom: Math.round(sceneRect.bottom),
      resultTop: Math.round(resultRect.top),
      batchTop: Math.round(batchRect.top),
    };
  });

  expect(layout.gridScrollHeight).toBeLessThanOrEqual(layout.gridClientHeight + 2);
  expect(layout.sceneBottom).toBeLessThanOrEqual(layout.gridBottom + 2);
  expect(layout.planHeight).toBeGreaterThanOrEqual(360);
  expect(layout.sceneHeight).toBeGreaterThanOrEqual(280);
  expect(layout.planHeight).toBeGreaterThan(layout.sceneHeight);
  expect(layout.resultTop).toBeLessThan(layout.batchTop);

  const desktopFrame = await readSceneCanvasScreenshotFrame(page);
  expect(desktopFrame.screenshotBytes).toBeGreaterThan(1000);
  expect(desktopFrame.litPixels).toBeGreaterThan(1000);
  expect(desktopFrame.cargoPixels).toBeGreaterThan(1000);
  expect(desktopFrame.cargoBottomMargin).toBeGreaterThan(8);
  expect(desktopFrame.topMargin).toBeGreaterThan(8);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "计算装载" }).click();
  const mobileFrame = await readSceneCanvasScreenshotFrame(page);
  expect(mobileFrame.screenshotBytes).toBeGreaterThan(1000);
  expect(mobileFrame.litPixels).toBeGreaterThan(1000);
  expect(mobileFrame.cargoPixels).toBeGreaterThan(1000);
  expect(mobileFrame.cargoBottomMargin).toBeGreaterThan(8);
});

test("keeps small viewport page height bounded", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "计算装载" }).click();

  const initial = await page.evaluate(() => ({
    viewportHeight: window.innerHeight,
    documentScrollHeight: document.documentElement.scrollHeight,
    bodyScrollHeight: document.body.scrollHeight,
    appHeight: Math.round(document.querySelector(".app-shell")?.getBoundingClientRect().height ?? 0),
    workbenchHeight: Math.round(document.querySelector(".workbench")?.getBoundingClientRect().height ?? 0),
    viewsHeight: Math.round(document.querySelector(".views-grid")?.getBoundingClientRect().height ?? 0),
    planHeight: Math.round(document.querySelector(".two-d-panel")?.getBoundingClientRect().height ?? 0),
    sceneHeight: Math.round(document.querySelector(".three-d-panel")?.getBoundingClientRect().height ?? 0),
  }));

  await page.mouse.wheel(0, 6000);
  await page.waitForTimeout(250);
  const afterScroll = await page.evaluate(() => ({
    documentScrollHeight: document.documentElement.scrollHeight,
    bodyScrollHeight: document.body.scrollHeight,
    scrollY: Math.round(window.scrollY),
    appHeight: Math.round(document.querySelector(".app-shell")?.getBoundingClientRect().height ?? 0),
    workbenchHeight: Math.round(document.querySelector(".workbench")?.getBoundingClientRect().height ?? 0),
    viewsHeight: Math.round(document.querySelector(".views-grid")?.getBoundingClientRect().height ?? 0),
  }));

  expect(initial.documentScrollHeight).toBeLessThanOrEqual(initial.viewportHeight * 4.6);
  expect(initial.bodyScrollHeight).toBeLessThanOrEqual(initial.viewportHeight * 4.6);
  expect(initial.workbenchHeight).toBeLessThanOrEqual(1180);
  expect(initial.viewsHeight).toBeLessThanOrEqual(1060);
  expect(initial.planHeight).toBeGreaterThan(0);
  expect(initial.sceneHeight).toBeGreaterThan(0);
  expect(afterScroll.documentScrollHeight).toBeLessThanOrEqual(initial.documentScrollHeight + 2);
  expect(afterScroll.bodyScrollHeight).toBeLessThanOrEqual(initial.bodyScrollHeight + 2);
  expect(afterScroll.workbenchHeight).toBeLessThanOrEqual(initial.workbenchHeight + 2);
  expect(afterScroll.viewsHeight).toBeLessThanOrEqual(initial.viewsHeight + 2);
});
