import type { APIRequestContext, Browser, Page } from "@playwright/test";

export type TestAccount = {
  email: string;
  password: string;
};

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`;
}

/**
 * Signup via the real API (POST /api/auth/signup). This seeds a starter
 * workspace (lib/starter.ts) and sets the wb_session cookie on the request
 * context.
 */
export async function signupAccount(
  request: APIRequestContext,
  prefix = "e2e"
): Promise<TestAccount> {
  const account: TestAccount = {
    email: uniqueEmail(prefix),
    password: "E2ePassw0rd!x",
  };
  const res = await request.post("/api/auth/signup", {
    data: { email: account.email, password: account.password },
  });
  if (!res.ok()) {
    throw new Error(`signup failed (${res.status()}): ${await res.text()}`);
  }
  return account;
}

/** Authenticate a page by copying the wb_session cookie from a request context. */
export async function loginPage(
  request: APIRequestContext,
  browser: Browser,
  path: string
): Promise<Page> {
  const storageState = await request.storageState();
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
  return page;
}

/** Navigate and wait for Next dev first-compile + hydration to settle. */
export async function gotoStable(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle", timeout: 30_000 });
  // Sidebar renders post-hydration; wait for it so heading assertions are stable.
  await page.waitForSelector("aside", { timeout: 30_000 });
}

/** Create a work task through the real API (goal is required by the route). */
export async function createWorkTask(
  request: APIRequestContext,
  title: string
): Promise<string> {
  const res = await request.post("/api/tasks", {
    data: { goal: title, title, product: "work", workKind: "coding" },
  });
  if (!res.ok()) {
    throw new Error(`create task failed (${res.status()}): ${await res.text()}`);
  }
  const json = await res.json();
  const task = json?.data ?? json;
  return String(task.id);
}