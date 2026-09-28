// Back up PostgreSQL using pg_dump, or copy the file-storage data folder to backups/craftbase-<date-time>/.
// Works while the server runs: the saved tables and the journal are read together, and the copy
// starts over if the server saved tables in the middle, so the backup is one consistent moment.
// Backups older than CRAFTBASE_BACKUP_KEEP_DAYS (default 30) are removed afterwards.
// Restore: npm run restore -- <backup folder>
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
createRequire(import.meta.url)("@next/env").loadEnvConfig(process.cwd());

const dir = path.resolve(process.env.CRAFTBASE_DATA_DIR || path.join(process.cwd(), ".data"));
const backupDir = path.resolve(process.env.CRAFTBASE_BACKUP_DIR || path.join(process.cwd(), "backups"));
const keepDays = Number(process.env.CRAFTBASE_BACKUP_KEEP_DAYS || 30);

if (process.env.DATABASE_URL) {
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const file = path.join(backupDir, `craftbase-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);
  const partial = `${file}.partial`;
  let connection;
  try { connection = new URL(process.env.DATABASE_URL); }
  catch { throw new Error("DATABASE_URL must be a valid PostgreSQL URL."); }
  if (!["postgres:", "postgresql:"].includes(connection.protocol)) throw new Error("DATABASE_URL must be a PostgreSQL URL.");
  // libpq does not expand a URI supplied only through PGDATABASE. Pass a URI
  // explicitly, keeping its password out of the process arguments and output.
  const password = connection.searchParams.get("password") ?? decodeURIComponent(connection.password);
  connection.password = "";
  connection.searchParams.delete("password");
  fs.writeFileSync(partial, "", { mode: 0o600, flag: "wx" });
  const result = spawnSync(process.env.PG_DUMP_PATH || "pg_dump", ["--dbname", connection.href, "--format=custom", "--no-owner", "--no-acl", "--file", partial, "--no-password"], {
    env: { ...process.env, PGPASSWORD: password }, encoding: "utf8", windowsHide: true, timeout: 600_000,
  });
  if (result.error || result.status !== 0) {
    fs.rmSync(partial, { force: true });
    console.error("Postgres backup failed. Install pg_dump matching your server version and check database access. No successful backup was recorded.");
    process.exit(1);
  }
  fs.renameSync(partial, file);
  fs.chmodSync(file, 0o600);
  if (keepDays > 0) {
    const cutoff = Date.now() - keepDays * 86400000;
    for (const entry of fs.readdirSync(backupDir, { withFileTypes: true })) {
      const match = /^craftbase-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.dump$/.exec(entry.name);
      if (entry.isFile() && match && Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`) < cutoff)
        fs.unlinkSync(path.join(backupDir, entry.name));
    }
  }
  console.log(`Postgres backup saved to ${file}. Verify it by restoring into a separate test database.`);
  process.exit(0);
}
if (!fs.existsSync(dir)) {
  console.error(`No data folder at ${dir}.`);
  process.exit(1);
}
if (backupDir === dir || backupDir.startsWith(dir + path.sep)) {
  console.error("CRAFTBASE_BACKUP_DIR must be outside the data folder.");
  process.exit(1);
}
if (/[\\/](OneDrive|Dropbox|iCloud ?Drive|Google ?Drive)[^\\/]*[\\/]/i.test(backupDir + path.sep))
  console.warn(`Warning: ${backupDir} is inside a cloud-synced folder, so backups (accounts, sessions, app data) are uploaded there too.\n         Set CRAFTBASE_BACKUP_DIR to a private folder.\n`);

/** Table and journal files, with what identifies each version of them. Blobs never change, so they're copied separately. */
function scan() {
  const files = new Map();
  const walk = (rel) => {
    for (const ent of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      if (r === "blobs" || r === "server.lock" || ent.name.endsWith(".tmp")) continue;
      if (ent.isDirectory()) walk(r);
      else if (ent.isFile()) {
        const s = fs.statSync(path.join(dir, r));
        // the journal only grows between saves: reading part of it is still a consistent moment
        files.set(r, r === "journal.log" ? `${s.ino}:${s.birthtimeMs}` : `${s.ino}:${s.size}:${s.mtimeMs}`);
      }
    }
  };
  walk("");
  return files;
}

function unchanged(before, after) {
  for (const [r, sig] of before) {
    if (r === "journal.log") {
      if (after.has(r) && after.get(r) !== sig) return false;
    } else if (after.get(r) !== sig) return false;
  }
  for (const r of after.keys()) if (!before.has(r) && r !== "journal.log") return false;
  return true;
}

let snapshot = null;
for (let attempt = 1; attempt <= 25 && !snapshot; attempt++) {
  if (attempt > 1) await new Promise((r) => setTimeout(r, 150 + Math.random() * 250));
  const before = scan();
  const read = new Map();
  try {
    for (const r of before.keys()) read.set(r, fs.readFileSync(path.join(dir, r)));
    for (const r of scan().keys()) if (r === "journal.log" && !read.has(r)) read.set(r, fs.readFileSync(path.join(dir, r)));
  } catch {
    continue; // a file was replaced while reading it
  }
  if (unchanged(before, scan())) snapshot = read;
}
if (!snapshot) {
  console.error("The server kept saving while the backup was being taken. Run it again at a quieter time, or stop the server for a moment.");
  process.exit(1);
}

// check the copy can be read back
for (const [r, buf] of snapshot) {
  if (!r.endsWith(".json")) continue;
  try {
    if (!Array.isArray(JSON.parse(buf.toString("utf8")))) throw new Error("not a list");
  } catch (err) {
    console.warn(`Warning: ${r} in the data folder is damaged (${err.message}); it was copied as it is.`);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
let target = "";
for (let n = 1; !target; n++) {
  const name = path.join(backupDir, n === 1 ? `craftbase-${stamp}` : `craftbase-${stamp}-${n}`);
  try {
    fs.mkdirSync(name, { mode: 0o700 });
    target = name;
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }
}
for (const [r, buf] of snapshot) {
  fs.mkdirSync(path.dirname(path.join(target, r)), { recursive: true });
  fs.writeFileSync(path.join(target, r), buf, { mode: 0o600 });
}
// uploaded files: written once before anything refers to them, so copying them now covers every record above
const blobs = path.join(dir, "blobs");
if (fs.existsSync(blobs)) fs.cpSync(blobs, path.join(target, "blobs"), { recursive: true, filter: (src) => !src.endsWith(".tmp") });

let removed = 0;
if (keepDays > 0) {
  const cutoff = Date.now() - keepDays * 86400000;
  for (const name of fs.readdirSync(backupDir)) {
    const m = /^craftbase-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-\d+)?$/.exec(name);
    if (!m || name === path.basename(target)) continue;
    if (Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`) < cutoff) {
      fs.rmSync(path.join(backupDir, name), { recursive: true, force: true });
      removed++;
    }
  }
}

const tables = [...snapshot.keys()].filter((r) => r.endsWith(".json")).length;
console.log(`Backed up ${dir}\n      to ${target}\n      (${tables} table files${removed ? `; removed ${removed} backup(s) older than ${keepDays} days` : ""})`);
console.log("Keep backups somewhere safe and private: they contain accounts and app data.");
