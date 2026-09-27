import crypto from "node:crypto";
import type { AppMeta, User } from "@/lib/shared/types";
import { nowIso } from "@/lib/shared/util";
import { getStore, type StoreOps } from "./store";
import { getOwnedApp } from "./apps";
import { audit } from "./audit";
import { badRequest, notFound } from "./http";

/*
 * People are added to an app with single-use invite links, never by email address: anyone can
 * create an account with any address, so an address proves nothing. The owner sends the link
 * to the person; whoever opens it while signed in joins (by account id) with the link's role:
 *
 *   editor  changes the design and database in the builder, and is an admin of the live app
 *   admin   sees admin-only pages and manages every record in the live app
 */

export type MemberRole = "editor" | "admin";

export interface Invite {
  id: string; // sha256 of the token
  appId: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  /** older invites have no role: they made admins */
  role?: MemberRole;
}

export interface Membership {
  id: string; // `${appId}:${userId}`
  appId: string;
  userId: string;
  addedAt: string;
  role?: MemberRole;
}

const INVITE_DAYS = 7;
const MAX_MEMBERS = 20;
const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const live = (i: Invite) => new Date(i.expiresAt).getTime() > Date.now();

export function parseRole(value: unknown): MemberRole {
  if (value === "editor" || value === "admin") return value;
  throw badRequest("Choose what the person can do: edit, or manage the live app.");
}

export function memberRole(meta: AppMeta, userId: string): MemberRole | null {
  if ((meta.editorIds || []).includes(userId)) return "editor";
  if ((meta.adminIds || []).includes(userId)) return "admin";
  return null;
}

/** Keep the two lists consistent: every editor is also an admin of the live app. */
function setMember(meta: AppMeta, userId: string, role: MemberRole | null) {
  const admins = (meta.adminIds || []).filter((id) => id !== userId);
  const editors = (meta.editorIds || []).filter((id) => id !== userId);
  if (role) admins.push(userId);
  if (role === "editor") editors.push(userId);
  meta.adminIds = admins;
  meta.editorIds = editors;
}

export async function listAdmins(owner: User, appId: string) {
  const meta = await getOwnedApp(owner, appId);
  const store = await getStore();
  const admins: { id: string; name: string; email: string; role: MemberRole }[] = [];
  for (const id of meta.adminIds || []) {
    const u = await store.get<User>("users", id);
    if (u) admins.push({ id: u.id, name: u.name, email: u.email, role: memberRole(meta, u.id) || "admin" });
  }
  const invites = (await store.find<Invite>("invites", "appId", appId))
    .filter(live)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((i) => ({ id: i.id.slice(0, 16), createdAt: i.createdAt, expiresAt: i.expiresAt, role: i.role || "admin" }));
  return { admins, invites };
}

/** Returns the secret token once; only its hash is stored. */
export async function createInvite(owner: User, appId: string, role: MemberRole, ip?: string) {
  const store = await getStore();
  return store.transaction(async (tx) => {
    const meta = await getOwnedApp(owner, appId, tx);
    const open = (await tx.find<Invite>("invites", "appId", appId)).filter(live);
    if (open.length >= 10) throw badRequest("You already have 10 open invite links. Cancel one first.");
    if ((meta.adminIds || []).length >= MAX_MEMBERS) throw badRequest(`An app can have at most ${MAX_MEMBERS} people besides its owner.`);
    const token = crypto.randomBytes(24).toString("base64url");
    const invite: Invite = { id: hash(token), appId, createdBy: owner.id, createdAt: nowIso(), expiresAt: new Date(Date.now() + INVITE_DAYS * 864e5).toISOString(), role };
    await tx.put("invites", invite);
    await audit({ action: "admin.invited", userId: owner.id, appId, detail: role, ip }, tx);
    return { token, expiresAt: invite.expiresAt, role };
  });
}

export async function revokeInvite(owner: User, appId: string, shortId: string, ip?: string) {
  const store = await getStore();
  await store.transaction(async (tx) => {
    await getOwnedApp(owner, appId, tx);
    const match = (await tx.find<Invite>("invites", "appId", appId)).find((i) => i.id.slice(0, 16) === shortId);
    if (!match) throw notFound("That invite doesn't exist anymore.");
    await tx.delete("invites", match.id);
    await audit({ action: "admin.invite.revoked", userId: owner.id, appId, ip }, tx);
  });
}

