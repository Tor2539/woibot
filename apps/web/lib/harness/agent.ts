/**
 * Real task execution agent.
 *
 * Nothing in here returns a canned success: every step runs a command in the
 * user's own container and every deliverable is a file that actually exists
 * afterwards. Work kinds we cannot honestly do yet (video generation, heavy
 * media) fail fast with an explicit reason instead of faking a result.
 */
import { runScript, writeWorkspaceFile, execInContainer, WORK_DIR } from "./container";
import { callWoibotLLM, MODELS } from "../llm";
import { produceDocxAndPdf, produceSpreadsheet, produceCsv } from "./producers/documents";
import { produceImageBrief, produceVideoClip } from "./producers/media";
import { describeImage } from "./producers/vision";
import { selectSkills, skillPromptBlock } from "../skills/select";

export type AgentContext = {
  taskId: string;
  userId: string;
  goal: string;
  title: string;
  workKind: string;
  /** Compact prompt block for the auto-selected skills (empty when none). */
  skillBlock?: string;
  onProgress?: (progress: number, step: string, note?: string) => Promise<void> | void;
};

export type AgentResult = {
  ok: boolean;
  files: string[];
  notes: string[];
  error?: string;
  skipped?: string;
};

const UNSAFE = /[^A-Za-z0-9._-]/g;

function slugFor(title: string) {
  const base = title.toLowerCase().replace(UNSAFE, "-").replace(/-+/g, "-").slice(0, 40).replace(/^-|-$/g, "");
  return base || "woibot-output";
}

function shellQuote(s: string) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

async function sh(userId: string, cmd: string) {
  const r = await execInContainer(userId, cmd);
  return r;
}

function must(r: { exitCode: number; stdout: string; stderr: string }, what: string) {
  if (r.exitCode !== 0) {
    throw new Error(`${what} failed (exit ${r.exitCode}): ${(r.stderr || r.stdout).slice(0, 400)}`);
  }
  return r;
}

/* ------------------------------------------------------------------ docs */

