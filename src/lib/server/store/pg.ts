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

function ops(q: Query, lockReads: boolean): StoreOps {
  return {
    async get<T extends Doc>(table: Table, id: string): Promise<T | null> {
      const r = await q(`SELECT data FROM cb_docs WHERE tbl = $1 AND id = $2${lockReads ? " FOR UPDATE" : ""}`, [table, id]);
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
    async deleteWhere(table, index, value) {
      const col = indexColumn(table, index);
      const r = await q(`DELETE FROM cb_docs WHERE tbl = $1 AND ${col} = $2`, [table, value]);
      return r.rowCount ?? 0;
    },
    async claimUnique(scope, value, docId) {
      await q(`DELETE FROM cb_unique WHERE scope = $1 AND doc_id = $2`, [scope, docId]);
      await q(`INSERT INTO cb_unique (scope, value, doc_id) VALUES ($1, $2, $3)`, [scope, value, docId]);
    },
    async releaseUnique(scope, docId) {
      if (scope) await q(`DELETE FROM cb_unique WHERE scope = $1 AND doc_id = $2`, [scope, docId]);
      else await q(`DELETE FROM cb_unique WHERE doc_id = $1`, [docId]);
    },
  };
}

export async function createPgStore(connectionString: string): Promise<Store> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString, max: Number(process.env.DATABASE_POOL_SIZE || 5) });
  await pool.query(SCHEMA);
  const q: Query = (sql, params) => pool.query(sql, params as any[]);
  const base = ops(q, false);
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
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(ops((sql, params) => client.query(sql, params as any[]), true));
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw translate(err);
      } finally {
        client.release();
      }
    },
    async scan<T extends Doc>(table: Table) {
      const r = await q(`SELECT data FROM cb_docs WHERE tbl = $1`, [table]);
      return r.rows.map((row) => row.data as T);
    },
    async putBlob(id, data) {
      await q(`INSERT INTO cb_blobs (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`, [id, data]);
    },
    async getBlob(id) {
      const r = await q(`SELECT data FROM cb_blobs WHERE id = $1`, [id]);
      return (r.rows[0]?.data as Buffer) ?? null;
    },
    async deleteBlob(id) {
      await q(`DELETE FROM cb_blobs WHERE id = $1`, [id]);
    },
    async notify(channel, payload) {
      await q(`SELECT pg_notify($1, $2)`, [channel, payload]);
    },
    async listen(channel, onMessage) {
      if (!/^[a-z_]+$/.test(channel)) throw new Error("Invalid channel name");
      // LISTEN needs its own direct connection: connection poolers (Neon's "-pooler" address,
      // PgBouncer) don't keep it, so prefer the unpooled address when the host provides one
      const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || connectionString;
      const { Client } = await import("pg");
      const connect = async () => {
        const client = new Client({ connectionString: direct });
        let dropped = false;
        const reconnect = () => {
          if (dropped) return;
          dropped = true;
          client.end().catch(() => undefined);
          setTimeout(() => void connect().catch((err) => console.error("[live] LISTEN failed", err)), 2000);
        };
        client.on("error", reconnect);
        client.on("end", reconnect);
        client.on("notification", (msg: { channel: string; payload?: string }) => {
          if (msg.channel === channel && msg.payload) onMessage(msg.payload);
        });
        await client.connect();
        await client.query(`LISTEN ${channel}`);
      };
      await connect();
    },
  };
}
