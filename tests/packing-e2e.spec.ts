import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

declare global {
  interface Window {
    __cartonColorClickCount: number;
  }
}

async function selectDropdownOption(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).click();
}

async function calculateSingleSku(page: Page, length: string, width: string, height: string) {
  await page.goto("/");
  await selectDropdownOption(page, "柜型", "40HQ");
  await page.fill("#carton-length", length);
  await page.fill("#carton-width", width);
  await page.fill("#carton-height", height);
  await page.getByRole("button", { name: "计算装载" }).click();
}

test("calculates the 488 x 380 x 291 benchmark and renders both views", async ({ page }) => {
  await calculateSingleSku(page, "488", "380", "291");

  await expect(page.locator("#total-boxes")).toHaveText("1,340");
  await expect(page.locator("#status-chip")).toHaveText("已完成计算");
  await expect(page.locator("#plan-canvas")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "俯视" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "侧视" }).click();
  await expect(page.getByRole("button", { name: "侧视" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".two-d-panel header span")).toHaveText("侧视图");
  await page.getByRole("button", { name: "端视" }).click();
  await expect(page.getByRole("button", { name: "端视" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".two-d-panel header span")).toHaveText("端视图");
  await expect(page.locator(".plan-group-summary")).toContainText("宽向 4排");
  await expect(page.locator(".plan-group-summary")).toContainText("占宽");
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

  const pixelCounts = await page.locator("#plan-canvas").evaluate((element) => {
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

  await cartonSection.getByRole("button", { name: "减少 长 mm" }).click();
  await expect(cartonLength).toHaveValue("480");
  await expect(page.locator("#status-chip")).toHaveText("待重新计算");

  await cartonLength.fill("1");
  await cartonLength.blur();
  await expect(cartonSection.getByRole("button", { name: "减少 长 mm" })).toBeDisabled();
  await expect(cartonLength).toHaveValue("1");
});

test("uses styled dropdown popovers for container and strategy selection", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("combobox", { name: "柜型" }).click();
  await expect(page.getByRole("listbox")).toBeVisible();
  const compactContainerLabel = page.locator(".base-select-item-label", { hasText: "20GP" });
  const compactContainerBox = await compactContainerLabel.boundingBox();
  expect(compactContainerBox?.width).toBeGreaterThan(40);
  await page.getByRole("option", { name: "40HQ" }).click();
  await expect(page.getByRole("combobox", { name: "柜型" })).toContainText("40HQ");
  await expect(page.locator("#container-length")).toHaveValue("12032");

  await page.getByRole("button", { name: "计算装载" }).click();
  await expect(page.locator("#total-boxes")).toHaveText("1,750");

  await page.getByLabel("多 SKU").check();
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

test("keeps the visualization workspace stable while the control panel scrolls", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("多 SKU").check();
  await page.locator("#sku-count").evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = input.max;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await expect(page.locator("#sku-count-value")).toHaveText("10");

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
      planHeight: Math.round(planPanel.getBoundingClientRect().height),
      sceneHeight: Math.round(scenePanel.getBoundingClientRect().height),
    };
  });

  expect(layout.documentScrollHeight).toBeLessThanOrEqual(layout.viewportHeight + 2);
  expect(layout.bodyScrollHeight).toBeLessThanOrEqual(layout.viewportHeight + 2);
  expect(layout.controlScrollHeight).toBeGreaterThan(layout.controlClientHeight + 20);
  expect(layout.workbenchBottom).toBeLessThanOrEqual(layout.viewportHeight - 18 + 2);
  expect(Math.abs(layout.planHeight - layout.sceneHeight)).toBeLessThanOrEqual(2);
});
