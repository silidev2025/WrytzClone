// Put a backup made by `npm run backup` back in place of the file-storage data folder.
// Usage (with the server stopped): npm run restore -- backups/craftbase-2026-09-28T02-00-00
// The current data folder is kept next to it (renamed), never deleted.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.env.CRAFTBASE_DATA_DIR || path.join(process.cwd(), ".data"));
const source = process.argv[2] && path.resolve(process.argv[2]);

if (process.env.DATABASE_URL) {
  console.log("DATABASE_URL is set: restore Postgres with pg_restore (or your host's tools) instead.");
  process.exit(0);
}
if (!source || !fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
  console.error("Usage: npm run restore -- <backup folder>");
  process.exit(1);
}
if (!fs.existsSync(path.join(source, "users.json"))) {
  console.error(`${source} doesn't look like a Craftbase backup (no users.json).`);
  process.exit(1);
}

// never swap the folder under a running server
try {
  const pid = Number(fs.readFileSync(path.join(dir, "server.lock"), "utf8").trim());
  if (pid) {
    let alive = true;
    try {
      process.kill(pid, 0);
    } catch (err) {
      alive = err.code === "EPERM";
    }
    if (alive) {
      console.error(`A Craftbase server (process ${pid}) is using ${dir}. Stop it, then run this again.`);
      process.exit(1);
    }
  }
} catch {
  /* no lock: no server */
}

let aside = "";
if (fs.existsSync(dir)) {
  aside = `${dir}-before-restore-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
  try {
    fs.renameSync(dir, aside);
  } catch (err) {
    console.error(`Couldn't move ${dir} aside (${err.code}). Close anything using it (a sync app, an editor) and try again.`);
    process.exit(1);
  }
}
fs.cpSync(source, dir, { recursive: true });
fs.rmSync(path.join(dir, "server.lock"), { force: true });

console.log(`Restored ${source}\n      to ${dir}`);
if (aside) console.log(`The previous data is kept in ${aside} — delete it once you've checked the restored site.`);
console.log("Start the server: it finishes any saves recorded in the backup's journal on its own.");
