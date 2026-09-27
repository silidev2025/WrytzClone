import type { AppDoc, AppMeta, Collection, Page, User } from "@/lib/shared/types";
import { currentUser } from "./auth";
import { getAppMeta, viewerFor } from "./apps";
import { hasConsent } from "./consent";
import { appUserId, canRead, listCollections, type Viewer } from "./data";
import { notFound } from "./http";

/**
 * Who is calling a running app, and may they? Unpublished apps only answer their admins.
 * Signed-in people count as signed in *for this app* only after they chose to continue to
 * it (or when they run it); until then the app treats them like any visitor.
 */
export async function runtimeContext(appId: string) {
  const meta = await getAppMeta(appId);
  const account = await currentUser();
  const viewer = await viewerForApp(meta, account);
  if (!meta.published && !viewer.isAdmin) throw notFound("This app isn't published.");
  return { meta, user: viewer.user, viewer, signedInElsewhere: !!account && !viewer.user };
}

/** A signed-in account as one app sees it: known only after consent (or as its admin). */
export async function viewerForApp(meta: AppMeta, account: User | null): Promise<Viewer> {
  const base = viewerFor(meta, account);
  const shared = account && (base.isAdmin || (await hasConsent(account.id, meta.id))) ? account : null;
  return { user: shared, isAdmin: base.isAdmin, appId: meta.id };
}

/**
 * Collection shapes as this visitor's runtime needs them: only collections they can read,
 * only fields they may see, and no access rules.
 */
export function publicSchema(cols: Collection[], viewer: Viewer) {
  return cols
    .filter((c) => canRead(c, viewer))
    .map((c) => ({
      id: c.id,
      name: c.name,
      fields: c.fields
        .filter((f) => viewer.isAdmin || !f.private)
        .map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          required: !!f.required,
          options: f.options,
          currency: f.currency,
          refCollectionId: f.refCollectionId,
          min: f.min,
          max: f.max,
        })),
    }));
}

export function pageAllowed(page: Page, viewer: Viewer): boolean {
  if (page.access === "admins") return viewer.isAdmin;
  if (page.access === "users") return !!viewer.user;
  return true;
}

/**
 * The published design as this visitor may receive it: pages they can't open are sent as
 * empty shells (name and address only), so their text, settings and actions never leave
 * the server.
 */
export function docForViewer(doc: AppDoc, viewer: Viewer): AppDoc {
  if (viewer.isAdmin) return doc;
  return {
    ...doc,
    pages: doc.pages.map((p) =>
      pageAllowed(p, viewer)
        ? p
        : { id: p.id, name: p.name, path: p.path, access: p.access, background: p.background, height: 800, elements: {}, rootIds: [], icon: p.icon, hideInNav: p.hideInNav },
    ),
  };
}

export async function runtimeSession(appId: string) {
  const { meta, user, viewer, signedInElsewhere } = await runtimeContext(appId);
  return {
    // an app sees an id unique to it, never the account id; no bio or other profile details
    user: user ? { id: appUserId(meta.id, user.id), name: user.name, email: user.email, avatarColor: user.avatarColor, isAdmin: viewer.isAdmin } : null,
    signedInElsewhere,
    schema: publicSchema(await listCollections(meta.id), viewer),
  };
}
