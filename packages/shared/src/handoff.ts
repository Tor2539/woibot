export type HandoffPacket = {
  goal: string;
  context: {
    chat_history: { role: string; content: string }[];
    memory_snippet: string;
    user_prefs: Record<string, unknown>;
  };
  attachments: { fileUrl: string; fileName: string; mimeType: string }[];
  deliverables: string[];
  constraints: { deadline?: string; budget?: number; must_not_leak?: string[] };
  verification_criteria: string[];
  execution_mode: "cloud" | "local";
  trace_id: string;
};

export const INTENT_ROUTER_PROMPT = `
Classify user intent into teammate vs work:
- teammate: daily Q&A, email summary, calendar, quick lookup, routine
- work: build app, generate video, create 10+ page doc, deep research, data analysis, cross-app workflow
Return {product: "teammate"|"work", workKind?, confidence, reason}
`;
