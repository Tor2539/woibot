/**
 * Skill types shared by the loader, selector and harness.
 *
 * A SkillRecord is one normalized catalog entry (see scripts/sync-skills.mjs):
 * genuinely written instructions, either from permissively-licensed open
 * collections (with the source repo recorded) or original authored work.
 */

export type SkillRecord = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  /** Full markdown playbook body. */
  instructions: string;
  /** Provenance: source repo URL, or "woibot-authored" for original work. */
  source: string;
  license: string;
};

export type SelectedSkill = {
  skill: SkillRecord;
  /** Relevance score in ~0..1. */
  score: number;
  /** Which ranking path produced the score. */
  matchedBy: "semantic" | "keyword";
};

export type SkillManifestSource = {
  id: string;
  repo?: string;
  homepage?: string;
  license?: string;
  licenseVerified?: boolean;
  count: number;
  status?: string;
};

export type SkillManifest = {
  total: number;
  generatedAt: string;
  sources: SkillManifestSource[];
  authored?: { count: number; location: string; license: string };
  minInstructionsChars?: number;
  generator?: string;
};