import crypto from "node:crypto";
import { nowIso, uid } from "@/lib/shared/util";
import { getStore, serverSecret, type StoreOps } from "./store";

/*
 * A short, durable history of security-relevant events: sign-ins, password changes, admin
 * changes, access-rule changes, deletions. IP addresses are stored only as a keyed hash
 * (enough to spot repeats, not to identify anyone). Kept for a year (see maintenance.ts).
 */

export type AuditAction =
  | "login"
  | "login.failed"
  | "logout"
  | "signup"
  | "terms.accepted"
  | "password.changed"
  | "password.reset.requested"
  | "password.reset"
  | "sessions.revoked"
  | "account.deleted"
  | "account.updated"
  | "app.deleted"
  | "app.published"
  | "app.unpublished"
  | "admin.invited"
  | "admin.invite.revoked"
  | "admin.added"
  | "admin.removed"
  | "consent.given"
  | "consent.revoked"
  | "collection.access"
  | "collection.deleted"
  | "records.deleted"
  | "record.deleted"
  | "media.deleted"
  | "report.created"
  | "report.resolved"
  | "app.takedown"
  | "app.restored"
  | "account.suspended"
  | "account.unsuspended"
  | "member.role";

export interface AuditEvent {
  id: string;
  at: string;
  action: AuditAction;
  userId?: string | null;
  appId?: string | null;
  target?: string;
  detail?: string;
  ip?: string;
}

export function hashIp(ip: string | null | undefined): string | undefined {
  if (!ip) return undefined;
  return crypto.createHmac("sha256", serverSecret()).update(`ip:${ip}`).digest("base64url").slice(0, 12);
}

export async function audit(e: Omit<AuditEvent, "id" | "at" | "ip"> & { ip?: string | null }, ops?: StoreOps) {
  try {
    const store = ops ?? (await getStore());
    const event: AuditEvent = { id: uid("aud", 14), at: nowIso(), ...e, ip: hashIp(e.ip) };
    if (event.detail) event.detail = event.detail.slice(0, 300);
    await store.put("audit", event);
  } catch (err) {
    // the audit log must never break the action itself
    console.error("[audit]", err);
  }
}

export async function appAuditLog(appId: string, limit = 200): Promise<AuditEvent[]> {
  const store = await getStore();
  const events = await store.find<AuditEvent>("audit", "appId", appId);
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export async function userAuditLog(userId: string, limit = 100): Promise<AuditEvent[]> {
  const store = await getStore();
  const events = await store.find<AuditEvent>("audit", "userId", userId);
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
