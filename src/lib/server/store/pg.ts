import { HttpError } from "../http";
import { INDEXES, type Doc, type Store, type StoreOps, type Table } from "./types";

/*
 * Postgres storage, used when DATABASE_URL is set (e.g. Neon, Supabase or Vercel Postgres).
 * Documents live in one JSONB table; secondary indexes are copied into k1..k3 columns.
 */

type Query = (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cb_docs (
  tbl  text  NOT NULL,
  id   text  NOT NULL,
  k1   text,
  k2   text,
  k3   text,
  data jsonb NOT NULL,
  PRIMARY KEY (tbl, id)
);
CREATE INDEX IF NOT EXISTS cb_docs_k1 ON cb_docs (tbl, k1);
CREATE INDEX IF NOT EXISTS cb_docs_k2 ON cb_docs (tbl, k2);
CREATE INDEX IF NOT EXISTS cb_docs_k3 ON cb_docs (tbl, k3);
CREATE INDEX IF NOT EXISTS cb_records_collection_date ON cb_docs (k1, (data->>'createdAt') DESC, id) WHERE tbl = 'records';
CREATE INDEX IF NOT EXISTS cb_records_owner_date ON cb_docs (k1, k3, (data->>'createdAt') DESC, id) WHERE tbl = 'records';
CREATE TABLE IF NOT EXISTS cb_migrations (id text PRIMARY KEY);
DO $$ BEGIN
  -- Serialize the one-time backfill across cold starts.
  PERFORM pg_advisory_xact_lock(67291328);
  IF NOT EXISTS (SELECT 1 FROM cb_migrations WHERE id = 'records-created-by-v1') THEN
    UPDATE cb_docs SET k3 = data->>'createdBy' WHERE tbl = 'records' AND k3 IS DISTINCT FROM data->>'createdBy';
    INSERT INTO cb_migrations VALUES ('records-created-by-v1');
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS cb_blobs (
  id   text PRIMARY KEY,
  data bytea NOT NULL
);
-- the database itself refuses duplicate emails, app addresses and "unique" field values,
-- so two requests racing each other can't both win
CREATE UNIQUE INDEX IF NOT EXISTS cb_docs_users_email ON cb_docs (k1) WHERE tbl = 'users';
CREATE UNIQUE INDEX IF NOT EXISTS cb_docs_apps_slug ON cb_docs (k2) WHERE tbl = 'apps' AND k2 IS NOT NULL;
CREATE TABLE IF NOT EXISTS cb_unique (
  scope  text NOT NULL,
  value  text NOT NULL,
  doc_id text NOT NULL,
  PRIMARY KEY (scope, value)
);
CREATE INDEX IF NOT EXISTS cb_unique_doc ON cb_unique (doc_id);
`;

/** A duplicate-key error from Postgres becomes a friendly 409. */
function translate(err: unknown): unknown {
  const code = (err as { code?: string } | null)?.code;
  if (code === "40001" || code === "40P01") return new HttpError(503, "The database is busy. Please retry shortly.");
  if (err && typeof err === "object" && (err as { code?: string }).code === "23505") {
    const detail = String((err as { constraint?: string }).constraint || "");
    if (detail.includes("email")) return new HttpError(409, "An account with that email already exists. Try signing in instead.");
    if (detail.includes("slug")) return new HttpError(409, "Another app already uses that link. Try a different name.");
    return new HttpError(409, "That value is already taken.", { fields: {} });
  }
  return err;
}

function indexColumn(table: Table, index: string): string {
  const names = Object.keys(INDEXES[table]);
  const i = names.indexOf(index);
  if (i < 0 || i > 2) throw new Error(`No index ${table}.${index}`);
  return `k${i + 1}`;
}

function indexValues(table: Table, doc: Doc): (string | null)[] {
  const fns = Object.values(INDEXES[table]);
  return [0, 1, 2].map((i) => (fns[i] ? (fns[i](doc) ?? null) : null));
}

function ops(q: Query): StoreOps {
  return {
    async recordPage(options) {
      const values: unknown[] = [options.collectionId];
      let filter = "tbl = 'records' AND k1 = $1";
      if (options.ownerId) { values.push(options.ownerId); filter += ` AND k3 = $${values.length}`; }
      if (options.ids?.length) { values.push(options.ids); filter += ` AND id = ANY($${values.length}::text[])`; }
      const count = await q(`SELECT count(*)::int AS n FROM cb_docs WHERE ${filter}`, values);
      values.push(options.limit, options.offset);
      const rows = await q(`SELECT data FROM cb_docs WHERE ${filter} ORDER BY data->>'createdAt' ${options.ascending ? "ASC" : "DESC"}, id LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
      return { records: rows.rows.map((r) => r.data), total: count.rows[0].n };
    },
    async get<T extends Doc>(table: Table, id: string): Promise<T | null> {
      // SERIALIZABLE detects stale snapshots without locking every account/app read.
      const r = await q("SELECT data FROM cb_docs WHERE tbl = $1 AND id = $2", [table, id]);
      return (r.rows[0]?.data as T | undefined) ?? null;
    },
    async put(table, doc) {
      const [k1, k2, k3] = indexValues(table, doc);
      await q(
        `INSERT INTO cb_docs (tbl, id, k1, k2, k3, data) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tbl, id) DO UPDATE SET k1 = EXCLUDED.k1, k2 = EXCLUDED.k2, k3 = EXCLUDED.k3, data = EXCLUDED.data`,
        [table, doc.id, k1, k2, k3, JSON.stringify(doc)],
      );
    },
    async delete(table, id) {
      await q(`DELETE FROM cb_docs WHERE tbl = $1 AND id = $2`, [table, id]);
    },
    async find<T extends Doc>(table: Table, index: string, value: string) {
      const col = indexColumn(table, index);
      const r = await q(`SELECT data FROM cb_docs WHERE tbl = $1 AND ${col} = $2`, [table, value]);
      return r.rows.map((row) => row.data as T);
    },
    async count(table, index, value) {
      const r = await q(`SELECT count(*)::int AS count FROM cb_docs WHERE tbl = $1 AND ${indexColumn(table, index)} = $2`, [table, value]);
      return r.rows[0].count;
    },
    async page<T extends Doc>(table: Table, options: { index?: string; value?: string; after?: string; limit?: number } = {}) {
      const params: unknown[] = [table, options.after || "", Math.max(1, Math.min(1000, options.limit || 250))];
      const filter = options.index ? ` AND ${indexColumn(table, options.index)} = $4` : "";
      if (options.index) params.push(options.value);
      const r = await q(`SELECT data FROM cb_docs WHERE tbl = $1 AND id > $2${filter} ORDER BY id LIMIT $3`, params);
      return r.rows.map((row) => row.data as T);
    },
    async deleteWhere(table, index, value) {
      const col = indexColumn(table, index);
      const r = await q(`DELETE FROM cb_docs WHERE tbl = $1 AND ${col} = $2`, [table, value]);
      return r.rowCount ?? 0;
    },
    async claimUnique(scope, value, docId) {
      const [collectionId, fieldId] = scope.split(":");
      if (collectionId && fieldId) {
        // Also cover legacy fields made unique before reservations were backfilled.
        const existing = await q(`SELECT id FROM cb_docs WHERE tbl = 'records' AND k1 = $1 AND id <> $4 AND
          lower(CASE WHEN jsonb_typeof(data->'data'->$2) = 'array'
            THEN (SELECT string_agg(v, ',') FROM jsonb_array_elements_text(data->'data'->$2) AS v)
            ELSE data->'data'->>$2 END) = $3 LIMIT 1`, [collectionId, fieldId, value, docId]);
        if (existing.rows.length) throw new HttpError(409, "That value is already taken.");
      }
      await q(`DELETE FROM cb_unique WHERE scope = $1 AND doc_id = $2`, [scope, docId]);
      await q(`INSERT INTO cb_unique (scope, value, doc_id) VALUES ($1, $2, $3)`, [scope, value, docId]);
    },
    async releaseUnique(scope, docId) {
      if (scope) await q(`DELETE FROM cb_unique WHERE scope = $1 AND doc_id = $2`, [scope, docId]);
      else await q(`DELETE FROM cb_unique WHERE doc_id = $1`, [docId]);
    },
    async releaseUniqueScope(scope) {
      await q("DELETE FROM cb_unique WHERE scope = $1", [scope]);
    },
  };
}

