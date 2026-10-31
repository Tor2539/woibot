/**
 * Web search — Parallel API (Fast).
 * Returns real result URLs + excerpts; callers must cite what they use.
 */
const PARALLEL_URL = "https://api.parallel.ai/v1beta/search";
const PARALLEL_KEY = process.env.PARALLEL_API_KEY || "";

export type SearchHit = { url: string; title: string; excerpt: string };

export async function parallelSearch(objective: string, queries?: string[], maxResults = 6): Promise<SearchHit[]> {
  if (PARALLEL_KEY.length < 10) throw new Error("PARALLEL_API_KEY is not configured");

  const res = await fetch(PARALLEL_URL, {
    method: "POST",
    headers: {
      "x-api-key": PARALLEL_KEY,
      "Content-Type": "application/json",
      "User-Agent": "woibot/1.0 (+https://woibot.com)",
    },
    body: JSON.stringify({
      objective: objective.slice(0, 400),
      search_queries: (queries && queries.length ? queries : [objective.slice(0, 120)]).slice(0, 4),
      max_results: Math.min(Math.max(maxResults, 1), 20),
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`parallel_${res.status}: ${detail.slice(0, 300)}`);
  }

  const data: any = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map((r: any) => ({
    url: String(r.url || ""),
    title: String(r.title || r.url || ""),
    excerpt: (Array.isArray(r.excerpts) ? r.excerpts.join(" ") : String(r.excerpt || "")).slice(0, 1200),
  })).filter((h: SearchHit) => h.url.startsWith("http"));
}
