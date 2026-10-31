/**
 * Media producers: a rendered poster (SVG -> PNG) and a real encoded MP4.
 *
 * There is no stock footage and no download: every pixel comes from either an
 * LLM-written brief rendered with ImageMagick/Chromium, or from title cards
 * rasterised inside the container and stitched with ffmpeg. If a renderer is
 * missing the producer fails loudly instead of shipping a broken file.
 */
import type { AgentContext, AgentResult } from "../agent";
import { execInContainer, runScript, writeWorkspaceFile, WORK_DIR } from "../container";
import { callWoibotLLM } from "../../llm";

/* --------------------------------------------------------------- plumbing */

const MIN_BYTES = 1000;

type ProducerResult = AgentResult;

function shellQuote(s: string) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

function must(r: { exitCode: number; stdout: string; stderr: string }, what: string) {
  if (r.exitCode !== 0) {
    throw new Error(`${what} ล้มเหลว (exit ${r.exitCode}): ${(r.stderr || r.stdout).slice(0, 400)}`);
  }
  return r;
}

async function requireFile(userId: string, relPath: string, what: string, minBytes = MIN_BYTES): Promise<number> {
  const r = await execInContainer(userId, `stat -c %s ${shellQuote(`${WORK_DIR}/${relPath}`)} 2>&1`);
  const n = Number(r.stdout.trim());
  if (r.exitCode !== 0 || !Number.isFinite(n)) {
    throw new Error(`${what}: ไม่พบไฟล์ ${relPath} — เรนเดอร์ไม่สำเร็จ`);
  }
  if (n <= minBytes) throw new Error(`${what}: ไฟล์ ${relPath} เล็กผิดปกติ (${n} bytes) — เรนเดอร์เสีย`);
  return n;
}

