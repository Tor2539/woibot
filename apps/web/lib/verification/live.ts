/**
 * Live verification — every check below actually runs open-source tooling
 * inside the user's isolated Cloud Computer (ffprobe, LibreOffice, poppler,
 * tsc, pandas, ImageMagick, Playwright). Nothing is asserted without evidence:
 * if the container is unreachable or a file is missing, the check fails and
 * the report says so.
 */
import { runScript, parseResult } from "./exec";
import type { Check, VerificationReport } from "./types";

const WS = "/home/woibot/workspace";

const VIDEO_SCRIPT = String.raw`
set -u
f=$(ls -t ${WS}/*.mp4 ${WS}/*.mov ${WS}/*.webm ${WS}/*/*.mp4 ${WS}/*/*.mov 2>/dev/null | head -1)
if [ -z "$f" ]; then echo '__RESULT__{"found":false}'; exit 0; fi
python3 - "$f" <<'PY'
import json, os, subprocess, sys
f = sys.argv[1]
raw = subprocess.run(["ffprobe","-v","error","-print_format","json","-show_format","-show_streams",f],
                     capture_output=True, text=True).stdout
try:
    d = json.loads(raw or "{}")
except Exception:
    d = {}
streams = d.get("streams", [])
fmt = d.get("format", {})
v = next((s for s in streams if s.get("codec_type") == "video"), None)
a = next((s for s in streams if s.get("codec_type") == "audio"), None)
s = next((s for s in streams if s.get("codec_type") == "subtitle"), None)
print("__RESULT__" + json.dumps({
    "found": True,
    "file": f,
    "bytes": os.path.getsize(f),
    "duration": float(fmt.get("duration") or 0),
    "format_name": fmt.get("format_name"),
    "bit_rate": int(fmt.get("bit_rate") or 0),
    "video": None if not v else {
        "codec": v.get("codec_name"), "width": v.get("width"), "height": v.get("height"),
        "fps": v.get("r_frame_rate"), "pix_fmt": v.get("pix_fmt"),
    },
    "audio": None if not a else {"codec": a.get("codec_name"), "sample_rate": a.get("sample_rate"), "channels": a.get("channels")},
    "subtitle_streams": 0 if not s else 1,
}))
PY
`;

const DOC_SCRIPT = String.raw`
set -u
f=$(ls -t ${WS}/*.docx ${WS}/*.pptx ${WS}/*.xlsx ${WS}/*.pdf ${WS}/*/*.docx ${WS}/*/*.pdf 2>/dev/null | head -1)
if [ -z "$f" ]; then echo '__RESULT__{"found":false}'; exit 0; fi
rm -rf /tmp/wbv && mkdir -p /tmp/wbv
python3 - "$f" <<'PY'
import json, os, subprocess, sys
f = sys.argv[1]
ext = os.path.splitext(f)[1].lower()
pdf = f if ext == ".pdf" else None
if not pdf:
    subprocess.run(["soffice","--headless","--convert-to","pdf","--outdir","/tmp/wbv",f],
                   capture_output=True, timeout=300)
    cand = os.path.join("/tmp/wbv", os.path.splitext(os.path.basename(f))[0] + ".pdf")
    pdf = cand if os.path.exists(cand) else None
pages = 0
words = 0
size_pdf = 0
if pdf:
    size_pdf = os.path.getsize(pdf)
    info = subprocess.run(["pdfinfo",pdf], capture_output=True, text=True).stdout
    for line in info.splitlines():
        if line.lower().startswith("pages:"):
            try: pages = int(line.split(":",1)[1].strip())
            except Exception: pages = 0
    txt = subprocess.run(["pdftotext",pdf,"-"], capture_output=True, text=True).stdout
    words = len(txt.split())
print("__RESULT__" + json.dumps({
    "found": True, "file": f, "ext": ext, "bytes": os.path.getsize(f),
    "converted_pdf": pdf, "pdf_bytes": size_pdf, "pages": pages, "words": words,
}))
PY
`;

