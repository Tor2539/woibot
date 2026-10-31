/**
 * Multi-Teammate collaboration layer.
 *
 * Three capabilities, all scoped to a single userId:
 *  1. Bot groups ("rooms") — a teammate row flagged `isGroup` that references
 *     real teammate ids. Grouping never copies a bot, it points at it.
 *  2. Cross-bot delegation — one bot hands a task to another; the target bot
 *     answers under its own role/scope (role separation), never impersonating
 *     the sender.
 *  3. Shared memory — `scope: "team"` memory rows tagged with `groupId` and the
 *     contributing `teammateId`, so a rule is attributable to the bot that
 *     taught it while remaining readable by every bot in the group.
 *
 * Nothing here invents bots, groups or memories: every read comes from the
 * store, every write is validated against rows that already belong to the user.
 */
import { prisma } from "./db";
import { callWoibotLLM } from "./llm";
import { recordUsage } from "./billing";

type PersRow = Record<string, any>;

/** Error carrying an HTTP status so API routes can map failures faithfully. */
export class CollabError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CollabError";
    this.status = status;
  }
}

export interface TeammateLite {
  id: string;
  name: string;
  role: string;
  avatar: string;
  isMain: boolean;
  isGroup: boolean;
  statusText: string | null;
}

export interface SharedMemory {
  id: string;
  key: string;
  value: string;
  scope: string;
  groupId: string | null;
  fromTeammateId: string | null;
  fromName: string | null;
  updatedAt: string | null;
}

export interface CollabGroup {
  id: string;
  name: string;
  role: string;
  avatar: string;
  createdAt: string | null;
  memberIds: string[];
  members: TeammateLite[];
  memories: SharedMemory[];
}

export interface DelegateResult {
  reply: string;
  provider: string;
  from: TeammateLite;
  to: TeammateLite;
  messageId: string;
  replyMessageId: string;
  memoriesUsed: string[];
  createdAt: string;
}

export interface CreateGroupInput {
  name: string;
  memberIds: string[];
  tone?: string;
}

export interface ShareMemoryInput {
  groupId: string;
  fromTeammateId: string;
  key: string;
  value: string;
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined || raw === "") return fallback;
  if (typeof raw === "object") return raw as T;
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);
}

