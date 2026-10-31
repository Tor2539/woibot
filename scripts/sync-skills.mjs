#!/usr/bin/env node
/**
 * sync-skills.mjs — builds the woibot skill catalog.
 *
 * Pulls real skill documents from curated permissively-licensed open-source
 * collections (verified MIT/Apache-2.0/CC0 only — anything with an unclear or
 * restrictive license is skipped, never invented), normalizes them, and merges
 * them with original authored skills from apps/web/data/skills/authored/*.md.
 *
 * Outputs:
 *   apps/web/data/skills/catalog.json    — array of normalized skills
 *   apps/web/data/skills/manifest.json   — { total, generatedAt, sources[] }
 *   apps/web/data/skills/parts/*.json    — per-source intermediate files
 *
 * Node 22+, built-in fetch only, no dependencies.
 */

import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "apps", "web", "data", "skills");
const PARTS = path.join(DATA, "parts");
const AUTHORED = path.join(DATA, "authored");

const UA = "Mozilla/5.0 (woibot-skills-sync/1.0; +https://woibot.com)";
const MIN_INSTRUCTIONS = 400; // quality bar: instructions must be substantive
const MAX_DESCRIPTION = 300;

/** Curated sources. Every entry was license-verified before being listed here;
 *  the script re-verifies the license file at fetch time and skips the source
 *  entirely if the text is not recognizably permissive. */
const SOURCES = [
  {
    id: "scientific",
    repo: "K-Dense-AI/claude-scientific-skills",
    branch: "main",
    license: "MIT",
    licenseFile: "LICENSE.md",
    baseTags: ["science"],
    homepage: "https://github.com/K-Dense-AI/claude-scientific-skills",
  },
  {
    id: "engineering",
    repo: "obra/superpowers",
    branch: "main",
    license: "MIT",
    licenseFile: "LICENSE",
    baseTags: ["engineering"],
    homepage: "https://github.com/obra/superpowers",
  },
];

/* ------------------------------------------------------------------ fetch */

async function fetchText(url, { retries = 2, timeoutMs = 30000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`http_${res.status}`);
      return await res.text();
    } catch (e) {
      if (attempt === retries) {
        console.warn(`  ! fetch failed (${url}): ${e instanceof Error ? e.message : e}`);
        return null;
      }
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  return null;
}

