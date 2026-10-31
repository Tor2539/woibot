import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { execInComputer } from "@/lib/computer";
import { audit } from "@/lib/pg";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/voice/command
 * Body: { text: string }
 *
 * Classifies a dictated transcript into either
 *   - kind: "action" → a real command executed inside the caller's isolated
 *     Cloud Computer container (via execInComputer), or
 *   - kind: "chat"   → not a computer action; the UI forwards it to /api/chat.
 *
 * Every action turn is persisted as ChatMessage rows (user + assistant) so the
 * voice history survives a reload, exactly like typed chat turns.
 *
 * The classifier is deterministic on purpose: a voice command must not depend
 * on a model round-trip to decide whether it is allowed to touch the computer.
 */

type VoiceKind = "action" | "chat";

type Plan = {
  intent: "screenshot" | "note" | "run" | "open_app" | "list_files";
  cmd: string;
  label: string;
};

/* -- shell helpers ------------------------------------------------------- */

/** POSIX single-quote escaping: safe for arbitrary user text. */
function shq(value: string): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function launchCommand(bins: string[], label: string, url?: string): string {
  const args = url ? ` --new-window ${shq(url)}` : "";
  return [
    "export DISPLAY=:99",
    `bin=""; for b in ${bins.join(" ")}; do if command -v "$b" >/dev/null 2>&1; then bin="$b"; break; fi; done`,
    `if [ -n "$bin" ]; then setsid "$bin"${args} >/dev/null 2>&1 & sleep 0.8; echo "opened ${label} via $bin"; else echo "not installed: ${label}" >&2; false; fi`,
  ].join("; ");
}

const SCREENSHOT_CMD = [
  "export DISPLAY=:99",
  'mkdir -p "$HOME/workspace/screenshots"',
  'f="$HOME/workspace/screenshots/shot-$(date +%Y%m%d-%H%M%S).jpg"',
  'if command -v import >/dev/null 2>&1 && import -window root -quality 85 "$f" 2>/dev/null; then echo "captured: $f"; ls -lh "$f"; ' +
    'elif command -v scrot >/dev/null 2>&1 && scrot "$f" 2>/dev/null; then echo "captured: $f"; ls -lh "$f"; ' +
    'elif command -v gnome-screenshot >/dev/null 2>&1 && gnome-screenshot -f "$f" 2>/dev/null; then echo "captured: $f"; ls -lh "$f"; ' +
    'else echo "screenshot tool unavailable (import / scrot / gnome-screenshot)" >&2; false; fi',
].join("; ");

/* -- app aliases --------------------------------------------------------- */

type AppEntry = { keys: string[]; label: string; bins: string[]; url?: string };

const CHROME_BINS = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];

const APP_TABLE: AppEntry[] = [
  {
    keys: ["chrome", "google chrome", "โครม", "โครมเม", "เบราว์เซอร์", "browser", "เว็บเบราว์เซอร์", "เว็บ"],
    label: "Chrome",
    bins: CHROME_BINS,
  },
  {
    keys: ["terminal", "เทอร์มินัล", "terminal emulator", "shell", "bash"],
    label: "Terminal",
    bins: ["x-terminal-emulator", "gnome-terminal", "xfce4-terminal", "xterm"],
  },
  {
    keys: ["files", "file manager", "ไฟล์", "ตัวจัดการไฟล์", "โฟลเดอร์"],
    label: "File Manager",
    bins: ["thunar", "nautilus", "pcmanfm", "nemo"],
  },
  {
    keys: ["vscode", "vs code", "code", "โค้ด", "visual studio code"],
    label: "VS Code",
    bins: ["code", "code-oss", "codium"],
  },
  {
    keys: ["editor", "text editor", "gedit", "notepad", "แก้ไขข้อความ", "โปรแกรมแก้ไข"],
    label: "Text Editor",
    bins: ["gedit", "mousepad", "leafpad", "xed"],
  },
  { keys: ["gmail", "อีเมล", "mail"], label: "Gmail", bins: CHROME_BINS, url: "https://mail.google.com" },
  {
    keys: ["calendar", "ปฏิทิน", "google calendar"],
    label: "Google Calendar",
    bins: CHROME_BINS,
    url: "https://calendar.google.com",
  },
  { keys: ["drive", "ไดรฟ์", "google drive"], label: "Google Drive", bins: CHROME_BINS, url: "https://drive.google.com" },
  { keys: ["youtube", "ยูทูป"], label: "YouTube", bins: CHROME_BINS, url: "https://www.youtube.com" },
];

