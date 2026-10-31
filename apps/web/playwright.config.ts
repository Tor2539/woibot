import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Some machines (offline / download blocked) keep a shared chromium cache;
// use it only when it actually exists so other machines and CI fall back
// to Playwright's normal browser lookup.
const sharedBrowsers = "C:\\Users\\WINDOWS\\OpenHandsTools\\pw-browsers";
if (process.env.PLAYWRIGHT_BROWSERS_PATH === undefined && existsSync(sharedBrowsers)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = sharedBrowsers;
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      PORT: "3100",
    },
  },
});