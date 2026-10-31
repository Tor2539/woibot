/**
 * Computer-use agent — "AI คุมคอมให้".
 *
 * A perception → decision → act loop on top of the user's real Cloud Computer:
 *   1. grab a fresh screenshot of DISPLAY :99 (framebuffer, 1280px wide)
 *   2. ask the Woibot vision model (Together, images attached as data URLs) to
 *      decide ONE action with pixel coordinates in the screenshot's space
 *   3. execute it for real via xdotool (with a visible blue cursor flash)
 *   4. repeat until the goal is achieved, the model reports done/fail, or the
 *      step budget runs out
 *
 * Everything is real: the screenshot is the actual framebuffer, the actions go
 * through the actual X server, and the transcript reports exactly what ran.
 * If the computer is not running, this fails loudly.
 */
import { execInContainer } from "./harness/container";
import { computerFile } from "./computer";
import { callWoibotLLM } from "./llm";

export type UseStep = {
  n: number;
  action: string;
  target?: string;
  note: string;
  ok: boolean;
  ms: number;
};

export type UseResult = {
  ok: boolean;
  steps: UseStep[];
  summary: string;
  error?: string;
};

type Decision = {
  action: "click" | "dblclick" | "rightclick" | "type" | "key" | "scroll" | "done" | "fail";
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  dy?: number;
  note?: string;
};

const Screenshot = 1280; // px width of the image shown to the model

// Screenshot round-trips as a workspace FILE (not exec stdout) to dodge the
// manager's ~20k stdout cap that silently truncates base64 payloads.
const WORK_SCREEN_REL = ".woibot-screen.jpg";
const WORK_SCREEN_FILE = `/home/woibot/workspace/${WORK_SCREEN_REL}`;

function parseDecision(raw: string): Decision | null {
  const text = raw.replace(/```json|```/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(text.slice(start, end + 1));
    if (!j || typeof j.action !== "string") return null;
    return j as Decision;
  } catch {
    return null;
  }
}

async function grabScreen(userId: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  // Write the screenshot to a workspace file and stream it back through the
  // manager file endpoint — manager exec stdout is capped (~20k chars), which
  // truncates any base64 image, so stdout is NOT a safe transport for pixels.
  const shot = await execInContainer(
    userId,
    `export DISPLAY=:99; import -window root -resize ${Screenshot}x -quality 70 "${WORK_SCREEN_FILE}" 2>/dev/null && stat -c %s "${WORK_SCREEN_FILE}"`,
  );
  if (shot.exitCode !== 0 || !shot.stdout.trim()) return null;
  const upstream = await computerFile(userId, WORK_SCREEN_REL);
  if (!upstream || !upstream.ok || !upstream.body) return null;
  const buf = Buffer.from(await upstream.arrayBuffer());
  if (buf.length < 1000) return null;
  // Xvfb is 1920x1080 → resize keeps the aspect ratio; compute from geometry.
  const geom = await execInContainer(
    userId,
    "export DISPLAY=:99; xdotool getdisplaygeometry 2>/dev/null || xdpyinfo 2>/dev/null | awk '/dimensions/{print $2}'",
  );
  const m = geom.stdout.trim().match(/^(\d+)x(\d+)/);
  const gw = m ? Number(m[1]) : 1920;
  const gh = m ? Number(m[2]) : 1080;
  return { dataUrl: `data:image/jpeg;base64,${buf.toString("base64")}`, width: gw, height: gh };
}