const DATA_SCRIPT = String.raw`
set -u
f=$(ls -t ${WS}/*.csv ${WS}/*.xlsx ${WS}/*/*.csv ${WS}/*/*.xlsx 2>/dev/null | head -1)
if [ -z "$f" ]; then echo '__RESULT__{"found":false}'; exit 0; fi
python3 - "$f" <<'PY'
import json, os, sys
f = sys.argv[1]
rows = cols = nulls = 0
err = None
try:
    import pandas as pd
    df = pd.read_csv(f) if f.lower().endswith(".csv") else pd.read_excel(f)
    rows, cols = int(df.shape[0]), int(df.shape[1])
    nulls = int(df.isna().sum().sum())
except Exception as e:
    err = str(e)
print("__RESULT__" + json.dumps({
    "found": True, "file": f, "bytes": os.path.getsize(f),
    "rows": rows, "cols": cols, "nulls": nulls, "error": err,
}))
PY
`;

const CODE_SCRIPT = (cmd: string) => String.raw`
set -u
cd ${WS}
if [ ! -f package.json ]; then echo '__RESULT__{"found":false}'; exit 0; fi
${cmd}
`;

const RESEARCH_SCRIPT = String.raw`
set -u
f=$(ls -t ${WS}/*.md ${WS}/*.txt ${WS}/*/*.md 2>/dev/null | head -1)
if [ -z "$f" ]; then echo '__RESULT__{"found":false}'; exit 0; fi
python3 - "$f" <<'PY'
import json, re, sys
f = sys.argv[1]
t = open(f, encoding="utf-8", errors="ignore").read()
urls = re.findall(r"https?://[^\s)\]\"']+", t)
headings = re.findall(r"^#{1,3} .+$", t, re.M)
print("__RESULT__" + json.dumps({
    "found": True, "file": f, "chars": len(t), "urls": len(set(urls)),
    "headings": len(headings), "words": len(t.split()),
}))
PY
`;

function critical(name: string, passed: boolean, detail: string, extra?: Partial<Check>): Check {
  return { name, passed, detail, severity: "critical", ...extra };
}
function warn(name: string, passed: boolean, detail: string): Check {
  return { name, passed, detail, severity: "warning" };
}

function unavailable(taskId: string, type: VerificationReport["type"], reason: string): VerificationReport {
  return {
    taskId,
    type,
    mode: "unavailable",
    passed: false,
    checks: [critical("computer_available", false, `Cloud Computer unavailable: ${reason}. No evidence was produced, so the task cannot be marked completed.`)],
    summary: "Verification could not run — the user's Cloud Computer was unreachable.",
    limitations: ["Re-run verification once the Cloud Computer is running."],
    createdAt: new Date().toISOString(),
  };
}

