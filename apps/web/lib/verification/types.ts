export type CheckSeverity = "critical" | "warning" | "info";

export type Check = {
  name: string;
  passed: boolean;
  detail: string;
  evidenceUrl?: string;
  durationMs?: number;
  severity?: CheckSeverity;
};

export type VerificationMode = "live" | "simulated" | "unavailable";

export type VerificationReport = {
  taskId: string;
  type: "coding" | "doc" | "video" | "research" | "data";
  mode: VerificationMode;
  passed: boolean;
  checks: Check[];
  summary: string;
  limitations?: string[];
  createdAt: string;
  durationMs?: number;
  artifacts?: { name: string; url: string; mimeType: string }[];
};
