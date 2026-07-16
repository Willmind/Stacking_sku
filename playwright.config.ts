import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const macChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || (fs.existsSync(macChromePath) ? macChromePath : undefined);
const previewUrl = "http://127.0.0.1:4175/";

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*e2e\.spec\.ts/,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4175 --strictPort",
    url: previewUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL: previewUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