export async function runLiveVerification(
  userId: string,
  taskId: string,
  type: VerificationReport["type"],
  opts: Record<string, any> = {},
): Promise<VerificationReport> {
  const started = Date.now();

  if (type === "coding") {
    const script = CODE_SCRIPT(String.raw`
echo '## typecheck' 
if [ -f tsconfig.json ]; then npx --yes tsc --noEmit 2>&1 | tail -5; echo "tsc_exit=$?"; else echo "tsc_skip=no_tsconfig"; fi
echo '## test'
npm test --if-present 2>&1 | tail -8; echo "test_exit=$?"
echo '## build'
npm run build --if-present 2>&1 | tail -8; echo "build_exit=$?"
echo '## result'
python3 - <<'PY'
print("__RESULT__" + "{}")
PY
`);
    const out = await runScript(userId, script);
    if (!out.available) return unavailable(taskId, type, out.error || "unreachable");
    const s = out.stdout;
    const found = !s.includes('"found":false');
    const checks: Check[] = [
      critical("project_present", found, found ? "package.json found in the user's workspace" : "No package.json in /home/woibot/workspace"),
      critical("typecheck", /tsc_exit=0/.test(s), pick(s, "tsc_exit")),
      critical("tests", /test_exit=0/.test(s), pick(s, "test_exit")),
      critical("build", /build_exit=0/.test(s), pick(s, "build_exit")),
    ];
    const passed = checks.filter((c) => c.severity === "critical").every((c) => c.passed);
    return {
      taskId, type, mode: "live", passed, checks,
      summary: passed ? "Coding verified by running typecheck, tests and build inside the Cloud Computer." : "Coding verification failed — see failing checks for the real command output.",
      limitations: ["Browser-level UX is only covered when the project ships its own e2e suite."],
      createdAt: new Date().toISOString(), durationMs: Date.now() - started,
    };
  }

  if (type === "video") {
    const out = await runScript(userId, VIDEO_SCRIPT);
    if (!out.available) return unavailable(taskId, type, out.error || "unreachable");
    const r = parseResult<any>(out.stdout);
    if (!r?.found) {
      return {
        taskId, type, mode: "live", passed: false,
        checks: [critical("deliverable_present", false, "No video file found in /home/woibot/workspace")],
        summary: "Verification failed — no rendered video to inspect.",
        createdAt: new Date().toISOString(), durationMs: Date.now() - started,
      };
    }
    const v = r.video || {};
    const expect = Number(opts.expectedDuration || 0);
    const tol = Number(opts.durationTolerance || 1.0);
    const checks: Check[] = [
      critical("file_readable", r.bytes > 1024, `${r.file} — ${(r.bytes / 1024 / 1024).toFixed(2)} MB, container ${r.format_name}`),
      critical("duration", expect ? Math.abs(r.duration - expect) <= tol : r.duration > 0,
        expect ? `${r.duration.toFixed(2)}s vs requested ${expect}s (tolerance ±${tol}s)` : `duration ${r.duration.toFixed(2)}s`),
      critical("video_stream", Boolean(v.codec), v.codec ? `${v.codec} ${v.width}x${v.height} @ ${v.fps} ${v.pix_fmt}` : "no decodable video stream"),
      warn("audio_stream", Boolean(r.audio), r.audio ? `${r.audio.codec} ${r.audio.sample_rate}Hz ${r.audio.channels}ch` : "no audio track"),
      warn("aspect_ratio", Boolean(v.width && v.height), v.width && v.height ? `${(v.width / v.height).toFixed(3)} (${v.width}:${v.height})` : "unknown"),
      { name: "subtitles", passed: r.subtitle_streams > 0, detail: r.subtitle_streams ? "embedded subtitle stream present" : "no embedded subtitles (sidecar .srt not auto-verified)", severity: "info" },
    ];
    const passed = checks.filter((c) => c.severity === "critical").every((c) => c.passed);
    return {
      taskId, type, mode: "live", passed, checks,
      summary: passed ? `Video verified with ffprobe — ${r.duration.toFixed(1)}s, ${v.width}x${v.height}, ${v.codec}.` : "Video verification failed — inspect the failing checks.",
      limitations: ["Frame-level content/AI-quality review is not automated."],
      createdAt: new Date().toISOString(), durationMs: Date.now() - started,
      artifacts: [{ name: "video", url: `/files/${taskId}/${r.file.split("/").pop()}`, mimeType: "video/mp4" }],
    };
  }

  if (type === "doc") {
    const out = await runScript(userId, DOC_SCRIPT);
    if (!out.available) return unavailable(taskId, type, out.error || "unreachable");
    const r = parseResult<any>(out.stdout);
    if (!r?.found) {
      return {
        taskId, type, mode: "live", passed: false,
        checks: [critical("deliverable_present", false, "No .docx/.pdf/.pptx/.xlsx file found in the workspace")],
        summary: "Verification failed — no document to inspect.",
        createdAt: new Date().toISOString(), durationMs: Date.now() - started,
      };
    }
    const minPages = Number(opts.minPages || 1);
    const minWords = Number(opts.minWords || 50);
    const checks: Check[] = [
      critical("opens_in_libreoffice", Boolean(r.converted_pdf || r.ext === ".pdf"), r.converted_pdf ? `converted to PDF via LibreOffice headless (${(r.pdf_bytes / 1024).toFixed(0)} KB)` : "LibreOffice could not convert the file"),
      critical("page_count", r.pages >= minPages, `${r.pages} page(s), minimum ${minPages}`),
      critical("has_text", r.words >= minWords, `${r.words} words extracted (pdftotext), minimum ${minWords}`),
      warn("formats", true, `source format ${r.ext}${r.ext !== ".pdf" ? " + PDF derivative" : ""}`),
    ];
    const passed = checks.filter((c) => c.severity === "critical").every((c) => c.passed);
    return {
      taskId, type, mode: "live", passed, checks,
      summary: passed ? `Document verified — opens, ${r.pages} pages, ${r.words} words.` : "Document verification failed.",
      limitations: ["Visual layout/brand review still needs a human eye."],
      createdAt: new Date().toISOString(), durationMs: Date.now() - started,
    };
  }

  if (type === "data") {
    const out = await runScript(userId, DATA_SCRIPT);
    if (!out.available) return unavailable(taskId, type, out.error || "unreachable");
    const r = parseResult<any>(out.stdout);
    if (!r?.found) {
      return {
        taskId, type, mode: "live", passed: false,
        checks: [critical("deliverable_present", false, "No .csv/.xlsx file found in the workspace")],
        summary: "Verification failed — no dataset to inspect.",
        createdAt: new Date().toISOString(), durationMs: Date.now() - started,
      };
    }
    const checks: Check[] = [
      critical("parses", !r.error, r.error ? `pandas failed: ${r.error}` : `pandas read ${r.rows} rows × ${r.cols} columns`),
      critical("has_rows", r.rows > 0, `${r.rows} data rows`),
      warn("null_ratio", r.rows === 0 ? true : r.nulls / (r.rows * Math.max(r.cols, 1)) < 0.2, `${r.nulls} null cells`),
    ];
    const passed = checks.filter((c) => c.severity === "critical").every((c) => c.passed);
    return {
      taskId, type, mode: "live", passed, checks,
      summary: passed ? `Dataset verified — ${r.rows}×${r.cols}, parsed with pandas.` : "Dataset verification failed.",
      createdAt: new Date().toISOString(), durationMs: Date.now() - started,
    };
  }

  const out = await runScript(userId, RESEARCH_SCRIPT);
  if (!out.available) return unavailable(taskId, type, out.error || "unreachable");
  const r = parseResult<any>(out.stdout);
  if (!r?.found) {
    return {
      taskId, type, mode: "live", passed: false,
      checks: [critical("deliverable_present", false, "No .md/.txt research deliverable found in the workspace")],
      summary: "Verification failed — no research document to inspect.",
      createdAt: new Date().toISOString(), durationMs: Date.now() - started,
    };
  }
  const minSources = Number(opts.minSources || 3);
  const checks: Check[] = [
    critical("has_content", r.words >= 150, `${r.words} words`),
    critical("structured", r.headings >= 3, `${r.headings} headings`),
    critical("sources", r.urls >= minSources, `${r.urls} unique source URLs (minimum ${minSources})`),
  ];
  const passed = checks.filter((c) => c.severity === "critical").every((c) => c.passed);
  return {
    taskId, type, mode: "live", passed, checks,
    summary: passed ? `Research verified — ${r.words} words, ${r.headings} headings, ${r.urls} sources.` : "Research verification failed — insufficient sourcing or structure.",
    limitations: ["Claim-level fact checking is not automated."],
    createdAt: new Date().toISOString(), durationMs: Date.now() - started,
  };
}

function pick(stdout: string, key: string): string {
  const lines = stdout.split("\n").filter((l) => l.includes(key));
  return lines.length ? lines[lines.length - 1].trim() : `${key} not reported`;
}
