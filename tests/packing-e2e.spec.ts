import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function calculateSingleSku(page: Page, length: string, width: string, height: string) {
  await page.goto("/");
  await page.selectOption("#container-type", "40HQ");
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