function unfence(text: string) {
  return text.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```\s*$/m, "").trim();
}

/** Pull the first JSON object out of a chatty model answer. */
function firstJson<T>(text: string): T | null {
  const raw = unfence(text);
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

const HEX = /^#[0-9A-Fa-f]{3,8}$/;
function color(v: unknown, fallback: string) {
  const s = String(v || "").trim();
  return HEX.test(s) ? s : fallback;
}

/* ---------------------------------------------------------------- poster */

type PosterBrief = {
  kicker?: string;
  headline: string;
  subhead?: string;
  bullets?: string[];
  footer?: string;
  palette?: { bg?: string; fg?: string; accent?: string };
};

function escXml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Rough advance-width estimate so SVG (no auto-wrap) lines never overflow. */
function measure(s: string, fontSize: number): number {
  let w = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0) || 0;
    if (code >= 0x0e00 && code <= 0x0e7f) w += 0.56;
    else if (ch === " ") w += 0.28;
    else if (/[A-Z0-9]/.test(ch)) w += 0.62;
    else if (/[a-z]/.test(ch)) w += 0.52;
    else w += 0.45;
  }
  return w * fontSize;
}

function wrapToWidth(text: string, maxWidth: number, fontSize: number, maxLines: number): string[] {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: string[] = [];
  let line = "";

  const pushChunked = (word: string) => {
    let rest = word;
    while (rest.length > 1 && measure(rest, fontSize) > maxWidth) {
      let cut = 1;
      while (cut < rest.length && measure(rest.slice(0, cut + 1), fontSize) <= maxWidth) cut++;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  };

  for (const word of clean.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, fontSize) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) {
      out.push(line);
      line = "";
    }
    pushChunked(word);
  }
  if (line) out.push(line);
  return out.slice(0, maxLines);
}

export function buildPosterSvg(brief: PosterBrief, title: string): string {
  const W = 1080;
  const H = 1350;
  const pad = 84;
  const inner = W - pad * 2;
  const bg = color(brief.palette?.bg, "#0B1020");
  const fg = color(brief.palette?.fg, "#FFFFFF");
  const accent = color(brief.palette?.accent, "#22D3EE");

  const kicker = (brief.kicker || "woibot · WORK").slice(0, 60);
  const headline = brief.headline || title;
  const subhead = brief.subhead || "";
  const bullets = (brief.bullets || []).filter(Boolean).slice(0, 4);
  const footer = brief.footer || "woibot Work · generated in your Cloud Computer";

  const parts: string[] = [];
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${bg}"/>`);
  parts.push(`<rect x="0" y="0" width="${W}" height="12" fill="${accent}"/>`);
  parts.push(`<rect x="${pad}" y="196" width="64" height="5" fill="${accent}"/>`);
  parts.push(
    `<text x="${pad}" y="164" font-family="Noto Sans Thai, DejaVu Sans, sans-serif" font-size="24" letter-spacing="4" fill="${accent}">${escXml(
      kicker.toUpperCase(),
    )}</text>`,
  );

  let y = 320;
  const headSize = 74;
  for (const line of wrapToWidth(headline, inner, headSize, 4)) {
    y += headSize;
    parts.push(
      `<text x="${pad}" y="${y}" font-family="Noto Sans Thai, DejaVu Sans, sans-serif" font-size="${headSize}" font-weight="bold" fill="${fg}">${escXml(
        line,
      )}</text>`,
    );
    y += 16;
  }

  y += 58;
  parts.push(`<rect x="${pad}" y="${y}" width="96" height="4" fill="${accent}"/>`);
  y += 46;

  if (subhead) {
    for (const line of wrapToWidth(subhead, inner, 32, 4)) {
      y += 44;
      parts.push(
        `<text x="${pad}" y="${y}" font-family="Noto Sans Thai, DejaVu Sans, sans-serif" font-size="32" fill="${fg}" opacity="0.78">${escXml(
          line,
        )}</text>`,
      );
      y += 8;
    }
  }

  if (bullets.length) {
    y += 46;
    for (const b of bullets) {
      const lines = wrapToWidth(b, inner - 44, 27, 3);
      if (!lines.length) continue;
      parts.push(`<circle cx="${pad + 10}" cy="${y - 8}" r="7" fill="${accent}"/>`);
      for (const line of lines) {
        y += 38;
        parts.push(
          `<text x="${pad + 40}" y="${y}" font-family="Noto Sans Thai, DejaVu Sans, sans-serif" font-size="27" fill="${fg}" opacity="0.86">${escXml(
            line,
          )}</text>`,
        );
      }
      y += 14;
    }
  }

  parts.push(`<line x1="${pad}" y1="${H - 132}" x2="${W - pad}" y2="${H - 132}" stroke="${fg}" stroke-opacity="0.18" stroke-width="1"/>`);
  parts.push(
    `<text x="${pad}" y="${H - 88}" font-family="Noto Sans Thai, DejaVu Sans, sans-serif" font-size="21" fill="${fg}" opacity="0.55">${escXml(
      footer,
    )}</text>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n${parts.join(
    "\n",
  )}\n</svg>\n`;
}

const POSTER_RENDER = String.raw`
set -u
cd "$1"
src="$2"
out="$3"
rm -f "$out"
renderer=none

if command -v convert >/dev/null 2>&1; then
  if convert -background '#ffffff' -density 96 "$src" -resize 1080x1350! -flatten "png:$out" 2>/tmp/im.log; then
    if [ -s "$out" ]; then renderer=imagemagick; fi
  fi
fi

if [ "$renderer" = none ] && command -v rsvg-convert >/dev/null 2>&1; then
  if rsvg-convert -w 1080 -h 1350 "$src" -o "$out" 2>/dev/null; then
    if [ -s "$out" ]; then renderer=rsvg-convert; fi
  fi
fi

if [ "$renderer" = none ] && command -v chromium >/dev/null 2>&1; then
  { printf '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff}</style></head><body>'; cat "$src"; printf '</body></html>'; } > ".render-$out.html"
  timeout 45 chromium --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
    --window-size=1080,1350 --screenshot="$out" ".render-$out.html" >/dev/null 2>&1 || true
  if [ -s "$out" ]; then renderer=chromium; fi
fi

thai=$(fc-list :lang=th 2>/dev/null | wc -l | tr -d ' ')
echo "THAIFONTS=$thai"
echo "RENDERER=$renderer"
if [ -s "$out" ]; then identify -format 'DIMS=%wx%h\n' "$out" 2>/dev/null; ls -l "$out" | awk '{print "BYTES="$5}'; fi
`;