const POLITE_TAIL = /(ให้หน่อย|ด้วยครับ|ด้วยค่ะ|ครับ|ค่ะ|นะครับ|นะคะ|please|for me|quickly)\s*$/gi;

function normalize(input: string): string {
  return input
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.。]+$/, "")
    .trim();
}

function stripPolite(value: string): string {
  let out = value.trim();
  // Repeat: transcripts often end with "…ครับ" + " please".
  for (let i = 0; i < 3; i += 1) {
    const next = out.replace(POLITE_TAIL, "").trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

function findApp(token: string): AppEntry | null {
  const t = stripPolite(token).toLowerCase();
  if (!t) return null;
  const exact = APP_TABLE.find((entry) => entry.keys.includes(t));
  if (exact) return exact;
  const partial = APP_TABLE.find((entry) => entry.keys.some((k) => k.length > 2 && t.includes(k)));
  return partial || null;
}

/* -- intent rules -------------------------------------------------------- */

const DANGEROUS =
  /(^|[;&|]\s*)rm\s+-[a-z]*r[a-z]*\s+\/(\s|$)|mkfs|\bdd\s+if=|shutdown|\breboot\b|\bhalt\b|:\(\)\s*\{|chmod\s+-R\s+777\s+\/|>\s*\/dev\/(sd|nvme)/i;

const RE_SCREENSHOT =
  /(ถ่ายภาพหน้าจอ|ถ่ายรูปหน้าจอ|แคปเจอร์หน้าจอ|แคปหน้าจอ|สกรีนช็อต|จับภาพหน้าจอ|ดูหน้าจอตอนนี้|screenshot|screen shot|capture (the )?screen)/i;

const RE_NOTE = /^(?:จดว่า|จดไว้ว่า|จดบันทึกว่า|บันทึกว่า|โน้ตว่า|จำไว้ว่า|note that|note:|remember that|write down)\s*/i;

const RE_RUN =
  /^(?:ช่วย)?(?:รันคำสั่ง|รันคําสั่ง|สั่งรัน|รันสคริปต์|รัน|execute command|execute|exec|run command|run this|run)\s*[:：]?\s*(.+)$/i;

const RE_LIST_FILES = /^(?:ลิสต์ไฟล์(?:ใน)?|ดูไฟล์(?:ใน)?|list files?|ls)(?:\s.*)?$/i;

function planFor(text: string): Plan | null {
  const clean = normalize(text);
  if (!clean) return null;

  if (RE_SCREENSHOT.test(clean)) {
    return { intent: "screenshot", cmd: SCREENSHOT_CMD, label: "จับภาพหน้าจอ Cloud Computer" };
  }

  const noteMatch = clean.match(RE_NOTE);
  if (noteMatch) {
    const content = stripPolite(clean.slice(noteMatch[0].length));
    if (content) {
      const cmd = [
        "export DISPLAY=:99",
        'mkdir -p "$HOME/workspace/notes"',
        'f="$HOME/workspace/notes/voice-$(date +%Y%m%d).md"',
        `printf -- '- [%s] %s\\n' "$(date +%H:%M)" ${shq(content)} >> "$f"`,
        'echo "saved: $f"',
        'tail -n 1 "$f"',
      ].join("; ");
      return { intent: "note", cmd, label: `จดบันทึก: ${content.slice(0, 60)}` };
    }
  }

  const runMatch = clean.match(RE_RUN);
  if (runMatch) {
    const raw = runMatch[1].trim();
    if (raw) {
      if (DANGEROUS.test(raw)) return null;
      return { intent: "run", cmd: `export DISPLAY=:99; ${raw}`, label: `รันคำสั่ง: ${raw.slice(0, 60)}` };
    }
  }

  if (RE_LIST_FILES.test(clean)) {
    return {
      intent: "list_files",
      cmd: 'export DISPLAY=:99; ls -alh "$HOME/workspace" 2>&1 | head -n 60',
      label: "ลิสต์ไฟล์ใน workspace",
    };
  }

  const openMatch = clean.match(/^(?:ช่วย)?(?:เปิด|เปิดโปรแกรม|เปิดแอป|เปิดแอพ|open|launch)\s*(?:โปรแกรม|แอป|แอพ)?\s*(.+)$/i);
  if (openMatch) {
    const token = stripPolite(openMatch[1]);
    const app = findApp(token);
    if (app) {
      return { intent: "open_app", cmd: launchCommand(app.bins, app.label, app.url), label: `เปิด ${app.label}` };
    }
    // Fall back to a literal binary name (ascii only, no shell metacharacters).
    if (/^[a-zA-Z0-9._-]{2,40}$/.test(token)) {
      return { intent: "open_app", cmd: launchCommand([token], token), label: `เปิด ${token}` };
    }
  }

  return null;
}

/* -- exec result normalisation ------------------------------------------- */

type ExecOut = { ok?: boolean; code?: number; stdout?: unknown; stderr?: unknown; result?: unknown; error?: string };

function normalizeExec(out: unknown) {
  const raw = (out || {}) as ExecOut;
  const inner = (raw.result && typeof raw.result === "object" ? raw.result : raw) as ExecOut;
  const stdout = String(inner.stdout ?? "");
  const stderr = String(inner.stderr ?? "");
  const rawCode = inner.code;
  const code = typeof rawCode === "number" ? rawCode : Number(rawCode ?? (raw.ok === false ? 1 : 0)) || 0;
  const ok = raw.ok !== false && code === 0;
  return { ok, code, stdout, stderr, error: raw.error };
}

/* -- ChatMessage persistence for voice turns ------------------------------ */

/** Resolve the user's main teammate, mirroring /api/chat fallback logic. */
async function mainTeammate(userId: string) {
  const existing = await prisma.teammate.findFirst({ where: { userId, isMain: true } });
  if (existing) return existing;
  const anyTeammate = await prisma.teammate.findFirst({ where: { userId } });
  if (anyTeammate) return anyTeammate;
  return prisma.teammate.create({
    data: { id: "tm_main", userId, name: "Woibot Main", role: "Chief Personal Teammate", isMain: true, language: "th" },
  });
}

/**
 * Best-effort persistence: a voice action turn must appear in chat history,
 * but a persistence failure must never block the command result.
 */
async function persistVoiceTurn(
  userId: string,
  teammateId: string,
  text: string,
  result: { ok: boolean; intent: string; label: string; cmd: string; stdout: string; stderr: string },
) {
  try {
    const now = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    await prisma.chatMessage.create({
      data: {
        teammateId,
        userId,
        role: "user",
        content: text,
        meta: JSON.stringify({ source: "voice", timestamp: now }),
      },
    });
    const stdoutSnippet = result.stdout.trim().slice(0, 600);
    const stderrSnippet = result.stderr.trim().slice(0, 300);
    const body = [
      result.ok ? `ดำเนินการสำเร็จ: ${result.label}` : `ดำเนินการไม่สำเร็จ: ${result.label}`,
      stdoutSnippet ? `\n\nผลลัพธ์:\n\`\`\`\n${stdoutSnippet}\n\`\`\`` : "",
      stderrSnippet ? `\n\nข้อผิดพลาด:\n\`\`\`\n${stderrSnippet}\n\`\`\`` : "",
    ].join("");
    await prisma.chatMessage.create({
      data: {
        teammateId,
        userId,
        role: "assistant",
        content: body.trim() || `ดำเนินการ: ${result.label}`,
        meta: JSON.stringify({
          source: "voice",
          intent: result.intent,
          cmd: result.cmd.slice(0, 300),
          ok: result.ok,
          timestamp: now,
        }),
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = normalize(String(body.text || ""));
  if (!text) {
    return NextResponse.json({ ok: false, error: "text is required" }, { status: 400 });
  }

  const plan = planFor(text);

  if (!plan) {
    return NextResponse.json({
      ok: true,
      kind: "chat" as VoiceKind,
      intent: null,
      cmd: null,
      result: null,
      stdout: "",
      text,
    });
  }

  const exec = normalizeExec(await execInComputer(userId, plan.cmd, 30000));
  await audit({
    tenantId: userId,
    actor: userId,
    action: "voice.command",
    target: plan.intent,
    meta: { text: text.slice(0, 200), cmd: plan.cmd.slice(0, 300), code: exec.code },
  });

  const stdout = (exec.ok ? exec.stdout : exec.stderr || exec.stdout).trim();

  const teammate = await mainTeammate(userId).catch(() => null);
  const persisted = teammate
    ? await persistVoiceTurn(userId, teammate.id, text, {
        ok: exec.ok,
        intent: plan.intent,
        label: plan.label,
        cmd: plan.cmd,
        stdout: exec.stdout,
        stderr: exec.stderr,
      })
    : false;

  return NextResponse.json({
    ok: exec.ok,
    kind: "action" as VoiceKind,
    intent: plan.intent,
    label: plan.label,
    cmd: plan.cmd,
    result: { ok: exec.ok, code: exec.code, stdout: exec.stdout, stderr: exec.stderr, error: exec.error },
    stdout,
    text,
    persisted,
  });
}
