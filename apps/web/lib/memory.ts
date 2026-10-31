/**
 * woibot Memory — ML-backed long-term memory subsystem (objective 13).
 *
 * - Storage: `memory` collection through lib/db (Postgres in prod, JSON store in dev).
 * - Vectors: BGE-M3 through lib/embeddings. The embed service may be unreachable
 *   (e.g. local dev) — every vector use is best-effort with a lexical fallback,
 *   so memory recall/writes can never hang or break a chat/task flow.
 * - Summaries: Together AI DeepSeek via lib/llm (never OpenAI/Anthropic).
 *
 * Contract: none of the exported functions throw; every result reports ok/error
 * so callers may fire-and-forget with `.catch(() => {})`.
 */

import { prisma } from "./db";
import { embedTexts, cosine } from "./embeddings";
import { callWoibotLLM } from "./llm";

/* ------------------------------------------------------------------ */
/* Tunables                                                            */
/* ------------------------------------------------------------------ */

const RECALL_LATEST = 6; // (a) newest memories always included
const RECALL_TOP_K = 5; // (b) semantic hits merged on top
const RECALL_LIMIT = 10; // merged cap
const SEMANTIC_MIN_SCORE = 0.3; // drop junk vector matches
const DEDUPE_SIMILARITY = 0.94; // near-identical embedding => same memory
const CANDIDATE_SCAN = 200; // max rows scanned for scoring/dedupe
const EMBED_BATCH = 64; // max texts embedded per call
const VECTOR_CACHE_MAX = 3000; // in-process vector cache cap
const SEMANTIC_BUDGET_MS = 3000; // soft deadline for the semantic pass

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function normalizeText(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:"'`“”‘’。、！？：；()[\]{}]/g, "")
    .trim();
}

function sanitizeKey(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

/** Cheap credential guard: never persist obvious secrets into Memory. */
function looksLikeSecret(v: string): boolean {
  return /(api[\s_-]?key|secret|password|passwd|รหัสผ่าน|bearer\s|sk-[a-z0-9]{8}|tgp_v1_)/i.test(v) || /\b[A-Za-z0-9_-]{32,}\b/.test(v);
}

/**
 * In-process vector cache keyed "<memoryId>|<updatedAt>" so row edits
 * invalidate entries. Survives across requests within one server instance;
 * durable copies also live on memory.embedding (written by rememberFact and
 * by /api/memories/search). recallContext itself never writes rows.
 */
const g = globalThis as unknown as { __woibotMemVecs?: Map<string, number[]> };
function vecCache(): Map<string, number[]> {
  if (!g.__woibotMemVecs) g.__woibotMemVecs = new Map();
  const c = g.__woibotMemVecs;
  if (c.size > VECTOR_CACHE_MAX) c.clear(); // cheap reset, cache rebuilds on demand
  return c;
}

function parseVec(raw: unknown): number[] | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) && v.length > 0 ? (v as number[]) : null;
  } catch {
    return null;
  }
}

function vecCacheKey(m: { id?: string; updatedAt?: string; createdAt?: string }): string {
  return `${m.id}|${m.updatedAt || m.createdAt || ""}`;
}

/** Vector for a memory row: in-process cache first, then the row's durable copy. */
function rowVec(m: any): number[] | null {
  const key = vecCacheKey(m);
  const cached = vecCache().get(key);
  if (cached) return cached;
  const fromRow = parseVec(m.embedding);
  if (fromRow) vecCache().set(key, fromRow);
  return fromRow;
}

/** Race a promise against a soft deadline; fall back instead of hanging. */
function withBudget<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/* ------------------------------------------------------------------ */
/* 1) rememberFact — dedupe write                                      */
/* ------------------------------------------------------------------ */

export type RememberFactInput = {
  key: string;
  value: string;
  /** "explicit" | "voice" | "auto-summary" | "inferred" | ... */
  source?: string;
  /** "personal" | "team" | "summary" */
  scope?: string;
};