/** Design a poster brief with the LLM, render it to SVG, then rasterise to PNG. */
export async function produceImageBrief(ctx: AgentContext, slug: string): Promise<ProducerResult> {
  const notes: string[] = [];

  await ctx.onProgress?.(20, "concept", "ให้ AI ออกแบบบรีฟโปสเตอร์");
  const draft = await callWoibotLLM({
    system:
      "You are an art director. Turn the brief into poster copy. Answer with ONE JSON object only, no prose, no fences:\n" +
      '{"kicker":string,"headline":string,"subhead":string,"bullets":[string,string,string],"footer":string,' +
      '"palette":{"bg":"#RRGGBB","fg":"#RRGGBB","accent":"#RRGGBB"}}\n' +
      "Rules: headline max 60 characters and must carry the single most important message; " +
      "subhead max 140 characters; exactly 3 bullets of max 70 characters each, each a concrete benefit (no filler). " +
      "Write in the language of the brief. Pick a high-contrast palette that suits the subject (dark backgrounds usually look best). " +
      "Never invent numbers, logos, or claims that are not in the brief.",
    user: `Poster brief: ${ctx.goal}\nTopic: ${ctx.title}`,
    maxTokens: 900,
  });

  const brief = firstJson<PosterBrief>(draft.text);
  if (!brief || !brief.headline) {
    throw new Error("AI ไม่ได้สร้างบรีฟโปสเตอร์ที่ใช้ได้ (ไม่มี headline) — เรนเดอร์ไม่ได้");
  }
  notes.push(`concept via ${draft.provider}: ${String(brief.headline).slice(0, 80)}`);

  const svg = buildPosterSvg(brief, ctx.title);
  must(await writeWorkspaceFile(ctx.userId, `${slug}.svg`, svg), "เขียนไฟล์ SVG");

  await ctx.onProgress?.(60, "render", "เรนเดอร์ SVG เป็น PNG ด้วย ImageMagick");
  const render = await runScript(
    ctx.userId,
    POSTER_RENDER.replace('cd "$1"', `cd ${shellQuote(WORK_DIR)}`)
      .replace('src="$2"', `src=${shellQuote(`${slug}.svg`)}`)
      .replace('out="$3"', `out=${shellQuote(`${slug}.png`)}`),
  );

  const renderer = (render.stdout.match(/RENDERER=(\S+)/) || [])[1] || "none";
  if (renderer === "none" || render.exitCode !== 0) {
    throw new Error(
      `เรนเดอร์โปสเตอร์เป็น PNG ไม่ได้: ${(render.stderr || render.stdout).slice(0, 300) || "ไม่พบตัวแปลง SVG"}`,
    );
  }

  const dims = (render.stdout.match(/DIMS=(\d+x\d+)/) || [])[1] || "";
  const noted = (render.stdout.match(/BYTES=(\d+)/) || [])[1] || "";
  if (!dims) throw new Error("เรนเดอร์แล้วแต่ตรวจขนาดภาพไม่ได้ — ไฟล์ PNG อาจเสีย");
  const [dw, dh] = dims.split("x").map(Number);
  if (!(dw >= 540 && dh >= 540)) {
    throw new Error(`ภาพที่ได้เล็กเกินไป (${dims}) — เรนเดอร์ไม่สมบูรณ์`);
  }
  notes.push(`renderer=${renderer} ${dims} ${noted} bytes`);
  const thaiFonts = Number((render.stdout.match(/THAIFONTS=(\d+)/) || [])[1] || "0");
  if (thaiFonts === 0 && /[\u0e00-\u0e7f]/.test(`${brief.headline || ""} ${brief.subhead || ""}`)) {
    notes.push("คำเตือน: เครื่องนี้ไม่มีฟอนต์ไทยใน fontconfig — ตัวอักษรไทยในภาพอาจแสดงเป็นกล่อง (เพิ่ม fonts-noto-thai)");
  }

  const bytes = await requireFile(ctx.userId, `${slug}.png`, "เรนเดอร์โปสเตอร์");

  await ctx.onProgress?.(92, "verify", "ตรวจไฟล์ PNG จริงใน workspace");
  return { ok: true, files: [`${slug}.png`, `${slug}.svg`], notes: [...notes, `${slug}.png ${bytes} bytes`] };
}

