/**
 * Document / spreadsheet / PDF producers.
 *
 * Every producer here ends with a real file on disk in the user's Cloud
 * Computer workspace. Nothing returns ok:true until `stat` has shown a file
 * bigger than MIN_BYTES — a conversion that silently produces a 0-byte artefact
 * is treated as a failure, not a success.
 *
 * Tooling assumed present in the container image (Debian 12):
 *   python3 (stdlib zipfile -> DOCX), openpyxl (XLSX), LibreOffice (PDF only).
 * LibreOffice is used for PDF export only: the image has no HTML->DOCX export
 * filter, so DOCX is written directly as OOXML. soffice also needs its own
 * HOME and profile dir or it refuses to start as a headless service user.
 */
import type { AgentContext, AgentResult } from "../agent";
import { execInContainer, runScript, writeWorkspaceFile, WORK_DIR } from "../container";
import { callWoibotLLM } from "../../llm";

/* --------------------------------------------------------------- plumbing */

/** Anything smaller than this is a broken artefact, not a deliverable. */
const MIN_BYTES = 1000;

const LO = "HOME=/tmp soffice -env:UserInstallation=file:///tmp/lo --headless";

export type ProducerResult = AgentResult;

function shellQuote(s: string) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

function must(r: { exitCode: number; stdout: string; stderr: string }, what: string) {
  if (r.exitCode !== 0) {
    throw new Error(`${what} ล้มเหลว (exit ${r.exitCode}): ${(r.stderr || r.stdout).slice(0, 400)}`);
  }
  return r;
}

/** `stat -c %s` on a workspace-relative path. Returns the byte size. */
async function statSize(userId: string, relPath: string): Promise<number> {
  const r = await execInContainer(userId, `stat -c %s ${shellQuote(`${WORK_DIR}/${relPath}`)} 2>&1`);
  const n = Number(r.stdout.trim());
  if (r.exitCode !== 0 || !Number.isFinite(n)) return -1;
  return n;
}

/**
 * Hard gate: the file must exist and be larger than `minBytes`.
 * Throws a human-readable error otherwise — callers never see a fake ok:true.
 */
async function requireFile(userId: string, relPath: string, what: string, minBytes = MIN_BYTES): Promise<number> {
  const size = await statSize(userId, relPath);
  if (size < 0) throw new Error(`${what}: ไม่พบไฟล์ ${relPath} ใน workspace (การแปลงไม่ได้สร้างไฟล์จริง)`);
  if (size <= minBytes) {
    throw new Error(`${what}: ไฟล์ ${relPath} เล็กผิดปกติ (${size} bytes ≤ ${minBytes}) — ผลลัพธ์เสีย`);
  }
  return size;
}

