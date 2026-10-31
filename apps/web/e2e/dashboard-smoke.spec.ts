import { test, expect } from "@playwright/test";
import { signupAccount, gotoStable, loginPage } from "./helpers";

const PROTECTED_PAGES = [
  "/tasks",
  "/routines",
  "/apps",
  "/files",
  "/team",
  "/settings",
  "/computer",
  "/work",
  "/teammate",
] as const;

test.beforeEach(async ({ request }) => {
  await signupAccount(request, "smoke");
});

test.describe.configure({ mode: "serial" });

// Each protected page must load through real middleware+auth+data path with
// hydration completing and no unhandled page errors.
for (const path of PROTECTED_PAGES) {
  test(`page ${path} loads with sidebar and no pageerror`, async ({ request, browser }) => {
    const page = await loginPage(request, browser, path);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(String(err)));

    await gotoStable(page, path);

    // Sidebar is the shell of every dashboard page.
    await expect(page.locator("aside").first()).toBeVisible({ timeout: 30_000 });

    // Main heading rendered by the page itself.
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });

    expect(errors, `unhandled pageerror on ${path}: ${errors.join(" | ")}`).toEqual([]);
  });
}

test("/settings shows Isolated Usage Ledger filters and pagination", async ({ request, browser }) => {
  // Seed one real ledger event (teammate task creation writes a usage event).
  const res = await request.post("/api/tasks", {
    data: { goal: "e2e ledger seed task", product: "teammate" },
  });
  expect(res.ok(), `seed task failed: ${await res.text()}`).toBeTruthy();

  const page = await loginPage(request, browser, "/settings");

  await expect(page.getByText(/Isolated Usage Ledger/i).first()).toBeVisible({ timeout: 30_000 });

  // Filter buttons render counts: all (N) / teammate (N) / work (N).
  // DOM text is lowercase with `capitalize` CSS, so match case-insensitively.
  await expect(page.getByRole("button", { name: /^all/i }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /^teammate/i }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^work/i }).first()).toBeVisible();

  // At least one real event must be listed, with the pagination line.
  await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/แสดง\s*\d+[–-]\d+\s*จาก\s*\d+/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/หน้า\s*\d+\s*\/\s*\d+/).first()).toBeVisible();
  await page.close();
});

test("/computer renders honest simulated-mode status without crashing", async ({ request, browser }) => {
  const page = await loginPage(request, browser, "/computer");
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });

  // Local mode (no MANAGER_URL): GET /api/computer returns status "simulated".
  const api = await page.request.get("/api/computer");
  if (api.ok()) {
    const body = await api.json();
    const computer = body?.data?.computer ?? body?.computer;
    if (computer?.status) {
      expect(computer.status).toBe("simulated");
    }
  }

  // Honest simulated mode: no live screen image should be streaming.
  await expect(page.locator("img[src*='action=screen']")).toHaveCount(0, { timeout: 10_000 });

  await page.waitForTimeout(1_000);
  expect(errors, `unhandled pageerror on /computer: ${errors.join(" | ")}`).toEqual([]);
});

