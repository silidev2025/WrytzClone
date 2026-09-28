import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { canEditApp, getAppMeta, getDraft } from "@/lib/server/apps";
import { runtimeSession } from "@/lib/server/runtime";
import { previewPassAllows, requestPreviewPass } from "@/lib/server/previewPass";
import { AppRuntime } from "@/components/runtime/AppRuntime";

export const metadata: Metadata = { title: "Preview", robots: { index: false } };

function Blocked({ title, text }: { title: string; text: string }) {
  return (
    <main className="simple-page">
      <div className="simple-card">
        <h1>{title}</h1>
        <p className="sub">{text}</p>
        <div>
          <Link className="btn primary" href="/apps">
            Go to my apps
          </Link>
        </div>
      </div>
    </main>
  );
}

export default async function PreviewPage({ params, searchParams }: { params: Promise<{ appId: string; path?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { appId, path = [] } = await params;
  const { pass: passState } = await searchParams;
  const here = `/preview/${appId}${path.length ? `/${path.join("/")}` : ""}`;
  const user = await currentUser();
  // a phone that scanned the QR code in Preview carries a short-lived pass instead of the editor's account
  const pass = await requestPreviewPass(appId);
  const expired = (
    <Blocked title="This preview code has expired" text="Preview codes work for one hour. In the editor, open Preview, choose “On a real device” and scan the new code." />
  );
  if (!user && !pass) {
    if (passState === "expired") return expired;
    redirect(`/auth?next=${encodeURIComponent(here)}`);
  }
  const meta = await getAppMeta(appId).catch(() => null);
  if (!meta) notFound();
  const ownAccess = canEditApp(meta, user);
  if (!ownAccess && !(await previewPassAllows(meta, pass))) {
    if (passState === "expired") return expired;
    if (!user) redirect(`/auth?next=${encodeURIComponent(here)}`);
    return (
      <Blocked
        title="This account can't preview this app"
        text={`You're signed in as ${user.email}, which can't edit this app. To test it on this device, scan the QR code from the editor's Preview (it works without signing in), or sign in with the account that owns the app.`}
      />
    );
  }
  const draft = await getDraft(appId);
  const session = await runtimeSession(appId);
  return (
    <AppRuntime
      mode="preview"
      appId={appId}
      appName={meta.name}
      doc={draft.doc}
      basePath={`/preview/${appId}`}
      path={path.map((p) => decodeURIComponent(p))}
      session={session}
      editorLink={ownAccess}
    />
  );
}