export type RememberFactResult = { ok: boolean; id?: string; deduped?: boolean; error?: string };

/**
 * Store one durable memory with dedupe: when an existing memory carries a very
 * similar value (same normalized tail of 60 chars, or a near-identical BGE-M3
 * embedding when the embed service is reachable), that row's value/updatedAt is
 * refreshed instead of creating a duplicate.
 */
export async function rememberFact(userId: string, input: RememberFactInput): Promise<RememberFactResult> {
  try {
    const value = String(input?.value ?? "").replace(/\s+/g, " ").trim().slice(0, 1000);
    if (!value) return { ok: false, error: "empty_value" };
    const key = sanitizeKey(input?.key) || `fact_${Date.now().toString(36)}`;
    const scope = String(input?.scope || "personal");
    const source = String(input?.source || "explicit");

    const norm = normalizeText(value);
    const tail = norm.slice(-60);

    // Best-effort vector for the new value; lexical dedupe still works without it.
    let newVec: number[] | null = null;
    try {
      const vecs = await embedTexts([`${key}: ${value}`]);
      newVec = vecs[0] ?? null;
    } catch {
      newVec = null; // embed service unavailable (e.g. local dev)
    }

    const candidates = await prisma.memory.findMany({ where: { userId }, take: CANDIDATE_SCAN });

    let dup: any = null;
    for (const m of candidates) {
      const mNorm = normalizeText(m.value);
      if (mNorm && (mNorm === norm || (tail.length >= 20 && mNorm.slice(-60) === tail))) {
        dup = m;
        break;
      }
    }
    if (!dup && newVec) {
      for (const m of candidates) {
        const vec = rowVec(m);
        if (vec && vec.length === newVec.length && cosine(newVec, vec) >= DEDUPE_SIMILARITY) {
          dup = m;
          break;
        }
      }
    }

    if (dup) {
      const data: Record<string, unknown> = { value, updatedAt: new Date().toISOString() };
      if (newVec) data.embedding = JSON.stringify(newVec);
      const updated = await prisma.memory.update({ where: { id: dup.id }, data }).catch(() => null);
      return { ok: true, id: (updated as any)?.id || dup.id, deduped: true };
    }

    const created = await prisma.memory.create({
      data: {
        userId,
        key,
        value,
        scope,
        source,
        canDelete: true,
        ...(newVec ? { embedding: JSON.stringify(newVec) } : {}),
      },
    });
    return { ok: true, id: (created as any)?.id, deduped: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ------------------------------------------------------------------ */
/* 2) recallContext — hybrid (recency + semantic) snippet for prompts  */
/* ------------------------------------------------------------------ */

export type RecallOptions = {
  /** newest memories always included (default 6) */
  latest?: number;
  /** semantic hits merged on top (default 5) */
  topK?: number;
  /** merged cap (default 10) */
  limit?: number;
  /** minimum cosine score for semantic hits (default 0.3) */
  minScore?: number;
};

/**
 * Hybrid recall for prompts: newest N memories + BGE-M3 semantic top-k over
 * memory values, merged and deduped by id (capped). Returns a ready-to-paste
 * snippet — one memory per line as "key: value" — or "" when there is nothing.
 * Never throws; the semantic pass is skipped whenever the embed service is
 * unreachable or exceeds a soft 3s budget (recency recall always answers).
 */
export async function recallContext(userId: string, query: string, opts?: RecallOptions): Promise<string> {
  try {
    const latest = Math.max(0, opts?.latest ?? RECALL_LATEST);
    const topK = Math.max(0, opts?.topK ?? RECALL_TOP_K);
    const limit = Math.max(1, opts?.limit ?? RECALL_LIMIT);
    const minScore = opts?.minScore ?? SEMANTIC_MIN_SCORE;

    const picked = new Map<string, any>();
    const push = (m: any) => {
      if (m?.id && !picked.has(m.id) && String(m?.value ?? "").trim()) picked.set(m.id, m);
    };

    // (a) recency — always available, even without the embed service
    if (latest > 0) {
      const rows = await prisma.memory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: latest });
      rows.forEach(push);
    }

    // (b) semantic — BGE-M3 top-k; silently skipped when the service is down
    const q = String(query ?? "").trim();
    if (topK > 0 && q) {
      const semantic = (async (): Promise<any[]> => {
        const qvecs = await embedTexts([q]);
        const queryVec = qvecs[0] ?? null;
        if (!queryVec) return [];

        const rows = await prisma.memory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: CANDIDATE_SCAN });

        // warm the in-process cache from durable row copies, find the rest
        const missing: any[] = [];
        for (const m of rows) {
          if (!rowVec(m)) missing.push(m);
        }
        if (missing.length) {
          try {
            const vecs = await embedTexts(missing.slice(0, EMBED_BATCH).map((m) => `${m.key}: ${m.value}`));
            for (let i = 0; i < missing.length && i < vecs.length; i++) {
              if (vecs[i]) vecCache().set(vecCacheKey(missing[i]), vecs[i]);
            }
          } catch {
            /* corpus embedding failed — score whatever is already cached */
          }
        }

        return rows
          .map((m: any) => {
            const vec = rowVec(m);
            return { m, score: vec && vec.length === queryVec.length ? cosine(queryVec, vec) : 0 };
          })
          .filter((s) => s.score >= minScore)
          .sort((a, b) => b.score - a.score)
          .slice(0, topK)
          .map((s) => s.m);
      })();

      const hits = await withBudget(semantic, SEMANTIC_BUDGET_MS, [] as any[]).catch(() => [] as any[]);
      hits.forEach(push);
    }

    if (!picked.size) return "";
    return [...picked.values()]
      .slice(0, limit)
      .map((m: any) => {
        const k = sanitizeKey(m.key) || String(m.key || "fact").trim().replace(/\s+/g, "_");
        return `${k}: ${String(m.value).replace(/\s+/g, " ").trim().slice(0, 300)}`;
      })
      .join("\n");
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* 3) summarizeAndStore — DeepSeek compression of a chat segment       */
/* ------------------------------------------------------------------ */

