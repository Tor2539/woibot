/**
 * BGE-M3 embeddings via our own Cloud Run service (services/embed).
 *
 * Inside Cloud Run we mint an identity token from the metadata server, so the
 * service stays private. Locally we fall back to EMBED_URL (if it is public).
 */
const EMBED_URL = process.env.EMBED_URL || "https://woibot-embed-578962358378.asia-southeast1.run.app";

let cachedToken: { value: string; exp: number } | null = null;

async function identityToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && cachedToken.exp > now + 60_000) return cachedToken.value;
  try {
    const res = await fetch(
      `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(EMBED_URL)}&format=full`,
      { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const tok = (await res.text()).trim();
    if (!tok) return null;
    cachedToken = { value: tok, exp: now + 45 * 60_000 };
    return tok;
  } catch {
    return null;
  }
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const clean = texts.map((t) => String(t || "").slice(0, 4000)).filter((t) => t.trim().length > 0);
  if (!clean.length) return [];

  const tok = await identityToken();
  const res = await fetch(`${EMBED_URL}/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      "User-Agent": "woibot/1.0 (+https://woibot.com)",
    },
    body: JSON.stringify({ texts: clean }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`embed_${res.status}: ${detail.slice(0, 200)}`);
  }
  const data: any = await res.json();
  const vectors = data?.vectors || data?.embeddings || [];
  if (!Array.isArray(vectors) || !vectors.length) throw new Error("embed_empty");
  return vectors as number[][];
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function embedHealth() {
  try {
    const tok = await identityToken();
    const res = await fetch(`${EMBED_URL}/health`, {
      headers: { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), "User-Agent": "woibot/1.0" },
      signal: AbortSignal.timeout(20000),
    });
    return { ok: res.ok, status: res.status, body: await res.text() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
