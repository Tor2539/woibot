/**
 * Document / spreadsheet / PDF producers.
 *
 * Every producer here ends with a real file on disk in the user's Cloud
 * Computer workspace. Nothing returns ok:true until `stat` has shown a file
 * bigger than MIN_BYTES — a conversion that silently produces a 0-byte artefact
 * is treated as a failure, not a success.
 *
 * Tooling assumed present in the container image (Debian 12):
 *   python3 (stdlib html.parser + zipfile -> DOCX; openpyxl -> XLSX),
 *   LibreOffice (HTML->DOCX and DOCX->PDF).
 * soffice needs its own HOME and profile dir or it refuses to start as a
 * headless service user. The image was reported to lack the HTML->DOCX export
 * filter at some point, so the document producer falls back to a python3
 * stdlib OOXML builder whenever the LibreOffice conversion produces nothing.
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
 * Structure-first document pipeline (report -> DOCX + PDF + HTML):
 *
 *   (a) OUTLINE  one LLM call returns a JSON skeleton
 *                {title, subtitle, language, audience, sections:[{heading, points[3-6], has_table}]}
 *                with 8-14 sections; one retry when the JSON is unparseable,
 *                one repair call when the outline comes back too thin.
 *   (b) BODY     one LLM call PER SECTION expanding the outline point list
 *                into semantic HTML (h2 + rich paragraphs + ul/ol + optional
 *                table built from the points + key-takeaway blockquote,
 *                180-350 words per section, maxTokens 3200, retried once with
 *                a higher budget when the reply is empty).
 *   (c) ASSEMBLE premium print HTML: A4 print CSS (22mm/18mm margins, footer
 *                page numbers via @page @bottom-center), Noto Sans Thai
 *                typography with serif fallback, cover page with the Woibot
 *                Document wordmark (no upstream tool names), auto table of
 *                contents (static list, sections numbered 1., 2., ...),
 *                numbered h2 sections with clean page breaks, styled tables,
 *                callout blockquotes and the closing "สรุปและก้าวต่อไป"
 *                section. The HTML itself is a deliverable.
 *   (d) CONVERT  HTML -> DOCX with LibreOffice (HOME=/tmp soffice, the same
 *                pattern as the historical produceDocument), then DOCX -> PDF;
 *                every step is verified on disk and errors out loudly. If the
 *                container image lacks the HTML->DOCX export filter, a
 *                python3 stdlib builder creates the same DOCX from the same
 *                HTML, and page numbers are injected into the footer.
 *
 * Prompts forbid invented statistics: unknown numbers must stay in
 * [brackets] as placeholders. Thai/English follows the language of the brief.
 */

