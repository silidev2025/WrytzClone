import type { AppMeta, User } from "@/lib/shared/types";
import { nowIso } from "@/lib/shared/util";
import { getStore } from "./store";
import { audit } from "./audit";
import { activeUser } from "./auth";
import { notFound } from "./http";

/*
 * Published apps are made by other people. Being signed in to Craftbase doesn't share your
 * name or email with every app you open: an app only learns who you are after you choose
 * "Continue to <app>" once. You can take that back any time in Settings.
 */

export interface Consent {
  id: string; // `${userId}:${appId}`
  userId: string;
  appId: string;
  at: string;
}

export async function hasConsent(userId: string, appId: string): Promise<boolean> {
  const store = await getStore();
  return !!(await store.get<Consent>("consents", `${userId}:${appId}`));
}

export async function giveConsent(user: User, appId: string, ip?: string) {
  const store = await getStore();
  return store.transaction(async (tx) => {
  await activeUser(tx, user.id);
  const meta = await tx.get<AppMeta>("apps", appId);
  if (!meta || (!meta.published && meta.ownerId !== user.id && !(meta.adminIds || []).includes(user.id))) throw notFound("That app isn't available.");
  await activeUser(tx, meta.ownerId);
  await tx.put("consents", { id: `${user.id}:${appId}`, userId: user.id, appId, at: nowIso() } satisfies Consent);
  await audit({ action: "consent.given", userId: user.id, appId, ip }, tx);
  return meta;
  });
}

export async function revokeConsent(user: User, appId: string, ip?: string) {
  const store = await getStore();
  await store.delete("consents", `${user.id}:${appId}`);
  await audit({ action: "consent.revoked", userId: user.id, appId, ip });
}

export async function listConsents(user: User) {
  const store = await getStore();
  const out: { appId: string; name: string; emoji: string; slug: string | null; at: string }[] = [];
  for (const c of await store.find<Consent>("consents", "userId", user.id)) {
    const meta = await store.get<AppMeta>("apps", c.appId);
    if (meta) out.push({ appId: meta.id, name: meta.name, emoji: meta.emoji, slug: meta.published?.slug ?? null, at: c.at });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
