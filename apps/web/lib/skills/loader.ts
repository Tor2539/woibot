/**
 * Skill catalog loader.
 *
 * Reads data/skills/catalog.json + manifest.json from disk at runtime and
 * caches per process (short TTL so a re-synced catalog is picked up without a
 * restart). All failures degrade to an empty catalog — skills are an
 * enhancement and must never break task execution.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SkillManifest, SkillRecord } from "./types";

const TTL_MS = 5 * 60 * 1000;

type Loaded = { skills: SkillRecord[]; manifest: SkillManifest | null; at: number };

let cache: Loaded | null = null;
let inflight: Promise<Loaded> | null = null;

/** Places the catalog may live, depending on cwd (apps/web, repo root, or a
 *  packaged runtime). */
function candidateDirs(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "data", "skills"),
    path.join(cwd, "apps", "web", "data", "skills"),
    path.join(cwd, "..", "data", "skills"),
  ];
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function normalizeSkill(x: unknown): SkillRecord | null {
  if (!x || typeof x !== "object") return null;
  const rec = x as Record<string, unknown>;
  const { id, name, instructions } = rec;
  if (typeof id !== "string" || !id) return null;
  if (typeof name !== "string" || !name) return null;
  if (typeof instructions !== "string" || instructions.length < 200) return null;
  return {
    id,
    name,
    description: typeof rec.description === "string" ? rec.description : "",
    tags: Array.isArray(rec.tags) ? rec.tags.filter((t): t is string => typeof t === "string") : [],
    instructions,
    source: typeof rec.source === "string" ? rec.source : "unknown",
    license: typeof rec.license === "string" ? rec.license : "unknown",
  };
}

async function loadOnce(): Promise<Loaded> {
  for (const dir of candidateDirs()) {
    const catalog = await readJson<unknown[]>(path.join(dir, "catalog.json"));
    if (Array.isArray(catalog) && catalog.length) {
      const skills = catalog
        .map(normalizeSkill)
        .filter((s): s is SkillRecord => s !== null);
      const manifest = await readJson<SkillManifest>(path.join(dir, "manifest.json"));
      return { skills, manifest, at: Date.now() };
    }
  }
  return { skills: [], manifest: null, at: Date.now() };
}

async function load(): Promise<Loaded> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  if (!inflight) {
    inflight = loadOnce()
      .then((loaded) => {
        cache = loaded;
        return loaded;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** All catalog skills (empty when the catalog is missing/unreadable). */
export async function listSkills(): Promise<SkillRecord[]> {
  return (await load()).skills;
}

/** Manifest metadata, or null when unavailable. */
export async function skillManifest(): Promise<SkillManifest | null> {
  return (await load()).manifest;
}

/** Drop the cached catalog; the next read reloads from disk. */
export function resetSkillCache(): void {
  cache = null;
  inflight = null;
}