/* ----------------------------------------------------------------- video */

type Scene = { heading?: string; sub?: string; bg?: string; fg?: string; accent?: string };
type Storyboard = { title?: string; scenes?: Scene[] };

const VIDEO_BUILD = String.raw`
import json, os, re, subprocess, sys

spec_path, work_dir, slug = sys.argv[1], sys.argv[2], sys.argv[3]
os.chdir(work_dir)
spec = json.load(open(spec_path, encoding="utf-8"))

W, H, FPS = 1920, 1080, 30
THAI = re.compile("[\u0e00-\u0e7f]")

def log(msg):
    sys.stderr.write(str(msg) + "\n")

def safe_color(v, fallback):
    v = str(v or "").strip()
    return v if re.match(r"^#[0-9A-Fa-f]{3,8}$", v) else fallback

FONT_FALLBACKS = [
    "/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]

def pick_font(text):
    patterns = [":lang=th", ":lang=en", "sans"] if THAI.search(text or "") else [":lang=en", "sans"]
    for pattern in patterns:
        try:
            r = subprocess.run(["fc-match", "-f", "%{file}", pattern], capture_output=True, text=True, timeout=10)
            p = r.stdout.strip()
        except Exception:
            p = ""
        if p and os.path.isfile(p):
            return p
    for cand in FONT_FALLBACKS:
        if os.path.isfile(cand):
            return cand
    return ""

def wrap(text, per_line, max_lines=3):
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    if not text:
        return []
    lines, cur = [], ""
    for word in text.split(" "):
        cand = (cur + " " + word).strip() if cur else word
        if len(cand) <= per_line:
            cur = cand
            continue
        if cur:
            lines.append(cur)
        while len(word) > per_line:
            lines.append(word[:per_line])
            word = word[per_line:]
        cur = word
    if cur:
        lines.append(cur)
    return lines[:max_lines]

def make_card(path, idx, total, scene, footer):
    bg = safe_color(scene.get("bg"), "#0B1020")
    fg = safe_color(scene.get("fg"), "#FFFFFF")
    accent = safe_color(scene.get("accent"), "#22D3EE")
    head = str(scene.get("heading") or "").strip()
    sub = str(scene.get("sub") or "").strip()
    font = pick_font(head + " " + sub)

    args = ["convert", "-size", "%dx%d" % (W, H), "xc:%s" % bg]
    args += ["-fill", accent, "-draw", "rectangle 0,%d %d,%d" % (H - 14, W, H)]
    args += ["-fill", accent, "-draw", "rectangle 140,%d 204,%d" % (300, 305)]
    if font:
        args += ["-font", font]
    args += ["-pointsize", "30", "-fill", accent, "-gravity", "NorthWest",
             "-annotate", "+140+190", "%02d / %02d" % (idx, total)]

    y = 348
    for line in wrap(head, 22, 3):
        args += ["-pointsize", "88", "-fill", fg, "-gravity", "NorthWest",
                 "-annotate", "+140+%d" % y, line]
        y += 112
    y += 34
    for line in wrap(sub, 46, 2):
        args += ["-pointsize", "40", "-fill", "#C7CFE0", "-gravity", "NorthWest",
                 "-annotate", "+140+%d" % y, line]
        y += 56
    if footer:
        args += ["-pointsize", "26", "-fill", "#8B93A7", "-gravity", "NorthWest",
                 "-annotate", "+140+%d" % (H - 96), footer]
    args += [path]

    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(path) or os.path.getsize(path) < 1000:
        raise SystemExit("card render failed (%s): %s" % (path, (r.stderr or r.stdout)[:400]))

scenes = [s for s in (spec.get("scenes") or []) if isinstance(s, dict) and str(s.get("heading") or "").strip()]
if len(scenes) < 3:
    raise SystemExit("storyboard needs at least 3 scenes with headings (got %d)" % len(scenes))
scenes = scenes[:6]
n = len(scenes)

# 10-20s total: 16s target, 3-5s per scene
target = 16.0
seg = max(3, min(5, int(round(target / n))))
total = float(seg * n)

footer = "woibot · " + str(spec.get("title") or slug)
cards = []
for i, scene in enumerate(scenes, start=1):
    p = "scene-%02d.png" % i
    make_card(p, i, n, scene, footer)
    cards.append(p)

out = slug + ".mp4"
cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
for p in cards:
    cmd += ["-loop", "1", "-framerate", str(FPS), "-t", str(seg), "-i", p]

audio_src = str(spec.get("audio_file") or "").strip()
has_audio_file = bool(audio_src) and os.path.isfile(audio_src)
if has_audio_file:
    cmd += ["-i", audio_src]
    afilter = ("[%d:a]volume=0.85,afade=t=in:st=0:d=1,afade=t=out:st=%.2f:d=1[aout]"
               % (n, max(0.0, total - 1.0)))
else:
    cmd += ["-f", "lavfi", "-i", "sine=frequency=196:sample_rate=44100:duration=%d" % int(total)]
    afilter = ("[%d:a]volume=0.06,tremolo=f=0.12:d=0.6,afade=t=in:st=0:d=1.5,afade=t=out:st=%.2f:d=1.5[aout]"
               % (n, max(0.0, total - 1.5)))

parts = []
for i in range(n):
    parts.append(
        "[%d:v]scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2,"
        "setsar=1,fps=%d,format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=%.2f:d=0.4[v%d]"
        % (i, W, H, W, H, FPS, max(0.0, seg - 0.4), i)
    )
parts.append("".join("[v%d]" % i for i in range(n)) + "concat=n=%d:v=1:a=0[vout]" % n)
parts.append(afilter)

cmd += ["-filter_complex", ";".join(parts),
        "-map", "[vout]", "-map", "[aout]",
        "-t", "%.2f" % total, "-r", str(FPS),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", out]

r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode != 0:
    raise SystemExit("ffmpeg encode failed: %s" % ((r.stderr or "")[:800]))

if not os.path.exists(out) or os.path.getsize(out) < 1000:
    raise SystemExit("ffmpeg produced no usable file")

# a real poster frame, decoded from the encoded video
poster = slug + "-poster.png"
subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", "0.6", "-i", out,
                "-frames:v", "1", poster], capture_output=True)

probe = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json",
                        "-show_format", "-show_streams", out], capture_output=True, text=True)
info = json.loads(probe.stdout or "{}")
fmt = info.get("format", {})
v = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), {})
a = next((s for s in info.get("streams", []) if s.get("codec_type") == "audio"), {})

print(json.dumps({
    "file": out,
    "scenes": n,
    "seconds": round(float(fmt.get("duration") or 0), 2),
    "bytes": int(fmt.get("size") or os.path.getsize(out)),
    "video": "%s %sx%s" % (v.get("codec_name"), v.get("width"), v.get("height")),
    "audio": a.get("codec_name") or "none",
    "audio_source": audio_src if has_audio_file else "generated-tone-bed",
    "font": pick_font(" ".join(str(s.get("heading") or "") + str(s.get("sub") or "") for s in scenes)) or "imagemagick-default",
    "poster": poster if os.path.exists(poster) else "",
}))
`;