/** Strip markdown fences an LLM likes to add around code/JSON. */
function unfence(text: string) {
  return text
    .replace(/^```[a-zA-Z]*\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();
}

/* --------------------------------------------------------------- documents */

/**
 * One JSON spec is the single source of truth for both outputs:
 *   spec.json -> _mkdocx.py (python3 stdlib, real WordprocessingML) -> .docx
 *   spec.json -> HTML -> soffice --convert-to pdf -> .pdf
 *
 * LibreOffice's HTML->DOCX export filter is NOT used: the writer_web_docx
 * filter is missing from the container image ("no export filter found"), so
 * DOCX is built directly from OOXML parts with zipfile.
 */

type DocTable = { headers?: (string | number)[]; rows?: (string | number | null)[][] };
type DocSection = { heading?: string; paragraphs?: string[]; bullets?: string[]; table?: DocTable };
type DocSpec = { title?: string; subtitle?: string; sections?: DocSection[] };

const DOC_SYSTEM =
  "You are a senior business writer producing a complete, print-ready document. " +
  "Answer with ONE JSON object only: no prose, no markdown fences, no comments. Schema:\n" +
  '{"title":string,"subtitle":string,' +
  '"sections":[{"heading":string,"paragraphs":[string,...],"bullets":[string,...],' +
  '"table":{"headers":[string,...],"rows":[[string|number,...],...]}}]}\n' +
  "Rules:\n" +
  "- 4 to 6 sections. Each heading is short and concrete.\n" +
  "- Every section has 1-3 paragraphs; each paragraph is 2-4 full sentences of real substance (no filler, no restating the brief).\n" +
  "- Add 3-6 bullets only where a list is genuinely clearer; otherwise omit the key.\n" +
  "- Include a table in at most two sections (3-5 headers, 3-8 rows). Omit the key entirely when no table is warranted.\n" +
  "- Write in the language of the brief.\n" +
  "- Never invent statistics, names, dates, or citations. If a figure is needed but unknown, write it as [placeholder] instead of guessing.\n" +
  "- The last section must be 'Next steps' with concrete owners and actions.\n" +
  "- Return at least 3 sections, each with 2-4 paragraphs of 80+ words. A thin outline is not acceptable.";

/** Pull the first JSON object out of an LLM reply and repair common damage. */
function extractJson<T>(text: string): T | null {
  const raw = unfence(String(text || ""));
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let body = raw.slice(start);
  const attempts: string[] = [];
  const lastBrace = body.lastIndexOf("}");
  if (lastBrace > 0) attempts.push(body.slice(0, lastBrace + 1));
  attempts.push(body.replace(/,\s*([}\]])/g, "$1"));
  // progressively close unbalanced braces/brackets (truncated replies)
  for (let cut = body.length; cut > start + 20; cut -= 40) {
    const slice = body.slice(0, cut).replace(/,\s*$/, "");
    const opens = (slice.match(/{/g) || []).length;
    const closes = (slice.match(/}/g) || []).length;
    const oSq = (slice.match(/\[/g) || []).length;
    const cSq = (slice.match(/\]/g) || []).length;
    attempts.push(slice + "]".repeat(Math.max(0, oSq - cSq)) + "}".repeat(Math.max(0, opens - closes)));
  }
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return parsed as T;
    } catch {}
  }
  return null;
}

async function fetchDocSpec(ctx: AgentContext): Promise<DocSpec> {
  const base = `Brief: ${ctx.goal}\nDocument title: ${ctx.title}`;
  const strict = `${base}\n\nReply with one JSON object only. It must start with { and end with }. No prose, no markdown fences.`;

  // Attempt 1: plain completion asked for JSON (most reliable on DeepSeek V4.1 Flash)
  let spec = extractJson<DocSpec>(
    (await callWoibotLLM({ system: DOC_SYSTEM, user: strict, maxTokens: 6000, temperature: 0.3 })).text,
  );

  // Attempt 2: JSON response format
  if (!spec) {
    spec = extractJson<DocSpec>(
      (await callWoibotLLM({ system: DOC_SYSTEM, user: strict, maxTokens: 6000, temperature: 0.2 })).text,
    );
  }

  // Attempt 3: ask for a compact skeleton, then expand later
  if (!spec) {
    spec = extractJson<DocSpec>(
      (await callWoibotLLM({
        system: "Return a compact JSON document spec: {\"title\":string,\"subtitle\":string,\"sections\":[{\"heading\":string,\"paragraphs\":[string],\"bullets\":[string]}]}",
        user: strict,
        maxTokens: 5000,
        temperature: 0.1,
      })).text,
    );
  }

  if (!spec) {
    throw new Error("AI ไม่ได้ตอบกลับเป็นโครงเอกสาร (JSON) — สร้างเอกสารไม่ได้");
  }

  let sections = (Array.isArray(spec.sections) ? spec.sections : [])
    .filter((s): s is DocSection => !!s && typeof s === "object")
    .map((s) => ({
      heading: String(s.heading || "").slice(0, 140),
      paragraphs: (Array.isArray(s.paragraphs) ? s.paragraphs : []).map((p) => String(p)).filter((p) => p.trim()).slice(0, 4),
      bullets: (Array.isArray(s.bullets) ? s.bullets : []).map((b) => String(b)).filter((b) => b.trim()).slice(0, 8),
      table:
        s.table && typeof s.table === "object" && Array.isArray((s.table as DocTable).headers)
          ? {
              headers: ((s.table as DocTable).headers || []).map((h) => String(h)).slice(0, 8),
              rows: (((s.table as DocTable).rows || []) as (string | number | null)[][])
                .filter((r) => Array.isArray(r))
                .slice(0, 30),
            }
          : undefined,
    }))
    .filter((s) => s.heading || (s.paragraphs && s.paragraphs.length));

  let chars = sections.reduce((n, s) => n + (s.paragraphs || []).join(" ").length, 0);

  // A thin reply is a model hiccup, not a user error: ask once to expand it.
  if (sections.length < 3 || chars < 900) {
    const expanded = extractJson<DocSpec>(
      (await callWoibotLLM({
        system:
          DOC_SYSTEM +
          "\n\nExpand the document: every section needs 2-4 full paragraphs of at least 80 words each. " +
          "Keep the same JSON shape. Return JSON only.",
        user: `Brief: ${ctx.goal}\nTitle: ${ctx.title}\n\nCurrent draft (too thin):\n${JSON.stringify(spec).slice(0, 2500)}`,
        maxTokens: 6000,
        temperature: 0.5,
      })).text,
    );
    if (expanded?.sections?.length) {
      const retrySections = (expanded.sections as DocSection[])
        .filter((x) => x && (x.heading || x.paragraphs?.length))
        .map((x) => ({
          heading: String(x.heading || "").slice(0, 140),
          paragraphs: (x.paragraphs || []).map(String).filter((x2) => x2.trim()).slice(0, 6),
          bullets: (x.bullets || []).map(String).filter((x2) => x2.trim()).slice(0, 8),
          table: x.table,
        }));
      const retryChars = retrySections.reduce((n, x) => n + (x.paragraphs || []).join(" ").length, 0);
      if (retrySections.length >= sections.length && retryChars > chars) {
        sections = retrySections as any;
        chars = retryChars;
        if (expanded.title) spec.title = expanded.title;
      }
    }
  }

  if (sections.length < 2 || chars < 400) {
    throw new Error(
      `AI ให้เนื้อหาน้อยเกินไป (${sections.length} หัวข้อ, ${chars} ตัวอักษร) แม้ลองขยายแล้ว — ลองรันอีกครั้ง`,
    );
  }

  return {
    title: String(spec.title || ctx.title).slice(0, 160),
    subtitle: String(spec.subtitle || "").slice(0, 240),
    sections,
  };
}

/** Same spec -> print-ready HTML, the input for the PDF conversion. */
function docSpecToHtml(spec: DocSpec, lang: string): string {
  const esc = (s: string) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const body: string[] = [];
  body.push(`<h1>${esc(spec.title || "Document")}</h1>`);
  if (spec.subtitle) body.push(`<p class="sub">${esc(spec.subtitle)}</p>`);
  body.push(`<hr/>`);

  for (const s of spec.sections || []) {
    if (s.heading) body.push(`<h2>${esc(s.heading)}</h2>`);
    for (const p of s.paragraphs || []) body.push(`<p>${esc(p)}</p>`);
    if (s.bullets && s.bullets.length) {
      body.push(`<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`);
    }
    if (s.table && s.table.headers && s.table.headers.length) {
      const heads = s.table.headers.map((h) => `<th>${esc(String(h))}</th>`).join("");
      const rows = (s.table.rows || [])
        .map((r) => `<tr>${s.table!.headers!.map((_, i) => `<td>${esc(String(r[i] ?? ""))}</td>`).join("")}</tr>`)
        .join("");
      body.push(`<table><thead><tr>${heads}</tr></thead><tbody>${rows}</tbody></table>`);
    }
  }

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<title>${esc(spec.title || "Document")}</title>
<style>
  @page { size: A4; margin: 20mm 17mm 22mm 17mm; }
  body { font-family: "Noto Sans Thai", "Noto Sans", "DejaVu Sans", sans-serif; font-size: 11pt; line-height: 1.6; color: #16181d; }
  h1 { font-size: 21pt; line-height: 1.25; margin: 0 0 6pt; color: #0b1220; }
  p.sub { font-size: 11pt; color: #5b6472; margin: 0 0 10pt; }
  hr { border: 0; border-top: 1px solid #c3c8d2; margin: 0 0 14pt; }
  h2 { font-size: 13.5pt; margin: 16pt 0 5pt; padding-bottom: 2pt; border-bottom: 1px solid #d8dbe2; color: #0b1220; page-break-after: avoid; }
  p { margin: 0 0 8pt; }
  table { border-collapse: collapse; width: 100%; margin: 9pt 0 13pt; font-size: 10pt; }
  th, td { border: 1px solid #c3c8d2; padding: 4.5pt 6pt; vertical-align: top; }
  th { background: #eef1f6; text-align: left; font-weight: 600; }
  ul { margin: 0 0 10pt 18pt; padding: 0; }
  li { margin: 0 0 3pt; }
</style></head><body>
${body.join("\n")}
</body></html>`;
}

/** python3 stdlib only: builds a genuine .docx (OOXML parts in a zip). */
const DOCX_BUILD = String.raw`
import json, re, sys, zipfile
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

spec_path, out_path = sys.argv[1], sys.argv[2]
spec = json.load(open(spec_path, encoding="utf-8"))

BAD_CHARS = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f]")
CONTENT_WIDTH = 9638  # A4 minus 1134 twip margins, in twips


def txt(value):
    s = BAD_CHARS.sub(" ", str("" if value is None else value))
    return escape(s, {'"': "&quot;"})


def runs(text):
    chunks = str("" if text is None else text).split("\n")
    out = []
    for i, chunk in enumerate(chunks):
        if i:
            out.append("<w:br/>")
        out.append('<w:t xml:space="preserve">%s</w:t>' % txt(chunk))
    return "".join(out)


def para(text, style=None, bold=False, italic=False, size=None, after=None):
    ppr = []
    if style:
        ppr.append('<w:pStyle w:val="%s"/>' % style)
    if after is not None:
        ppr.append('<w:spacing w:after="%d"/>' % after)
    ppr_xml = "<w:pPr>%s</w:pPr>" % "".join(ppr) if ppr else ""
    rpr = []
    if bold:
        rpr.append("<w:b/>")
    if italic:
        rpr.append("<w:i/>")
    if size:
        rpr.append('<w:sz w:val="%d"/><w:szCs w:val="%d"/>' % (size, size))
    rpr_xml = "<w:rPr>%s</w:rPr>" % "".join(rpr) if rpr else ""
    return "<w:p>%s<w:r>%s%s</w:r></w:p>" % (ppr_xml, rpr_xml, runs(text))


def bullet(text):
    return (
        '<w:p><w:pPr><w:pStyle w:val="ListParagraph"/>'
        '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>'
        "<w:r>%s</w:r></w:p>" % runs(text)
    )


def rule():
    return (
        '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="6" w:color="C3C8D2"/></w:pBdr>'
        '<w:spacing w:after="240"/></w:pPr></w:p>'
    )


def table(tbl):
    headers = [str(h) for h in (tbl.get("headers") or []) if str(h).strip()]
    rows = [r for r in (tbl.get("rows") or []) if isinstance(r, list)]
    ncols = max([len(headers)] + [len(r) for r in rows] + [0])
    if ncols == 0:
        return ""
    colw = int(CONTENT_WIDTH / ncols)
    borders = "".join(
        '<w:%s w:val="single" w:sz="4" w:space="0" w:color="C3C8D2"/>' % side
        for side in ("top", "left", "bottom", "right", "insideH", "insideV")
    )
    out = [
        '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>%s</w:tblBorders>'
        '<w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0"/></w:tblPr>' % borders
    ]
    out.append("<w:tblGrid>" + "".join('<w:gridCol w:w="%d"/>' % colw for _ in range(ncols)) + "</w:tblGrid>")

    def cell(value, header=False):
        shd = '<w:shd w:val="clear" w:color="auto" w:fill="EEF1F6"/>' if header else ""
        inner = para(value, style="TableText", bold=header, size=18)
        return (
            '<w:tc><w:tcPr><w:tcW w:w="%d" w:type="dxa"/>%s<w:vAlign w:val="top"/></w:tcPr>%s</w:tc>'
            % (colw, shd, inner)
        )

    if headers:
        out.append(
            "<w:tr><w:trPr><w:tblHeader/></w:trPr>"
            + "".join(cell(headers[i] if i < len(headers) else "", True) for i in range(ncols))
            + "</w:tr>"
        )
    for r in rows:
        out.append("<w:tr>" + "".join(cell(r[i] if i < len(r) else "") for i in range(ncols)) + "</w:tr>")
    out.append("</w:tbl>")
    out.append("<w:p/>")  # a table may never be the last block before sectPr
    return "".join(out)


counts = {"sections": 0, "paragraphs": 0, "bullets": 0, "tables": 0}
body = []
body.append(para(str(spec.get("title") or "Document"), style="Title"))
subtitle = str(spec.get("subtitle") or "").strip()
if subtitle:
    body.append(para(subtitle, style="Subtitle"))
body.append(rule())

for sec in spec.get("sections") or []:
    if not isinstance(sec, dict):
        continue
    heading = str(sec.get("heading") or "").strip()
    if heading:
        body.append(para(heading, style="Heading1"))
        counts["sections"] += 1
    for p in sec.get("paragraphs") or []:
        if str(p).strip():
            body.append(para(str(p).strip()))
            counts["paragraphs"] += 1
    for b in sec.get("bullets") or []:
        if str(b).strip():
            body.append(bullet(str(b).strip()))
            counts["bullets"] += 1
    tbl = sec.get("table")
    if isinstance(tbl, dict):
        xml = table(tbl)
        if xml:
            body.append(xml)
            counts["tables"] += 1

if counts["sections"] == 0 and counts["paragraphs"] == 0:
    raise SystemExit("spec produced an empty document")

SECT = (
    '<w:sectPr><w:footerReference w:type="default" r:id="rId2"/>'
    '<w:pgSz w:w="11906" w:h="16838"/>'
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" '
    'w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>'
)

DOCUMENT = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    "<w:body>" + "".join(body) + SECT + "</w:body></w:document>"
)

STYLES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    "<w:docDefaults><w:rPrDefault><w:rPr>"
    '<w:rFonts w:ascii="Noto Sans Thai" w:hAnsi="Noto Sans Thai" w:eastAsia="Noto Sans Thai" w:cs="Noto Sans Thai"/>'
    '<w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-US" w:eastAsia="th-TH"/>'
    "</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>"
    '<w:spacing w:after="160" w:line="276" w:lineRule="auto"/>'
    "</w:pPr></w:pPrDefault></w:docDefaults>"
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/>'
    '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>'
    '<w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr>'
    '<w:rPr><w:b/><w:color w:val="0B1220"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/>'
    '<w:basedOn w:val="Normal"/><w:qFormat/>'
    '<w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr>'
    '<w:rPr><w:color w:val="5B6472"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>'
    '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>'
    '<w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/>'
    '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="D8DBE2"/></w:pBdr><w:outlineLvl w:val="0"/></w:pPr>'
    '<w:rPr><w:b/><w:color w:val="0B1220"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>'
    '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>'
    '<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr>'
    '<w:rPr><w:b/><w:color w:val="16181D"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/>'
    '<w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="425"/><w:spacing w:after="60"/></w:pPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/>'
    '<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/></w:pPr>'
    '<w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/>'
    '<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="right"/></w:pPr>'
    '<w:rPr><w:color w:val="7A8291"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>'
    "</w:styles>"
)

NUMBERING = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>'
    '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#8226;"/>'
    '<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="425" w:hanging="300"/></w:pPr></w:lvl>'
    "</w:abstractNum>"
    '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>'
)

FOOTER = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    '<w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr>'
    '<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
    '<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>'
    '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r>'
    '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>'
)

CONTENT_TYPES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
    '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
    "</Types>"
)

ROOT_RELS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
    "</Relationships>"
)

DOC_RELS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>'
    "</Relationships>"
)

CORE = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    "<dc:title>%s</dc:title><dc:creator>woibot Work</dc:creator>"
    '<cp:lastModifiedBy>woibot Work</cp:lastModifiedBy></cp:coreProperties>' % txt(spec.get("title") or "Document")
)

APP = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
    "<Application>woibot Work</Application></Properties>"
)

parts = [
    ("[Content_Types].xml", CONTENT_TYPES),
    ("_rels/.rels", ROOT_RELS),
    ("word/document.xml", DOCUMENT),
    ("word/styles.xml", STYLES),
    ("word/numbering.xml", NUMBERING),
    ("word/footer1.xml", FOOTER),
    ("word/_rels/document.xml.rels", DOC_RELS),
    ("docProps/core.xml", CORE),
    ("docProps/app.xml", APP),
]

with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for name, data in parts:
        zf.writestr(name, data)

# verify: every part present and every XML part well-formed
with zipfile.ZipFile(out_path) as zf:
    names = set(zf.namelist())
    for name, _ in parts:
        if name not in names:
            raise SystemExit("docx missing part: " + name)
    for name in names:
        if name.endswith(".xml") or name.endswith(".rels"):
            ET.fromstring(zf.read(name))

print(json.dumps(dict(counts, parts=len(parts))))
`;

export async function produceDocxAndPdf(ctx: AgentContext, slug: string): Promise<ProducerResult> {
  const notes: string[] = [];

  await ctx.onProgress?.(12, "drafting", "ให้ AI ร่างโครงเอกสาร (JSON)");
  const spec = await fetchDocSpec(ctx);
  const sections = spec.sections || [];
  const words = sections.reduce(
    (n, s) => n + (s.paragraphs || []).join(" ").split(/\s+/).filter(Boolean).length,
    0,
  );
  notes.push(`${sections.length} sections, ~${words} words`);

  await ctx.onProgress?.(40, "docx", "สร้าง .docx จาก OOXML ด้วย python3 stdlib");
  must(await writeWorkspaceFile(ctx.userId, `${slug}.spec.json`, JSON.stringify(spec, null, 2)), "เขียน spec เอกสาร");
  must(await writeWorkspaceFile(ctx.userId, "_mkdocx.py", DOCX_BUILD), "เขียนสคริปต์ docx");

  const build = await runScript(
    ctx.userId,
    `cd ${WORK_DIR} && python3 _mkdocx.py ${shellQuote(`${slug}.spec.json`)} ${shellQuote(`${slug}.docx`)} 2>&1`,
  );
  if (build.exitCode !== 0) {
    throw new Error(`สร้าง .docx ไม่สำเร็จ: ${(build.stderr || build.stdout).slice(0, 400)}`);
  }
  notes.push(build.stdout.trim().split("\n").pop() || "");

  const listing = await execInContainer(
    ctx.userId,
    `cd ${WORK_DIR} && unzip -l ${shellQuote(`${slug}.docx`)} 2>&1 | grep -c 'word/document.xml'`,
  );
  if (listing.exitCode !== 0 || Number(listing.stdout.trim()) < 1) {
    throw new Error(`ไฟล์ .docx ไม่ใช่แพ็กเกจ OOXML ที่ถูกต้อง (ไม่พบ word/document.xml): ${listing.stdout.slice(0, 200)}`);
  }
  const docxBytes = await requireFile(ctx.userId, `${slug}.docx`, "สร้างเอกสาร DOCX", 2000);
  notes.push(`${slug}.docx ${docxBytes} bytes, OOXML parts verified`);

  await ctx.onProgress?.(72, "pdf", "เรนเดอร์สเปกเดียวกันเป็น HTML แล้วแปลงเป็น PDF");
  const html = docSpecToHtml(spec, /[\u0e00-\u0e7f]/.test(`${ctx.title} ${ctx.goal}`) ? "th" : "en");
  must(await writeWorkspaceFile(ctx.userId, `${slug}.html`, html), "เขียนไฟล์ HTML");

  const conv = await execInContainer(
    ctx.userId,
    `cd ${WORK_DIR} && ${LO} --convert-to pdf --outdir . ${shellQuote(`${slug}.html`)} 2>&1 | tail -3`,
  );
  const pdfBytes = await requireFile(ctx.userId, `${slug}.pdf`, "แปลง HTML → PDF").catch((e) => {
    throw new Error(`แปลง HTML → PDF ไม่ได้: ${(conv.stdout || conv.stderr || (e as Error).message).slice(0, 300)}`);
  });
  notes.push(`${slug}.pdf ${pdfBytes} bytes`);

  await ctx.onProgress?.(93, "verify", "ตรวจขนาดไฟล์จริงใน workspace");
  return { ok: true, files: [`${slug}.docx`, `${slug}.pdf`, `${slug}.html`], notes };
}

/* ------------------------------------------------------------ spreadsheets */

type ColumnSpec = { name: string; kind?: string };
type FormulaColumn = { name: string; kind?: string; formula: string };
type TableSpec = {
  title: string;
  sheet: string;
  columns: ColumnSpec[];
  rows: (string | number | null)[][];
  formula_columns?: FormulaColumn[];
  summary_notes?: string;
};

/**
 * Ask the model for a tabular spec. Returned as a plain object so the python
 * builders can be fed a JSON file instead of a shell-quoted blob.
 */
async function fetchTableSpec(
  ctx: AgentContext,
  minRows: number,
  opts: { minCols?: number; minFormula?: number } = {},
): Promise<TableSpec> {
  const oracles = [
    "text", "int", "number", "currency", "percent", "date",
  ].join("|");

  const draft = await callWoibotLLM({
    system:
      "You design business spreadsheets that a finance analyst would actually use. " +
      "Answer with ONE JSON object only: no prose, no markdown fences. Schema:\n" +
      '{"title":string,"sheet":string,' +
      '"columns":[{"name":string,"kind":"' + oracles + '"}],' +
      '"rows":[[value,...],...],' +
      '"formula_columns":[{"name":string,"kind":"currency","formula":"=D{row}*E{row}"}],' +
      '"summary_notes":string}\n' +
      "Rules:\n" +
      `- "columns" are the input columns, in order; rows must have exactly that many values.\n` +
      `- Provide between ${minRows} and ${minRows + 15} data rows of realistic, internally consistent data ` +
      "(no placeholders, no [brackets], no 'N/A').\n" +
      "- Column letters are assigned in order: A is the first base column, then formula columns follow the last base column. " +
      'Inside "formula" use Excel syntax with {row} as the row placeholder, e.g. "=D{row}*E{row}".\n' +
      "- 0-2 formula_columns is enough; they must reference only existing columns.\n" +
      "- percent values are fractions (0.125 means 12.5%).\n" +
      "- summary_notes: one or two sentences an analyst should read before using the sheet." +
      (opts.minCols ? `\n- Use at least ${opts.minCols} base columns.` : "") +
      (opts.minFormula ? `\n- Include at least ${opts.minFormula} formula_columns.` : ""),
    user: `Build a spreadsheet for: ${ctx.goal}\nTitle: ${ctx.title}`,
    maxTokens: 2600,
  });

  let spec = extractJson<TableSpec>(draft.text);
  if (!spec) {
    const retry = await callWoibotLLM({
      system: "You generate spreadsheet specs. Reply with a single JSON object only — no prose, no markdown, starting with {.",
      user: `Build a spreadsheet for: ${ctx.goal}\nTitle: ${ctx.title}`,
      maxTokens: 2800,
      temperature: 0.2,
    });
    spec = extractJson<TableSpec>(retry.text);
  }
  if (!spec) {
    throw new Error("AI ไม่ได้ตอบกลับเป็นข้อมูลตาราง (JSON) — สร้างสเปรดชีตไม่ได้");
  }

  const columns = Array.isArray(spec.columns)
    ? spec.columns.filter((c) => c && typeof c.name === "string" && c.name.trim()).slice(0, 14)
    : [];
  if (columns.length < 2) throw new Error("สเปรดชีตต้องมีอย่างน้อย 2 คอลัมน์ แต่ AI ให้มาไม่ครบ");

  const rows = (Array.isArray(spec.rows) ? spec.rows : [])
    .filter((r): r is (string | number | null)[] => Array.isArray(r))
    .slice(0, 40);
  if (rows.length < Math.min(8, minRows)) {
    throw new Error(`AI ให้ข้อมูลเพียง ${rows.length} แถว (ต้องการอย่างน้อย ${Math.min(8, minRows)}) — ไม่พอทำสเปรดชีตจริง`);
  }

  const formulaColumns = (Array.isArray(spec.formula_columns) ? spec.formula_columns : [])
    .filter((c) => c && typeof c.name === "string" && typeof c.formula === "string" && c.formula.startsWith("="))
    .slice(0, 3);

  return {
    title: String(spec.title || ctx.title).slice(0, 120),
    sheet: String(spec.sheet || "Data").slice(0, 31),
    columns: columns.map((c) => ({ name: String(c.name).slice(0, 60), kind: String(c.kind || "text") })),
    rows,
    formula_columns: formulaColumns.map((c) => ({
      name: String(c.name).slice(0, 60),
      kind: String(c.kind || "number"),
      formula: String(c.formula).slice(0, 120),
    })),
    summary_notes: String(spec.summary_notes || "").slice(0, 600),
  };
}

/** Python builder: real workbook with styling, formulas, autofilter, widths, summary sheet. */
const XLSX_BUILD = String.raw`
import json, re, sys, time
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.properties import PageSetupProperties

spec_path, out_path = sys.argv[1], sys.argv[2]
spec = json.load(open(spec_path, encoding="utf-8"))

NUMERIC = {"int", "number", "currency", "percent"}
FMT = {"int": "#,##0", "number": "#,##0.00", "currency": "#,##0.00", "percent": "0.0%"}
FORMULA_CHARS = re.compile(r"^=[A-Za-z0-9+\-*/().,:% ]+$")


def sheet_name(raw, fallback):
    s = re.sub(r"[\[\]:*?/\\]", " ", str(raw or fallback)).strip()
    return (s or fallback)[:31]


title = str(spec.get("title") or "Workbook")[:120]
data_name = sheet_name(spec.get("sheet"), "Data")
summary_name = sheet_name("Summary", "Summary")
if summary_name == data_name:
    summary_name = (data_name + " Summary")[:31]

base = [c for c in spec.get("columns") or [] if isinstance(c, dict) and c.get("name")]
fcols = [c for c in spec.get("formula_columns") or [] if isinstance(c, dict) and c.get("name")]
rows = [r for r in spec.get("rows") or [] if isinstance(r, list)]
if len(base) < 2:
    raise SystemExit("sheet spec needs at least 2 columns")
if len(rows) < 8:
    raise SystemExit("sheet spec needs at least 8 rows (got %d)" % len(rows))

all_cols = [{"name": c["name"], "kind": str(c.get("kind") or "text")} for c in base]
all_cols += [{"name": c["name"], "kind": str(c.get("kind") or "number")} for c in fcols]
ncols = len(all_cols)
nbase = len(base)

# normalise rows to the base width
data = []
for r in rows:
    vals = list(r[:nbase]) + [None] * max(0, nbase - len(r))
    data.append(vals)

for idx, col in enumerate(all_cols):
    if col["kind"] == "percent" and idx < nbase:
        for row in data:
            if idx < len(row) and isinstance(row[idx], (int, float)) and abs(row[idx]) > 1.5:
                row[idx] = row[idx] / 100.0

wb = Workbook()
ws = wb.active
ws.title = data_name

HEAD_FILL = PatternFill("solid", fgColor="0B1220")
HEAD_FONT = Font(name="DejaVu Sans", bold=True, color="FFFFFF", size=10)
BODY_FONT = Font(name="DejaVu Sans", size=10)
TITLE_FONT = Font(name="DejaVu Sans", bold=True, size=14, color="0B1220")
THIN = Side(style="thin", color="C3C8D2")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
TOTAL_FILL = PatternFill("solid", fgColor="EEF1F6")

first_data = 2
last_data = first_data + len(data) - 1

# header
for i, col in enumerate(all_cols, start=1):
    c = ws.cell(row=1, column=i, value=col["name"])
    c.fill = HEAD_FILL
    c.font = HEAD_FONT
    c.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
    c.border = BORDER
ws.row_dimensions[1].height = 24

# body
for ri, row in enumerate(data):
    excel_row = first_data + ri
    for ci in range(nbase):
        c = ws.cell(row=excel_row, column=ci + 1, value=row[ci] if ci < len(row) else None)
        c.font = BODY_FONT
        c.border = BORDER
        kind = all_cols[ci]["kind"]
        c.alignment = Alignment(
            horizontal="right" if kind in NUMERIC else "left", vertical="center"
        )
        if kind in FMT:
            c.number_format = FMT[kind]

# formula columns (real formulas, not values)
for fi, fc in enumerate(fcols):
    letter = get_column_letter(nbase + fi + 1)
    h = ws.cell(row=1, column=nbase + fi + 1, value=fc["name"])
    h.fill = HEAD_FILL
    h.font = HEAD_FONT
    h.alignment = Alignment(horizontal="right", vertical="center", wrap_text=True)
    h.border = BORDER
    template = str(fc.get("formula") or "")
    if not FORMULA_CHARS.match(template.replace("{row}", "")):
        template = ""
    for ri in range(len(data)):
        excel_row = first_data + ri
        c = ws.cell(row=excel_row, column=nbase + fi + 1)
        if template:
            c.value = template.replace("{row}", str(excel_row))
        kind = all_cols[nbase + fi]["kind"]
        c.font = BODY_FONT
        c.border = BORDER
        c.alignment = Alignment(horizontal="right", vertical="center")
        if kind in FMT:
            c.number_format = FMT[kind]

# total row (subtotals survive autofilter)
total_row = last_data + 1
label = ws.cell(row=total_row, column=1, value="TOTAL")
label.font = Font(name="DejaVu Sans", bold=True, size=10, color="0B1220")
label.fill = TOTAL_FILL
label.border = BORDER
label.alignment = Alignment(horizontal="left", vertical="center")
for ci in range(2, ncols + 1):
    kind = all_cols[ci - 1]["kind"]
    c = ws.cell(row=total_row, column=ci)
    c.fill = TOTAL_FILL
    c.border = BORDER
    c.font = Font(name="DejaVu Sans", bold=True, size=10)
    c.alignment = Alignment(horizontal="right", vertical="center")
    if kind in NUMERIC:
        letter = get_column_letter(ci)
        c.value = "=SUBTOTAL(109,%s%d:%s%d)" % (letter, first_data, letter, last_data)
        c.number_format = FMT.get(kind, "#,##0.00")

ws.auto_filter.ref = "A1:%s%d" % (get_column_letter(ncols), last_data)
ws.freeze_panes = "A2"

# column widths from real content
for ci in range(1, ncols + 1):
    letter = get_column_letter(ci)
    widest = len(str(all_cols[ci - 1]["name"]))
    for rs in ws.iter_rows(min_col=ci, max_col=ci, min_row=2, max_row=last_data):
        for cell in rs:
            if cell.value is None:
                continue
            widest = max(widest, len(str(cell.value)))
    ws.column_dimensions[letter].width = max(10, min(48, widest + 3))

ws.page_setup.orientation = "landscape"
ws.page_setup.fitToWidth = 1
ws.page_setup.fitToHeight = 0
ws.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
ws.print_title_rows = "1:1"

# ---------------------------------------------------------------- summary
sm = wb.create_sheet(summary_name)
sm["A1"] = title
sm["A1"].font = TITLE_FONT
sm["A2"] = "Generated %s UTC by woibot Work" % time.strftime("%Y-%m-%d %H:%M", time.gmtime())
sm["A2"].font = Font(name="DejaVu Sans", size=9, color="5B6472")
sm["A3"] = "Source sheet: %s — %d rows, %d columns" % (data_name, len(data), ncols)
sm["A3"].font = Font(name="DejaVu Sans", size=9, color="5B6472")

headers = ["Metric", "Value", "Formula reference"]
for i, h in enumerate(headers, start=1):
    c = sm.cell(row=5, column=i, value=h)
    c.fill = HEAD_FILL
    c.font = HEAD_FONT
    c.border = BORDER

ref = "'%s'!" % data_name if re.search(r"[^A-Za-z0-9_]", data_name) else data_name + "!"
r0, r1 = 6, 5
for ci in range(1, ncols + 1):
    kind = all_cols[ci - 1]["kind"]
    if kind not in NUMERIC:
        continue
    letter = get_column_letter(ci)
    rng = "%s%s%d:%s%d" % (ref, letter, first_data, letter, last_data)
    for metric, fn in (("Sum", "SUM"), ("Average", "AVERAGE"), ("Minimum", "MIN"), ("Maximum", "MAX"), ("Rows counted", "COUNT")):
        r1 += 1
        sm.cell(row=r1, column=1, value="%s — %s" % (all_cols[ci - 1]["name"], metric)).font = BODY_FONT
        v = sm.cell(row=r1, column=2, value="=%s(%s)" % (fn, rng))
        v.font = BODY_FONT
        if fn != "COUNT":
            v.number_format = FMT.get(kind, "#,##0.00")
        sm.cell(row=r1, column=3, value="%s(%s)" % (fn, rng)).font = Font(name="DejaVu Sans", size=9, color="5B6472")
        for col in (1, 2, 3):
            sm.cell(row=r1, column=col).border = BORDER

notes = str(spec.get("summary_notes") or "").strip()
if notes:
    r1 += 2
    sm.cell(row=r1, column=1, value="Notes").font = Font(name="DejaVu Sans", bold=True, size=10)
    nc = sm.cell(row=r1 + 1, column=1, value=notes)
    nc.alignment = Alignment(wrap_text=True, vertical="top")
    sm.merge_cells(start_row=r1 + 1, start_column=1, end_row=r1 + 1, end_column=3)
    sm.row_dimensions[r1 + 1].height = 48

sm.column_dimensions["A"].width = 42
sm.column_dimensions["B"].width = 18
sm.column_dimensions["C"].width = 46

wb.save(out_path)

# verify by reopening: a corrupt workbook must not be reported as a deliverable
chk = load_workbook(out_path)
assert chk.sheetnames == [data_name, summary_name], chk.sheetnames
ws2 = chk[data_name]
print(json.dumps({
    "sheets": chk.sheetnames,
    "data_rows": ws2.max_row - 2,
    "cols": ws2.max_column,
    "formulas": sum(1 for row in ws2.iter_rows() for c in row if isinstance(c.value, str) and c.value.startswith("=")),
    "summary_rows": chk[summary_name].max_row,
}))
`;

const CSV_BUILD = String.raw`
import ast, csv, json, operator, re, sys

spec_path, out_path = sys.argv[1], sys.argv[2]
spec = json.load(open(spec_path, encoding="utf-8"))

NUMERIC = {"int", "number", "currency", "percent"}
base = [c for c in spec.get("columns") or [] if isinstance(c, dict) and c.get("name")]
fcols = [
    c
    for c in spec.get("formula_columns") or []
    if isinstance(c, dict) and c.get("name") and str(c.get("formula") or "").startswith("=")
]
rows = [r for r in spec.get("rows") or [] if isinstance(r, list)]

if len(base) < 2:
    raise SystemExit("csv spec needs at least 2 columns")
if len(rows) < 10:
    raise SystemExit("csv spec needs at least 10 rows (got %d)" % len(rows))
if len(base) + len(fcols) < 4:
    raise SystemExit("csv spec needs at least 4 columns in total (got %d)" % (len(base) + len(fcols)))

OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def evaluate(formula, env):
    expr = str(formula).lstrip("=").replace("{row}", "1")
    expr = re.sub(r"\b([A-Za-z]{1,3})\d+\b", r"c_\1", expr)
    tree = ast.parse(expr, mode="eval")

    def walk(node):
        if isinstance(node, ast.Expression):
            return walk(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.Name):
            return float(env.get(node.id) or 0.0)
        if isinstance(node, ast.BinOp) and type(node.op) in OPS:
            return OPS[type(node.op)](walk(node.left), walk(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in OPS:
            return OPS[type(node.op)](walk(node.operand))
        raise ValueError("unsupported expression")

    return walk(tree)


def as_number(value):
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).replace(",", "").replace("%", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


width = len(base) + len(fcols)
letters = [chr(65 + i) for i in range(width)]
header = [str(c["name"]) for c in base] + [str(c["name"]) for c in fcols]
kinds = [str(c.get("kind") or "text") for c in base] + [str(c.get("kind") or "number") for c in fcols]

out_rows = []
for r in rows:
    env = {}
    vals = []
    for i in range(len(base)):
        v = r[i] if i < len(r) else ""
        vals.append("" if v is None else v)
        num = as_number(v)
        if num is not None:
            env["c_" + letters[i]] = num
    for j, fc in enumerate(fcols):
        idx = len(base) + j
        try:
            num = evaluate(fc.get("formula"), env)
        except Exception:
            vals.append("")
            continue
        kind = kinds[idx]
        if kind == "int":
            vals.append(int(round(num)))
        elif kind == "percent":
            vals.append(round(num, 6) or 0.0)
        else:
            vals.append(round(num, 2) or 0.0)
        env["c_" + letters[idx]] = float(num)
    out_rows.append(vals)

# a real totals row: csv has no formulas, so the numbers are computed here
totals = ["TOTAL"] + [""] * (width - 1)
for i in range(1, width):
    if kinds[i] not in NUMERIC or kinds[i] == "percent":
        continue
    nums = [as_number(row[i]) for row in out_rows]
    nums = [x for x in nums if x is not None]
    if not nums:
        continue
    total = sum(nums)
    if kinds[i] == "int":
        totals[i] = int(round(total))
    elif kinds[i] == "percent":
        totals[i] = round(total, 6)
    else:
        totals[i] = round(total, 2)

with open(out_path, "w", encoding="utf-8-sig", newline="") as fh:
    writer = csv.writer(fh, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(header)
    for row in out_rows:
        writer.writerow(row)
    writer.writerow(totals)

print(json.dumps({"rows": len(out_rows), "cols": width}))

`;

/**
 * Real .xlsx: styled header, frozen panes, autofilter, real formulas,
 * computed TOTAL row, tuned column widths and a formula-driven Summary sheet.
 */
export async function produceSpreadsheet(ctx: AgentContext, slug: string): Promise<ProducerResult> {
  const notes: string[] = [];

  await ctx.onProgress?.(20, "spec", "ให้ AI ออกแบบโครงสร้างตารางและสูตร");
  const spec = await fetchTableSpec(ctx, 18);
  notes.push(`${spec.columns.length} cols × ${spec.rows.length} rows, ${spec.formula_columns?.length || 0} formula columns`);

  await ctx.onProgress?.(45, "write", "เขียนสคริปต์ openpyxl และสร้างไฟล์ .xlsx จริง");
  must(await writeWorkspaceFile(ctx.userId, `${slug}.spec.json`, JSON.stringify(spec, null, 2)), "เขียน spec");
  must(await writeWorkspaceFile(ctx.userId, "_build_xlsx.py", XLSX_BUILD), "เขียนสคริปต์ xlsx");

  const run = await runScript(
    ctx.userId,
    `cd ${WORK_DIR} && python3 _build_xlsx.py ${shellQuote(`${slug}.spec.json`)} ${shellQuote(`${slug}.xlsx`)} 2>&1`,
  );
  if (run.exitCode !== 0) {
    throw new Error(`สร้าง .xlsx ด้วย openpyxl ไม่สำเร็จ: ${(run.stderr || run.stdout).slice(0, 300)}`);
  }
  notes.push(run.stdout.trim().split("\n").pop() || "");

  await ctx.onProgress?.(85, "verify", "ตรวจว่าไฟล์เปิดได้จริงและมีขนาดถูกต้อง");
  const bytes = await requireFile(ctx.userId, `${slug}.xlsx`, "สร้างสเปรดชีต");
  notes.push(`${slug}.xlsx ${bytes} bytes`);

  return { ok: true, files: [`${slug}.xlsx`, `${slug}.spec.json`], notes };
}

/** Same tabular source, exported as UTF-8 (BOM) CSV with a computed TOTAL row. */
export async function produceCsv(ctx: AgentContext, slug: string): Promise<ProducerResult> {
  const notes: string[] = [];

  await ctx.onProgress?.(20, "spec", "ให้ AI เตรียมข้อมูลตาราง");
  const spec = await fetchTableSpec(ctx, 24, { minCols: 6, minFormula: 2 });

  await ctx.onProgress?.(55, "write", "เขียนไฟล์ CSV ด้วย csv module");
  must(await writeWorkspaceFile(ctx.userId, `${slug}.spec.json`, JSON.stringify(spec, null, 2)), "เขียน spec");
  must(await writeWorkspaceFile(ctx.userId, "_build_csv.py", CSV_BUILD), "เขียนสคริปต์ csv");

  const run = await runScript(
    ctx.userId,
    `cd ${WORK_DIR} && python3 _build_csv.py ${shellQuote(`${slug}.spec.json`)} ${shellQuote(`${slug}.csv`)} 2>&1`,
  );
  if (run.exitCode !== 0) {
    throw new Error(`สร้างไฟล์ CSV ไม่สำเร็จ: ${(run.stderr || run.stdout).slice(0, 300)}`);
  }
  notes.push(run.stdout.trim().split("\n").pop() || "");

  const bytes = await requireFile(ctx.userId, `${slug}.csv`, "สร้างไฟล์ CSV");
  notes.push(`${slug}.csv ${bytes} bytes`);

  return { ok: true, files: [`${slug}.csv`], notes };
}