function initials(name: string): string {
  const clean = name.trim();
  if (!clean) return "??";
  return clean.slice(0, 2).toUpperCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

/** A row is a group if it says so at the top level or inside its persona blob. */
export function isGroupRow(row: PersRow | null | undefined): boolean {
  if (!row) return false;
  if (row.isGroup === true) return true;
  const persona = parseJson<Record<string, any>>(row.persona, {});
  return persona?.isGroup === true;
}

function toLite(row: PersRow): TeammateLite {
  const persona = parseJson<Record<string, any>>(row.persona, {});
  return {
    id: str(row.id),
    name: str(row.name) || "Teammate",
    role: str(row.role) || "Teammate",
    avatar: str(row.avatar) || initials(str(row.name)),
    isMain: row.isMain === true,
    isGroup: isGroupRow(row),
    statusText: typeof persona.statusText === "string" ? persona.statusText : null,
  };
}

function memberIdsOf(row: PersRow): string[] {
  const persona = parseJson<Record<string, any>>(row.persona, {});
  const raw = Array.isArray(row.memberIds) ? row.memberIds : Array.isArray(persona.memberIds) ? persona.memberIds : [];
  return raw.filter((v: unknown): v is string => typeof v === "string" && v.length > 0);
}

function toSharedMemory(row: PersRow, nameById: Map<string, string>): SharedMemory {
  return {
    id: str(row.id),
    key: str(row.key),
    value: str(row.value),
    scope: str(row.scope) || "team",
    groupId: row.groupId ? str(row.groupId) : null,
    fromTeammateId: row.teammateId ? str(row.teammateId) : null,
    fromName: row.teammateId ? nameById.get(str(row.teammateId)) || null : null,
    updatedAt: row.updatedAt ? str(row.updatedAt) : row.createdAt ? str(row.createdAt) : null,
  };
}

async function teammateRows(userId: string): Promise<PersRow[]> {
  const rows = await prisma.teammate.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return (rows || []) as PersRow[];
}

async function requireTeammate(userId: string, id: string, label = "Teammate"): Promise<PersRow> {
  if (!id) throw new CollabError(`${label} id is required`, 400);
  const row = await prisma.teammate.findFirst({ where: { id, userId } });
  if (!row) throw new CollabError(`${label} not found`, 404);
  return row as PersRow;
}

async function teamMemoryRows(userId: string): Promise<PersRow[]> {
  const rows = await prisma.memory.findMany({ where: { userId, scope: "team" }, orderBy: { updatedAt: "desc" } });
  return (rows || []) as PersRow[];
}

function buildGroup(row: PersRow, allById: Map<string, PersRow>, memories: PersRow[]): CollabGroup {
  const persona = parseJson<Record<string, any>>(row.persona, {});
  let memberIds = memberIdsOf(row);

  // Legacy rooms (seeded before groups existed) only carry member *names*.
  if (memberIds.length === 0 && Array.isArray(persona.members)) {
    const names = persona.members.filter((n: unknown) => typeof n === "string");
    memberIds = Array.from(allById.values())
      .filter((t) => names.includes(str(t.name)) && !isGroupRow(t))
      .map((t) => str(t.id));
  }

  const members = memberIds.map((id) => allById.get(id)).filter((t): t is PersRow => Boolean(t)).map(toLite);
  const nameById = new Map(Array.from(allById.values()).map((t) => [str(t.id), str(t.name)] as const));

  return {
    id: str(row.id),
    name: str(row.name) || "Bot Group",
    role: str(row.role) || `Group · ${members.length} bots`,
    avatar: str(row.avatar) || initials(str(row.name)),
    createdAt: row.createdAt ? str(row.createdAt) : null,
    memberIds: members.map((m) => m.id),
    members,
    memories: memories.filter((m) => str(m.groupId) === str(row.id)).map((m) => toSharedMemory(m, nameById)),
  };
}

/** Groups owned by the user, with resolved members and their shared rules. */
export async function listGroups(userId: string): Promise<CollabGroup[]> {
  const rows = await teammateRows(userId);
  const allById = new Map(rows.map((r) => [str(r.id), r] as const));
  const memories = await teamMemoryRows(userId);
  return rows.filter(isGroupRow).map((row) => buildGroup(row, allById, memories));
}

export async function createGroup(userId: string, input: CreateGroupInput): Promise<CollabGroup> {
  const name = str(input?.name).trim();
  if (!name) throw new CollabError("name is required", 400);
  if (name.length > 80) throw new CollabError("name must be 80 characters or fewer", 400);

  const requested = Array.from(new Set((input?.memberIds || []).filter((v): v is string => typeof v === "string" && v.length > 0)));
  if (requested.length === 0) throw new CollabError("memberIds must contain at least one teammate", 400);

  const rows = await teammateRows(userId);
  const byId = new Map(rows.map((r) => [str(r.id), r] as const));

  const members: PersRow[] = [];
  for (const id of requested) {
    const row = byId.get(id);
    if (!row) throw new CollabError(`Teammate not found: ${id}`, 404);
    if (isGroupRow(row)) throw new CollabError(`Cannot nest group "${str(row.name)}" inside a group`, 400);
    members.push(row);
  }

  const id = `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const created = await prisma.teammate.create({
    data: {
      id,
      userId,
      name,
      role: `Group · ${members.length} bots`,
      avatar: initials(name),
      isMain: false,
      isGroup: true,
      groupKind: "room",
      memberIds: members.map((m) => str(m.id)),
      language: members[0] ? str(members[0].language) || "th" : "th",
      persona: JSON.stringify({
        isGroup: true,
        memberIds: members.map((m) => str(m.id)),
        memberNames: members.map((m) => str(m.name)),
        tone: str(input?.tone) || "Coordinated multi-bot room",
        statusText: `${members.length} bots · ready`,
        statusKind: "idle",
        createdAt: nowIso(),
      }),
    },
  });

  const allRows = [...rows.filter((r) => str(r.id) !== str(created.id)), created as PersRow];
  const allById = new Map(allRows.map((r) => [str(r.id), r] as const));
  return buildGroup(created as PersRow, allById, await teamMemoryRows(userId));
}

/** Deletes a group row and the shared rules that belonged to it. */
export async function deleteGroup(userId: string, id: string): Promise<{ deleted: string; removedMemories: number }> {
  const row = await requireTeammate(userId, id, "Group");
  if (!isGroupRow(row)) throw new CollabError("Only group rooms can be deleted", 400);

  const memories = (await teamMemoryRows(userId)).filter((m) => str(m.groupId) === id);
  for (const memory of memories) {
    await prisma.memory.delete({ where: { id: str(memory.id) } });
  }
  await prisma.teammate.delete({ where: { id } });
  return { deleted: id, removedMemories: memories.length };
}

/**
 * Writes (or refreshes) a team-scope memory row inside a group.
 * The contributing bot is recorded so readers can see who set the rule.
 */
export async function shareMemory(userId: string, input: ShareMemoryInput): Promise<SharedMemory> {
  const groupId = str(input?.groupId).trim();
  const fromTeammateId = str(input?.fromTeammateId).trim();
  const key = str(input?.key).trim();
  const value = str(input?.value).trim();

  if (!groupId) throw new CollabError("groupId is required", 400);
  if (!key) throw new CollabError("key is required", 400);
  if (key.length > 64) throw new CollabError("key must be 64 characters or fewer", 400);
  if (!value) throw new CollabError("value is required", 400);
  if (value.length > 4000) throw new CollabError("value must be 4000 characters or fewer", 400);

  const group = await requireTeammate(userId, groupId, "Group");
  if (!isGroupRow(group)) throw new CollabError("groupId must reference a group room", 400);

  const memberIds = memberIdsOf(group);
  if (fromTeammateId && memberIds.length > 0 && !memberIds.includes(fromTeammateId)) {
    throw new CollabError("fromTeammateId is not a member of this group", 400);
  }

  let contributor: PersRow | null = null;
  if (fromTeammateId) {
    contributor = (await prisma.teammate.findFirst({ where: { id: fromTeammateId, userId } })) as PersRow | null;
    if (!contributor) throw new CollabError("fromTeammateId not found", 404);
    if (isGroupRow(contributor)) throw new CollabError("A group cannot contribute memory; pick a teammate", 400);
  }

  const metadata = JSON.stringify({
    groupId,
    groupName: str(group.name),
    fromTeammateId: fromTeammateId || null,
    fromName: contributor ? str(contributor.name) : null,
    fromRole: contributor ? str(contributor.role) : null,
    sharedAt: nowIso(),
  });

  const existing = await prisma.memory.findFirst({ where: { userId, scope: "team", groupId, key } });
  const payload = {
    userId,
    key,
    value,
    scope: "team",
    source: "explicit",
    canDelete: true,
    groupId,
    teammateId: fromTeammateId || null,
    metadata,
  };

  const saved = existing
    ? await prisma.memory.update({ where: { id: str(existing.id) }, data: payload })
    : await prisma.memory.create({ data: payload });

  const rows = await teammateRows(userId);
  const nameById = new Map(rows.map((r) => [str(r.id), str(r.name)] as const));
  return toSharedMemory(saved as PersRow, nameById);
}

/** Assigns an existing task to one teammate (the task owner must match). */
export async function assignTaskToTeammate(
  taskId: string,
  teammateId: string,
): Promise<{ task: PersRow; teammate: TeammateLite }> {
  if (!taskId) throw new CollabError("taskId is required", 400);
  if (!teammateId) throw new CollabError("teammateId is required", 400);

  const task = (await prisma.task.findFirst({ where: { id: taskId } })) as PersRow | null;
  if (!task) throw new CollabError("Task not found", 404);
  if (!task.userId) throw new CollabError("Task has no owner", 400);

  const teammate = (await prisma.teammate.findFirst({ where: { id: teammateId, userId: str(task.userId) } })) as PersRow | null;
  if (!teammate) throw new CollabError("Teammate not found for this task owner", 404);
  if (isGroupRow(teammate)) throw new CollabError("Tasks are assigned to a teammate, not a group room", 400);

  const lite = toLite(teammate);
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      teammateId: lite.id,
      assigneeName: lite.name,
      assignment: JSON.stringify({ teammateId: lite.id, name: lite.name, role: lite.role, assignedAt: nowIso() }),
    },
  });
  return { task: updated as PersRow, teammate: lite };
}

function delegationSystemPrompt(from: TeammateLite, fromRow: PersRow, to: PersRow, teamRules: string[]): string {
  const toPersona = parseJson<Record<string, any>>(to.persona, {});
  const toSkills = Array.isArray(toPersona.skills) ? toPersona.skills.filter((s: unknown) => typeof s === "string") : [];
  const fromPersona = parseJson<Record<string, any>>(fromRow.persona, {});

  return [
    `"${from.name}" (${from.role}) is handing you work inside woibot.com.`,
    `You are "${to.name}" (${to.role}). You speak only as yourself.`,
    "",
    "ROLE SEPARATION (hard rules):",
    `- Your remit: ${to.role}${toSkills.length ? ` — skills: ${toSkills.join(", ")}` : ""}.`,
    `- Sender's remit: "${from.name}" (${from.role}). You don't do their job and you don't speak for them.`,
    "- If the request is outside your remit, say so in one line and name which teammate should own it. Do not pretend to execute it.",
    "- Never claim you are the sender. Never merge identities. Do not claim actions you did not take.",
    "",
    "SHARED TEAM MEMORY (rules binding every bot in this team):",
    teamRules.length ? teamRules.map((r) => `- ${r}`).join("\n") : "- (none recorded yet)",
    "",
    "STYLE:",
    `- Sender's tone: ${fromPersona?.tone ? str(fromPersona.tone) : "direct, concise"}.`,
    "- Reply in the language of the incoming message (Thai default). Executive-grade, no fluff, no emojis.",
    "- End with a single line starting with 'HAND-BACK →' telling the sender what you did or what you need.",
  ].join("\n");
}

