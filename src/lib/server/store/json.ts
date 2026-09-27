import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { INDEXES, type Doc, type Store, type StoreOps, type Table } from "./types";

/*
 * Zero-config storage: every table lives in memory and is written to JSON files under the
 * data directory. Big tables are split into one file per shard (e.g. one file per
 * collection of records) so a single change doesn't rewrite everything.
 * Writes are serialized through a mutex; transactions keep an undo list and roll back on error.
 *
 * Durability: every change is appended to journal.log (and flushed to disk) before the call
 * returns, so a crash loses nothing that was confirmed; a transaction is one journal line, so
 * it is replayed all-or-nothing. The table files are rewritten in the background; once they
 * are on disk the journal they cover is removed. A lock file stops two servers sharing a folder.
 */

const TABLES = Object.keys(INDEXES) as Table[];

const SHARD: Partial<Record<Table, (doc: any) => string>> = {
  drafts: (d) => d.id,
  published: (d) => d.id,
  versions: (d) => d.appId,
  records: (d) => d.collectionId,
  // one file per month, so old entries are cheap to drop
  audit: (d) => String(d.at || "").slice(0, 7) || "unknown",
};

class Mutex {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

const RETRYABLE = new Set(["EPERM", "EBUSY", "EACCES", "ENOTEMPTY", "EEXIST"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function writeFileAtomic(file: string, data: string | Buffer) {
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await fsp.writeFile(tmp, data);
  for (let attempt = 0; ; attempt++) {
    try {
      await fsp.rename(tmp, file);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code || "";
      if (RETRYABLE.has(code) && attempt < 6) {
        // Windows/OneDrive/antivirus can briefly lock files; try again shortly.
        await sleep(30 * (attempt + 1));
        continue;
      }
      // Last resort: write in place.
      await fsp.writeFile(file, data);
      await fsp.unlink(tmp).catch(() => undefined);
      return;
    }
  }
}

function writeFileAtomicSync(file: string, data: string) {
  const tmp = `${file}.${process.pid}.exit.tmp`;
  try {
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, file);
  } catch {
    fs.writeFileSync(file, data);
    fs.rmSync(tmp, { force: true });
  }
}

function safeFileKey(key: string) {
  return key.replace(/[^A-Za-z0-9_-]/g, "_") || "_";
}

export class JsonStore implements Store {
  readonly kind = "json" as const;
  private readonly dir: string;
  private tables = new Map<Table, Map<string, Doc>>();
  private shardOf = new Map<Table, Map<string, string>>();
  private shardMembers = new Map<Table, Map<string, Set<string>>>();
  private dirty = new Map<Table, Set<string>>();
  private timer: NodeJS.Timeout | null = null;
  private firstDirtyAt = 0;
  /** Saves run one after another; `writing` is what the current one hasn't finished writing. */
  private flushChain: Promise<void> = Promise.resolve();
  private writing = new Map<Table, Set<string>>();
  /** Undoes the transaction running right now: it isn't confirmed until its journal line is written. */
  private undoActive: (() => void) | null = null;
  private mutex = new Mutex();
  private loaded = false;
  private journalFd: number | null = null;
  private replaying = false;

  constructor(dir: string) {
    this.dir = dir;
    process.once("exit", () => {
      this.flushSync();
      this.releaseLock();
    });
  }

  /* -------------------------------------------------- one server per folder */

  private lockFile() {
    return path.join(/*turbopackIgnore: true*/ this.dir, "server.lock");
  }

  private takeLock() {
    const file = this.lockFile();
    try {
      fs.writeFileSync(file, String(process.pid), { flag: "wx" });
      return;
    } catch {
      /* a lock exists: is its process still running? */
    }
    const pid = Number(fs.readFileSync(file, "utf8").trim());
    let alive = false;
    if (pid && pid !== process.pid) {
      try {
        process.kill(pid, 0);
        alive = true;
      } catch (err) {
        alive = (err as NodeJS.ErrnoException).code === "EPERM";
      }
    }
    if (alive)
      throw new Error(
        `Another Craftbase server (process ${pid}) is using the data folder ${this.dir}. Stop it first, give each server its own CRAFTBASE_DATA_DIR, or use Postgres (DATABASE_URL) to run several servers. If no other server is running, delete ${file}.`,
      );
    fs.writeFileSync(file, String(process.pid));
  }

  private releaseLock() {
    try {
      if (Number(fs.readFileSync(this.lockFile(), "utf8").trim()) === process.pid) fs.unlinkSync(this.lockFile());
    } catch {
      /* already gone */
    }
  }

  /* -------------------------------------------------- journal */

  private journalFile() {
    return path.join(/*turbopackIgnore: true*/ this.dir, "journal.log");
  }

  private flushingFile() {
    return path.join(/*turbopackIgnore: true*/ this.dir, "journal.flushing");
  }

  /** Write committed changes to disk before telling anyone they happened. */
  private appendJournal(ops: [Table, string, Doc | null][]) {
    if (!ops.length || this.replaying) return;
    if (this.journalFd === null) this.journalFd = fs.openSync(this.journalFile(), "a");
    fs.writeSync(this.journalFd, JSON.stringify(ops) + "\n");
    fs.fsyncSync(this.journalFd);
  }

  /** Start a new journal; the old one is kept until the table files it covers are saved. */
  private rotateJournal() {
    if (this.journalFd !== null) {
      fs.closeSync(this.journalFd);
      this.journalFd = null;
    }
    const log = this.journalFile();
    if (!fs.existsSync(log)) return;
    const flushing = this.flushingFile();
    if (fs.existsSync(flushing)) {
      fs.appendFileSync(flushing, fs.readFileSync(log));
      fs.unlinkSync(log);
    } else fs.renameSync(log, flushing);
  }

  /** After a crash: re-apply what the table files may not have caught. */
  private replayJournal() {
    this.replaying = true;
    try {
      for (const file of [this.flushingFile(), this.journalFile()]) {
        let text = "";
        try {
          text = fs.readFileSync(file, "utf8");
        } catch {
          continue;
        }
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          let ops: [Table, string, Doc | null][];
          try {
            ops = JSON.parse(line);
          } catch {
            continue; // a line cut short by the crash: that change was never confirmed
          }
          for (const [table, id, doc] of ops) {
            if (!TABLES.includes(table)) continue;
            if (doc) this.putRaw(table, doc);
            else this.deleteRaw(table, id);
          }
        }
      }
    } finally {
      this.replaying = false;
    }
  }

  /* -------------------------------------------------- loading */

  private ensureLoaded() {
    if (this.loaded) return;
    fs.mkdirSync(this.dir, { recursive: true });
    fs.mkdirSync(path.join(/*turbopackIgnore: true*/ this.dir, "blobs"), { recursive: true });
    this.takeLock();
    for (const t of TABLES) if (!this.tables.has(t)) this.loadTable(t);
    this.loaded = true;
    this.replayJournal();
  }

  /** Read one table from disk (also used for tables added by an upgrade while running). */
  private loadTable(t: Table) {
    const map = new Map<string, Doc>();
    const shardIds = new Map<string, string>();
    const members = new Map<string, Set<string>>();
    if (SHARD[t]) {
      const tdir = path.join(/*turbopackIgnore: true*/ this.dir, t);
      fs.mkdirSync(tdir, { recursive: true });
      for (const file of fs.readdirSync(tdir)) {
        if (!file.endsWith(".json")) continue;
        const docs = this.readArray(path.join(/*turbopackIgnore: true*/ tdir, file));
        const key = file.slice(0, -5);
        for (const d of docs) {
          map.set(d.id, d);
          const shard = safeFileKey(SHARD[t]!(d));
          shardIds.set(d.id, shard);
          if (!members.has(shard)) members.set(shard, new Set());
          members.get(shard)!.add(d.id);
          if (shard !== key) {
            // document sits in the wrong file: rewrite both
            this.tables.set(t, map);
            this.shardOf.set(t, shardIds);
            this.shardMembers.set(t, members);
            this.markDirty(t, key);
            this.markDirty(t, shard);
          }
        }
      }
    } else {
      for (const d of this.readArray(path.join(/*turbopackIgnore: true*/ this.dir, `${t}.json`))) map.set(d.id, d);
    }
    this.tables.set(t, map);
    this.shardOf.set(t, shardIds);
    this.shardMembers.set(t, members);
  }

  private readArray(file: string): Doc[] {
    try {
      const text = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed.filter((d) => d && typeof d.id === "string") : [];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`[store] could not read ${file}:`, err);
        // keep a copy of the unreadable file so nothing is silently lost
        try {
          fs.copyFileSync(file, `${file}.corrupt-${Date.now()}`);
        } catch {
          /* ignore */
        }
      }
      return [];
    }
  }

  private map(table: Table) {
    this.ensureLoaded();
    if (!this.tables.has(table)) this.loadTable(table);
    return this.tables.get(table)!;
  }

  /* -------------------------------------------------- persistence */

  private markDirty(table: Table, shard: string) {
    if (!this.dirty.has(table)) this.dirty.set(table, new Set());
    this.dirty.get(table)!.add(shard);
    this.scheduleFlush();
  }

  private scheduleFlush() {
    const now = Date.now();
    if (!this.firstDirtyAt) this.firstDirtyAt = now;
    if (this.timer) clearTimeout(this.timer);
    // debounce, but never wait more than a second
    const wait = now - this.firstDirtyAt > 1000 ? 0 : 120;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, wait);
  }

  private snapshotShard(table: Table, shard: string): string | null {
    const map = this.tables.get(table)!;
    let docs: Doc[];
    if (SHARD[table]) {
      const ids = this.shardMembers.get(table)!.get(shard);
      docs = ids ? Array.from(ids, (id) => map.get(id)!).filter(Boolean) : [];
      if (!docs.length) return null;
    } else docs = Array.from(map.values());
    return JSON.stringify(docs);
  }

  private fileFor(table: Table, shard: string) {
    return SHARD[table] ? path.join(/*turbopackIgnore: true*/ this.dir, table, `${shard}.json`) : path.join(/*turbopackIgnore: true*/ this.dir, `${table}.json`);
  }

  flush(): Promise<void> {
    const run = this.flushChain.then(() => this.flushOnce());
    this.flushChain = run.catch(() => undefined);
    return run;
  }

  private async flushOnce() {
    if (!this.dirty.size) return;
    const files: { table: Table; shard: string; data: string | null }[] = [];
    // copy the changed shards and start a new journal in one step, inside the lock: no transaction
    // is half-done there, so the table files only ever hold confirmed changes
    await this.mutex.run(async () => {
      for (const [table, shards] of this.dirty) for (const shard of shards) files.push({ table, shard, data: this.snapshotShard(table, shard) });
      this.writing = this.dirty;
      this.dirty = new Map();
      this.firstDirtyAt = 0;
      this.rotateJournal();
    });
    let failed = false;
    try {
      for (const { table, shard, data } of files) {
        const file = this.fileFor(table, shard);
        try {
          if (data === null) await fsp.unlink(file).catch(() => undefined);
          else await writeFileAtomic(file, data);
        } catch (err) {
          console.error(`[store] failed to save ${file}:`, err);
          failed = true;
          this.markDirty(table, shard);
        }
      }
      // everything the old journal described is in the table files now
      if (!failed) await fsp.unlink(this.flushingFile()).catch(() => undefined);
    } finally {
      this.writing = new Map();
    }
  }

  /** On exit: save what is confirmed, so the next start doesn't need the journal. */
  flushSync() {
    if (!this.loaded) return;
    // a transaction cut off half-way was never confirmed: don't save its changes
    this.undoActive?.();
    this.undoActive = null;
    const shards = new Map<Table, Set<string>>();
    for (const src of [this.writing, this.dirty])
      for (const [table, set] of src) {
        if (!shards.has(table)) shards.set(table, new Set());
        for (const shard of set) shards.get(table)!.add(shard);
      }
    if (!shards.size) return;
    for (const [table, set] of shards) {
      for (const shard of set) {
        const file = this.fileFor(table, shard);
        const data = this.snapshotShard(table, shard);
        try {
          if (data === null) fs.rmSync(file, { force: true });
          else writeFileAtomicSync(file, data);
        } catch {
          return; // best effort on exit; the journal still has it
        }
      }
    }
    this.dirty.clear();
    // a background save may still land an older copy of a file: keep the journal to replay then
    if (this.writing.size) return;
    try {
      if (this.journalFd !== null) fs.closeSync(this.journalFd);
      this.journalFd = null;
      fs.rmSync(this.journalFile(), { force: true });
      fs.rmSync(this.flushingFile(), { force: true });
    } catch {
      /* keep them: they will be replayed */
    }
  }

  /* -------------------------------------------------- raw ops (no locking) */

  private getRaw(table: Table, id: string): Doc | null {
    return this.map(table).get(id) ?? null;
  }

  private putRaw(table: Table, doc: Doc) {
    const map = this.map(table);
    const copy = structuredClone(doc);
    map.set(copy.id, copy);
    const shardFn = SHARD[table];
    if (shardFn) {
      const key = safeFileKey(shardFn(copy));
      const ids = this.shardOf.get(table)!;
      const prev = ids.get(copy.id);
      const members = this.shardMembers.get(table)!;
      if (prev && prev !== key) {
        members.get(prev)?.delete(copy.id);
        this.markDirty(table, prev);
      }
      ids.set(copy.id, key);
      if (!members.has(key)) members.set(key, new Set());
      members.get(key)!.add(copy.id);
      this.markDirty(table, key);
    } else this.markDirty(table, "");
  }

  private deleteRaw(table: Table, id: string) {
    const map = this.map(table);
    if (!map.has(id)) return;
    map.delete(id);
    if (SHARD[table]) {
      const key = this.shardOf.get(table)!.get(id);
      this.shardOf.get(table)!.delete(id);
      if (key) {
        this.shardMembers.get(table)!.get(key)?.delete(id);
        this.markDirty(table, key);
      }
    } else this.markDirty(table, "");
  }

  private findRaw(table: Table, index: string, value: string): Doc[] {
    const fn = INDEXES[table][index];
    if (!fn) throw new Error(`No index ${table}.${index}`);
    const out: Doc[] = [];
    // records are sharded by collection: only look at that shard
    if (SHARD[table] && table === "records" && index === "collectionId") {
      const ids = this.shardMembers.get(table)!.get(safeFileKey(value));
      const map = this.map(table);
      if (ids) for (const id of ids) {
        const d = map.get(id);
        if (d && fn(d) === value) out.push(d);
      }
      return out;
    }
    for (const d of this.map(table).values()) if (fn(d) === value) out.push(d);
    return out;
  }

  /* -------------------------------------------------- public API */

  async get<T extends Doc>(table: Table, id: string): Promise<T | null> {
    const d = this.getRaw(table, id);
    return d ? (structuredClone(d) as T) : null;
  }

  async find<T extends Doc>(table: Table, index: string, value: string): Promise<T[]> {
    return this.findRaw(table, index, value).map((d) => structuredClone(d) as T);
  }

  async scan<T extends Doc>(table: Table): Promise<T[]> {
    return Array.from(this.map(table).values(), (d) => structuredClone(d) as T);
  }

  put<T extends Doc>(table: Table, doc: T): Promise<void> {
    return this.transaction(async (tx) => tx.put(table, doc));
  }

  delete(table: Table, id: string): Promise<void> {
    return this.transaction(async (tx) => tx.delete(table, id));
  }

  deleteWhere(table: Table, index: string, value: string): Promise<number> {
    return this.transaction(async (tx) => tx.deleteWhere(table, index, value));
  }

  transaction<R>(fn: (tx: StoreOps) => Promise<R>): Promise<R> {
    return this.mutex.run(async () => {
      // journal of original documents, to undo on failure
      const journal = new Map<string, { table: Table; id: string; before: Doc | null }>();
      const remember = (table: Table, id: string) => {
        const key = `${table}:${id}`;
        if (!journal.has(key)) {
          const before = this.getRaw(table, id);
          journal.set(key, { table, id, before: before ? structuredClone(before) : null });
        }
      };
      const tx: StoreOps = {
        get: async <T extends Doc>(table: Table, id: string) => {
          const d = this.getRaw(table, id);
          return d ? (structuredClone(d) as T) : null;
        },
        find: async <T extends Doc>(table: Table, index: string, value: string) =>
          this.findRaw(table, index, value).map((d) => structuredClone(d) as T),
        put: async (table, doc) => {
          remember(table, doc.id);
          this.putRaw(table, doc);
        },
        delete: async (table, id) => {
          remember(table, id);
          this.deleteRaw(table, id);
        },
        deleteWhere: async (table, index, value) => {
          const docs = this.findRaw(table, index, value);
          for (const d of docs) {
            remember(table, d.id);
            this.deleteRaw(table, d.id);
          }
          return docs.length;
        },
      };
      const undo = () => {
        for (const { table, id, before } of journal.values()) {
          if (before) this.putRaw(table, before);
          else this.deleteRaw(table, id);
        }
      };
      let result: R;
      this.undoActive = undo;
      try {
        result = await fn(tx);
      } catch (err) {
        this.undoActive = null;
        undo();
        throw err;
      }
      try {
        // one line per transaction: replayed all-or-nothing after a crash
        const ops: [Table, string, Doc | null][] = [];
        for (const { table, id } of journal.values()) {
          const now = this.getRaw(table, id);
          ops.push([table, id, now ? structuredClone(now) : null]);
        }
        this.appendJournal(ops);
      } catch (err) {
        this.undoActive = null;
        undo();
        console.error("[store] could not write the journal:", err);
        throw new Error("Couldn't save your change (the server's disk may be full). Please try again.");
      }
      this.undoActive = null;
      return result;
    });
  }

  private blobPath(id: string) {
    this.ensureLoaded();
    return path.join(/*turbopackIgnore: true*/ this.dir, "blobs", safeFileKey(id));
  }

  async putBlob(id: string, data: Buffer) {
    await writeFileAtomic(this.blobPath(id), data);
  }

  async getBlob(id: string) {
    try {
      return await fsp.readFile(this.blobPath(id));
    } catch {
      return null;
    }
  }

  async deleteBlob(id: string) {
    await fsp.unlink(this.blobPath(id)).catch(() => undefined);
  }
}
