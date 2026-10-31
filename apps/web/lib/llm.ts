/**
 * LLM router — Together AI only.
 *
 * Policy (set by the product owner):
 *   - general work  → deepseek-ai/DeepSeek-V4.1-Flash-1017
 *   - coding work   → zai-org/GLM-5.3-Flash
 *   - images        → same DeepSeek model, images attached as data URLs
 * No OpenAI, no Anthropic, no fallback to them.
 */

const TOGETHER_URL = "https://api.together.xyz/v1/chat/completions";
const TOGETHER_KEY = process.env.TOGETHER_API_KEY || "";

export const MODELS = {
  general: process.env.WOIBOT_MODEL_GENERAL || "deepseek-ai/DeepSeek-V4.1-Flash-1017",
  code: process.env.WOIBOT_MODEL_CODE || "zai-org/GLM-5.3-Flash",
} as const;

export type ModelRole = keyof typeof MODELS;

export type ImageInput = { dataUrl: string; detail?: "low" | "high" | "auto" };

export type LLMCall = {
  system: string;
  user: string;
  maxTokens?: number;
  role?: ModelRole;
  images?: ImageInput[];
  temperature?: number;
  json?: boolean;
};

export type LLMResult = { text: string; provider: "together"; model: string; ms: number };

function keyPresent() {
  return TOGETHER_KEY.length > 20;
}

export async function callWoibotLLM(call: LLMCall): Promise<LLMResult> {
  if (!keyPresent()) throw new Error("TOGETHER_API_KEY is not configured");

  const model = MODELS[call.role || "general"];
  const started = Date.now();

  const content: any[] = [{ type: "text", text: call.user }];
  for (const img of call.images || []) {
    content.push({ type: "image_url", image_url: { url: img.dataUrl, detail: img.detail || "auto" } });
  }

  const body: Record<string, unknown> = {
    model,
    messages: [
      ...(call.system ? [{ role: "system", content: call.system }] : []),
      { role: "user", content: call.images?.length ? content : call.user },
    ],
    max_tokens: call.maxTokens ?? 1600,
    temperature: call.temperature ?? 0.4,
  };
  if (call.json) body.response_format = { type: "json_object" };

  const res = await fetch(TOGETHER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOGETHER_KEY}`,
      "Content-Type": "application/json",
      // Together's edge rejects non-browser user agents with error 1010
      "User-Agent": "woibot/1.0 (+https://woibot.com)",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`together_${res.status}: ${detail.slice(0, 300)}`);
  }

  const data: any = await res.json();
  const msg = data?.choices?.[0]?.message || {};
  const text = String(msg.content ?? "").trim() || String(msg.reasoning_content ?? "").trim();

  return { text, provider: "together", model, ms: Date.now() - started };
}

/** Convenience for code generation / refactoring. */
export function callCodeLLM(call: Omit<LLMCall, "role">) {
  return callWoibotLLM({ ...call, role: "code" });
}
