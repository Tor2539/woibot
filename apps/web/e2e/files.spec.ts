import { test, expect } from "@playwright/test";
import { signupAccount, gotoStable, loginPage } from "./helpers";

test.beforeEach(async ({ request }) => {
  await signupAccount(request, "files");
});

test.describe.configure({ mode: "serial" });

test("/files loads and renders empty state or list", async ({ request, browser }) => {
  const page = await loginPage(request, browser, "/files");
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  await gotoStable(page, "/files");
  const main = page.locator("main").first();
  await expect(main).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });

  // Fresh account: either an explicit empty state or a file list must render.
  const emptyState = main.getByText(/ยังไม่มีไฟล์|ไม่พบไฟล์|no files/i).first();
  const listRows = main.locator("table tbody tr, li");
  const hasEmpty = await emptyState.isVisible({ timeout: 5_000 }).catch(() => false);
  const hasRows = (await listRows.count()) > 0;
  expect(hasEmpty || hasRows, "/files must render either an empty state or a list").toBe(true);

  expect(errors, `unhandled pageerror on /files: ${errors.join(" | ")}`).toEqual([]);
  await page.close();
});
