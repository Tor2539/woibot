import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { embedTexts, cosine } from "@/lib/embeddings";

/**
 * GET /api/memories/search?q=...&k=5
 * Semantic recall over the user's memories with BGE-M3 vectors.
 * Vectors are cached on the memory row; missing ones are embedded on demand.
 */
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const k = Math.min(Number(req.nextUrl.searchParams.get("k") || 5), 20);
  if (!q) return NextResponse.json({ ok: false, error: "q is required" }, { status: 400 });

  const memories = await prisma.memory.findMany({ where: { userId }, take: 200 });
  if (!memories.length) return NextResponse.json({ ok: true, query: q, results: [], note: "no_memories" });

  let queryVec: number[];
  try {
    [queryVec] = await embedTexts([q]);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "embed_failed" }, { status: 502 });
  }

  const missing = memories.filter((m: any) => !m.embedding);
  if (missing.length) {
    try {
      const vecs = await embedTexts(missing.map((m: any) => `${m.key}: ${m.value}`));
      for (let i = 0; i < missing.length && i < vecs.length; i++) {
        await prisma.memory.update({ where: { id: missing[i].id }, data: { embedding: JSON.stringify(vecs[i]) } }).catch(() => {});
      }
    } catch {
      // embedding the corpus failed; still answer with whatever we have
    }
  }

  const scored = memories
    .map((m: any) => {
      let vec: number[] | null = null;
      try { vec = m.embedding ? JSON.parse(m.embedding) : null; } catch { vec = null; }
      return { memory: m, score: vec ? cosine(queryVec, vec) : 0 };
    })
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, k);

  return NextResponse.json({
    ok: true,
    query: q,
    model: "bge-m3",
    results: scored.map((s: any) => ({
      id: s.memory.id,
      key: s.memory.key,
      value: s.memory.value,
      scope: s.memory.scope,
      score: Number(s.score.toFixed(4)),
    })),
  });
}
