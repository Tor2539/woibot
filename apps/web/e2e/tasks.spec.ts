import { test, expect } from "@playwright/test";
import { signupAccount, gotoStable, createWorkTask, loginPage } from "./helpers";

test.beforeEach(async ({ request }) => {
  await signupAccount(request, "tasks");
});

test.describe.configure({ mode: "serial" });

test("create a work task via API and see it listed on /tasks", async ({ request, browser }) => {
  const title = `E2E work task ${Date.now()}`;
  await createWorkTask(request, title);

  const page = await loginPage(request, browser, "/tasks");
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 30_000 });
  await page.close();
});

test("status filter buttons change the task list", async ({ request, browser }) => {
  const title = `E2E filter task ${Date.now()}`;
  await createWorkTask(request, title);

  const page = await loginPage(request, browser, "/tasks");
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 30_000 });

  const listBefore = await page.locator("main").innerText();

  // Click a status filter that excludes the queued task; list content must change.
  const planningBtn = page.getByRole("button", { name: /^planning \(/i }).first();
  await expect(planningBtn).toBeVisible({ timeout: 30_000 });
  await planningBtn.click();
  await page.waitForTimeout(800);
  const listAfter = await page.locator("main").innerText();
  expect(listAfter).not.toBe(listBefore);

  // Back to All: the task is visible again.
  await page.getByRole("button", { name: /^all \(/i }).first().click();
  await page.waitForTimeout(800);
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 30_000 });
  await page.close();
});

test("Run button (POST /api/tasks/[id]/run) shows honest result banner", async ({ request, browser }) => {
  const title = `E2E run task ${Date.now()}`;
  await createWorkTask(request, title);

  const page = await loginPage(request, browser, "/tasks");
  const row = page.getByText(title).first();
  await expect(row).toBeVisible({ timeout: 30_000 });

  // Click the real Run control; it POSTs /api/tasks/[id]/run and shows a
  // result banner (success OR honest failure — never silent).
  const runBtn = page.getByRole("button", { name: /^run$/i }).first();
  await expect(runBtn).toBeVisible({ timeout: 30_000 });
  await runBtn.click();

  // Banner appears with either the running notice or an honest result.
  await expect(
    page.getByText(/กำลังรัน|เสร็จแล้ว|ยังไม่ผ่าน|รันไม่สำเร็จ/).first()
  ).toBeVisible({ timeout: 30_000 });

  // The board must still render after the PATCH/run cycle (no crash).
  await expect(page.locator("main").first()).toBeVisible();
  await page.close();
});
