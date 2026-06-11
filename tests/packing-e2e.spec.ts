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
  await expect(page.locator("#scene-canvas")).toHaveCount(1);
  await expect(page.locator(".door-marker")).toHaveText("柜门");
});

test("calculates the 488 x 360 x 291 benchmark", async ({ page }) => {
  await calculateSingleSku(page, "488", "360", "291");

  await expect(page.locator("#total-boxes")).toHaveText("1,403");
  await expect(page.locator("#blocked-count")).toHaveText("1 箱");
});
