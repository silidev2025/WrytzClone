import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { AppMeta } from "@/lib/shared/types";
import { currentUser } from "@/lib/server/auth";
import { hasConsent } from "@/lib/server/consent";
import { isAppAdmin } from "@/lib/server/apps";
import { getStore } from "@/lib/server/store";
import { AuthForm } from "@/components/workspace/AuthForm";
import { ConsentStep } from "@/components/workspace/ConsentStep";
import { safeNext } from "@/lib/shared/urls";
import { LEGAL } from "@/lib/shared/legal";
import { TermsStep } from "@/components/workspace/TermsStep";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Where to go after signing in: a path on this site, or (with app subdomains on) a page of
 * one of our own apps. Anything else could send people to a stranger's site.
 */
export default async function AuthPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const appId = typeof sp.app === "string" && /^app_[A-Za-z0-9]{4,40}$/.test(sp.app) ? sp.app : null;
  const store = await getStore();
  const meta = appId ? await store.get<AppMeta>("apps", appId) : null;
  const app = meta?.published ? { id: meta.id, name: meta.name, emoji: meta.emoji } : null;
  const user = await currentUser();
  if (user) {
    if (user.termsVersion !== LEGAL.termsVersion) return <TermsStep next={`/auth?next=${encodeURIComponent(next)}${app ? `&app=${encodeURIComponent(app.id)}` : ""}`} />;
    // signed in: an app only learns who you are after you say so
    if (app && meta && !isAppAdmin(meta, user) && !(await hasConsent(user.id, app.id))) {
      return <ConsentStep app={app} user={{ name: user.name, email: user.email }} next={next} />;
    }
    redirect(next);
  }
  return <AuthForm initialMode={sp.mode === "signup" ? "signup" : "signin"} next={next} app={app} />;
}