type ExtractedFact = { key: string; value: string };

function parseFacts(raw: string): ExtractedFact[] | null {
  if (!raw) return null;
  const toFact = (k: unknown, v: unknown): ExtractedFact | null => {
    const key = sanitizeKey(String(k ?? ""));
    const value = String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
    return key && value && !looksLikeSecret(value) ? { key, value } : null;
  };

  let text = String(raw).trim().replace(/^```(?:json)?/i, "").replace(/```\s*$/g, "").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end > start) text = text.slice(start, end + 1);

  try {
    const parsed = JSON.parse(text);
    const arr: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.facts)
        ? parsed.facts
        : Array.isArray(parsed?.memories)
          ? parsed.memories
          : [];
    const facts = arr.map((it: any) => toFact(it?.key, it?.value)).filter(Boolean) as ExtractedFact[];
    return facts.length ? facts : null;
  } catch {
    // fallback: plain "key: value" lines
    const facts = String(raw)
      .split(/\n+/)
      .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
      .map((line) => {
        const idx = line.indexOf(":");
        return idx > 0 ? toFact(line.slice(0, idx), line.slice(idx + 1)) : null;
      })
      .filter(Boolean) as ExtractedFact[];
    return facts.length ? facts : null;
  }
}

/** DeepSeek (Together) extraction: compress a snippet into 1-2 durable facts. null on any failure. */
async function llmExtractFacts(snippet: string, trigger: string): Promise<ExtractedFact[] | null> {
  try {
    const text = String(snippet || "").trim().slice(0, 6000);
    if (text.length < 40) return null; // too short to hold a durable fact
    const res = await callWoibotLLM({
      role: "general",
      json: true,
      maxTokens: 3000, // DeepSeek on Together returns empty content with small budgets
      temperature: 0.2,
      system:
        "You are the long-term memory subsystem of woibot.com. Extract durable, reusable facts about the user " +
        "(preferences, decisions, deadlines, ongoing work, client relationships) from the conversation segment. " +
        'Respond ONLY with a JSON array, max 2 items, each {"key":"english_snake_case","value":"..."}. ' +
        "Write each value in Thai, max 200 characters. Never store API keys, passwords, tokens or card numbers.",
      user:
        `Conversation segment (trigger=${trigger}):\n"""\n${text}\n"""\n\n` +
        'Return only a JSON array like [{"key":"client_acme_sla","value":"..."}]. No prose, no markdown fences.',
    });
    return parseFacts(res.text);
  } catch {
    return null;
  }
}