/**
 * Build a real, encoded 15-18s MP4 from generated title cards + a generated
 * audio bed (or a user-supplied track already sitting in the workspace).
 */
export async function produceVideoClip(
  ctx: AgentContext,
  slug: string,
  opts: { audioRelPath?: string } = {},
): Promise<ProducerResult> {
  const notes: string[] = [];

  await ctx.onProgress?.(15, "script", "ให้ AI เขียนสตอรีบอร์ด");
  const draft = await callWoibotLLM({
    system:
      "You are a motion-graphics scriptwriter. Answer with ONE JSON object only, no prose, no fences:\n" +
      '{"title":string,"scenes":[{"heading":string,"sub":string,"bg":"#RRGGBB","fg":"#RRGGBB","accent":"#RRGGBB"}]}\n' +
      "Rules: 4 scenes (minimum 3, maximum 6). Each heading is max 40 characters — it is rendered as a large on-screen title. " +
      "Each sub is max 90 characters. Scene 1 is the hook, the middle scenes carry one idea each, the last scene is the call to action. " +
      "Use a coherent palette across scenes (e.g. dark navy background with one bright accent). " +
      "Write in the language of the brief. No scene may rely on footage we do not have.",
    user: `Video brief: ${ctx.goal}\nTitle: ${ctx.title}`,
    maxTokens: 1200,
  });

  const board = firstJson<Storyboard>(draft.text);
  const scenes = (board?.scenes || []).filter((s) => s && String(s.heading || "").trim()).slice(0, 6);
  if (scenes.length < 3) {
    throw new Error(`AI ให้สตอรีบอร์ดไม่ครบ (${scenes.length} ฉาก, ต้องมีอย่างน้อย 3) — สร้างวิดีโอไม่ได้`);
  }

  const spec = {
    title: String(board?.title || ctx.title).slice(0, 90),
    scenes: scenes.map((s) => ({
      heading: String(s.heading).slice(0, 60),
      sub: String(s.sub || "").slice(0, 140),
      bg: color(s.bg, "#0B1020"),
      fg: color(s.fg, "#FFFFFF"),
      accent: color(s.accent, "#22D3EE"),
    })),
    audio_file: opts.audioRelPath ? `${WORK_DIR}/${opts.audioRelPath.replace(/^\/+/, "")}` : "",
  };
  notes.push(`${spec.scenes.length} scenes from ${draft.provider}`);

  must(await writeWorkspaceFile(ctx.userId, `${slug}.storyboard.json`, JSON.stringify(spec, null, 2)), "เขียนสตอรีบอร์ด");
  must(await writeWorkspaceFile(ctx.userId, "_build_video.py", VIDEO_BUILD), "เขียนสคริปต์วิดีโอ");

  await ctx.onProgress?.(40, "render", "สร้างการ์ดภาพและเข้ารหัส MP4 ด้วย ffmpeg");
  const run = await runScript(
    ctx.userId,
    `cd ${WORK_DIR} && python3 _build_video.py ${shellQuote(`${slug}.storyboard.json`)} ${shellQuote(WORK_DIR)} ${shellQuote(
      slug,
    )} 2>&1`,
  );
  if (run.exitCode !== 0) {
    throw new Error(`สร้างวิดีโอไม่สำเร็จ: ${(run.stderr || run.stdout).slice(0, 400)}`);
  }

  let info: Record<string, unknown> = {};
  try {
    const last = run.stdout.trim().split("\n").filter((l) => l.trim().startsWith("{")).pop();
    info = last ? (JSON.parse(last) as Record<string, unknown>) : {};
  } catch {
    info = {};
  }

  await ctx.onProgress?.(88, "verify", "ตรวจไฟล์ MP4 ที่เข้ารหัสแล้ว");
  const bytes = await requireFile(ctx.userId, `${slug}.mp4`, "สร้างวิดีโอ");
  const seconds = Number(info.seconds || 0);
  if (seconds && seconds < 9.5) {
    throw new Error(`วิดีโอสั้นเกินไป (${seconds}s) — ต้องได้ 10-20 วินาที`);
  }
  notes.push(
    `${slug}.mp4 ${bytes} bytes, ${seconds || "?"}s, ${String(info.video || "")}, audio=${String(info.audio || "?")} (${
      info.audio_source || "generated"
    }), font=${String(info.font || "default")}`,
  );

  const files = [`${slug}.mp4`, `${slug}.storyboard.json`];
  if (info.poster) {
    files.push(`${slug}-poster.png`);
    await requireFile(ctx.userId, `${slug}-poster.png`, "สร้างภาพโปสเตอร์จากวิดีโอ", 500).catch(() => undefined);
  }
  return { ok: true, files, notes };
}
