import { defineConfig, devices } from "@playwright/test";

// The toolkit ships a matching chromium in its own browsers cache; use it when
// the default ms-playwright cache is unavailable (offline / download blocked).
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || "C:\\Users\\WINDOWS\\OpenHandsTools\\pw-browsers";

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