/**
 * One bot delegates to another. Persists both sides of the exchange on the
 * target bot's thread and answers under the target bot's role.
 */
export async function delegateBetweenBots(
  userId: string,
  input: { fromId: string; toId: string; message: string; groupId?: string },
): Promise<DelegateResult> {
  const fromId = str(input?.fromId).trim();
  const toId = str(input?.toId).trim();
  const message = str(input?.message).trim();
  const groupId = str(input?.groupId).trim();

  if (!fromId) throw new CollabError("fromId is required", 400);
  if (!toId) throw new CollabError("toId is required", 400);
  if (fromId === toId) throw new CollabError("fromId and toId must be different teammates", 400);
  if (!message) throw new CollabError("message is required", 400);
  if (message.length > 4000) throw new CollabError("message must be 4000 characters or fewer", 400);

  const fromRow = await requireTeammate(userId, fromId, "Sender");
  const toRow = await requireTeammate(userId, toId, "Target");
  if (isGroupRow(fromRow) || isGroupRow(toRow)) {
    throw new CollabError("Delegation runs between individual teammates, not group rooms", 400);
  }

  const from = toLite(fromRow);
  const to = toLite(toRow);

  let group: PersRow | null = null;
  if (groupId) {
    group = await requireTeammate(userId, groupId, "Group");
    if (!isGroupRow(group)) throw new CollabError("groupId must reference a group room", 400);
    const members = memberIdsOf(group);
    if (members.length > 0 && (!members.includes(fromId) || !members.includes(toId))) {
      throw new CollabError("Both teammates must be members of the group", 400);
    }
  }

  // Team-scope rules are shared; a group narrows the set to its own rules plus
  // the team-wide rules that predate grouping (no groupId).
  const allTeamMemories = await teamMemoryRows(userId);
  const scoped = groupId
    ? allTeamMemories.filter((m) => str(m.groupId) === groupId || !m.groupId)
    : allTeamMemories;
  const teamRules = scoped.slice(0, 12).map((m) => `${str(m.key)}: ${str(m.value)}`);

  const created = nowIso();
  const userMsg = await prisma.chatMessage.create({
    data: {
      teammateId: to.id,
      userId,
      role: "user",
      content: message,
      meta: JSON.stringify({
        delegation: {
          fromId: from.id,
          fromName: from.name,
          fromRole: from.role,
          toId: to.id,
          toName: to.name,
          groupId: groupId || null,
          groupName: group ? str(group.name) : null,
          at: created,
        },
        timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      }),
    },
  });

  let llm: { text: string; provider: string };
  try {
    llm = await callWoibotLLM({
      system: delegationSystemPrompt(from, fromRow, toRow, teamRules),
      user: message,
      maxTokens: 900,
    });
  } catch (e: unknown) {
    // Surface provider outages as 503 — the delegation itself was valid and the
    // inbound message stays on the target's thread as an unanswered hand-off.
    throw new CollabError(
      `AI provider unavailable: ${e instanceof Error ? e.message : "unknown error"}`,
      503,
    );
  }
  if (!llm.text.trim()) throw new CollabError("AI provider returned an empty reply", 502);

  const replyMsg = await prisma.chatMessage.create({
    data: {
      teammateId: to.id,
      userId,
      role: "assistant",
      content: llm.text,
      meta: JSON.stringify({
        delegation: {
          fromId: from.id,
          fromName: from.name,
          toId: to.id,
          toName: to.name,
          groupId: groupId || null,
          replyTo: str(userMsg.id),
          at: nowIso(),
        },
        provider: llm.provider,
        roleScoped: true,
      }),
    },
  });

  await import("./billing")
    .then(({ recordUsage }) =>
      recordUsage(userId, {
        product: "teammate",
        kind: "chat",
        tokens: Math.ceil((message.length + llm.text.length) / 3),
        cost: 0,
        meta: { delegation: `${from.id}->${to.id}` },
      }),
    )
    .catch(() => {});

  return {
    reply: llm.text,
    provider: llm.provider,
    from,
    to,
    messageId: str(userMsg.id),
    replyMessageId: str(replyMsg.id),
    memoriesUsed: scoped.slice(0, 12).map((m) => str(m.key)),
    createdAt: created,
  };
}