/** Pull the first JSON object out of an LLM reply and repair common damage. */
function extractJson<T>(text: string): T | null {
  const raw = unfence(String(text || ""));
  const start = raw.indexOf("{");
  if (start < 0) return null;
  const body = raw.slice(start);
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

type OutlineSection = { heading: string; points: string[]; has_table: boolean };
type DocOutline = {
  title: string;
  subtitle: string;
  language: "th" | "en";
  audience: string;
  sections: OutlineSection[];
};

const OUTLINE_SYSTEM =
  "You are a senior document architect designing a premium, print-ready business report. " +
  "Answer with ONE JSON object only: no prose, no markdown fences, no comments. Schema:\n" +
  '{"title":string,"subtitle":string,"language":"th"|"en","audience":string,' +
  '"sections":[{"heading":string,"points":[string,...],"has_table":boolean}]}\n' +
  "Rules:\n" +
  "- 10 to 12 sections, never fewer than 8.\n" +
  "- The FIRST section is an executive summary (บทสรุปผู้บริหาร / Executive Summary).\n" +
  "- The LAST section must be exactly 'สรุปและก้าวต่อไป' for a Thai brief or 'Summary and Next Steps' for an English brief.\n" +
  "- Order the rest like a real report: context and background, current state, analysis, options, plan, resources, risks, KPIs.\n" +
  "- Every section carries 3-6 short, concrete 'points' that a writer will expand into prose later. Points are directions, not finished sentences.\n" +
  "- has_table:true for at most 3 sections where a table is genuinely the clearest format, otherwise false.\n" +
  "- 'language' mirrors the language of the brief ('th' or 'en'); every heading and point is written in that same language.\n" +
  "- 'audience' names who the document is written for, in one short phrase.\n" +
  "- Never invent statistics, names, dates or citations.";

const CLOSING_HEADING = { th: "สรุปและก้าวต่อไป", en: "Summary and Next Steps" } as const;

/** Deterministic sections used to top up an outline that came back too thin. */
const FILLER_SECTIONS: Record<"th" | "en", OutlineSection[]> = {
  th: [
    {
      heading: "ปัจจัยความสำเร็จและตัวชี้วัดงาน",
      points: [
        "ปัจจัยที่ทำให้แผนนี้สำเร็จได้จริง",
        "ตัวชี้วัดที่ใช้ติดตามความคืบหน้า (ระบุค่าเป้าหมายเป็น [placeholder] หากไม่ทราบ)",
        "วิธีวัดผลและรอบการทบทวนตัวชี้วัด",
      ],
      has_table: true,
    },
    {
      heading: "ความเสี่ยงและข้อจำกัดที่ต้องจับตา",
      points: [
        "ความเสี่ยงหลักที่อาจทำให้แผนเหลื่อมล้ม",
        "ข้อจำกัดด้านข้อมูล ทรัพยากร และเวลา",
        "แนวทางลดความเสี่ยงที่เริ่มได้ทันที",
      ],
      has_table: false,
    },
    {
      heading: "แผนการดำเนินงานและไทม์ไลน์โดยประมาณ",
      points: [
        "ขั้นตอนการดำเนินงานจากต้นจนจบ",
        "งานที่ทำขนานกันได้และงานที่ต้องรอผลก่อน",
        "จุดตรวจสอบความคืบหน้าในแต่ละงวด",
      ],
      has_table: false,
    },
  ],
  en: [
    {
      heading: "Success Factors and KPIs",
      points: [
        "Factors that make this plan realistically succeed",
        "Metrics used to track progress (target values as [placeholder] when unknown)",
        "How each metric is measured and reviewed",
      ],
      has_table: true,
    },
    {
      heading: "Risks and Limitations to Watch",
      points: [
        "Primary risks that could derail the plan",
        "Data, resource and time constraints",
        "Risk mitigations that can start immediately",
      ],
      has_table: false,
    },
    {
      heading: "Execution Plan and Indicative Timeline",
      points: [
        "End-to-end execution steps",
        "Work that can run in parallel versus work that must wait",
        "Progress checkpoints per period",
      ],
      has_table: false,
    },
  ],
};

function detectDocLang(ctx: AgentContext): "th" | "en" {
  return /[\u0e00-\u0e7f]/.test(`${ctx.title} ${ctx.goal}`) ? "th" : "en";
}

function isParsableOutline(p: unknown): p is Partial<DocOutline> & { sections: unknown[] } {
  if (!p || typeof p !== "object") return false;
  const o = p as Partial<DocOutline>;
  if (!Array.isArray(o.sections)) return false;
  const good = o.sections.filter(
    (s) =>
      s &&
      typeof s === "object" &&
      typeof (s as OutlineSection).heading === "string" &&
      !!(s as OutlineSection).heading.trim(),
  );
  return good.length >= 6;
}

function normalizeOutline(p: Partial<DocOutline>, ctx: AgentContext): DocOutline {
  const lang: "th" | "en" = p.language === "en" ? "en" : p.language === "th" ? "th" : detectDocLang(ctx);
  const sections = (Array.isArray(p.sections) ? p.sections : [])
    .map((raw): OutlineSection | null => {
      const s = raw as Partial<OutlineSection>;
      const heading = String(s.heading || "").trim().slice(0, 140);
      if (!heading) return null;
      const points = (Array.isArray(s.points) ? s.points : [])
        .map((x) => String(x).trim())
        .filter(Boolean)
        .slice(0, 6);
      return { heading, points: points.length ? points : [heading], has_table: s.has_table === true };
    })
    .filter((s): s is OutlineSection => !!s)
    .slice(0, 14);
  return {
    title: String(p.title || "").trim().slice(0, 160) || ctx.title.slice(0, 160),
    subtitle: String(p.subtitle || "").trim().slice(0, 240),
    language: lang,
    audience: String(p.audience || "").trim().slice(0, 120),
    sections,
  };
}

/** Guarantee: at least 8 sections and the closing summary always last. */
function finalizeOutline(outline: DocOutline): DocOutline {
  const th = outline.language === "th";
  const isClosing = (s: OutlineSection) => /สรุปและก้าวต่อไป|summary\s*(and|&)\s*next/i.test(s.heading);
  const closing: OutlineSection = th
    ? {
        heading: CLOSING_HEADING.th,
        points: [
          "สรุปประเด็นสำคัญของเอกสารทั้งฉบับให้กระชับที่สุด",
          "ก้าวต่อไปที่ควรลงมือทำทันที ระบุผู้รับผิดชอบเป็น [placeholder] หากไม่ทราบ",
          "สิ่งที่ต้องติดตามและทบทวนในรอบถัดไป",
        ],
        has_table: false,
      }
    : {
        heading: CLOSING_HEADING.en,
        points: [
          "Condense the key takeaways of the whole document",
          "Immediate next actions, with owners as [placeholder] when unknown",
          "What to track and review in the next cycle",
        ],
        has_table: false,
      };

  const sections = [...outline.sections];
  const last = sections[sections.length - 1];
  if (!last || !isClosing(last)) sections.push(closing);

  const fillers = FILLER_SECTIONS[th ? "th" : "en"];
  let fi = 0;
  while (sections.length < 8 && fi < fillers.length) {
    sections.splice(Math.max(0, sections.length - 1), 0, fillers[fi]);
    fi += 1;
  }

  if (sections.length > 14) {
    const tail = isClosing(sections[sections.length - 1]) ? [sections[sections.length - 1]] : [closing];
    return { ...outline, sections: sections.slice(0, 13).concat(tail) };
  }
  return { ...outline, sections };
}

/* (a) outline -------------------------------------------------------------- */

async function fetchOutline(ctx: AgentContext): Promise<DocOutline> {
  const brief = `Brief: ${ctx.goal}\nDocument title: ${ctx.title}`;
  const ask = (note: string) =>
    callWoibotLLM({
      system: OUTLINE_SYSTEM + note,
      user: `${brief}\n\nReturn ONLY the JSON object — it must start with { and end with }.`,
      maxTokens: 3000,
      temperature: 0.3,
    });

  // Attempt 1: plain completion asked for JSON in the prompt (most reliable on
  // DeepSeek V4.1 Flash — never response_format json_object, it returns empty).
  let parsed = extractJson<Partial<DocOutline>>((await ask("")).text);

  // Attempt 2: one retry with a stricter instruction.
  if (!isParsableOutline(parsed)) {
    parsed = extractJson<Partial<DocOutline>>(
      (
        await ask(
          "\n\nRETRY: the previous reply was not usable. Return exactly one valid JSON object in the schema above and nothing else.",
        )
      ).text,
    );
  }
  if (!isParsableOutline(parsed)) {
    throw new Error("AI ไม่ได้ตอบกลับเป็นโครงเอกสาร (JSON) — สร้างเอกสารไม่ได้");
  }

  let outline = normalizeOutline(parsed, ctx);

  // A thin outline is a model hiccup, not a user error: one repair call, keep the better draft.
  if (outline.sections.length < 8) {
    const repair = extractJson<Partial<DocOutline>>(
      (
        await callWoibotLLM({
          system:
            OUTLINE_SYSTEM +
            "\n\nThe draft outline below is too short. Expand it to 10-12 sections: keep the existing headings, " +
            "add the missing parts of a full report (background, current state, analysis, options, plan, resources, risks, KPIs). " +
            "Return the FULL JSON object only.",
          user:
            `${brief}\n\nDraft outline (too short):\n` +
            `${JSON.stringify({ title: outline.title, language: outline.language, sections: outline.sections }).slice(0, 3000)}\n\n` +
            "Return ONLY the full JSON object.",
          maxTokens: 3000,
          temperature: 0.4,
        })
      ).text,
    );
    const expanded = isParsableOutline(repair) ? normalizeOutline(repair, ctx) : null;
    if (expanded && expanded.sections.length > outline.sections.length) outline = expanded;
  }

  return finalizeOutline(outline);
}

/* (b) per-section bodies --------------------------------------------------- */

function bodySystem(th: boolean): string {
  return (
    "You are a senior business writer expanding ONE section of a premium, print-ready business document. " +
    "Reply with ONE semantic HTML fragment only: no markdown fences, no commentary, no <!doctype>, no <html>/<body>.\n" +
    "Required structure, in this order:\n" +
    "1. <h2> containing the exact section heading text given below and nothing else.\n" +
    "2. 2-4 rich <p> paragraphs of real substance (2-5 full sentences each; the whole section is 180-350 words).\n" +
    "3. Optionally one <ul> or <ol> with 3-6 concise <li> items, only when a list is genuinely clearer than prose.\n" +
    "4. Exactly one <table> with <thead> and <tbody> IF AND ONLY IF told that this section has a table " +
    "(3-5 columns, 3-8 rows of real, internally consistent content; unknown numbers become [placeholder]).\n" +
    "5. End with exactly one <blockquote> holding a single-sentence key takeaway of the section.\n" +
    "Rules:\n" +
    `- Write ALL content in ${th ? "Thai" : "English"}, the language of the brief.\n` +
    "- Cover every point given; add depth, implications, trade-offs and concrete guidance. Never pad with filler.\n" +
    "- NEVER invent statistics, citations, names or dates. Unknown numbers stay as [placeholder] or are described qualitatively.\n" +
    "- No inline styles, no class attributes, no headings other than the single <h2> (at most one <h3> for a sub-point)."
  );
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strip fences, scripts, event handlers and page scaffolding from a model fragment. */
function sanitizeFragment(raw: string): string {
  return unfence(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<\/?(html|head|body)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .trim();
}

function looksLikeSection(frag: string): boolean {
  return frag.trim().length >= 350 && /<p[\s>]|<li|<table/i.test(frag);
}

/** Deterministic floor when both LLM attempts come back empty: real outline points only. */
function fallbackFragment(section: OutlineSection, lang: "th" | "en"): string {
  const th = lang === "th";
  const points = section.points.length ? section.points : [section.heading];
  const intro = th
    ? "หัวข้อนี้ครอบคลุมประเด็นหลักดังต่อไปนี้ ซึ่งเชื่อมโยงโดยตรงกับเป้าหมายของเอกสาร"
    : "This section covers the following key points, tied directly to the goal of the document.";
  return (
    `<h2>${escHtml(section.heading)}</h2>\n` +
    `<p>${escHtml(intro)}</p>\n` +
    `<ul>\n${points.map((p) => `<li>${escHtml(p)}</li>`).join("\n")}\n</ul>\n` +
    `<blockquote>${escHtml(
      th
        ? "ประเด็นสำคัญ: ดำเนินการตามรายการข้างต้นให้ครบก่อนขยายผลไปยังหัวข้อถัดไป"
        : "Key point: complete the items above before extending work to the next section.",
    )}</blockquote>`
  );
}

async function fetchSectionHtml(ctx: AgentContext, outline: DocOutline, idx: number): Promise<string> {
  const section = outline.sections[idx];
  const th = outline.language === "th";
  const system = bodySystem(th);
  const user =
    `Document title: ${outline.title}\n` +
    `Brief: ${ctx.goal}\n` +
    (outline.audience ? `Audience: ${outline.audience}\n` : "") +
    `Language: ${th ? "Thai" : "English"}\n` +
    `Section ${idx + 1} of ${outline.sections.length}\n` +
    `Section heading: ${section.heading}\n` +
    `Points to cover (expand all of them with substance):\n${section.points.map((p) => `- ${p}`).join("\n")}\n` +
    (section.has_table
      ? "This section MUST include exactly one <table> (use [placeholder] for unknown numbers).\n"
      : "This section must NOT include a <table>.\n") +
    "Return the HTML fragment only.";

  let frag = sanitizeFragment((await callWoibotLLM({ system, user, maxTokens: 3200, temperature: 0.55 })).text);

  // Empty or skeletal reply: retry once with a higher token budget.
  if (!looksLikeSection(frag)) {
    frag = sanitizeFragment(
      (
        await callWoibotLLM({
          system,
          user:
            user +
            "\n\nNOTE: the previous reply was empty or far too short. Write the FULL section now (aim for 250-350 words) and return the HTML fragment only.",
          maxTokens: 4400,
          temperature: 0.6,
        })
      ).text,
    );
  }

  if (!looksLikeSection(frag)) return fallbackFragment(section, outline.language);

  // Guarantee exactly one leading h2 carrying the section heading.
  if (!/<h2[\s>]/i.test(frag)) {
    if (/<h1[^>]*>[\s\S]*?<\/h1>/i.test(frag)) {
      frag = frag.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/i, (_m, inner: string) => `<h2>${stripTags(inner).trim()}</h2>`);
    } else {
      frag = `<h2>${escHtml(section.heading)}</h2>\n${frag}`;
    }
  }
  frag = frag.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, "").trim();
  return frag;
}

/* (c) premium HTML assembly ------------------------------------------------ */

/** Whitespace tokens for Latin text; Thai has no spaces, so ~5 characters per word. */
function countDocWords(htmlText: string): number {
  const t = htmlText.replace(/<[^>]+>/g, " ");
  const latin = (t.match(/[A-Za-z0-9]+/g) || []).length;
  const thai = (t.match(/[\u0e01-\u0e4f]/g) || []).length;
  return latin + Math.round(thai / 5);
}

function formatDocDate(lang: "th" | "en"): string {
  try {
    return new Intl.DateTimeFormat(lang === "th" ? "th-TH-u-ca-buddhist" : "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Renumber the leading h2 of a section fragment ("1.", "2.", ...). */
function numberFragment(frag: string, no: number, fallbackHeading: string): string {
  const m = frag.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (m) {
    const heading =
      stripTags(m[1])
        .replace(/^\s*\d+(\.\d+)*[.)]?\s*/, "")
        .trim() || fallbackHeading;
    // function replacer: a "$" inside the heading must never act as a pattern
    return frag.replace(m[0], () => `<h2>${no}. ${escHtml(heading)}</h2>`);
  }
  return `<h2>${no}. ${escHtml(fallbackHeading)}</h2>\n${frag}`;
}

function assembleDocumentHtml(outline: DocOutline, frags: string[]): string {
  const th = outline.language === "th";
  const title = escHtml(outline.title);
  const dateStr = escHtml(formatDocDate(outline.language));
  const audience = escHtml(outline.audience || "");
  const numbered = outline.sections.map((s, i) => ({ ...s, no: i + 1 }));

  const cover = [
    '<div class="cover">',
    '<p class="cover-brand">Woibot Document</p>',
    `<h1 class="cover-title">${title}</h1>`,
    outline.subtitle ? `<p class="cover-sub">${escHtml(outline.subtitle)}</p>` : "",
    '<hr class="cover-rule"/>',
    `<p class="cover-meta">${dateStr}${audience ? ` · ${th ? "จัดทำเพื่อ" : "Prepared for"}: ${audience}` : ""}</p>`,
    "</div>",
  ]
    .filter(Boolean)
    .join("\n");

  const tocLines = numbered.map((s) => `<p class="toc-line">${s.no}.&nbsp;&nbsp;${escHtml(s.heading)}</p>`).join("\n");
  const sectionsHtml = numbered.map((s, i) => numberFragment(frags[i] || "", s.no, s.heading)).join("\n");

  return `<!doctype html>
<html lang="${outline.language}">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @page { size: A4; margin: 22mm 18mm 20mm 18mm;
    @bottom-center { content: counter(page); font-size: 9pt; color: #6b7280; } }
  body { font-family: "Noto Sans Thai", "Noto Serif", "DejaVu Serif", Georgia, "Times New Roman", serif;
    font-size: 11pt; line-height: 1.7; color: #1a1d24; }
  h1, h2, h3 { color: #0b1220; }
  .cover { margin: 36pt 0 0; }
  .cover-brand { font-size: 10pt; font-weight: 600; letter-spacing: 3pt; text-transform: uppercase;
    color: #6b7280; margin: 0 0 30pt; }
  .cover-title { font-size: 26pt; line-height: 1.3; margin: 0 0 12pt; }
  .cover-sub { font-size: 13pt; color: #4b5563; line-height: 1.5; margin: 0 0 8pt; }
  .cover-rule { border: 0; border-top: 2pt solid #2563eb; width: 40pt; margin: 18pt 0; }
  .cover-meta { font-size: 10.5pt; color: #6b7280; margin: 0 0 6pt; }
  h2.toc-title { font-size: 15pt; margin: 0 0 16pt; padding-bottom: 4pt;
    border-bottom: 1pt solid #d8dbe2; page-break-before: always; page-break-after: avoid; }
  .toc-line { font-size: 11pt; margin: 0 0 7pt; }
  h2 { font-size: 14pt; line-height: 1.4; margin: 0 0 10pt; padding-bottom: 3pt;
    border-bottom: 1pt solid #d8dbe2; page-break-before: always; page-break-after: avoid; }
  h3 { font-size: 12pt; margin: 12pt 0 5pt; page-break-after: avoid; }
  p { margin: 0 0 7.5pt; }
  ul, ol { margin: 2pt 0 9pt 20pt; padding: 0; }
  li { margin: 0 0 3.5pt; }
  table { border-collapse: collapse; width: 100%; margin: 9pt 0 12pt; font-size: 9.5pt; }
  th, td { border: 0.75pt solid #c3c8d2; padding: 5pt 7pt; text-align: left; vertical-align: top; }
  th { background-color: #eef1f6; font-weight: 600; }
  tbody tr:nth-child(even) td { background-color: #f7f9fc; }
  blockquote { margin: 10pt 0 6pt; padding: 8pt 12pt; border-left: 3pt solid #2563eb;
    background-color: #f5f7fb; color: #1f2937; font-size: 10.5pt; }
  strong { color: #0b1220; }
</style>
</head>
<body>
${cover}
<div class="toc">
<h2 class="toc-title">${escHtml(th ? "สารบัญ" : "Contents")}</h2>
${tocLines}
</div>
${sectionsHtml}
</body>
</html>`;
}

/* (d) python3 stdlib fallbacks ---------------------------------------------- */

/**
 * Fallback DOCX builder used when LibreOffice's HTML->DOCX export filter is
 * missing from the container image ("no export filter found"). python3 stdlib
 * only: parses the SAME premium HTML with html.parser and writes genuine
 * WordprocessingML (real styles, numbered sections, page breaks per section,
 * bordered/shaded tables, callouts, footer PAGE field) via zipfile.
 */
const DOCX_FROM_HTML = String.raw`
import json, re, sys, zipfile
from html.parser import HTMLParser
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape

html_path, out_path = sys.argv[1], sys.argv[2]
meta = {}
if len(sys.argv) > 3:
    try:
        meta = json.loads(sys.argv[3])
    except Exception:
        meta = {}

BAD_CHARS = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f]")
CONTENT_WIDTH = 9864  # A4 width minus 18 mm side margins, in twips


def txt(value):
    s = BAD_CHARS.sub(" ", str("" if value is None else value))
    return escape(s, {'"': "&quot;"})


def runs(text, bold=False, italic=False, size=None, color=None):
    chunks = str("" if text is None else text).split("\n")
    out = []
    for i, chunk in enumerate(chunks):
        if i:
            out.append("<w:br/>")
        out.append('<w:t xml:space="preserve">%s</w:t>' % txt(chunk))
    rpr = []
    if bold:
        rpr.append("<w:b/>")
    if italic:
        rpr.append("<w:i/>")
    if size:
        rpr.append('<w:sz w:val="%d"/><w:szCs w:val="%d"/>' % (size, size))
    if color:
        rpr.append('<w:color w:val="%s"/>' % color)
    rpr_xml = "<w:rPr>%s</w:rPr>" % "".join(rpr) if rpr else ""
    return "<w:r>%s%s</w:r>" % (rpr_xml, "".join(out))


def para(text, style=None, page_break=False, bold=False, italic=False, size=None, color=None):
    ppr = []
    if page_break:
        ppr.append("<w:pageBreakBefore/>")
    if style:
        ppr.append('<w:pStyle w:val="%s"/>' % style)
    ppr_xml = "<w:pPr>%s</w:pPr>" % "".join(ppr) if ppr else ""
    return "<w:p>%s%s</w:p>" % (ppr_xml, runs(text, bold=bold, italic=italic, size=size, color=color))


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


class DocHTMLParser(HTMLParser):
    """Forgiving parser: block-level content collected in document order."""

    BLOCKS = ("h1", "h2", "h3", "p", "li", "blockquote")

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []
        self._skip = 0
        self._cur = None
        self._tbl = None
        self._row = None
        self._row_th = False
        self._cell = None

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip += 1
            return
        if self._skip:
            return
        cls = ""
        for k, v in attrs:
            if k == "class":
                cls = v or ""
        if tag == "table":
            self._flush()
            self._tbl = {"thead": False, "headers": [], "rows": []}
        elif tag == "thead" and self._tbl is not None:
            self._tbl["thead"] = True
        elif tag == "tbody" and self._tbl is not None:
            self._tbl["thead"] = False
        elif tag == "hr":
            self._flush()
            self.blocks.append({"kind": "rule"})
        elif tag == "tr" and self._tbl is not None:
            self._flush()
            self._row = []
            self._row_th = False
        elif tag in ("td", "th") and self._row is not None:
            self._flush()
            self._cell = []
            if tag == "th":
                self._row_th = True
        elif tag in self.BLOCKS:
            self._flush()
            self._cur = {"kind": tag, "cls": cls, "text": []}

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self._skip = max(0, self._skip - 1)
            return
        if self._skip:
            return
        if tag in ("td", "th") and self._cell is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            if self._tbl["thead"] or self._row_th:
                self._tbl["headers"].append(self._row)
            else:
                self._tbl["rows"].append(self._row)
            self._row = None
        elif tag == "table" and self._tbl is not None:
            self._flush()
            if self._tbl["headers"] or self._tbl["rows"]:
                self.blocks.append({"kind": "table", "headers": self._tbl["headers"], "rows": self._tbl["rows"]})
            self._tbl = None
        elif tag in self.BLOCKS:
            self._flush()

    def handle_data(self, data):
        if self._skip:
            return
        if self._cell is not None:
            self._cell.append(data)
        elif self._cur is not None:
            self._cur["text"].append(data)

    def close(self):
        super().close()
        self._flush()

    def _flush(self):
        cur = self._cur
        self._cur = None
        if not cur:
            return
        text = " ".join("".join(cur["text"]).split())
        if not text:
            return
        kind = cur["kind"]
        cls = cur["cls"] or ""
        if kind == "h1":
            self.blocks.append({"kind": "title", "text": text})
        elif kind == "h2" and "toc-title" in cls:
            self.blocks.append({"kind": "toc-title", "text": text})
        elif kind == "h2":
            self.blocks.append({"kind": "h2", "text": text})
        elif kind == "h3":
            self.blocks.append({"kind": "h3", "text": text})
        elif kind == "p":
            if "cover-brand" in cls:
                self.blocks.append({"kind": "brand", "text": text})
            elif "cover-sub" in cls:
                self.blocks.append({"kind": "subtitle", "text": text})
            elif "cover-meta" in cls:
                self.blocks.append({"kind": "meta", "text": text})
            elif "toc-line" in cls:
                self.blocks.append({"kind": "toc", "text": text})
            else:
                self.blocks.append({"kind": "p", "text": text})
        elif kind == "li":
            self.blocks.append({"kind": "li", "text": text})
        elif kind == "blockquote":
            self.blocks.append({"kind": "quote", "text": text})


raw = open(html_path, encoding="utf-8").read()
parser = DocHTMLParser()
parser.feed(raw)
parser.close()
blocks = parser.blocks

if not any(b["kind"] in ("h2", "h3", "p", "li", "table", "quote") for b in blocks):
    raise SystemExit("html produced no content blocks")

title = str(meta.get("title") or next((b["text"] for b in blocks if b["kind"] == "title"), "") or "Document")
parsed_subtitle = next((b["text"] for b in blocks if b["kind"] == "subtitle"), "")

counts = {"sections": 0, "paragraphs": 0, "bullets": 0, "tables": 0, "quotes": 0}
body = []
saw_title = False


def emit_title(text):
    global saw_title
    if not saw_title:
        body.append(para(text, style="Title"))
        saw_title = True
    else:
        body.append(para(text, style="Heading1", page_break=True))
        counts["sections"] += 1


for b in blocks:
    kind = b["kind"]
    if kind == "brand":
        body.append(para(b["text"], style="Brand"))
    elif kind == "rule":
        body.append(rule())
    elif kind == "title":
        emit_title(b["text"])
    elif kind == "subtitle":
        body.append(para(b["text"], style="Subtitle"))
    elif kind == "meta":
        body.append(para(b["text"], style="Meta"))
    elif kind == "toc-title":
        body.append(para(b["text"], style="TocTitle", page_break=True))
    elif kind == "toc":
        body.append(para(b["text"], style="TocLine"))
    elif kind == "h2":
        body.append(para(b["text"], style="Heading1", page_break=True))
        counts["sections"] += 1
    elif kind == "h3":
        body.append(para(b["text"], style="Heading2"))
    elif kind == "p":
        body.append(para(b["text"]))
        counts["paragraphs"] += 1
    elif kind == "li":
        body.append(bullet(b["text"]))
        counts["bullets"] += 1
    elif kind == "quote":
        body.append(para(b["text"], style="Quote"))
        counts["quotes"] += 1
    elif kind == "table":
        hrows = b["headers"] or []
        rows = list(b["rows"] or [])
        flat = hrows[0] if hrows else []
        if len(hrows) > 1:
            rows = hrows[1:] + rows
        xml = table({"headers": flat, "rows": rows})
        if xml:
            body.append(xml)
            counts["tables"] += 1

if not saw_title:
    body.insert(0, para(title, style="Title"))
if parsed_subtitle:
    body.insert(1, para(parsed_subtitle, style="Subtitle"))

if counts["sections"] == 0 and counts["paragraphs"] == 0 and counts["bullets"] == 0:
    raise SystemExit("html produced an empty document")

SECT = (
    '<w:sectPr><w:footerReference w:type="default" r:id="rId2"/>'
    '<w:pgSz w:w="11906" w:h="16838"/>'
    '<w:pgMar w:top="1247" w:right="1021" w:bottom="1134" w:left="1021" '
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
    '<w:style w:type="paragraph" w:styleId="Brand"><w:name w:val="Cover Brand"/>'
    '<w:basedOn w:val="Normal"/><w:qFormat/>'
    '<w:pPr><w:spacing w:before="2400" w:after="480"/></w:pPr>'
    '<w:rPr><w:caps/><w:spacing w:val="60"/><w:b/><w:color w:val="6B7280"/>'
    '<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/>'
    '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>'
    '<w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr>'
    '<w:rPr><w:b/><w:color w:val="0B1220"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/>'
    '<w:basedOn w:val="Normal"/><w:qFormat/>'
    '<w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr>'
    '<w:rPr><w:color w:val="5B6472"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Meta"><w:name w:val="Cover Meta"/>'
    '<w:basedOn w:val="Normal"/><w:qFormat/>'
    '<w:pPr><w:spacing w:before="360" w:after="0"/></w:pPr>'
    '<w:rPr><w:color w:val="6B7280"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="TocTitle"><w:name w:val="TOC Title"/>'
    '<w:basedOn w:val="Normal"/><w:next w:val="TocLine"/><w:qFormat/>'
    '<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="240"/>'
    '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="D8DBE2"/></w:pBdr></w:pPr>'
    '<w:rPr><w:b/><w:color w:val="0B1220"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="TocLine"><w:name w:val="TOC Line"/>'
    '<w:basedOn w:val="Normal"/><w:qFormat/>'
    '<w:pPr><w:spacing w:after="100"/></w:pPr>'
    '<w:rPr><w:color w:val="1A1D24"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>'
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
    '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Key Takeaway"/>'
    '<w:basedOn w:val="Normal"/><w:qFormat/>'
    '<w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="2563EB"/></w:pBdr>'
    '<w:shd w:val="clear" w:color="auto" w:fill="F5F7FB"/>'
    '<w:ind w:left="240"/><w:spacing w:before="160" w:after="200"/></w:pPr>'
    '<w:rPr><w:color w:val="1F2937"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/>'
    '<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/></w:pPr>'
    '<w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/>'
    '<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>'
    '<w:rPr><w:color w:val="6B7280"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>'
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
    '<cp:lastModifiedBy>woibot Work</cp:lastModifiedBy></cp:coreProperties>' % txt(title)
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

/**
 * Inject a centered footer PAGE field into a DOCX produced by LibreOffice
 * (whose HTML import does not carry @page @bottom-center margin boxes over).
 * No-op when a footer already exists; validates every XML part before
 * replacing the original file, so a failure can never corrupt the document.
 */
const DOCX_FOOTER = String.raw`
import os, re, sys, zipfile
from xml.etree import ElementTree as ET

path = sys.argv[1]

with zipfile.ZipFile(path) as zf:
    names = zf.namelist()
    doc = zf.read("word/document.xml").decode("utf-8")
    rels = zf.read("word/_rels/document.xml.rels").decode("utf-8")
    ct = zf.read("[Content_Types].xml").decode("utf-8")

if "footerReference" in doc:
    print("footer-already-present")
    sys.exit(0)

existing = [n for n in names if re.match(r"word/footer\d+\.xml$", n)]
next_no = 1 + max([int(re.search(r"footer(\d+)\.xml$", n).group(1)) for n in existing] or [0])
foot_name = "footer%d.xml" % next_no

nums = [int(m) for m in re.findall(r'Id="rId(\d+)"', rels)]
new_id = "rId%d" % ((max(nums) + 1) if nums else 1)

RPR = '<w:rPr><w:color w:val="6B7280"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>'
FOOTER_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>'
    "<w:r>%s<w:fldChar w:fldCharType=\"begin\"/></w:r>" % RPR
    + "<w:r>%s<w:instrText xml:space=\"preserve\"> PAGE </w:instrText></w:r>" % RPR
    + "<w:r>%s<w:fldChar w:fldCharType=\"separate\"/></w:r>" % RPR
    + "<w:r>%s<w:t>1</w:t></w:r>" % RPR
    + "<w:r>%s<w:fldChar w:fldCharType=\"end\"/></w:r>" % RPR
    + "</w:p></w:ftr>"
)

doc2 = re.sub(r"(<w:sectPr[^>]*>)", r'\1<w:footerReference w:type="default" r:id="%s"/>' % new_id, doc, count=1)
if doc2 == doc:
    print("sectPr-not-found")
    sys.exit(4)

rels2 = rels.replace(
    "</Relationships>",
    '<Relationship Id="%s" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" '
    'Target="%s"/></Relationships>' % (new_id, foot_name),
)
ct2 = ct.replace(
    "</Types>",
    '<Override PartName="/word/%s" '
    'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>' % foot_name,
)

tmp = path + ".tmp"
with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename == "word/document.xml":
            data = doc2.encode("utf-8")
        elif item.filename == "word/_rels/document.xml.rels":
            data = rels2.encode("utf-8")
        elif item.filename == "[Content_Types].xml":
            data = ct2.encode("utf-8")
        zout.writestr(item, data)
    zout.writestr("word/" + foot_name, FOOTER_XML)

# validate every XML part before replacing the original
with zipfile.ZipFile(tmp) as zf:
    for n in zf.namelist():
        if n.endswith(".xml") or n.endswith(".rels"):
            ET.fromstring(zf.read(n))

os.replace(tmp, path)
print("footer-added:%s" % new_id)
`;

/* (e) orchestration --------------------------------------------------------- */

async function hasWordDocumentXml(userId: string, slug: string): Promise<boolean> {
  const r = await execInContainer(
    userId,
    `cd ${WORK_DIR} && unzip -l ${shellQuote(`${slug}.docx`)} 2>&1 | grep -c 'word/document.xml'`,
  );
  return r.exitCode === 0 && Number(r.stdout.trim()) >= 1;
}

export async function produceDocxAndPdf(ctx: AgentContext, slug: string): Promise<ProducerResult> {
  const notes: string[] = [];

  /* (a) outline */
  await ctx.onProgress?.(8, "outline", "ให้ AI ออกแบบโครงเอกสาร (8-14 หัวข้อ)");
  const outline = await fetchOutline(ctx);
  must(
    await writeWorkspaceFile(ctx.userId, `${slug}.outline.json`, JSON.stringify(outline, null, 2)),
    "เขียนไฟล์โครงเอกสาร",
  );
  notes.push(`outline: ${outline.sections.length} sections, ${outline.language}`);

  /* (b) per-section bodies, sequentially */
  const frags: string[] = [];
  for (let i = 0; i < outline.sections.length; i++) {
    await ctx.onProgress?.(
      14 + Math.round(((i + 1) / outline.sections.length) * 40),
      "sections",
      `เขียนเนื้อหาหัวข้อ ${i + 1}/${outline.sections.length}: ${outline.sections[i].heading.slice(0, 40)}`,
    );
    frags.push(await fetchSectionHtml(ctx, outline, i));
  }
  const words = countDocWords(frags.join("\n"));
  notes.push(`${outline.sections.length} sections, ~${words} words`);

  // remove any stale artefacts from an earlier run with the same slug, so a
  // failed conversion can never be masked by an old file
  await execInContainer(
    ctx.userId,
    `rm -f ${shellQuote(`${WORK_DIR}/${slug}.docx`)} ${shellQuote(`${WORK_DIR}/${slug}.pdf`)}`,
  );

  /* (c) premium HTML (also a deliverable) */
  await ctx.onProgress?.(58, "layout", "ประกอบเอกสารสำหรับสิ่งพิมพ์ (ปก + สารบัญ + เนื้อหา)");
  const html = assembleDocumentHtml(outline, frags);
  must(await writeWorkspaceFile(ctx.userId, `${slug}.html`, html), "เขียนไฟล์ HTML");
  notes.push(`${slug}.html ${html.length} chars`);

  /* (d) HTML -> DOCX with LibreOffice, python3 fallback when the filter is missing */
  await ctx.onProgress?.(64, "docx", "แปลง HTML → DOCX ด้วย LibreOffice");
  let docxVia = "LibreOffice HTML→DOCX";
  const convDocx = await execInContainer(
    ctx.userId,
    `cd ${WORK_DIR} && ${LO} --convert-to docx --outdir . ${shellQuote(`${slug}.html`)} 2>&1 | tail -3`,
  );
  const docxSize = await statSize(ctx.userId, `${slug}.docx`);
  if (docxSize < 2000 || !(await hasWordDocumentXml(ctx.userId, slug))) {
    docxVia = "python3 OOXML (LibreOffice HTML→DOCX filter unavailable)";
    must(await writeWorkspaceFile(ctx.userId, "_mkdocx.py", DOCX_FROM_HTML), "เขียนสคริปต์ docx (ตัวสำรอง)");
    const build = await runScript(
      ctx.userId,
      `cd ${WORK_DIR} && python3 _mkdocx.py ${shellQuote(`${slug}.html`)} ${shellQuote(`${slug}.docx`)} ${shellQuote(
        JSON.stringify({ title: outline.title, lang: outline.language }),
      )} 2>&1`,
    );
    if (build.exitCode !== 0) {
      throw new Error(
        `สร้าง .docx ไม่สำเร็จ (LibreOffice: ${(convDocx.stdout || convDocx.stderr || "-").slice(0, 160)} | ตัวสำรอง: ${(
          build.stderr || build.stdout
        ).slice(0, 240)})`,
      );
    }
    notes.push(build.stdout.trim().split("\n").pop() || "");
  }

  // footer page numbers (no-op when the document already carries a footer)
  must(await writeWorkspaceFile(ctx.userId, "_docx_footer.py", DOCX_FOOTER), "เขียนสคริปต์เลขหน้า");
  const foot = await runScript(ctx.userId, `cd ${WORK_DIR} && python3 _docx_footer.py ${shellQuote(`${slug}.docx`)} 2>&1`);
  if (foot.exitCode === 0) {
    notes.push(foot.stdout.trim().split("\n").pop() || "");
  } else {
    notes.push("ข้ามการใส่เลขหน้าใน footer (ไม่กระทบไฟล์)");
  }

  const listing = await execInContainer(
    ctx.userId,
    `cd ${WORK_DIR} && unzip -l ${shellQuote(`${slug}.docx`)} 2>&1 | grep -c 'word/document.xml'`,
  );
  if (listing.exitCode !== 0 || Number(listing.stdout.trim()) < 1) {
    throw new Error(`ไฟล์ .docx ไม่ใช่แพ็กเกจ OOXML ที่ถูกต้อง (ไม่พบ word/document.xml): ${listing.stdout.slice(0, 200)}`);
  }
  const docxBytes = await requireFile(ctx.userId, `${slug}.docx`, "สร้างเอกสาร DOCX", 2000);
  notes.push(`${slug}.docx ${docxBytes} bytes via ${docxVia}`);

  /* (e) DOCX -> PDF with LibreOffice */
  await ctx.onProgress?.(80, "pdf", "แปลง DOCX → PDF ด้วย LibreOffice");
  const convPdf = await execInContainer(
    ctx.userId,
    `cd ${WORK_DIR} && ${LO} --convert-to pdf --outdir . ${shellQuote(`${slug}.docx`)} 2>&1 | tail -3`,
  );
  const pdfBytes = await requireFile(ctx.userId, `${slug}.pdf`, "แปลง DOCX → PDF").catch((e) => {
    throw new Error(
      `แปลง DOCX → PDF ไม่ได้: ${(convPdf.stdout || convPdf.stderr || (e as Error).message).slice(0, 300)}`,
    );
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
