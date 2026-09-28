import { randomUUID } from "node:crypto";
import type { MediaItem } from "@/lib/shared/types";
import type { Store, Table } from "./store/types";
import { cleanMobileDeployments } from "./mobile";
import { queueBlobDeletion } from "./blob-cleanup";
import { retryLiveEvent, type LiveEvent } from "./live";
import { resumeAccountDeletion } from "./account";

const DAY = 864e5;
export const RETENTION = { unsavedAttachmentsDays: 1, auditDays: 365 };
const g = globalThis as unknown as { __cbMaintenance?: boolean };

export function startMaintenance(getStore: () => Promise<Store>) {
  if (process.env.VERCEL || g.__cbMaintenance) return;
  g.__cbMaintenance = true;
  const run = () => void getStore().then(runMaintenance).catch((err) => console.error("[maintenance]", err));
  setTimeout(run, 30_000).unref?.();
  setInterval(run, 60_000).unref?.();
}

/** Bounded pages with durable cursors and a lease shared by every server. */
export async function runMaintenance(store: Store, now = Date.now()) {
  const token = randomUUID();
  const acquired = await store.transaction(async (tx) => {
    const lease = await tx.get<{ id: string; until: number }>("jobs", "maintenance_lock");
    if (lease && lease.until > now) return false;
    await tx.put("jobs", { id: "maintenance_lock", kind: "maintenance", token, until: now + 120_000 });
    return true;
  });
  if (!acquired) return 0;
  let removed = 0;
  let processed = 0, failures = 0;
  const startedAt = Date.now();
  const deadline = Date.now() + 45_000;
  const page = async (table: Table, visit: (row: any) => Promise<void>) => {
    if (Date.now() >= deadline) return;
    const id = `maintenance_cursor_${table}`;
    const cursor = await store.get<{ id: string; after: string }>("jobs", id);
    const rows = await store.page(table, { after: cursor?.after, limit: 250 });
    let after = cursor?.after || "";
    for (const row of rows) {
      if (Date.now() >= deadline) break;
      try { await visit(row); } catch (err) { failures++; console.error("[maintenance] item retained for retry", table, row.id, err); }
      processed++;
      after = row.id;
    }
    if (!rows.length || (rows.length < 250 && after === rows.at(-1)?.id)) after = "";
    await store.put("jobs", { id, kind: "maintenance", after });
  };
  const remove = async (table: Table, id: string, expired: (row: any) => boolean) => {
    await store.transaction(async (tx) => {
      const fresh = await tx.get(table, id);
      if (fresh && expired(fresh)) { await tx.delete(table, id); removed++; }
    });
  };
  try {
    await page("jobs", async (job) => {
      try {
        if (job.kind === "accountDeletion") {
          for (let attempt = 0; attempt < 20 && Date.now() < deadline; attempt++) if (await resumeAccountDeletion(job.userId)) break;
        }
        else if (job.kind === "live") await retryLiveEvent(job as { id: string; appId: string; event: LiveEvent });
        else if (job.kind === "apkUpload" && Date.parse(job.expiresAt) < now) await store.delete("jobs", job.id);
      } catch (err) { failures++; console.error("[maintenance] job retained for retry", job.id, err); }
    });
    await page("blobDeletes", async (job) => {
      if (job.notBefore && job.notBefore > now) return;
      await store.deleteBlob(job.id);
      await store.delete("blobDeletes", job.id);
      removed++;
    });
    for (const table of ["sessions", "invites", "tokens", "idempotency"] as const)
      await page(table, (row) => remove(table, row.id, (r) => Date.parse(r.expiresAt) < now));
    await page("rateLimits", (row) => remove("rateLimits", row.id, (r) => r.reset < now));
    await page("live", (row) => remove("live", row.id, (r) => now - Date.parse(r.at) > 3600_000));
    await page("audit", (row) => remove("audit", row.id, (r) => now - Date.parse(r.at) > RETENTION.auditDays * DAY));
    await page("media", async (row: MediaItem) => {
      await store.transaction(async (tx) => {
        const fresh = await tx.get<MediaItem>("media", row.id);
        if (!fresh || now - Date.parse(fresh.createdAt) < RETENTION.unsavedAttachmentsDays * DAY) return;
        if (!fresh.pending && (fresh.public || fresh.recordId)) return;
        await queueBlobDeletion(tx, fresh.id);
        await tx.delete("media", fresh.id);
        removed++;
      });
    });
    await page("mobileDeployments", (row) => cleanMobileDeployments(store, [row]));
    return removed;
  } finally {
    await store.transaction(async (tx) => {
      const lease = await tx.get<{ id: string; token: string }>("jobs", "maintenance_lock");
      if (lease?.token === token) {
        await tx.put("jobs", { id: "maintenance_status", kind: "maintenance", startedAt: new Date(startedAt).toISOString(), completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, processed, removed, failures, deadlineReached: Date.now() >= deadline });
        await tx.delete("jobs", lease.id);
      }
    });
  }
}
