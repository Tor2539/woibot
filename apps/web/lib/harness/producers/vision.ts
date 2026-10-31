/**
 * Vision producer — OCR first, description second.
 *
 * Deliberately narrow: this harness has no multimodal model wired in, so the
 * only thing it can honestly know about an image is what tesseract read out of
 * it plus the pixel metadata (`identify`). The description is therefore built
 * strictly from the OCR text, and every result says so. It never claims to have
 * "looked at" a picture.
 */
import type { AgentContext, AgentResult } from "../agent";
import { execInContainer, runScript, writeWorkspaceFile, WORK_DIR } from "../container";
import { callWoibotLLM } from "../../llm";

export type ImageDescriptionMeta = {
  relPath: string;
  bytes: number;
  width?: number;
  height?: number;
  format?: string;
  ocrLang: string;
  ocrChars: number;
  page?: number;
};

export type ImageDescription = AgentResult & {
  relPath: string;
  /** Raw text tesseract actually read. */
  text: string;
  /** LLM description of that text — not of the pixels. */
  description: string;
  meta: ImageDescriptionMeta;
};

const MIN_BYTES = 1000;

function shellQuote(s: string) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/** Workspace-relative path only; no traversal, no absolute paths. */
function safeRelPath(relPath: string): string {
  const cleaned = String(relPath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!cleaned || cleaned.includes("..") || cleaned.startsWith("-")) {
    throw new Error(`พาธไฟล์ไม่ถูกต้อง: ${relPath} (ต้องเป็นพาธสัมพัทธ์ใน workspace)`);
  }
  return cleaned.replace(/[^A-Za-z0-9._\-\/]/g, "_");
}

const OCR_SCRIPT = String.raw`
set -u
cd %WORKDIR%
src=%SRC%
base=%BASE%
img="$src"
pre="/tmp/wbvision-$base-pre.png"
outbase="/tmp/wbvision-$base-ocr"
rm -f "$pre" "$outbase.txt"

# a PDF has no pixels yet: rasterise page 1 first
case "$src" in
  *.pdf|*.PDF)
    if command -v pdftoppm >/dev/null 2>&1; then
      pdftoppm -png -r 200 -f 1 -l 1 "$src" "/tmp/wbvision-$base-page" >/dev/null 2>&1 || true
      cand=$(ls /tmp/wbvision-$base-page*.png 2>/dev/null | head -1 || true)
      if [ -n "$cand" ]; then img="$cand"; fi
    fi
    ;;
esac

dims=$(identify -format '%wx%h' "$img" 2>/dev/null || echo "")
fmt=$(identify -format '%m' "$img" 2>/dev/null || echo "")

# upscale + sharpen improves small-print recognition; failure is not fatal
if command -v convert >/dev/null 2>&1; then
  convert "$img" -colorspace Gray -resize '2600x2600>' -sharpen 0x1 "$pre" >/dev/null 2>&1 || true
fi
[ -s "$pre" ] || pre="$img"

langs="eng"
if tesseract --list-langs 2>/dev/null | grep -qx 'tha'; then langs="tha+eng"; fi

tesseract "$pre" "$outbase" -l "$langs" >/tmp/wbvision-$base.log 2>&1 || true
[ -f "$outbase.txt" ] || : > "$outbase.txt"

chars=$(wc -c < "$outbase.txt" 2>/dev/null | tr -d ' ')
bytes=$(stat -c %s "$src" 2>/dev/null || echo 0)

echo "DIMS=$dims"
echo "FORMAT=$fmt"
echo "LANGS=$langs"
echo "CHARS=$chars"
echo "BYTES=$bytes"
echo "PRE=$pre"
`;

/**
 * OCR a workspace image (or the first page of a PDF) and describe the text.
 * Throws when the source file is missing or tesseract is unavailable.
 */