async function fetchJson(url, opts) {
  const t = await fetchText(url, opts);
  if (t == null) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

const PERMISSIVE_RE =
  /^\s*(MIT License|Apache License|Apache 2\.0|Creative Commons (Zero|CC0)|CC0 1\.0|The Unlicense|Unlicense)/im;

/** Verify a license file actually looks permissive (defense in depth). */
function looksPermissive(licenseText) {
  if (!licenseText) return false;
  return PERMISSIVE_RE.test(licenseText.slice(0, 600));
}

/* -------------------------------------------------------------- normalize */

/** White-label: user-visible text must not carry upstream product names.
 *  Note: GLM is NOT replaced — it is a legitimate statistics term
 *  (generalized linear model) that appears in real analytical content. */
function whiteLabel(text) {
  return String(text)
    .replace(/claude\s*code/gi, "the coding CLI")
    .replace(/claude/gi, "the assistant")
    .replace(/anthropic/gi, "the platform")
    .replace(/\bopencode\b/gi, "the coding CLI");
}

function clean(s) {
  return whiteLabel(String(s || "")).replace(/\s+/g, " ").trim();
}

function truncate(s, max) {
  const t = String(s || "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + "\u2026";
}

/** Deterministic topical tags derived from name + description.
 *  Regexes are word-boundary anchored where a bare substring would
 *  false-positive (e.g. "gene" in "general", "rest" in "restore"). */
const TAG_RULES = [
  [/pdf|docx|word document|document conversi/, "documents"],
  [/pptx|powerpoint|slides?\b|presentation|\bdecks?\b/, "presentations"],
  [/xlsx|excel|spreadsheet|worksheet/, "spreadsheets"],
  [/csv|tabular|dataframe|pandas|dataset/, "data"],
  [/\bml\b|machine learning|\bneural net|deep learning|\bllm\b|embedding|transformer/, "machine-learning"],
  [/statistic|regression|\bbayes|probabilit|anova|forecast/, "statistics"],
  [/visuali[sz]|\bplot|chart|figure|graph/, "visualization"],
  [/security|vulnerab|encrypt|threat|pentest|auth(enticat|orization)|privacy/, "security"],
  [/\btest|\btdd\b|testing|\bqa\b|quality assurance/, "testing"],
  [/\bdebug|troubleshoot|root cause|\bdiagnose/, "debugging"],
  [/refactor|code review|static analysis|\blint/, "coding"],
  [/\bapi\b|\bhttp\b|graphql|endpoint|webhook/, "api"],
  [/\bgit\b|github|pull request|\bbranch|\bcommit\b|\bmerge\b/, "git"],
  [/deploy|devops|ci\/cd|docker|kubernetes|\bserver|infra/, "devops"],
  [/\bgene\b|genom|\bdna\b|\brna\b|protein|bioinform|sequenc|biolog|\bcells?\b|crispr/, "biology"],
  [/chem|molecul|spectro|chromatograph|compound|reaction/, "chemistry"],
  [/physic|quantum|optics|laser|particle|thermodyn/, "physics"],
  [/astronom|telescope|galaxy|stellar|\bastro\b|exoplanet/, "astronomy"],
  [/earth|climate|weather|ocean|geolog|seismic|atmospher/, "earth-science"],
  [/clinic|patient|medical|health|disease|symptom|hospital/, "healthcare"],
  [/neuro|\bbrain\b|cogniti|psycholog/, "neuroscience"],
  [/\bmarket\b|finance|econom|revenue|budget|invoic|\bcash\b/, "finance"],
  [/legal|contract|compliance|patent|regulat|licens|\bnda\b/, "legal"],
  [/writ|draft|editorial|proofread|copyedit/, "writing"],
  [/research|literature|citation|\bpaper|pubmed|arxiv|survey design/, "research"],
  [/\bplan\b|planning|\bprojects?\b|workflow|schedul|roadmap|\bsprint|\bokr\b|\btask/, "planning"],
  [/teach|lesson|learn|educat|quiz|tutor|curriculum|study/, "education"],
  [/translat|localiz|multilingual|subtitl/, "translation"],
  [/\bseo\b|keyword research|search engine|meta tag|\bserp\b/, "seo"],
  [/social media|twitter|instagram|linkedin|tiktok|facebook/, "social-media"],
  [/email|newsletter|campaign|marketing|advertis/, "marketing"],
  [/\bbrand|design|logo|typograph|\blayout|\bui\b|\bux\b|color palette/, "design"],
  [/support|customer service|ticket|\bfaq\b|helpdesk|complaint/, "support"],
  [/\bhr\b|recruit|hiring|interview|onboard|employee|performance review/, "hr"],
  [/\bsale|pitch|\bleads?\b|\blead gen|crm|prospect|objection|\bdemo\b/, "sales"],
  [/image|photo|microscop|imaging|\bocr\b|pixel/, "imaging"],
  [/video|ffmpeg|frame rate|codec/, "video"],
  [/audio|speech|voice|sound|transcri/, "audio"],
  [/geo|\bgis\b|geocod|satellite|cartograph|terrain|topograph/, "geospatial"],
  [/web app|frontend|html|\bcss\b|javascript|\breact\b|browser/, "web"],
  [/python|numpy|jupyter|\bscript|automat/, "python"],
];

function deriveTags(name, description, extra = []) {
  const hay = `${name} ${description}`.toLowerCase();
  const tags = new Set(extra);
  for (const [re, tag] of TAG_RULES) if (re.test(hay)) tags.add(tag);
  return [...tags].slice(0, 5);
}

/* ------------------------------------------------------------- parsing */

/** Parse the YAML-lite frontmatter of a SKILL.md (single document). */
function parseSkillDoc(raw) {
  const text = String(raw || "").replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return null;
  const fm = {};
  const lines = m[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    // folded block scalars: >, >-, |, |- (accumulate indented lines)
    if (/^[>|][+-]?$/.test(value)) {
      const buf = [];
      i++;
      while (i < lines.length && (/^\s/.test(lines[i]) || lines[i] === "")) {
        buf.push(lines[i].trim());
        i++;
      }
      i--;
      value = buf.join(" ");
    }
    value = value.replace(/^["']|["']$/g, "");
    fm[kv[1].toLowerCase()] = value;
  }
  const body = text.slice(m[0].length).trim();
  return { fm, body };
}

/** Parse an authored multi-document markdown file:
 *  a preamble-free stream of `---` frontmatter blocks alternating with bodies. */
function parseAuthoredDoc(raw) {
  const text = String(raw || "").replace(/\r\n/g, "\n");
  const segments = text.split(/^---$/m);
  const out = [];
  for (let i = 1; i + 1 <= segments.length - 1; i += 2) {
    const fmRaw = segments[i];
    const body = (segments[i + 1] || "").trim();
    const fm = {};
    for (const line of fmRaw.split("\n")) {
      const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
      if (kv) fm[kv[1].toLowerCase()] = kv[2].trim().replace(/^\["'\]|["']$/g, "").replace(/^\[|\]$/g, "");
    }
    const tags = String(fm.tags || "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    out.push({ fm, body, tags });
  }
  return out;
}

/* --------------------------------------------------------------- helpers */

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function humanize(s) {
  return String(s || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function runParallel(items, worker, concurrency = 8) {
  const results = new Array(items.length);
  let idx = 0;
  async function lane() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
  return results;
}

/* ----------------------------------------------------------------- main */

async function main() {
  const started = Date.now();
  console.log("== woibot skills sync ==");
  await mkdir(PARTS, { recursive: true });
  await mkdir(AUTHORED, { recursive: true });

  const catalog = [];
  const manifestSources = [];

  for (const src of SOURCES) {
    console.log(`\n-- source: ${src.repo} (${src.license}) --`);

    // 1) verify the license text itself before trusting anything from this repo
    const licenseText = await fetchText(
      `https://raw.githubusercontent.com/${src.repo}/${src.branch}/${src.licenseFile}`,
      { retries: 1 },
    );
    if (!looksPermissive(licenseText)) {
      console.warn(`  ! license not verifiably permissive — SKIPPING this source entirely`);
      manifestSources.push({ id: src.id, repo: src.repo, license: src.license, status: "skipped-license", count: 0 });
      continue;
    }

    // 2) list skill files via the GitHub tree API (1 call per source)
    const tree = await fetchJson(
      `https://api.github.com/repos/${src.repo}/git/trees/${src.branch}?recursive=1`,
      { retries: 1, timeoutMs: 45000 },
    );
    if (!tree || !Array.isArray(tree.tree)) {
      console.warn(`  ! tree listing failed — skipping source`);
      manifestSources.push({ id: src.id, repo: src.repo, license: src.license, status: "skipped-tree", count: 0 });
      continue;
    }

    const skillFiles = tree.tree.filter((n) => n.type === "blob" && /SKILL\.md$/.test(n.path));
    // find per-directory LICENSE overrides (vendored content with own terms)
    const ownLicense = new Map();
    for (const n of tree.tree) {
      if (n.type !== "blob") continue;
      const dir = path.posix.dirname(n.path);
      if (/LICENSE|COPYING/i.test(path.posix.basename(n.path)) && dir.includes("/")) {
        ownLicense.set(dir, n.path);
      }
    }

    console.log(`  found ${skillFiles.length} SKILL.md files`);

    // 3) fetch and normalize each skill
    const entries = await runParallel(skillFiles, async (node) => {
      const raw = await fetchText(`https://raw.githubusercontent.com/${src.repo}/${src.branch}/${node.path}`);
      if (raw == null) return null;
      const parsed = parseSkillDoc(raw);
      if (!parsed) return null;

      const dir = path.posix.dirname(node.path);
      if (ownLicense.has(dir) && path.posix.join(dir, src.licenseFile) !== ownLicense.get(dir)) {
        // this skill ships its own license — it must be permissive too
        const lic = await fetchText(`https://raw.githubusercontent.com/${src.repo}/${src.branch}/${ownLicense.get(dir)}`, { retries: 1 });
        if (!looksPermissive(lic)) {
          console.log(`  · skip ${node.path} (own license not permissive)`);
          return null;
        }
      }

      const slug = slugify(parsed.fm.name || path.posix.basename(dir));
      const name = humanize(parsed.fm.name || path.posix.basename(dir));
      const description = truncate(clean(parsed.fm.description || firstParagraph(parsed.body)), MAX_DESCRIPTION);
      const instructions = whiteLabel(parsed.body).trim();

      if (instructions.length < MIN_INSTRUCTIONS) {
        console.log(`  · skip ${node.path} (instructions too short: ${instructions.length})`);
        return null;
      }
      if (!slug || !description) return null;

      const tags = deriveTags(name, description, src.baseTags);
      return {
        id: slug,
        name,
        description,
        tags,
        instructions,
        source: src.homepage,
        license: src.license,
      };
    });

    const good = entries.filter(Boolean);
    manifestSources.push({
      id: src.id,
      repo: src.repo,
      homepage: src.homepage,
      license: src.license,
      licenseVerified: true,
      count: good.length,
    });
    catalog.push(...good);
    await writeFile(path.join(PARTS, `remote-${src.id}.json`), JSON.stringify(good, null, 2), "utf8");
    console.log(`  kept ${good.length} skills -> parts/remote-${src.id}.json`);
  }

  /* -------------------------------------------------- authored originals */

  console.log("\n-- authored originals (woibot) --");
  let authoredFiles = [];
  try {
    authoredFiles = (await readdir(AUTHORED)).filter((f) => f.endsWith(".md")).sort();
  } catch {
    /* no authored dir yet */
  }
  const authored = [];
  for (const file of authoredFiles) {
    const raw = await readFile(path.join(AUTHORED, file), "utf8");
    for (const doc of parseAuthoredDoc(raw)) {
      const slug = slugify(doc.fm.id || doc.fm.name);
      const name = clean(doc.fm.name || humanize(slug));
      const description = truncate(clean(doc.fm.description || firstParagraph(doc.body)), MAX_DESCRIPTION);
      const instructions = doc.body.trim();
      if (!slug || !name) continue;
      if (instructions.length < MIN_INSTRUCTIONS) {
        console.warn(`  ! authored skill ${file}/${slug} too short (${instructions.length}) — fix the file`);
        continue;
      }
      authored.push({
        id: slug,
        name,
        description,
        tags: doc.tags.length ? doc.tags : deriveTags(name, description),
        instructions,
        source: "woibot-authored",
        license: "woibot-original",
      });
    }
  }
  await writeFile(path.join(PARTS, "authored.json"), JSON.stringify(authored, null, 2), "utf8");
  console.log(`  kept ${authored.length} authored skills from ${authoredFiles.length} file(s) -> parts/authored.json`);

  /* --------------------------------------------------------- merge + write */

  const seen = new Map();
  const merged = [];
  for (const s of [...catalog, ...authored]) {
    let id = s.id;
    let n = 1;
    while (seen.has(id)) id = `${s.id}-${++n}`;
    seen.set(id, true);
    merged.push({ ...s, id });
  }
  merged.sort((a, b) => a.id.localeCompare(b.id));

  const manifest = {
    total: merged.length,
    generatedAt: new Date().toISOString(),
    sources: manifestSources,
    authored: {
      count: authored.length,
      location: "apps/web/data/skills/authored",
      license: "woibot-original",
    },
    minInstructionsChars: MIN_INSTRUCTIONS,
    generator: "scripts/sync-skills.mjs",
  };

  await writeFile(path.join(DATA, "catalog.json"), JSON.stringify(merged, null, 2), "utf8");
  await writeFile(path.join(DATA, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  const ms = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n== done in ${ms}s ==`);
  console.log(`catalog: apps/web/data/skills/catalog.json`);
  console.log(`manifest total: ${manifest.total} (remote ${catalog.length}, authored ${authored.length})`);
  if (manifest.total < 200) {
    console.warn(`WARNING: total ${manifest.total} < 200 — add more authored skills under apps/web/data/skills/authored/`);
    process.exitCode = 1;
  }
}

function firstParagraph(body) {
  const text = String(body || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 280);
}

main().catch((e) => {
  console.error("sync failed:", e);
  process.exit(1);
});