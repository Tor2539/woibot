import { test, expect } from "@playwright/test";
import { signupAccount, gotoStable, uniqueEmail, loginPage } from "./helpers";

test.beforeEach(async ({ request }) => {
  await signupAccount(request, "routines");
});

test.describe.configure({ mode: "serial" });

/**
 * Compute the next occurrence of a 5-field cron INDEPENDENTLY of the app's own
 * cron code (lib/cron.ts), strictly-after `from`, in UTC — mirroring the
 * documented contract. This is the test's own oracle, not a copy of the app.
 */
function nextCronAfter(
  from: Date,
  minute = "*/2",
  hour = "*",
  dom = "*",
  month = "*",
  dow = "*"
): Date {
  const t = new Date(from.getTime() + 60_000);
  t.setUTCSeconds(0, 0);
  for (let i = 0; i < 60 * 24 * 3; i++) {
    if (month !== "*" && !(t.getUTCMonth() + 1 === Number(month))) {
      t.setUTCMonth(t.getUTCMonth() + 1, 1);
      t.setUTCHours(0, 0, 0, 0);
      continue;
    }
    if (dom !== "*" && !(t.getUTCDate() === Number(dom))) {
      t.setUTCDate(t.getUTCDate() + 1);
      t.setUTCHours(0, 0, 0, 0);
      continue;
    }
    if (dow !== "*" && !(t.getUTCDay() === Number(dow))) {
      t.setUTCDate(t.getUTCDate() + 1);
      t.setUTCHours(0, 0, 0, 0);
      continue;
    }
    const hourMatch =
      hour === "*" || t.getUTCHours() === Number(hour) || (hour.startsWith("*/") && t.getUTCHours() % Number(hour.slice(2)) === 0);
    const minuteMatch =
      minute === "*" ||
      t.getUTCMinutes() === Number(minute) ||
      (minute.startsWith("*/") && t.getUTCMinutes() % Number(minute.slice(2)) === 0);
    if (hourMatch && minuteMatch) return t;
    t.setUTCMinutes(t.getUTCMinutes() + 1);
  }
  throw new Error("no cron match found");
}

type RoutineApi = {
  id?: string;
  title?: string;
  trigger?: { expr?: string } | null;
  nextRun?: string | null;
  status?: string;
};

async function listRoutines(request: any): Promise<RoutineApi[]> {
  const res = await request.get("/api/routines");
  expect(res.ok(), `GET /api/routines failed: ${res.status()}`).toBeTruthy();
  const json = await res.json();
  return (json?.data?.routines ?? json?.data ?? json?.routines ?? []) as RoutineApi[];
}

test("create a cron routine via UI, verify computed next-run, then disable it", async ({ request, browser }) => {
  const name = `E2E routine ${uniqueEmail("x").split("-")[1]}-${Date.now() % 100000}`;
  const before = new Date();

  const page = await loginPage(request, browser, "/routines");

  // Open the create form.
  const createBtn = page.getByRole("button", { name: /create automated routine/i }).first();
  await expect(createBtn).toBeVisible({ timeout: 30_000 });
  await createBtn.click();

  // Hydration race: if the click lands before React attaches onClick, retry once.
  const dialog = page.getByRole("dialog");
  try {
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  } catch {
    await createBtn.click();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
  }

  // Form fields (grid): 1st text = title, 2nd text = trigger expr, then template.
  const nameInput = page.locator("input[type='text']").first();
  await expect(nameInput).toBeVisible({ timeout: 30_000 });
  await nameInput.fill(name);
  await page.locator("input[type='text']").nth(1).fill("*/2 * * * *");
  await page.getByRole("button", { name: /save routine/i }).click();

  // The routine appears in the list.
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 30_000 });

  // Verify through the real API (not just UI echo).
  const items = await listRoutines(request);
  const created = items.find((r) => r.title === name);
  expect(created, "created routine not returned by /api/routines").toBeTruthy();
  const trig = created?.trigger?.expr;
  expect(String(trig), "trigger expr must echo the cron").toContain("*/2");

  // The next run must be a real computed cron window, NOT fixed now+24h.
  const nextRaw = created?.nextRun;
  expect(nextRaw, "nextRun missing from API response").toBeTruthy();
  const next = new Date(String(nextRaw));
  const expected = nextCronAfter(before);
  const diffMinutes = Math.abs(next.getTime() - expected.getTime()) / 60_000;
  expect(
    diffMinutes,
    `nextRunAt ${next.toISOString()} should be within the */2 cron window (~${expected.toISOString()}), not now+24h`
  ).toBeLessThanOrEqual(3);

  // No delete in UI: disable through the real API endpoint.
  const del = await request.delete(`/api/routines/${created!.id}`);
  expect(del.ok(), `DELETE /api/routines failed: ${await del.text()}`).toBeTruthy();

  const after = await listRoutines(request);
  const disabled = after.find((r) => r.id === created!.id);
  expect(disabled?.status, "routine must be disabled after DELETE").toBe("disabled");
  await page.close();
});
