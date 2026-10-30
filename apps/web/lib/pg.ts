import { Pool } from "pg";

/**
 * woibot Postgres layer.
 *
 * Durable, multi-instance safe replacement for the JSON runtime store.
 * Collections are stored as rows (collection, id, tenant_id, data jsonb) so the
 * existing Prisma-like call sites keep working while we migrate to typed tables.
 *
 * Connection:
 *  - Cloud Run + Cloud SQL socket: PGHOST=/cloudsql/<project:region:instance>
 *  - Any Postgres: DATABASE_URL=postgres://user:pass@host:5432/db
 */

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function connectionConfig() {
  if (process.env.PGHOST) {
    return {
      host: process.env.PGHOST,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || "woibot",
      max: Number(process.env.PGPOOL_MAX || 5),
    };
  }
  return {
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PGPOOL_MAX || 5),
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  };
}

export function pgEnabled(): boolean {
  const url = process.env.DATABASE_URL || "";
  return Boolean(process.env.PGHOST) || url.startsWith("postgres://") || url.startsWith("postgresql://");
}

export function getPool(): Pool {
  if (!pool) pool = new Pool(connectionConfig());
  return pool;
}

const SCHEMA_SQL = `
create extension if not exists vector;

create table if not exists woibot_users (
  id text primary key,
  email text unique not null,
  name text,
  password_hash text,
  image text,
  created_at timestamptz not null default now()
);

create table if not exists woibot_sessions (
  id text primary key,
  user_id text not null references woibot_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists woibot_records (
  collection text not null,
  id text not null,
  tenant_id text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists woibot_records_tenant_idx on woibot_records (collection, tenant_id);
create index if not exists woibot_records_gin_idx on woibot_records using gin (data jsonb_path_ops);

create table if not exists woibot_audit_log (
  id bigserial primary key,
  tenant_id text,
  actor text,
  action text not null,
  target text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create table if not exists woibot_memory_vectors (
  id text primary key,
  tenant_id text not null,
  memory_id text not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists woibot_memory_vectors_tenant_idx on woibot_memory_vectors (tenant_id);
`;

export async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const client = await getPool().connect();
      try {
        await client.query(SCHEMA_SQL);
      } finally {
        client.release();
      }
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

export async function audit(entry: {
  tenantId?: string | null;
  actor?: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown>;
}) {
  if (!pgEnabled()) return;
  try {
    await ensureSchema();
    await getPool().query(
      "insert into woibot_audit_log (tenant_id, actor, action, target, meta) values ($1,$2,$3,$4,$5)",
      [entry.tenantId || null, entry.actor || null, entry.action, entry.target || null, entry.meta ? JSON.stringify(entry.meta) : null],
    );
  } catch {
    /* audit must never break the request */
  }
}

/* ------------------------------------------------------------------ */
/* Prisma-like delegates over woibot_records                          */
/* ------------------------------------------------------------------ */

type Where = Record<string, any>;

function whereToSql(where: Where | undefined, params: any[]): string {
  if (!where) return "true";
  const clauses: string[] = [];
  const containment: Record<string, any> = {};

  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;

    if ((key === "AND" || key === "OR") && Array.isArray(value)) {
      const joiner = key;
      const inner = value.map((v) => `(${whereToSql(v, params)})`).join(` ${joiner} `);
      if (inner) clauses.push(`(${inner})`);
      continue;
    }
    if (key === "userId_key_scope" && value && typeof value === "object") {
      containment.userId = value.userId;
      containment.key = value.key;
      containment.scope = value.scope;
      continue;
    }
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      if ("contains" in value) {
        params.push(`%${String(value.contains).toLowerCase()}%`);
        clauses.push(`lower(data->>'${key}') like $${params.length}`);
        continue;
      }
      if ("in" in value && Array.isArray(value.in)) {
        params.push(value.in);
        clauses.push(`data->>'${key}' = any($${params.length}::text[])`);
        continue;
      }
      if ("gte" in value) {
        params.push(value.gte);
        clauses.push(`(data->>'${key}')::timestamptz >= $${params.length}::timestamptz`);
        continue;
      }
      if ("lt" in value) {
        params.push(value.lt);
        clauses.push(`(data->>'${key}')::timestamptz < $${params.length}::timestamptz`);
        continue;
      }
    }
    containment[key] = value;
  }

  if (Object.keys(containment).length) {
    params.push(JSON.stringify(containment));
    clauses.push(`data @> $${params.length}::jsonb`);
  }
  return clauses.length ? clauses.join(" and ") : "true";
}

function orderToSql(orderBy: Record<string, any> | undefined): string {
  if (!orderBy) return "";
  const [field, dir] = Object.entries(orderBy)[0] || [];
  if (!field) return "";
  const direction = String(dir).toLowerCase() === "desc" ? "desc" : "asc";
  return ` order by (data->>'${field}') ${direction} nulls last`;
}

const INCLUDE_KEYS = ["deliverables", "files", "messages"] as const;

function withInclude(collection: string, row: any, include?: Record<string, any>) {
  if (!include) return row;
  return row;
}