export async function createPgStore(connectionString: string): Promise<Store> {
  const { Pool } = await import("pg");
  const size = Number(process.env.DATABASE_POOL_SIZE || 5);
  if (!Number.isInteger(size) || size < 1 || size > 100) throw new Error("DATABASE_POOL_SIZE must be between 1 and 100.");
  const pool = new Pool({ connectionString, max: size, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000, statement_timeout: 30_000, query_timeout: 35_000 });
  pool.on("error", (err) => console.error("[database] idle connection failed", err.message));
  await pool.query(SCHEMA);
  const q: Query = (sql, params) => pool.query(sql, params as any[]);
  const base = ops(q);
  return {
    kind: "postgres",
    ...base,
    async put(table, doc) {
      try {
        await base.put(table, doc);
      } catch (err) {
        throw translate(err);
      }
    },
    async transaction(fn) {
      const retryDeadline = Date.now() + 15_000;
      for (let attempt = 0; ; attempt++) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
          const result = await fn(ops((sql, params) => client.query(sql, params as any[])));
          await client.query("COMMIT");
          return result;
        } catch (err) {
          await client.query("ROLLBACK").catch(() => undefined);
          const code = (err as { code?: string })?.code;
          if (attempt >= 9 || Date.now() >= retryDeadline || (code !== "40001" && code !== "40P01")) throw translate(err);
        } finally {
          client.release();
        }
        const delay = Math.min(500, 20 * 2 ** attempt);
        await new Promise((resolve) => setTimeout(resolve, delay * (0.5 + Math.random())));
      }
    },
    async consumeRateLimit(key, limit, windowMs) {
      const now = Date.now();
      const result = await q(`INSERT INTO cb_docs (tbl, id, data) VALUES ('rateLimits', $1, jsonb_build_object('id', $1::text, 'count', 1, 'reset', $2::bigint + $3::bigint))
        ON CONFLICT (tbl, id) DO UPDATE SET data = CASE WHEN (cb_docs.data->>'reset')::bigint <= $2
          THEN jsonb_build_object('id', $1::text, 'count', 1, 'reset', $2::bigint + $3::bigint)
          ELSE jsonb_set(cb_docs.data, '{count}', to_jsonb(LEAST((cb_docs.data->>'count')::int + 1, $4::int + 1))) END
        RETURNING (data->>'count')::int AS count`, [key, now, windowMs, limit]);
      return result.rows[0].count <= limit;
    },
    async scan<T extends Doc>(table: Table) {
      const r = await q(`SELECT data FROM cb_docs WHERE tbl = $1`, [table]);
      return r.rows.map((row) => row.data as T);
    },
    async putBlob(id, data) {
      await q(`INSERT INTO cb_blobs (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`, [id, data]);
    },
    async getBlob(id, range) {
      const r = range ? await q("SELECT substring(data FROM $2::int FOR $3::int) AS data FROM cb_blobs WHERE id = $1", [id, range.start + 1, range.end - range.start + 1]) : await q(`SELECT data FROM cb_blobs WHERE id = $1`, [id]);
      return (r.rows[0]?.data as Buffer) ?? null;
    },
    async deleteBlob(id) {
      await q(`DELETE FROM cb_blobs WHERE id = $1`, [id]);
    },
    async notify(channel, payload) {
      await q(`SELECT pg_notify($1, $2)`, [channel, payload]);
    },
    async listen(channel, onMessage, onReconnect) {
      if (!/^[a-z_]+$/.test(channel)) throw new Error("Invalid channel name");
      // LISTEN needs its own direct connection: connection poolers (Neon's "-pooler" address,
      // PgBouncer) don't keep it, so prefer the unpooled address when the host provides one
      const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || connectionString;
      const { Client } = await import("pg");
      let connectedOnce = false;
      let failures = 0;
      const connect = async (): Promise<void> => {
        const client = new Client({ connectionString: direct, connectionTimeoutMillis: 10_000 });
        let scheduled = false;
        const reconnect = () => {
          if (scheduled) return;
          scheduled = true;
          void client.end().catch(() => undefined);
          const delay = Math.min(30_000, 1000 * 2 ** Math.min(failures++, 5)) + Math.random() * 500;
          setTimeout(() => void connect(), delay).unref?.();
        };
        client.on("error", reconnect);
        client.on("end", reconnect);
        client.on("notification", (msg: { channel: string; payload?: string }) => {
          if (msg.channel === channel && msg.payload) onMessage(msg.payload);
        });
        try {
          await client.connect();
          await client.query(`LISTEN ${channel}`);
          if (scheduled) return;
          const recovered = connectedOnce || failures > 0;
          failures = 0;
          if (recovered) onReconnect?.();
          connectedOnce = true;
        } catch (err) {
          console.error("[live] LISTEN unavailable", (err as Error).message);
          reconnect();
        }
      };
      await connect();
    },
  };
}
