import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { ensureComputer, computerStatus, computerAction, execInComputer, computerLogs, computerPublicOrigin } from "@/lib/computer";
import { audit } from "@/lib/pg";
import { runComputerUse, type UseStep } from "@/lib/computerUse";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** POSIX single-quote escaping — safe for arbitrary user text in shell. */
function shq(value: string): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/** xdotool key names: letters/digits plus modifiers joined by "+", e.g. ctrl+shift+t. */
const KEY_TOKEN = /^[a-zA-Z0-9_+.-]{1,32}$/;

function buildInputCmd(body: Record<string, unknown>):
  | { ok: true; cmd: string; label: string }
  | { ok: false; error: string } {
  const kind = String(body.kind || "");
  const x = Math.round(Number(body.x));
  const y = Math.round(Number(body.y));

  switch (kind) {
    case "move": {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, error: "x,y required" };
      return { ok: true, cmd: `export DISPLAY=:99; xdotool mousemove ${x} ${y}`, label: `move ${x},${y}` };
    }
    case "click": {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, error: "x,y required" };
      const dbl = Boolean(body.dbl);
      const btn = dbl ? 1 : Number(body.button) === 3 ? 3 : 1;
      const clickPart = dbl ? "click --repeat 2 --delay 130 1" : `click ${btn}`;
      return {
        ok: true,
        cmd: `export DISPLAY=:99; xdotool mousemove --sync ${x} ${y} ${clickPart}`,
        label: `${dbl ? "double-click" : btn === 3 ? "right-click" : "click"} ${x},${y}`,
      };
    }
    case "type": {
      const text = String(body.text ?? "");
      if (!text) return { ok: false, error: "text required" };
      if (text.length > 2000) return { ok: false, error: "text too long" };
      return { ok: true, cmd: `export DISPLAY=:99; xdotool type --delay 25 -- ${shq(text)}`, label: `type ${text.length} chars` };
    }
    case "key": {
      const key = String(body.key || "").trim();
      if (!key || !KEY_TOKEN.test(key)) return { ok: false, error: "invalid key name" };
      return { ok: true, cmd: `export DISPLAY=:99; xdotool key --clearmodifiers -- ${shq(key)}`, label: `key ${key}` };
    }
    case "scroll": {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, error: "x,y required" };
      const steps = Math.max(1, Math.min(15, Math.round(Math.abs(Number(body.dy)) / 100) || 3));
      const dir = Number(body.dy) < 0 ? 4 : 5; // 4 = wheel up, 5 = wheel down
      return {
        ok: true,
        cmd: `export DISPLAY=:99; xdotool mousemove --sync ${x} ${y} click --repeat ${steps} --delay 40 ${dir}`,
        label: `scroll ${Number(body.dy) < 0 ? "up" : "down"} x${steps}`,
      };
    }
    default:
      return { ok: false, error: `unknown input kind: ${kind}` };
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const action = req.nextUrl.searchParams.get("action");

  if (action === "ensure") {
    const out = await ensureComputer(userId);
    await audit({ tenantId: userId, actor: userId, action: "computer.ensure", meta: { status: out.status } });
    return NextResponse.json({ ok: out.status !== "error", computer: out, origin: computerPublicOrigin() });
  }

  if (action === "geom") {
    const out = await execInComputer(
      userId,
      "export DISPLAY=:99; xdotool getdisplaygeometry 2>/dev/null || xdpyinfo 2>/dev/null | awk '/dimensions/{print $2}'",
    );
    const m = String((out as any)?.stdout || "").trim().match(/^(\d+)[x ](\d+)/);
    if (!m) {
      return NextResponse.json({ ok: false, error: "geometry_unavailable", detail: out }, { status: 502 });
    }
    return NextResponse.json({ ok: true, width: Number(m[1]), height: Number(m[2]) });
  }

  if (action === "stats") {
    // Real resource snapshot from inside the container (no fabricated numbers).
    const out = await execInComputer(
      userId,
      [
        "export DISPLAY=:99",
        'top -b -n2 -d 1 2>/dev/null | grep "%Cpu" | tail -1 | awk \'{printf "CPU=%s\\n", $2}\'',
        'free -m | awk \'/^Mem:/{printf "MEM=%d/%d\\n", $3, $2}\'',
        'df -h /home/woibot 2>/dev/null | tail -1 | awk \'{printf "DISK=%s/%s\\n", $3, $2}\'',
        'uptime -p 2>/dev/null | sed \'s/^/UP=/\'',
      ].join("; "),
    );
    const text = String((out as any)?.stdout || "");
    const grab = (k: string) => {
      const m = text.match(new RegExp(`${k}=([^\\n]*)`));
      return m ? m[1].trim() : null;
    };
    const mem = (grab("MEM") || "/").split("/");
    const disk = (grab("DISK") || "/").split("/");
    return NextResponse.json({
      ok: Boolean((out as any)?.ok),
      cpuPercent: Number(grab("CPU")) || null,
      memUsedMb: Number(mem[0]) || null,
      memTotalMb: Number(mem[1]) || null,
      diskUsed: disk[0] !== "/" ? disk[0] : null,
      diskTotal: disk[1] !== "/" ? disk[1] : null,
      uptime: grab("UP"),
    });
  }

  if (action === "screen") {
    const shot = await execInComputer(
      userId,
      "export DISPLAY=:99; import -window root -resize 640x -quality 55 jpg:- 2>/dev/null | base64 -w0",
    );
    const b64 = String((shot as any)?.stdout || "").trim();
    if (!b64) {
      return NextResponse.json({ ok: false, error: "screen_unavailable" }, { status: 502 });
    }
    if (req.nextUrl.searchParams.get("raw") === "1") {
      return new NextResponse(Buffer.from(b64, "base64"), {
        headers: { "content-type": "image/jpeg", "cache-control": "no-store" },
      });
    }
    return NextResponse.json({
      ok: true,
      image: `data:image/jpeg;base64,${b64}`,
      ts: new Date().toISOString(),
    });
  }

  const out = await computerStatus(userId);
  return NextResponse.json({ ok: true, computer: out, origin: computerPublicOrigin() });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "pause" || action === "resume" || action === "destroy") {
    const out = await computerAction(userId, action);
    await audit({ tenantId: userId, actor: userId, action: `computer.${action}` });
    return NextResponse.json({ ok: Boolean(out.ok), detail: out });
  }

  if (action === "logs") {
    const out = await computerLogs(userId);
    return NextResponse.json({ ok: Boolean(out.ok), result: out });
  }

  if (action === "exec") {
    const out = await execInComputer(userId, String(body.cmd || ""));
    await audit({ tenantId: userId, actor: userId, action: "computer.exec", meta: { cmd: String(body.cmd || "").slice(0, 200) } });
    return NextResponse.json({ ok: Boolean(out.ok), result: out });
  }

  if (action === "input") {
    // Real mouse/keyboard control of the user's Cloud Computer via xdotool.
    const built = buildInputCmd(body);
    if (!built.ok) {
      return NextResponse.json({ ok: false, error: built.error }, { status: 400 });
    }
    // Visible blue cursor flash before pointer actions (cosmetic; never blocks).
    const bx = Math.round(Number(body.x));
    const by = Math.round(Number(body.y));
    if (["click", "move", "scroll"].includes(String(body.kind)) && Number.isFinite(bx) && Number.isFinite(by)) {
      await execInComputer(
        userId,
        `nohup python3 /opt/cursorfx.py ${bx} ${by} ${body.kind} >/dev/null 2>&1 & true`,
        8000,
      );
    }
    const out = await execInComputer(userId, built.cmd);
    await audit({
      tenantId: userId,
      actor: userId,
      action: "computer.input",
      meta: { label: built.label, code: (out as any)?.code ?? null },
    });
    const inner = (out && typeof out === "object" ? out : {}) as { ok?: boolean; code?: number | string; stderr?: unknown };
    const code = typeof inner.code === "number" ? inner.code : Number(inner.code ?? 0);
    return NextResponse.json({
      ok: inner.ok !== false && code === 0,
      label: built.label,
      result: out,
    });
  }

  if (action === "use") {
    // Computer-use agent: perception → decision → real actions, step by step.
    const goal = String(body.goal || "").trim();
    const maxSteps = Math.max(1, Math.min(8, Number(body.maxSteps) || 5));
    if (!goal) return NextResponse.json({ ok: false, error: "goal is required" }, { status: 400 });

    const collected: UseStep[] = [];
    const result = await runComputerUse(userId, goal, maxSteps, (s) => {
      collected.push(s);
    });
    await audit({
      tenantId: userId,
      actor: userId,
      action: "computer.use",
      target: result.ok ? "done" : "failed",
      meta: { goal: goal.slice(0, 200), steps: result.steps.length },
    });
    return NextResponse.json({
      ok: result.ok,
      summary: result.summary,
      steps: collected,
      error: result.error,
      goal,
    });
  }

  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}
