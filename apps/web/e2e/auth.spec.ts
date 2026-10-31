import { test, expect } from "@playwright/test";
import { uniqueEmail, signupAccount } from "./helpers";

// Fresh browser context so /login starts signed-out.
test.use({ storageState: { cookies: [], origins: [] } });

test("signup via UI creates account and redirects into dashboard", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle", timeout: 30_000 });

  const email = uniqueEmail("ui-signup");
  // Login page: name (signup mode) → email → password → submit.
  const nameInput = page.locator("input[type='text']");
  if (await nameInput.count()) {
    await nameInput.first().fill("E2E Tester");
  }
  await page.locator("input[type='email']").first().fill(email);
  await page.locator("input[type='password']").first().fill("E2ePassw0rd!x");
  await Promise.all([
    page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {}),
    page.locator("button[type='submit']").first().click(),
  ]);

  // Signup should land in the dashboard (sidebar layout), not back on /login.
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  await page.waitForSelector("aside", { timeout: 30_000 });
  expect(page.url()).not.toContain("/login");
});

test("logout via /api/auth/logout redirects to /login", async ({ request, browser }) => {
  // Signup gives a real session cookie in this request context.
  await signupAccount(request, "logout");
  const storageState = await request.storageState();
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  // Confirm the cookie actually authenticates the dashboard.
  await page.goto("/tasks", { waitUntil: "networkidle", timeout: 30_000 });
  await expect(page.locator("aside").first()).toBeVisible({ timeout: 30_000 });

  // Real logout endpoint from the same browser context (clears wb_session).
  const res = await page.request.post("/api/auth/logout");
  expect(res.ok()).toBeTruthy();

  const me = await page.request.get("/api/auth/me");
  // Session must be gone: 401 or an explicitly-unauthenticated body.
  if (me.ok()) {
    const body = await me.json();
    const user = body?.user ?? body?.data?.user ?? body?.authenticated ?? null;
    expect(user, "session must be cleared after logout").toBeFalsy();
  } else {
    expect(me.status()).toBe(401);
  }

  // Protected page must now bounce to /login through real middleware.
  await page.goto("/tasks", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForURL(/\/login/, { timeout: 30_000 });
  await context.close();
});