/**
 * Skill auto-selection.
 *
 * Given a task goal, rank the skill catalog and return the top-k skills.
 *
 * Primary path: semantic similarity through the embedding service
 * (lib/embeddings — BGE-M3). That service is only reachable when the deploy
 * environment can mint a GCP identity token, so every failure (no network, no
 * token, timeout, shape mismatch) falls back to a deterministic keyword
 * scorer: token overlap against name/description/instructions, plus tag and
 * name-phrase matching, with a small Thai-phrase → concept map because goals
 * on this platform are often Thai.
 *
 * Nothing in here throws at callers: selection is best-effort.
 */
import { cosine, embedTexts } from "../embeddings";
import { listSkills } from "./loader";
import type { SelectedSkill, SkillRecord } from "./types";

const DEFAULT_K = 3;
/** One-shot embedding timeout; past this we prefer the instant keyword path. */
const EMBED_TIMEOUT_MS = 10_000;
/** Scores at or below this are noise; better to return fewer skills. */
const MIN_SCORE = 0.05;
/** Shared text the semantic path embeds per skill. */
const SKILL_EMBED_CHARS = 700;

/** Per-process embedding cache so repeated selections cost one goal vector. */
const embedCache = new Map<string, number[]>();

export async function selectSkills(goal: string, k: number = DEFAULT_K): Promise<SelectedSkill[]> {
  const trimmed = String(goal || "").trim();
  if (!trimmed) return [];
  const skills = await listSkills();
  if (!skills.length) return [];

  const keyword = skills.map((s) => ({ skill: s, kw: keywordScore(trimmed, s) }));

  let semantic: Map<string, number> | null = null;
  try {
    semantic = await semanticScores(trimmed, skills);
  } catch {
    semantic = null;
  }

  const scored: SelectedSkill[] = keyword.map(({ skill, kw }) => {
    if (semantic) {
      const sem = Math.max(0, semantic.get(skill.id) ?? 0);
      // Blend: embeddings carry most of the signal, keywords keep it grounded.
      return { skill, score: round3(clamp01(0.7 * sem + 0.3 * kw)), matchedBy: "semantic" as const };
    }
    return { skill, score: round3(clamp01(kw)), matchedBy: "keyword" as const };
  });

  scored.sort((a, b) => b.score - a.score || a.skill.id.localeCompare(b.skill.id));
  const top = scored.filter((s) => s.score > MIN_SCORE).slice(0, Math.max(0, k));
  return top;
}

/* ------------------------------------------------------------ semantic path */

async function semanticScores(goal: string, skills: SkillRecord[]): Promise<Map<string, number> | null> {
  const missing = skills.filter((s) => !embedCache.has(s.id));
  let goalVec: number[] | undefined;

  if (missing.length) {
    const texts = [goal, ...missing.map(skillEmbedText)];
    const vectors = await embedWithTimeout(texts);
    if (!vectors || vectors.length !== texts.length) return null;
    goalVec = vectors[0];
    for (let i = 0; i < missing.length; i++) embedCache.set(missing[i].id, vectors[i + 1]);
  } else {
    const onlyGoal = await embedWithTimeout([goal]);
    if (!onlyGoal || onlyGoal.length !== 1) return null;
    goalVec = onlyGoal[0];
  }
  if (!goalVec) return null;

  const scores = new Map<string, number>();
  for (const s of skills) {
    const v = embedCache.get(s.id);
    if (v) scores.set(s.id, cosine(goalVec, v));
  }
  return scores;
}

function skillEmbedText(s: SkillRecord): string {
  return `${s.name}. ${s.description} Tags: ${s.tags.join(", ")}. ${s.instructions.slice(0, SKILL_EMBED_CHARS)}`;
}

async function embedWithTimeout(texts: string[]): Promise<number[][] | null> {
  try {
    const result = await Promise.race([
      embedTexts(texts),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("skill_embed_timeout")), EMBED_TIMEOUT_MS),
      ),
    ]);
    return result as number[][];
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------- keyword path */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "for", "in", "on", "with", "is", "are", "be", "by",
  "at", "as", "it", "this", "that", "from", "we", "you", "i", "my", "our", "their", "your", "me",
  "how", "what", "when", "do", "does", "can", "need", "want", "make", "please", "help", "using",
  "create", "build", "write", "give", "let", "us", "about", "into", "over", "up",
]);

/** Thai task phrases often carry the intent; map common ones to concept words
 *  that appear in skill tags and descriptions (Thai-first platform). */
