import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { JsonStore } from "./json";
import type { Store } from "./types";

export type { Store, StoreOps, Table } from "./types";

const g = globalThis as unknown as { __craftbaseStore?: Promise<Store>; __craftbaseSecret?: string };

export function dataDir(): string {
  return process.env.CRAFTBASE_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), ".data");
}

/**
 * The one store instance for this process. Kept on globalThis so hot reloads in dev
 * don't create a second copy that would overwrite the first one's files.
 */
export function getStore(): Promise<Store> {
  if (!g.__craftbaseStore) {
    const url = process.env.DATABASE_URL;
    if (!url) warnIfSynced(dataDir());
    g.__craftbaseStore = url
      ? import("./pg").then((m) => m.createPgStore(url))
      : Promise.resolve(new JsonStore(dataDir()));
    g.__craftbaseStore.catch(() => {
      g.__craftbaseStore = undefined;
    });
    void import("../maintenance").then((m) => m.startMaintenance(getStore));
  }
  return g.__craftbaseStore;
}

/** Accounts and sessions live in the data folder: it shouldn't be copied to someone's cloud drive. */
function warnIfSynced(dir: string) {
  if (/onedrive|dropbox|icloud|google ?drive|box sync/i.test(dir))
    console.warn(
      `[security] The data folder ${dir} is inside a cloud-synced folder. Accounts, sessions and app data would be uploaded to that cloud. Set CRAFTBASE_DATA_DIR to a local folder outside it (and move .data there).`,
    );
}

/**
 * A server-only key for signing and keyed hashes. CRAFTBASE_SECRET wins; with file storage a
 * random key is created next to the data; with Postgres it is derived from the (secret)
 * connection string when CRAFTBASE_SECRET isn't set.
 */
export function serverSecret(): string {
  if (g.__craftbaseSecret) return g.__craftbaseSecret;
  const env = process.env.CRAFTBASE_SECRET?.trim();
  if (env && env.length >= 32) return (g.__craftbaseSecret = env);
  if (env) console.warn("[security] CRAFTBASE_SECRET should be at least 32 characters; ignoring it.");
  const url = process.env.DATABASE_URL;
  if (url) {
    console.warn("[security] Set CRAFTBASE_SECRET (32+ characters). Without it the key comes from DATABASE_URL, so changing the database password changes the ids apps see for each person.");
    return (g.__craftbaseSecret = crypto.createHash("sha256").update(`craftbase:${url}`).digest("base64url"));
  }
  const file = path.join(/*turbopackIgnore: true*/ dataDir(), "secret.key");
  let secret = "";
  try {
    secret = fs.readFileSync(file, "utf8").trim();
  } catch {
    /* first run */
  }
  if (secret.length < 32) {
    secret = crypto.randomBytes(32).toString("base64url");
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
  }
  return (g.__craftbaseSecret = secret);
}