export async function describeImage(ctx: AgentContext, relPath: string): Promise<ImageDescription> {
  const rel = safeRelPath(relPath);
  const base = rel.replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 48) || "image";

  const stat = await execInContainer(ctx.userId, `stat -c %s ${shellQuote(`${WORK_DIR}/${rel}`)} 2>&1`);
  const size = Number(stat.stdout.trim());
  if (stat.exitCode !== 0 || !Number.isFinite(size)) {
    throw new Error(`ไม่พบไฟล์ ${rel} ใน workspace — อัปโหลดรูปก่อนให้ OCR`);
  }
  if (size === 0) throw new Error(`ไฟล์ ${rel} ว่างเปล่า (0 bytes) — OCR ไม่ได้`);

  await ctx.onProgress?.(25, "ocr", `tesseract กำลังอ่านตัวอักษรจาก ${rel}`);
  const script = OCR_SCRIPT.replace("%WORKDIR%", WORK_DIR)
    .replace("%SRC%", shellQuote(rel))
    .replace(/%BASE%/g, shellQuote(base));
  const run = await runScript(ctx.userId, script);
  if (run.exitCode !== 0) {
    throw new Error(`OCR ล้มเหลว: ${(run.stderr || run.stdout).slice(0, 300)}`);
  }

  const grab = (key: string) => (run.stdout.match(new RegExp(`^${key}=(.*)$`, "m")) || [])[1]?.trim() || "";

  const ocrLang = grab("LANGS") || "eng";
  const dims = grab("DIMS");
  const [width, height] = dims.split("x").map(Number);
  const chars = Number(grab("CHARS") || 0);

  const read = await execInContainer(ctx.userId, `cat ${shellQuote(`/tmp/wbvision-${base}-ocr.txt`)} 2>/dev/null | head -c 40000`);
  const text = (read.stdout || "").replace(/\r/g, "").trim();

  await ctx.onProgress?.(55, "read", chars > 0 ? `อ่านได้ ${chars} ตัวอักษร` : "ไม่พบตัวอักษรในภาพ");

  const excerpt = text.slice(0, 6000) || "[OCR returned no text]";
  const draft = await callWoibotLLM({
    system:
      "You summarise OCR output from a scanned document or screenshot. You have NOT seen the image — you only have text that " +
      "tesseract extracted, which may contain recognition errors and has lost all layout. " +
      "Write at most 150 words covering: what the document appears to be, its structure (headings, table, list, form fields) " +
      "if and only if the text shows it, the key facts that literally appear, and which parts look garbled or unreadable. " +
      "Never invent numbers, names, dates, or visual details that are not in the text. " +
      "If the text is empty or pure noise, say exactly that and do not guess what the image shows. " +
      "Answer in the language of the text (Thai if the text is Thai, otherwise English). No markdown headings.",
    user: `File: ${rel} (${width || "?"}x${height || "?"})\nOCR (lang ${ocrLang}):\n${excerpt}`,
    maxTokens: 700,
  });

  const description = draft.text.trim() || (text ? "OCR succeeded but no description was generated." : "ไม่พบข้อความในภาพนี้");
  const notes = [
    `ocr=${ocrLang}, ${text.length} chars read from ${rel}`,
    dims ? `image ${dims} ${grab("FORMAT")}` : "image dimensions unavailable",
    `described by ${draft.provider} from OCR text only (no visual model)`,
  ];

  await ctx.onProgress?.(80, "write", "บันทึกผล OCR และคำอธิบายลง workspace");
  const md = `# OCR — ${rel}\n\n- size: ${size} bytes\n- dimensions: ${dims || "unknown"}\n- ocr lang: ${ocrLang}\n- characters: ${text.length}\n\n## Extracted text\n\n${
    text || "_(no text recognised)_"
  }\n\n## Description (derived from the OCR text only)\n\n${description}\n`;
  must(await writeWorkspaceFile(ctx.userId, `${base}.ocr.txt`, text || "(no text recognised)\n"), "เขียนผล OCR");
  must(await writeWorkspaceFile(ctx.userId, `${base}.ocr.md`, md), "เขียนรายงาน OCR");

  const json = {
    relPath: rel,
    bytes: size,
    width: width || undefined,
    height: height || undefined,
    format: grab("FORMAT") || undefined,
    ocrLang,
    ocrChars: text.length,
    text,
    description,
  };
  must(await writeWorkspaceFile(ctx.userId, `${base}.ocr.json`, JSON.stringify(json, null, 2)), "เขียนผล OCR (json)");

  await ctx.onProgress?.(94, "verify", "ตรวจไฟล์ผลลัพธ์ใน workspace");
  const out = await execInContainer(
    ctx.userId,
    `stat -c %s ${shellQuote(`${WORK_DIR}/${base}.ocr.json`)} 2>&1`,
  );
  const outSize = Number(out.stdout.trim());
  if (out.exitCode !== 0 || !(outSize > 200)) {
    throw new Error(`บันทึกผล OCR ไม่สำเร็จ: ${base}.ocr.json (${out.stdout.slice(0, 120)})`);
  }

  return {
    ok: true,
    files: [`${base}.ocr.txt`, `${base}.ocr.md`, `${base}.ocr.json`],
    notes,
    relPath: rel,
    text,
    description,
    meta: { relPath: rel, bytes: size, width: width || undefined, height: height || undefined, format: grab("FORMAT") || undefined, ocrLang, ocrChars: text.length },
  };
}

function must(r: { exitCode: number; stdout: string; stderr: string }, what: string) {
  if (r.exitCode !== 0) {
    throw new Error(`${what} ล้มเหลว (exit ${r.exitCode}): ${(r.stderr || r.stdout).slice(0, 300)}`);
  }
  return r;
}