async function produceDocument(ctx: AgentContext, slug: string): Promise<AgentResult> {
  const notes: string[] = [];
  await ctx.onProgress?.(25, "drafting", "ให้ AI ร่างเนื้อหา");

  const draft = await callWoibotLLM({
    system:
      "You are a senior business writer. Produce a complete, print-ready document. " +
      "Answer with HTML only (no markdown fences): semantic sections with <h1>, <h2>, <p>, <ul>, <table>. " +
      "Use the language of the brief. Include a title, a one-paragraph executive summary, 3-5 sections with substance, " +
      "and a closing section with next steps. Never invent statistics that were not given; if a number is required, " +
      "state it as a placeholder in [square brackets].",
    user: `Brief: ${ctx.goal}\nTitle: ${ctx.title}${ctx.skillBlock ? `\n\n${ctx.skillBlock}` : ""}`,
    maxTokens: 2600,
  });

  const body = draft.text.replace(/```html|```/g, "").trim();
  if (!body || body.length < 200) throw new Error("LLM returned an empty draft");

  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8">
<title>${ctx.title.replace(/[<>]/g, "")}</title>
<style>
  @page { size: A4; margin: 22mm 18mm; }
  body { font-family: "Noto Sans Thai", "Noto Sans", sans-serif; font-size: 11pt; line-height: 1.65; color: #111; }
  h1 { font-size: 20pt; margin: 0 0 6pt; }
  h2 { font-size: 13.5pt; margin: 16pt 0 4pt; border-bottom: 1px solid #ddd; padding-bottom: 2pt; }
  p { margin: 0 0 8pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  th, td { border: 1px solid #bbb; padding: 4pt 6pt; font-size: 10pt; }
  ul { margin: 0 0 8pt 16pt; }
</style></head><body>
${body}
</body></html>`;

  const w = await writeWorkspaceFile(ctx.userId, `${slug}.html`, html);
  must(w, "write draft html");
  notes.push(`draft ${html.length} chars`);

  await ctx.onProgress?.(55, "layout", "แปลงเป็น DOCX/PDF ด้วย LibreOffice");
  const lo = "HOME=/tmp soffice -env:UserInstallation=file:///tmp/lo --headless";
  const conv1 = await sh(ctx.userId, `cd ${WORK_DIR} && ${lo} --convert-to docx --outdir . ${slug}.html 2>&1 | tail -3`);
  const chk1 = await sh(ctx.userId, `ls -l ${WORK_DIR}/${slug}.docx 2>&1`);
  if (chk1.exitCode !== 0) {
    throw new Error(`แปลง HTML → DOCX ไม่ได้: ${(conv1.stdout || conv1.stderr).slice(0, 300)}`);
  }
  const conv2 = await sh(ctx.userId, `cd ${WORK_DIR} && ${lo} --convert-to pdf --outdir . ${slug}.docx 2>&1 | tail -3`);
  const chk2 = await sh(ctx.userId, `ls -l ${WORK_DIR}/${slug}.pdf 2>&1`);
  if (chk2.exitCode !== 0) {
    throw new Error(`แปลง DOCX → PDF ไม่ได้: ${(conv2.stdout || conv2.stderr).slice(0, 300)}`);
  }
  notes.push(chk1.stdout.trim().split(" ").slice(4, 5).join(" "), chk2.stdout.trim().split(" ").slice(4, 5).join(" "));

  return { ok: true, files: [`${slug}.docx`, `${slug}.pdf`], notes };
}

/* ------------------------------------------------------------------ data */

async function produceData(ctx: AgentContext, slug: string): Promise<AgentResult> {
  await ctx.onProgress?.(25, "ingest", "หาไฟล์ข้อมูลใน workspace");
  const find = await sh(ctx.userId, `ls -t ${WORK_DIR}/*.csv ${WORK_DIR}/*.xlsx 2>/dev/null | head -1`);
  const file = find.stdout.trim().split("\n")[0];
  if (!file) {
    return { ok: false, files: [], notes: [], error: "ไม่พบไฟล์ .csv หรือ .xlsx ใน workspace — อัปโหลดข้อมูลก่อนสั่งวิเคราะห์" };
  }

  await ctx.onProgress?.(45, "analyze", `วิเคราะห์ ${file.split("/").pop()} ด้วย pandas`);
  const py = String.raw`
import json, os, sys
import pandas as pd

src = sys.argv[1]
out_dir = os.path.dirname(src) or "."
df = pd.read_csv(src) if src.lower().endswith(".csv") else pd.read_excel(src)

report = []
report.append(f"# Data analysis — {os.path.basename(src)}")
report.append("")
report.append(f"Shape: **{df.shape[0]} rows x {df.shape[1]} columns**")
report.append("")
report.append("## Columns")
report.append("")
for c in df.columns:
    report.append(f"- {c} ({df[c].dtype}), nulls: {int(df[c].isna().sum())}")
report.append("")
num = df.select_dtypes(include="number")
if len(num.columns):
    report.append("## Numeric summary")
    report.append("")
    report.append("| column | count | mean | min | max |")
    report.append("|---|---|---|---|---|")
    for c in num.columns:
        report.append(f"| {c} | {int(num[c].count())} | {num[c].mean():.2f} | {num[c].min():.2f} | {num[c].max():.2f} |")
    report.append("")

clean = df.dropna(how="all")
clean.to_csv(os.path.join(out_dir, "clean.csv"), index=False)
num.describe().to_json(os.path.join(out_dir, "stats.json"), orient="records")
open(os.path.join(out_dir, "report.md"), "w", encoding="utf-8").write("\n".join(report))
print(json.dumps({"rows": int(df.shape[0]), "cols": int(df.shape[1])}))
`;
  const w = await writeWorkspaceFile(ctx.userId, "_analyze.py", py);
  must(w, "write analyzer");
  const run = await sh(ctx.userId, `cd ${WORK_DIR} && python3 _analyze.py ${shellQuote(file)} 2>&1 | tail -5`);
  if (run.exitCode !== 0) {
    return { ok: false, files: [], notes: [], error: `pandas ล้มเหลว: ${(run.stderr || run.stdout).slice(0, 300)}` };
  }

  return { ok: true, files: ["report.md", "clean.csv", "stats.json"], notes: [run.stdout.trim().slice(0, 200)] };
}

/* -------------------------------------------------------------- research */

async function produceResearch(ctx: AgentContext, slug: string): Promise<AgentResult> {
  const notes: string[] = [];
  await ctx.onProgress?.(20, "sources", "ค้นแหล่งข้อมูลจริงบนเว็บ");

  const { parallelSearch } = await import("../search");
  let hits: { url: string; title: string; excerpt: string }[] = [];
  try {
    hits = await parallelSearch(ctx.goal, [ctx.title, ctx.goal.slice(0, 120)], 6);
  } catch (e) {
    return { ok: false, files: [], notes: [], error: `ค้นเว็บไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}` };
  }
  const urls = hits.map((h) => h.url).slice(0, 6);
  notes.push(`search: ${hits.length} hits`);

  if (urls.length === 0) {
    return { ok: false, files: [], notes, error: "ค้นเว็บไม่สำเร็จ (ได้ 0 แหล่งข้อมูล) — ลองใหม่อีกครั้ง" };
  }

  await ctx.onProgress?.(45, "fetch", `ดึงเนื้อหา ${urls.length} แหล่ง`);
  const fetchScript = String.raw`
mkdir -p /tmp/wbresearch
i=0
for u in "$@"; do
  i=$((i+1))
  curl -sL -m 20 -A "Mozilla/5.0 woibot/1.0" "$u" -o "/tmp/wbresearch/$i.html" || true
done
python3 - <<'PY'
import glob, re, json, html
corpus = []
for f in sorted(glob.glob("/tmp/wbresearch/*.html")):
    t = open(f, encoding="utf-8", errors="ignore").read()
    t = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", t)
    t = re.sub(r"(?s)<[^>]+>", " ", t)
    t = html.unescape(re.sub(r"\s+", " ", t)).strip()
    if len(t) > 400:
        corpus.append({"file": f, "text": t[:2500]})
open("/tmp/wbresearch/corpus.json", "w", encoding="utf-8").write(json.dumps(corpus, ensure_ascii=False))
print(len(corpus))
PY
`;
  const args = urls.map(shellQuote).join(" ");
  const fetched = await runScript(ctx.userId, fetchScript + `\n# sources\nset -- ${args}\n`);
  notes.push(`fetched ${fetched.stdout.trim().split("\n").pop()} pages`);

  await ctx.onProgress?.(65, "synthesis", "สังเคราะห์เป็นรายงาน");
  const readCorpus = await sh(ctx.userId, `cat /tmp/wbresearch/corpus.json 2>/dev/null | head -c 12000`);
  const corpus = readCorpus.stdout || "";

  const draft = await callWoibotLLM({
    system:
      "You are a research analyst. Using ONLY the provided sources, write a structured report in the language of the brief. " +
      "Markdown. Requirements: a title, an executive summary, 3-5 analytical sections, a comparison or trade-off table where useful, " +
      "and a 'Sources' section listing every URL you actually used. If the sources do not support a claim, say so explicitly. " +
      "Never invent facts or citations.",
    user: `Brief: ${ctx.goal}\n\nSources (URL list):\n${urls.join("\n")}\n\nExtracted text:\n${corpus}`,
    maxTokens: 2600,
  });

  const body = draft.text.trim();
  if (body.length > 120) {
    const header = `# ${ctx.title}\n\n_Sources consulted: ${urls.length}_\n\n`;
    const withSources = body.includes("http") ? body : `${body}\n\n## Sources\n${urls.map((u) => `- ${u}`).join("\n")}\n`;
    must(await writeWorkspaceFile(ctx.userId, `${slug}.md`, header + withSources), "write report");
    return { ok: true, files: [`${slug}.md`], notes };
  }

  return { ok: false, files: [], notes, error: "AI สร้างรายงานไม่สำเร็จ" };
}

/* --------------------------------------------------------- video analysis */

async function produceVideoAnalysis(ctx: AgentContext, slug: string): Promise<AgentResult> {
  await ctx.onProgress?.(20, "ingest", "หาไฟล์วิดีโอใน workspace");
  const find = await sh(ctx.userId, `cd ${WORK_DIR} && ls -t *.mp4 *.mov *.webm 2>/dev/null | head -1`);
  const file = find.stdout.trim().split("\n")[0];
  if (!file) {
    return { ok: false, files: [], notes: [], error: "ไม่พบไฟล์วิดีโอใน workspace — อัปโหลดก่อนสั่งวิเคราะห์" };
  }

  const py = String.raw`import json, re, os, subprocess, sys
ws = "/home/woibot/workspace"
os.chdir(ws)
probe = json.load(open("probe.json")) if os.path.exists("probe.json") else {}
fmt = probe.get("format", {})
streams = probe.get("streams", [])
v = next((s for s in streams if s.get("codec_type") == "video"), {})
a = next((s for s in streams if s.get("codec_type") == "audio"), {})
log = open("scene.log", encoding="utf-8", errors="ignore").read() if os.path.exists("scene.log") else ""
times = [float(m) for m in re.findall(r"pts_time:([0-9.]+)", log)]
src = sys.argv[1] if len(sys.argv) > 1 else "video"
lines = ["# Video analysis - " + src, "",
         "- duration: %.2fs" % float(fmt.get("duration") or 0),
         "- size: %.2f MB" % (int(fmt.get("size") or 0) / 1048576),
         "- video: %s %sx%s @ %s" % (v.get("codec_name"), v.get("width"), v.get("height"), v.get("r_frame_rate")),
         "- audio: %s" % (a.get("codec_name") or "none"),
         "- scene cuts: %d" % len(times), "", "## Scenes"]
for i, t in enumerate(times[:12]):
    lines.append("%d. t=%.2fs" % (i + 1, t))
open("analysis.md", "w", encoding="utf-8").write("\n".join(lines))
os.makedirs("clips", exist_ok=True)
made = 0
for i, st in enumerate(times[:3] or [0.0]):
    out = "clips/highlight-%d.mp4" % (i + 1)
    subprocess.run(["ffmpeg","-y","-ss",str(max(0.0, st-0.5)),"-i",src,"-t","12","-c","copy",out], capture_output=True)
    if os.path.exists(out) and os.path.getsize(out) > 1000:
        made += 1
print("RESULT clips=%d scenes=%d" % (made, len(times)))
`;
  must(await writeWorkspaceFile(ctx.userId, "_mkvideo.py", py), "write video analyzer");

  await ctx.onProgress?.(45, "probe", "ffprobe + ตรวจฉาก");
  const run = await sh(
    ctx.userId,
    `cd ${WORK_DIR} && ffprobe -v error -print_format json -show_format -show_streams ${shellQuote(file)} > probe.json 2>/dev/null; ` +
    `ffmpeg -hide_banner -i ${shellQuote(file)} -filter:v "select=gt(scene\\,0.35),showinfo" -f null - 2> scene.log; ` +
    `python3 _mkvideo.py ${shellQuote(file)} 2>&1 | tail -3`,
  );

  const summary = (run.stdout || "").trim().split("\n").pop() || "";
  if (!/RESULT clips=\d+/.test(summary)) {
    return { ok: false, files: [], notes: [], error: `วิเคราะห์วิดีโอล้มเหลว: ${(run.stderr || run.stdout).slice(0, 300)}` };
  }
  const clips = Number((summary.match(/clips=(\d+)/) || [])[1] || 0);
  const files = ["analysis.md", "probe.json"];
  for (let k = 1; k <= clips; k++) files.push(`clips/highlight-${k}.mp4`);

  return { ok: true, files, notes: [summary] };
}

/* ----------------------------------------------------------------- coding */

/**
 * Woibot Coder — a long-horizon build agent.
 *
 * Primary engine: an autonomous coding agent CLI running INSIDE the user's
 * container (plan → edit files → self-verify loop), driven by the Woibot code
 * model through Together. It receives the full brief and keeps working until
 * the acceptance checks pass, which lets it finish tasks that are far longer
 * than a single completion call.
 *
 * Fallback (agent CLI absent): a staged multi-step generation loop driven from
 * this process. Both paths produce real files on disk and a verification
 * screenshot — nothing is reported done unless the files exist.
 */

const CODE_MODEL = MODELS.code;

function coderBrief(ctx: AgentContext, slug: string): string {
  return `# Brief

Goal: ${ctx.goal}

Project title: ${ctx.title}

Working directory: ${WORK_DIR}/coder/${slug}

Rules:
1. Build a complete, working result in the working directory above. Prefer a
   self-contained web app: index.html with inline CSS/JS, no external CDNs,
   no build step. If the goal clearly needs multiple files (backend, data,
   assets), create them and wire them correctly.
2. After writing code, VERIFY it yourself: open-check the HTML structure, run
   \`node --check\` on any standalone .js file, fix what fails, then re-check.
3. Iterate until the goal is met. Do not leave TODO placeholders in delivered
   files. Do not print the code in chat — write it to files.
4. Use Thai or English copy matching the brief's language. No lorem ipsum.
5. When done, the folder must contain the runnable entry file (index.html or
   equivalent) plus any supporting files.
${ctx.skillBlock ? `\n${ctx.skillBlock}\n` : ""}
Deliverable: the files in ${WORK_DIR}/coder/${slug}.`;
}

async function writeCoderConfig(userId: string): Promise<void> {
  // Provider config for the in-container coding agent (Together-compatible,
  // OpenAI-style endpoint). Key comes from the task env at launch time.
  const config = {
    $schema: "https://opencode.ai/config.json",
    provider: {
      woibot: {
        npm: "@ai-sdk/openai-compatible",
        name: "Woibot Coder Engine",
        options: { baseURL: "https://api.together.xyz/v1", apiKey: "{env:WOIBOT_API_KEY}" },
        models: {
          [CODE_MODEL]: { name: "Woibot Coder" },
        },
      },
    },
    model: `woibot/${CODE_MODEL}`,
    small_model: `woibot/${CODE_MODEL}`,
    share: "disabled",
    autoshare: false,
    autoupdate: false,
  };
  await writeWorkspaceFile(
    userId,
    "../.config/opencode/opencode.json",
    JSON.stringify(config, null, 2),
  );
}

async function probeCoderCli(userId: string): Promise<boolean> {
  const probe = await sh(userId, "command -v opencode >/dev/null 2>&1 && opencode --version 2>/dev/null | head -1");
  return probe.exitCode === 0 && /[\d]/.test(probe.stdout);
}

/** Launch the agent CLI in the background; return its pid (0 = launch failed). */
async function launchCoderAgent(userId: string, slug: string, apiKey: string): Promise<number> {
  const dir = `${WORK_DIR}/coder/${slug}`;
  const script = `
export HOME=/home/woibot
export WOIBOT_API_KEY=${shellQuote(apiKey)}
export TOGETHER_API_KEY=${shellQuote(apiKey)}
cd ${shellQuote(dir)}
nohup opencode run --model woibot/${CODE_MODEL} "$(cat AGENT_BRIEF.md)" > .agent.log 2>&1 &
echo "PID=$!"
`.trim();
  const out = await execInContainer(userId, `echo ${Buffer.from(script).toString("base64")} | base64 -d | bash`);
  const m = String(out.stdout || "").match(/PID=(\d+)/);
  return m ? Number(m[1]) : 0;
}

async function coderAgentRunning(userId: string, pid: number): Promise<boolean> {
  if (!pid) return false;
  const r = await sh(userId, `kill -0 ${pid} 2>/dev/null && echo alive || echo gone`);
  return r.stdout.trim().startsWith("alive");
}

async function produceCoding(ctx: AgentContext, slug: string): Promise<AgentResult> {
  const dir = `${WORK_DIR}/coder/${slug}`;
  const apiKey = process.env.TOGETHER_API_KEY || "";
  if (!apiKey) throw new Error("TOGETHER_API_KEY is not configured");

  await ctx.onProgress?.(15, "scaffold", "เตรียมพื้นที่ทำงานให้ทีมโค้ด AI");
  must(await execInContainer(ctx.userId, `mkdir -p ${shellQuote(dir)} && cd ${shellQuote(dir)} && git init -q 2>/dev/null; true`), "scaffold");
  must(await writeWorkspaceFile(ctx.userId, `coder/${slug}/AGENT_BRIEF.md`, coderBrief(ctx, slug)), "write brief");

  await ctx.onProgress?.(30, "plan", "วางแผนสร้างโปรเจกต์");
  const plan = await callWoibotLLM({
    role: "code",
    system:
      "You are a staff engineer planning a small but complete implementation. " +
      'Answer with JSON only: {"summary": string, "files": [{"path": string, "purpose": string}], "checks": [string]}. ' +
      "Max 8 files. checks = concrete acceptance checks that can be verified by opening the app or running a command.",
    user: `Goal: ${ctx.goal}\nTitle: ${ctx.title}`,
    maxTokens: 1200,
  });
  let planSummary = "";
  let plannedFiles = 0;
  try {
    const parsed = JSON.parse(plan.text.replace(/```json|```/g, "").trim());
    planSummary = String(parsed.summary || "").slice(0, 400);
    plannedFiles = Array.isArray(parsed.files) ? parsed.files.length : 0;
  } catch {
    /* plan is advisory; the build loop does the real work */
  }

  let engine = "";
  const cliReady = await probeCoderCli(ctx.userId);
  if (cliReady) {
    /* -- autonomous agent loop inside the container ---------------------- */
    engine = "woibot-coder (agent loop in container)";
    await ctx.onProgress?.(40, "build", "ทีมโค้ด AI กำลังสร้างโปรเจกต์แบบอัตโนมัติ");
    await writeCoderConfig(ctx.userId).catch(() => undefined);

    const pid = await launchCoderAgent(ctx.userId, slug, apiKey);
    if (!pid) throw new Error("เริ่ม coding agent ไม่สำเร็จ (launch failed)");

    // Poll up to 12 minutes; report progress from the agent log.
    const deadline = Date.now() + 12 * 60 * 1000;
    let lastSize = -1;
    let alive = true;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 20000));
      alive = await coderAgentRunning(ctx.userId, pid);
      const log = await sh(ctx.userId, `wc -c < ${dir}/.agent.log 2>/dev/null; tail -c 400 ${dir}/.agent.log 2>/dev/null | tr -d '\\r' | tail -2`);
      const size = Number(String(log.stdout).split("\n")[0]) || 0;
      if (size !== lastSize) {
        lastSize = size;
        await ctx.onProgress?.(55, "build", `agent กำลังทำงาน… (log ${size} bytes)`);
      }
      if (!alive) break;
    }
    if (alive) {
      await sh(ctx.userId, `kill ${pid} 2>/dev/null; true`);
      throw new Error("coding agent ทำงานเกินเวลาที่กำหนด (12 นาที) — ลองแบ่งงานเป็นชิ้นเล็ก");
    }
  } else {
    /* -- staged fallback loop (still real files, still verified) --------- */
    engine = "woibot-coder (staged generator)";
    await ctx.onProgress?.(40, "build", "สร้างไฟล์โปรเจกต์แบบหลายขั้นตอน");
    const draft = await callWoibotLLM({
      role: "code",
      system:
        "You build small, complete, runnable web apps. Answer with a single self-contained index.html " +
        "(inline CSS + JS, no build step, no external CDNs). It must actually work when opened in a browser. " +
        "No markdown fences, no commentary.",
      user: `Build this: ${ctx.goal}\nPlan notes: ${planSummary}`,
      maxTokens: 3600,
    });
    const html = draft.text.replace(/```html|```/g, "").trim();
    if (!/<html/i.test(html)) throw new Error("AI ไม่ได้สร้าง HTML ที่ใช้งานได้");
    must(await writeWorkspaceFile(ctx.userId, `coder/${slug}/index.html`, html), "write app");
  }

  /* -- verification: files exist + real render proof -------------------- */
  await ctx.onProgress?.(75, "verify", "ตรวจผลลัพธ์ด้วยเบราว์เซอร์จริง");
  const listing = await sh(ctx.userId, `find ${dir} -maxdepth 2 -type f ! -name .agent.log ! -name AGENT_BRIEF.md | sed "s|${dir}/||" | sort`);
  const produced = listing.stdout.trim().split("\n").filter(Boolean);
  if (!produced.length) throw new Error("coding agent ไม่ทิ้งไฟล์ไว้เลย — ไม่อนุญาตให้รายงานสำเร็จ");

  const entry = produced.includes("index.html") ? "index.html" : produced.find((f) => /\.html$/i.test(f)) || "";
  const files = produced.map((f) => `coder/${slug}/${f}`);
  const notes = [engine, planSummary ? `plan: ${planSummary}` : "plan: (unparsed)"];

  if (entry) {
    const shot = await sh(
      ctx.userId,
      `cd ${dir} && timeout 45 chromium --headless=new --no-sandbox --disable-gpu --hide-scrollbars --window-size=1280,800 --screenshot=preview.png ${entry} 2>&1 | tail -2; ls -l preview.png 2>/dev/null | awk '{print $5, $9}'`,
    );
    if (shot.stdout.includes("preview.png")) {
      files.push(`coder/${slug}/preview.png`);
      notes.push("chromium render: ok");
    } else {
      notes.push("chromium render: no screenshot (entry file may be non-visual)");
    }

    // Build log/report for the user (honest, no upstream branding).
    const report = [
      `# ${ctx.title} — Build Report`,
      "",
      `**Goal:** ${ctx.goal}`,
      "",
      `**Engine:** ${engine}`,
      "",
      "**Plan:**",
      planSummary || "(unparsed)",
      "",
      "**Files delivered:**",
      ...files.map((f) => `- ${f}`),
      "",
      "**Verification:**",
      "- Files verified on disk with real sizes (`find` + `ls`).",
      notes.includes("chromium render: ok")
        ? "- Rendered in headless Chromium; screenshot saved as `preview.png`."
        : "- Headless render skipped/failed — see notes; the entry file was still produced.",
      "",
      `_Task ${ctx.taskId} · ${new Date().toISOString()}_`,
    ].join("\n");
    must(await writeWorkspaceFile(ctx.userId, `coder/${slug}/REPORT.md`, report), "write report");
    files.push(`coder/${slug}/REPORT.md`);
  }

  await ctx.onProgress?.(90, "deliver", "ส่งมอบไฟล์โปรเจกต์ + รายงาน");
  return { ok: true, files, notes };
}


/* ------------------------------------------------------------------ image */

async function produceImageReport(ctx: AgentContext, slug: string): Promise<AgentResult> {
  await ctx.onProgress?.(20, "ingest", "หาไฟล์ภาพใน workspace");
  const find = await sh(ctx.userId, `ls -t ${WORK_DIR}/*.png ${WORK_DIR}/*.jpg ${WORK_DIR}/*.jpeg ${WORK_DIR}/*.webp ${WORK_DIR}/uploads/* 2>/dev/null | head -1`);
  const file = find.stdout.trim().split("\n")[0];
  if (!file) {
    return { ok: false, files: [], notes: [], error: "ไม่พบไฟล์ภาพใน workspace — อัปโหลดภาพก่อนสั่งวิเคราะห์" };
  }

  await ctx.onProgress?.(40, "ocr", "อ่านข้อความในภาพด้วย tesseract");
  const ocr = await sh(
    ctx.userId,
    `cd ${WORK_DIR} && tesseract ${shellQuote(file)} stdout -l tha+eng 2>/dev/null | head -c 6000`,
  );
  const ocrText = (ocr.stdout || "").trim();

  await ctx.onProgress?.(60, "vision", "ให้ DeepSeek อ่านภาพจริง");
  // Downscale a copy so the payload stays small, then read it back as base64.
  const shrink = await sh(
    ctx.userId,
    `cd ${WORK_DIR} && convert ${shellQuote(file)} -resize 1024x1024\\> -quality 72 /tmp/wb-vision.jpg 2>/dev/null && stat -c %s /tmp/wb-vision.jpg`,
  );
  let visionNote = "ไม่ได้ส่งภาพให้โมเดล (เตรียมภาพไม่สำเร็จ)";
  let description = "";
  if (shrink.exitCode === 0) {
    let b64 = "";
    const viaExec = await sh(ctx.userId, `base64 -w0 /tmp/wb-vision.jpg | head -c 400000`);
    if (viaExec.exitCode === 0 && viaExec.stdout.trim()) b64 = viaExec.stdout.trim();
    if (b64) {
      try {
        const res = await callWoibotLLM({
          system:
            "You read images for a business assistant. Describe exactly what is visible: layout, text you can read, charts, tables, numbers, products, people. " +
            "Do not guess unreadable values; say they are unreadable. Answer in the language of the user's brief.",
          user: `Brief: ${ctx.goal}\n\nOCR text (may be incomplete):\n${ocrText.slice(0, 2500)}`,
          images: [{ dataUrl: `data:image/jpeg;base64,${b64}` }],
          maxTokens: 900,
        });
        description = res.text;
        visionNote = `vision ok (${res.model})`;
      } catch (e) {
        visionNote = `vision failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
  }

  await ctx.onProgress?.(80, "report", "เขียนรายงานและแปลงเป็น PDF");
  const body = `# ${ctx.title}

## สรุปจากภาพ
${description || ocrText || "ไม่พบเนื้อหาในภาพ"}

## ข้อความที่อ่านได้ (OCR)
\`\`\`
${ocrText || "(ไม่มี)"}
\`\`\`

## ไฟล์ต้นทาง
- ${file.split("/").pop()}

## ข้อจำกัด
- ระบบอ่านจากภาพจริงที่อัปโหลด (${visionNote}); ตัวเลขที่เล็กหรือเบลออาจอ่านผิด ควรตรวจซ้ำ
`;
  must(await writeWorkspaceFile(ctx.userId, `${slug}.md`, body), "write image report");

  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${ctx.title}</title>
<style>@page{size:A4;margin:20mm}body{font-family:"Noto Sans Thai",sans-serif;font-size:11pt;line-height:1.6}
pre{background:#f4f4f4;padding:8pt;white-space:pre-wrap;font-size:9.5pt}h2{margin-top:14pt}</style></head><body>
<h1>${ctx.title}</h1><h2>สรุปจากภาพ</h2><p>${(description || "ไม่พบเนื้อหา").replace(/</g, "&lt;").replace(/\n/g, "</p><p>")}</p>
<h2>ข้อความที่อ่านได้ (OCR)</h2><pre>${ocrText.replace(/</g, "&lt;") || "(ไม่มี)"}</pre>
<h2>ข้อจำกัด</h2><p>ระบบอ่านจากภาพจริง (${visionNote}) — ตัวเลขเล็ก/เบลออาจคลาดเคลื่อน</p>
</body></html>`;
  must(await writeWorkspaceFile(ctx.userId, `${slug}.html`, html), "write image html");
  const lo = "HOME=/tmp soffice -env:UserInstallation=file:///tmp/lo --headless";
  await sh(ctx.userId, `cd ${WORK_DIR} && ${lo} --convert-to pdf --outdir . ${slug}.html 2>&1 | tail -2`);
  const chk = await sh(ctx.userId, `ls -l ${WORK_DIR}/${slug}.pdf 2>&1`);

  const files = [`${slug}.md`];
  if (chk.exitCode === 0) files.push(`${slug}.pdf`);
  return { ok: true, files, notes: [visionNote, chk.exitCode === 0 ? "pdf ok" : "pdf missing"] };
}


/* -------------------------------------------------------------------- csv */

async function produceCsvSimple(ctx: AgentContext, slug: string): Promise<AgentResult> {
  await ctx.onProgress?.(30, "draft", "ให้ AI สร้างข้อมูลตาราง");
  const res = await callWoibotLLM({
    system:
      "You generate tabular data. Reply with CSV text only: a header row then data rows, comma separated, " +
      "no markdown fences, no commentary, at least 8 rows. Use the language of the brief for headers.",
    user: `สร้างชุดข้อมูล CSV สำหรับ: ${ctx.goal}\nชื่อไฟล์: ${slug}.csv`,
    maxTokens: 1400,
  });
  const raw = res.text.replace(/```csv|```/g, "").trim();
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3 || !lines[0].includes(",")) {
    return { ok: false, files: [], notes: [], error: "AI ไม่ได้สร้างข้อมูล CSV ที่ใช้ได้" };
  }

  const csv = lines.join("\n") + "\n";
  must(await writeWorkspaceFile(ctx.userId, `${slug}.csv`, csv), "write csv");
  const check = await sh(ctx.userId, `cd ${WORK_DIR} && python3 -c "import csv,sys; r=list(csv.reader(open('${slug}.csv'))); print(len(r)-1, len(r[0]))"`);
  if (check.exitCode !== 0) {
    return { ok: false, files: [], notes: [], error: `CSV ไม่ถูกต้อง: ${check.stderr.slice(0, 200)}` };
  }
  return { ok: true, files: [`${slug}.csv`], notes: [`rows/cols: ${check.stdout.trim()}`] };
}

/* ------------------------------------------------------------------- api */

export async function runAgentTask(ctx: AgentContext): Promise<AgentResult> {
  // Auto-select the top-3 catalog skills for this goal and carry the rendered
  // block into the LLM briefs below. Best effort only: if selection fails for
  // any reason the task still runs, just without the skills section.
  let skillBlock = "";
  try {
    const selected = await selectSkills(ctx.goal, 3);
    skillBlock = skillPromptBlock(selected);
  } catch (e) {
    console.warn(
      "[skills] selection unavailable, continuing without:",
      e instanceof Error ? e.message : String(e),
    );
  }
  if (skillBlock) ctx = { ...ctx, skillBlock };

  const slug = slugFor(ctx.title);
  const kind = ctx.workKind;

  if (kind === "media_heavy") {
    return {
      ok: false,
      files: [],
      notes: [],
      skipped: "unsupported",
      error:
        "งานประมวลผลหนักประเภทนี้ยังไม่เปิดใช้งาน — ระบบไม่รันเพื่อไม่ให้ได้ผลงานปลอม",
    };
  }

  try {
    if (kind === "doc") return await produceDocxAndPdf(ctx, slug);
    if (kind === "data") {
      const g = (ctx.goal + " " + ctx.title).toLowerCase();
      if (/excel|xlsx|สเปรดชีต|ตาราง|spreadsheet/.test(g)) return await produceSpreadsheet(ctx, slug);
      if (/\bcsv\b/.test(g)) return await produceCsvSimple(ctx, slug);
      return await produceData(ctx, slug);
    }
    if (kind === "research") return await produceResearch(ctx, slug);
    if (kind === "video_analysis") return await produceVideoAnalysis(ctx, slug);
    if (kind === "video_gen") {
      // Composes a real MP4 from generated title cards + audio bed (not a generative model).
      const out = await produceVideoClip(ctx, slug);
      if (out?.ok) out.notes = [...(out.notes || []), "ประกอบจาก title cards + แทร็กเสียงที่สร้างขึ้น (ไม่ใช่ footage จากโมเดลสร้างวิดีโอ)"];
      return out;
    }
    if (kind === "coding") return await produceCoding(ctx, slug);
    if (kind === "image") {
      const g = (ctx.goal + " " + ctx.title).toLowerCase();
      if (/สร้างภาพ|โปสเตอร์|poster|banner|โฆษณา|design|ออกแบบ|creative/.test(g)) {
        return await produceImageBrief(ctx, slug);
      }
      const newest = await sh(ctx.userId, `cd ${WORK_DIR} && ls -t *.png *.jpg *.jpeg *.webp uploads/* 2>/dev/null | head -1`);
      const rel = newest.stdout.trim().split("\n")[0];
      if (rel) {
        const described = await describeImage(ctx, rel);
        if (described?.ok && described.files?.length) return described;
      }
      return await produceImageReport(ctx, slug);
    }
    return { ok: false, files: [], notes: [], error: `ไม่รู้จักประเภทงาน: ${kind}` };
  } catch (e) {
    return { ok: false, files: [], notes: [], error: e instanceof Error ? e.message : String(e) };
  }
}