const TH_TERMS: Array<[RegExp, string]> = [
  [/รายงาน|สรุปเนื้อหา|brief/, "report"],
  [/วิเคราะห์|เจาะลึก/, "analysis"],
  [/เอกสาร|หนังสือ|จดหมาย/, "document"],
  [/สไลด์|นำเสนอ|พรีเซ็น|งานเสนอ/, "presentation"],
  [/แปล|พากย์|ซับ/, "translation"],
  [/โฆษณา|การตลาด|แคมเปญ|โซเชียล|คอนเทนต์/, "marketing"],
  [/ขาย|ลูกค้า|ปิดการขาย|ยอดขาย/, "sales"],
  [/การเงิน|บัญชี|งบประมาณ|รายได้|ต้นทุน/, "finance"],
  [/สัญญา|กฎหมาย|ข้อกฎหมาย|เงื่อนไข/, "legal"],
  [/โค้ด|เขียนโปรแกรม|แอป|เว็บไซต์|เว็บแอป|ระบบ|หน้าเว็บ/, "coding"],
  [/ข้อมูล|ฐานข้อมูล|สถิติ/, "data"],
  [/ความปลอดภัย|แฮ็ก|ไวรัส|ข้อมูลส่วนตัว/, "security"],
  [/แผน|วางแผน|กำหนดการ|โครงการ/, "planning"],
  [/สอน|เรียน|อบรม|หลักสูตร|แบบทดสอบ|quiz/, "education"],
  [/ออกแบบ|โลโก้|โปสเตอร์|กราฟิก|แบรนด์/, "design"],
  [/ทดสอบ|ตรวจสอบ|qa|ปรับปรุงคุณภาพ/, "testing"],
  [/ดูแลลูกค้า|ซัพพอร์ต|เคลม|ร้องเรียน/, "support"],
  [/สรรหา|สัมภาษณ์|พนักงาน|บุคลากร|ทีมงาน/, "hr"],
  [/ค้นคว้า|วิจัย|ค้นหาข้อมูล|ตลาด/, "research"],
];

function tokenize(text: string): string[] {
  return String(text)
    .toLowerCase()
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.replace(/['’].*$/, ""))
    .filter((t) => t.length >= 2 && t.length < 40 && !STOPWORDS.has(t));
}

/** Set lookup tolerant to singular/plural ("document" ↔ "documents"). */
function hasTerm(set: Set<string>, term: string): boolean {
  if (set.has(term)) return true;
  if (term.endsWith("s") && set.has(term.slice(0, -1))) return true;
  if (term.endsWith("ies") && set.has(`${term.slice(0, -3)}y`)) return true;
  return set.has(`${term}s`) || set.has(`${term}es`);
}

function keywordScore(goal: string, skill: SkillRecord): number {
  const goalTokens = new Set(tokenize(goal));
  for (const [re, term] of TH_TERMS) if (re.test(goal)) goalTokens.add(term);
  if (!goalTokens.size) return 0;

  const nameTokens = new Set(tokenize(skill.name));
  const descTokens = new Set(tokenize(skill.description));
  const tagSet = new Set(skill.tags.map((t) => t.toLowerCase()));
  const instTokens = new Set(tokenize(skill.instructions.slice(0, 1500)));

  let score = 0;
  for (const t of goalTokens) {
    if (hasTerm(tagSet, t)) score += 2.5;
    if (hasTerm(nameTokens, t)) score += 3;
    if (hasTerm(descTokens, t)) score += 1;
    else if (hasTerm(instTokens, t)) score += 0.3;
  }

  // Multi-word phrase bonus: "market research" appearing in the name.
  const goalWords = tokenize(goal);
  const nameLower = skill.name.toLowerCase();
  for (let i = 0; i + 1 < goalWords.length; i++) {
    const bigram = `${goalWords[i]} ${goalWords[i + 1]}`;
    if (bigram.length >= 6 && nameLower.includes(bigram)) score += 4;
  }

  return score / (goalTokens.size * 2.5 + 4);
}

/* -------------------------------------------------------------- rendering */

/** Render selected skills as a compact prompt section for LLM briefs. */
export function skillPromptBlock(selected: SelectedSkill[]): string {
  const usable = (selected || []).filter((s) => s?.skill?.instructions);
  if (!usable.length) return "";

  const parts = usable.map(({ skill }) => {
    const head = `### ${skill.name}\n${skill.description}`;
    return `${head}\n\n${compactInstructions(skill.instructions)}`;
  });

  return [
    "## Selected skills",
    "",
    "Apply these curated playbooks where they fit the goal. They are guidance for quality, not extra requirements — skip anything that does not apply:",
    "",
    parts.join("\n\n\n"),
  ].join("\n");
}

function compactInstructions(instructions: string, max = 1200): string {
  const text = String(instructions)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const nl = cut.lastIndexOf("\n");
  return `${(nl > max * 0.5 ? cut.slice(0, nl) : cut).trimEnd()}\n…`;
}

/* ----------------------------------------------------------------- helpers */

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}