/** Change what someone who already joined can do. */
export async function setMemberRole(owner: User, appId: string, userId: string, role: MemberRole, ip?: string) {
  const store = await getStore();
  return store.transaction(async (tx) => {
    const meta = await getOwnedApp(owner, appId, tx);
    if (!memberRole(meta, userId)) throw notFound("That person isn't part of this app anymore.");
    setMember(meta, userId, role);
    await tx.put("apps", meta);
    const m = await tx.get<Membership>("memberships", `${appId}:${userId}`);
    if (m) await tx.put("memberships", { ...m, role });
    await audit({ action: "member.role", userId: owner.id, appId, target: userId, detail: role, ip }, tx);
    return meta;
  });
}

export async function removeAdmin(owner: User, appId: string, userId: string, ip?: string) {
  const store = await getStore();
  return store.transaction(async (tx) => {
    const meta = await getOwnedApp(owner, appId, tx);
    setMember(meta, userId, null);
    await tx.put("apps", meta);
    await tx.delete("memberships", `${appId}:${userId}`);
    await audit({ action: "admin.removed", userId: owner.id, appId, target: userId, ip }, tx);
    return meta;
  });
}

/** What the invite page shows before someone accepts. */
export async function inviteInfo(token: string) {
  const store = await getStore();
  const invite = await store.get<Invite>("invites", hash(token));
  if (!invite || !live(invite)) return null;
  const meta = await store.get<AppMeta>("apps", invite.appId);
  if (!meta) return null;
  const owner = await store.get<User>("users", meta.ownerId);
  return { appId: meta.id, appName: meta.name, emoji: meta.emoji, ownerName: owner?.name || "the app's owner", expiresAt: invite.expiresAt, role: invite.role || "admin" };
}

export async function acceptInvite(user: User, token: string, ip?: string) {
  const store = await getStore();
  return store.transaction(async (tx) => {
    const invite = await tx.get<Invite>("invites", hash(String(token || "")));
    if (!invite || !live(invite)) throw notFound("This invite link has expired or was already used. Ask for a new one.");
    const meta = await tx.get<AppMeta>("apps", invite.appId);
    if (!meta) throw notFound("That app doesn't exist anymore.");
    // single use: the link stops working whatever happens next
    await tx.delete("invites", invite.id);
    if (meta.ownerId === user.id) return { meta, role: "owner" as const };
    const current = memberRole(meta, user.id);
    const wanted = invite.role || "admin";
    // an invite never takes access away: an editor who opens an admin link stays an editor
    const role: MemberRole = current === "editor" ? "editor" : wanted;
    if (!current && (meta.adminIds || []).length >= MAX_MEMBERS) throw badRequest(`This app already has ${MAX_MEMBERS} people besides its owner.`);
    if (current !== role) {
      setMember(meta, user.id, role);
      await tx.put("apps", meta);
      await tx.put("memberships", { id: `${meta.id}:${user.id}`, appId: meta.id, userId: user.id, addedAt: nowIso(), role } satisfies Membership);
      await audit({ action: "admin.added", userId: user.id, appId: meta.id, detail: role, ip }, tx);
    }
    return { meta, role };
  });
}

/** When an account is deleted: take it off every app it was part of. */
export async function removeUserFromAllApps(userId: string, tx: StoreOps) {
  for (const m of await tx.find<Membership>("memberships", "userId", userId)) {
    const meta = await tx.get<AppMeta>("apps", m.appId);
    if (meta) {
      setMember(meta, userId, null);
      await tx.put("apps", meta);
    }
    await tx.delete("memberships", m.id);
  }
}

/** Apps this person helps run or edit (for their workspace). */
export async function appsIAdminister(userId: string) {
  const store = await getStore();
  const out: { id: string; name: string; emoji: string; color: string; slug: string | null; role: MemberRole; updatedAt: string }[] = [];
  for (const m of await store.find<Membership>("memberships", "userId", userId)) {
    const meta = await store.get<AppMeta>("apps", m.appId);
    const role = meta && memberRole(meta, userId);
    if (meta && role) out.push({ id: meta.id, name: meta.name, emoji: meta.emoji, color: meta.color, slug: meta.published?.slug ?? null, role, updatedAt: meta.updatedAt });
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