async function act(userId: string, d: Decision, scale: number): Promise<{ ok: boolean; target: string }> {
  const q = (v: string) => `'${String(v).replace(/'/g, `'\\''`)}'`;
  const show = (x?: number, y?: number) => (x != null && y != null ? ` @${Math.round(x)},${Math.round(y)}` : "");
  // Flash the blue target marker first (fire-and-forget) so every action is visible.
  const flash = (x: number, y: number) =>
    execInContainer(userId, `nohup python3 /opt/cursorfx.py ${Math.round(x)} ${Math.round(y)} ${d.action} >/dev/null 2>&1 & true`, 8000);

  let cmd = "";
  let target = "";
  const X = d.x != null ? Math.round(d.x * scale) : undefined;
  const Y = d.y != null ? Math.round(d.y * scale) : undefined;

  switch (d.action) {
    case "click":
      if (X == null || Y == null) return { ok: false, target: "" };
      await flash(X, Y);
      cmd = `export DISPLAY=:99; xdotool mousemove --sync ${X} ${Y} click 1`;
      target = `click${show(X, Y)}`;
      break;
    case "dblclick":
      if (X == null || Y == null) return { ok: false, target: "" };
      await flash(X, Y);
      cmd = `export DISPLAY=:99; xdotool mousemove --sync ${X} ${Y} click --repeat 2 --delay 130 1`;
      target = `dblclick${show(X, Y)}`;
      break;
    case "rightclick":
      if (X == null || Y == null) return { ok: false, target: "" };
      await flash(X, Y);
      cmd = `export DISPLAY=:99; xdotool mousemove --sync ${X} ${Y} click 3`;
      target = `rightclick${show(X, Y)}`;
      break;
    case "type": {
      const text = String(d.text ?? "");
      if (!text) return { ok: false, target: "" };
      if (text.length > 500) return { ok: false, target: "" };
      cmd = `export DISPLAY=:99; xdotool type --delay 20 -- ${q(text)}`;
      target = `type "${text.slice(0, 60)}"`;
      break;
    }
    case "key": {
      const key = String(d.key ?? "").trim();
      if (!key || !/^[a-zA-Z0-9_+.-]{1,32}$/.test(key)) return { ok: false, target: "" };
      cmd = `export DISPLAY=:99; xdotool key --clearmodifiers -- ${q(key)}`;
      target = `key ${key}`;
      break;
    }
    case "scroll": {
      if (X == null || Y == null) return { ok: false, target: "" };
      await flash(X, Y);
      const steps = Math.max(1, Math.min(15, Math.round(Math.abs(d.dy ?? 300) / 100) || 3));
      const dir = (d.dy ?? 300) < 0 ? 4 : 5;
      cmd = `export DISPLAY=:99; xdotool mousemove --sync ${X} ${Y} click --repeat ${steps} --delay 40 ${dir}`;
      target = `scroll ${dir === 4 ? "up" : "down"} x${steps}${show(X, Y)}`;
      break;
    }
    default:
      return { ok: false, target: "" };
  }

  const r = await execInContainer(userId, cmd);
  return { ok: r.exitCode === 0, target };
}

export async function runComputerUse(
  userId: string,
  goal: string,
  maxSteps = 5,
  onStep?: (step: UseStep) => Promise<void> | void,
): Promise<UseResult> {
  if (!goal.trim()) return { ok: false, steps: [], summary: "", error: "goal is required" };
  if (maxSteps < 1 || maxSteps > 8) maxSteps = 5;

  const steps: UseStep[] = [];
  const history: string[] = [];

  for (let n = 1; n <= maxSteps; n += 1) {
    const screen = await grabScreen(userId);
    if (!screen) {
      const step: UseStep = { n, action: "screenshot", note: "ถ่ายภาพหน้าจอไม่สำเร็จ — คอมพิวเตอร์ไม่ทำงาน?", ok: false, ms: 0 };
      steps.push(step);
      await onStep?.(step);
      return { ok: false, steps, summary: "", error: "screen_unavailable" };
    }
    const scaleX = screen.width / Screenshot;
    const scaleY = screen.height / Math.round((Screenshot * screen.height) / screen.width);

    const started = Date.now();
    let decision: Decision | null = null;
    try {
      const res = await callWoibotLLM({
        system:
          "You are the Woibot computer-use agent. You see ONE screenshot of a Linux desktop (Xvfb 1920x1080, " +
          "image downscaled to 1280px wide). The user gives you a goal; decide the SINGLE best next action. " +
          "The image is shown to you at 1280x" +
          Math.round((Screenshot * screen.height) / screen.width) +
          " pixels — give x,y coordinates in THAT image space (top-left origin). " +
          "Prefer clicking visible UI elements. To enter text into a field, click the field in one turn, then use " +
          'action "type" in the next turn. To press Enter use action "key" with key "Return". ' +
          'Answer with JSON only: {"action":"click|dblclick|rightclick|type|key|scroll|done|fail","x":int,"y":int,' +
          '"text":str,"key":str,"dy":int,"note":str}. "note" = one short Thai sentence explaining what you see/did. ' +
          'Use "done" when the goal is achieved, "fail" when impossible.',
        user:
          `Goal: ${goal}\n\n` +
          (history.length ? `Actions so far:\n${history.join("\n")}\n\n` : "No actions taken yet.\n\n") +
          "Decide the next single action as JSON.",
        images: [{ dataUrl: screen.dataUrl, detail: "auto" }],
        maxTokens: 1600,
        temperature: 0.1,
      });
      decision = parseDecision(res.text);
      if (!decision) throw new Error("โมเดลไม่ตอบ JSON ที่อ่านได้");
    } catch (e) {
      const step: UseStep = {
        n,
        action: "decide",
        note: `ตัดสินใจไม่สำเร็จ: ${e instanceof Error ? e.message : "unknown"}`,
        ok: false,
        ms: Date.now() - started,
      };
      steps.push(step);
      await onStep?.(step);
      return { ok: false, steps, summary: "", error: "decision_failed" };
    }

    const note = String(decision.note || "").slice(0, 200);

    if (decision.action === "done") {
      const step: UseStep = { n, action: "done", note: note || "เป้าหมายสำเร็จ", ok: true, ms: Date.now() - started };
      steps.push(step);
      await onStep?.(step);
      return { ok: true, steps, summary: note || "เป้าหมายสำเร็จ" };
    }
    if (decision.action === "fail") {
      const step: UseStep = { n, action: "fail", note: note || "โมเดลรายงานว่าทำไม่ได้", ok: false, ms: Date.now() - started };
      steps.push(step);
      await onStep?.(step);
      return { ok: false, steps, summary: "", error: note || "agent รายงานว่าทำไม่ได้" };
    }

    const r = await act(userId, decision, Math.max(scaleX, scaleY));
    const step: UseStep = {
      n,
      action: decision.action,
      target: r.target,
      note: `${note}${r.ok ? "" : " (ส่งคำสั่งไม่สำเร็จ)"}`,
      ok: r.ok,
      ms: Date.now() - started,
    };
    steps.push(step);
    await onStep?.(step);
    history.push(`${n}. ${r.target || decision.action} — ${note}`);
    if (!r.ok && steps.filter((s) => !s.ok).length >= 2) {
      return { ok: false, steps, summary: "", error: "ส่งคำสั่งเข้าคอมพิวเตอร์ล้มเหลวซ้ำ 2 ครั้ง" };
    }
  }

  return {
    ok: false,
    steps,
    summary: "",
    error: `ครบโควตา ${maxSteps} ก้าวแล้วแต่งานยังไม่เสร็จ — ลองเป้าหมายที่เล็กลง หรือเพิ่มจำนวนก้าว`,
  };
}