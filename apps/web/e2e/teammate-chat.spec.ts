import { test, expect } from "@playwright/test";
import { signupAccount, gotoStable, loginPage } from "./helpers";

test.beforeEach(async ({ request }) => {
  await signupAccount(request, "chat");
});

test.describe.configure({ mode: "serial" });

/**
 * KEY HONEST-FAILURE TEST: without TOGETHER_API_KEY the backend must fail
 * loudly (callWoibotLLM throws "TOGETHER_API_KEY is not configured" → 500).
 * The chat API must return a real error — never a fabricated assistant reply.
 * NOTE: the message avoids Work-deliverable keywords so routeIntent keeps it
 * on the teammate chat path (which is the path that fails honestly).
 */
test("chat send hits real LLM path and fails loudly without API key", async ({ request, browser }) => {
  const page = await loginPage(request, browser, "/teammate");

  // The composer textarea (its placeholder contains the bot name).
  const composer = page.locator("textarea").last();
  await expect(composer).toBeVisible({ timeout: 30_000 });

  const msg = `ทดสอบ E2E honest failure ${Date.now()}`;
  const chatResponse = page.waitForResponse(
    (r) => r.url().includes("/api/chat") && r.request().method() === "POST",
    { timeout: 30_000 }
  );
  await composer.click();
  await composer.pressSequentially(msg, { delay: 5 });
  // Wait for hydration: React state must hold the typed text before Enter.
  await expect(composer).toHaveValue(msg, { timeout: 15_000 });
  await page.waitForTimeout(500);
  await composer.press("Enter");

  // Hydration race: if Enter landed before React attached onKeyDown, retry once.
  try {
    await expect(page.getByText(msg).first()).toBeVisible({ timeout: 8_000 });
  } catch {
    await composer.press("Enter");
    await expect(page.getByText(msg).first()).toBeVisible({ timeout: 30_000 });
  }

  // Backend must fail loudly: 500 from /api/chat, not a fake 200 reply.
  const res = await chatResponse;
  expect(res.status(), "chat API must fail without TOGETHER_API_KEY").toBe(500);
  const body = await res.json().catch(() => ({}));
  const errMsg = String(body?.error ?? body?.data?.error ?? "");
  expect(errMsg).toContain("TOGETHER_API_KEY");

  // Honest UI behaviour: no assistant reply may appear for this message.
  await page.waitForTimeout(5_000);
  const feed = await page.locator("body").innerText();
  expect(feed).toContain(msg);
  // A fabricated success would claim completion — assert none.
  expect(feed, "assistant must not fabricate success").not.toMatch(
    /E2E honest failure.*(completed|เสร็จ|สำเร็จ)/i
  );

  await page.close();
});