async function attachIncludes(collection: string, rows: any[], include?: Record<string, any>) {
  if (!include || rows.length === 0) return rows;
  if (collection === "task" && include.deliverables) {
    const ids = rows.map((r) => r.id);
    const { rows: dels } = await getPool().query(
      "select data from woibot_records where collection='deliverable' and data->>'taskId' = any($1::text[])",
      [ids],
    );
    const byTask = new Map<string, any[]>();
    for (const d of dels) {
      const list = byTask.get(d.data.taskId) || [];
      list.push(d.data);
      byTask.set(d.data.taskId, list);
    }
    return rows.map((r) => ({ ...r, deliverables: byTask.get(r.id) || [] }));
  }
  return rows;
}

function createDelegate(collection: string, prefix: string) {
  return {
    async findMany(args?: {
      where?: Where;
      orderBy?: Record<string, any>;
      take?: number;
      skip?: number;
      include?: Record<string, any>;
    }) {
      await ensureSchema();
      const params: any[] = [collection];
      const whereSql = whereToSql(args?.where, params);
      let sql = `select data from woibot_records where collection=$1 and ${whereSql}`;
      sql += orderToSql(args?.orderBy);
      if (typeof args?.take === "number") {
        params.push(args.take);
        sql += ` limit $${params.length}`;
      }
      if (typeof args?.skip === "number" && args.skip > 0) {
        params.push(args.skip);
        sql += ` offset $${params.length}`;
      }
      const { rows } = await getPool().query(sql, params);
      const list = rows.map((r) => r.data);
      return attachIncludes(collection, list, args?.include);
    },

    async findFirst(args?: { where?: Where; orderBy?: Record<string, any>; include?: Record<string, any> }) {
      const rows = await this.findMany({ ...args, take: 1 });
      return rows[0] ?? null;
    },

    async findUnique(args?: { where?: Where; include?: Record<string, any> }) {
      const rows = await this.findMany({ ...args, take: 1 });
      return rows[0] ?? null;
    },

    async count(args?: { where?: Where }) {
      await ensureSchema();
      const params: any[] = [collection];
      const whereSql = whereToSql(args?.where, params);
      const { rows } = await getPool().query(
        `select count(*)::int as n from woibot_records where collection=$1 and ${whereSql}`,
        params,
      );
      return rows[0]?.n ?? 0;
    },

    async create(args: { data: Where; include?: Record<string, any> }) {
      await ensureSchema();
      const now = new Date().toISOString();
      const id = args.data.id || `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const record: Record<string, any> = { ...args.data, id, createdAt: args.data.createdAt || now, updatedAt: now };
      await getPool().query(
        `insert into woibot_records (collection, id, tenant_id, data, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$5)`,
        [collection, id, record.userId || null, JSON.stringify(record), now],
      );
      return record;
    },

    async update(args: { where: Where; data: Where; include?: Record<string, any> }) {
      await ensureSchema();
      const params: any[] = [collection];
      const whereSql = whereToSql(args.where, params);
      params.push(JSON.stringify(args.data));
      const patchIdx = params.length;
      const { rows } = await getPool().query(
        `update woibot_records
            set data = data || $${patchIdx}::jsonb, updated_at = now()
          where collection=$1 and ${whereSql}
          returning data`,
        params,
      );
      if (!rows[0]) throw new Error(`${collection} record not found`);
      return rows[0].data;
    },

    async updateMany(args: { where?: Where; data: Where }) {
      await ensureSchema();
      const params: any[] = [collection];
      const whereSql = whereToSql(args.where, params);
      params.push(JSON.stringify(args.data));
      const patchIdx = params.length;
      const res = await getPool().query(
        `update woibot_records set data = data || $${patchIdx}::jsonb, updated_at = now()
          where collection=$1 and ${whereSql}`,
        params,
      );
      return { count: res.rowCount ?? 0 };
    },

    async upsert(args: { where: Where; update: Where; create: Where }) {
      const existing = await this.findFirst({ where: args.where });
      if (existing) return this.update({ where: { id: existing.id }, data: args.update });
      return this.create({ data: { ...args.create, ...args.where, userId_key_scope: undefined } });
    },

    async delete(args: { where: Where }) {
      await ensureSchema();
      const params: any[] = [collection];
      const whereSql = whereToSql(args.where, params);
      const { rows } = await getPool().query(
        `delete from woibot_records where collection=$1 and ${whereSql} returning data`,
        params,
      );
      return rows[0]?.data ?? null;
    },
  };
}

export function createPgClient() {
  return {
    user: createDelegate("user", "usr"),
    teammate: createDelegate("teammate", "tm"),
    chatMessage: createDelegate("chatMessage", "msg"),
    memory: createDelegate("memory", "mem"),
    task: createDelegate("task", "tsk"),
    deliverable: createDelegate("deliverable", "del"),
    file: createDelegate("file", "fil"),
    subscription: createDelegate("subscription", "sub"),
    workQuota: createDelegate("workQuota", "wq"),
    usageEvent: createDelegate("usageEvent", "ue"),
    connectedApp: createDelegate("connectedApp", "app"),
    routine: createDelegate("routine", "rt"),
    artifact: createDelegate("artifact", "art"),
    vaultSecret: createDelegate("vaultSecret", "sec"),
  };
}
