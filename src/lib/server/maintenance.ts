import type { MediaItem } from "@/lib/shared/types";
import type { AuditEvent } from "./audit";
import type { Store } from "./store/types";
import { cleanMobileDeployments } from "./mobile";

/*
 * Housekeeping, hourly: what we keep, and for how long.
 *  - sign-in sessions: until they expire (30 days after sign-in)
 *  - admin invite links: 7 days; password reset links: 1 hour
 *  - files attached in a form that was never sent: 1 day
 *  - the security log: 1 year
 * Everything else (accounts, apps, records) stays until its owner deletes it.
 */

const DAY = 864e5;
export const RETENTION = { unsavedAttachmentsDays: 1, auditDays: 365 };

const g = globalThis as unknown as { __cbMaintenance?: boolean };

export function startMaintenance(getStore: () => Promise<Store>) {
  if (g.__cbMaintenance) return;
  g.__cbMaintenance = true;
  const run = () =>
    void getStore()
      .then((store) => runMaintenance(store))
      .catch((err) => console.error("[maintenance]", err));
  setTimeout(run, 30_000).unref?.();
  setInterval(run, 3600_000).unref?.();
}

export async function runMaintenance(store: Store, now = Date.now()) {
  // one failing job must not stop the retention clean-up below
  await cleanMobileDeployments(store).catch((err) => console.error("[maintenance] phone builds", err));
  for (const e of await store.scan<{ id: string; at: string }>("live")) if (now - Date.parse(e.at) > 3600_000) await store.delete("live", e.id);
  const expired = (iso: string | undefined) => !!iso && new Date(iso).getTime() < now;
  let removed = 0;
  for (const s of await store.scan<{ id: string; expiresAt: string }>("sessions")) if (expired(s.expiresAt)) (await store.delete("sessions", s.id), removed++);
  for (const i of await store.scan<{ id: string; expiresAt: string }>("invites")) if (expired(i.expiresAt)) (await store.delete("invites", i.id), removed++);
  for (const t of await store.scan<{ id: string; expiresAt: string }>("tokens")) if (expired(t.expiresAt)) (await store.delete("tokens", t.id), removed++);
  for (const m of await store.scan<MediaItem>("media")) {
    if (m.public || m.recordId) continue;
    if (now - new Date(m.createdAt).getTime() < RETENTION.unsavedAttachmentsDays * DAY) continue;
    await store.delete("media", m.id);
    await store.deleteBlob(m.id);
    removed++;
  }
  for (const e of await store.scan<AuditEvent>("audit")) {
    if (now - new Date(e.at).getTime() > RETENTION.auditDays * DAY) (await store.delete("audit", e.id), removed++);
  }
  if (removed) console.log(`[maintenance] removed ${removed} expired items`);
  return removed;
}