/**
 * Compress a chat segment into 1-2 durable facts (Thai, key:value) via DeepSeek
 * and store them with source "auto-summary". Fully resilient: catches all and
 * never breaks the chat flow.
 */
export async function summarizeAndStore(
  userId: string,
  conversationSnippet: string,
  trigger: string = "chat",
): Promise<{ ok: boolean; stored?: number; error?: string }> {
  try {
    const facts = await llmExtractFacts(conversationSnippet, trigger);
    if (!facts || !facts.length) return { ok: false, error: "no_facts_extracted" };
    let stored = 0;
    for (const f of facts) {
      const r = await rememberFact(userId, { key: f.key, value: f.value, source: "auto-summary", scope: "personal" });
      if (r.ok) stored += 1;
    }
    return { ok: stored > 0, stored };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ------------------------------------------------------------------ */
/* 4) consolidateIfNeeded — compress old memories into one summary     */
/* ------------------------------------------------------------------ */

/**
 * When a user holds more than `threshold` (default 60) memories, compress the
 * oldest `compressCount` (default 40) into ONE summary memory (id `sum_<ts>`,
 * scope "summary") through the same DeepSeek extraction path used by
 * summarizeAndStore. The originals are deleted only after the summary row is
 * durable. Safe to call fire-and-forget — never throws.
 */
export async function consolidateIfNeeded(
  userId: string,
  opts?: { threshold?: number; compressCount?: number },
): Promise<{ ok: boolean; skipped?: boolean; compressed?: number; summaryId?: string; error?: string }> {
  try {
    const threshold = Math.max(10, opts?.threshold ?? 60);
    const compressCount = Math.max(5, opts?.compressCount ?? 40);

    const count = await prisma.memory.count({ where: { userId } });
    if (count <= threshold) return { ok: true, skipped: true, compressed: 0 };

    const oldest = await prisma.memory.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, take: compressCount });
    if (oldest.length < 5) return { ok: true, skipped: true, compressed: 0 };

    const digest = oldest.map((m: any) => `${m.key}: ${m.value}`).join("\n").slice(0, 6000);
    const facts = await llmExtractFacts(digest, "consolidation");
    if (!facts || !facts.length) return { ok: false, error: "summarize_failed" };

    const summaryValue = facts.map((f) => `${f.key}: ${f.value}`).join(" | ").slice(0, 1000);
    const summaryId = `sum_${Date.now().toString(36)}`;
    await prisma.memory.create({
      data: {
        id: summaryId,
        userId,
        key: "memory_summary",
        value: summaryValue,
        scope: "summary",
        source: "auto-summary",
        canDelete: true,
        createdAt: new Date().toISOString(),
      },
    });

    // Only after the summary is durable, compress (delete) the originals.
    let deleted = 0;
    for (const m of oldest) {
      const gone = await prisma.memory.delete({ where: { id: m.id } }).catch(() => null);
      if (gone) deleted += 1;
    }
    return { ok: true, compressed: deleted, summaryId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}