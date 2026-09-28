"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Copy, ExternalLink, Globe, Rocket, ShieldAlert, Smartphone } from "lucide-react";
import type { AppMeta } from "@/lib/shared/types";
import { relativeTime, slugify } from "@/lib/shared/util";
import { ROOT_DOMAIN, shareableAppUrl } from "@/lib/shared/urls";
import { ACCESS_LABELS } from "@/lib/shared/fields";
import { contactLine } from "@/lib/shared/legal";
import { api, errorMessage } from "@/lib/client/api";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm";
import { ed, useEditor } from "../store";
import { saveNow } from "../saving";
import { MobileDeploymentPanel } from "./MobileDeploymentPanel";
import type { MobileTarget } from "@/lib/shared/mobile";

function VisitsChart({ daily }: { daily: AppMeta["stats"]["daily"] }) {
  const days: { d: string; v: number; s: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    days.push({ d, v: daily?.[d]?.v || 0, s: daily?.[d]?.s || 0 });
  }
  const max = Math.max(1, ...days.map((x) => x.v));
  return (
    <svg viewBox="0 0 300 60" preserveAspectRatio="none" style={{ width: "100%", height: 60 }} role="img" aria-label="Visits over the last 30 days">
      <line x1={0} x2={300} y1={59.5} y2={59.5} stroke="var(--line)" strokeWidth={1} />
      {days.map((x, i) =>
        x.v ? (
          <rect key={x.d} x={i * 10 + 1} y={59 - (x.v / max) * 54} width={8} height={(x.v / max) * 54} rx={2} fill="var(--brand)">
            <title>{`${x.d}: ${x.v} visits, ${x.s} submissions`}</title>
          </rect>
        ) : null,
      )}
    </svg>
  );
}

export function PublishDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useEditor((s) => s.app);
  const revision = useEditor((s) => s.revision);
  const phoneApp = useEditor((s) => s.doc.settings.kind === "mobile");
  const isOwner = useEditor((s) => s.role === "owner");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [explore, setExplore] = useState(false);
  const [check, setCheck] = useState<{ available: boolean; error: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const publishing = useRef(false);
  const [meta, setMeta] = useState<AppMeta>(app);

  useEffect(() => {
    if (!open) return;
    setMeta(app);
    setSlug(app.published?.slug || slugify(app.name));
    setDescription(app.published?.description || app.description || "");
    setExplore(app.published?.explore ?? false);
    // refresh stats
    api<{ app: AppMeta }>(`/api/apps/${app.id}`)
      .then((r) => setMeta(r.app))
      .catch(() => undefined);
  }, [open, app]);

  useEffect(() => {
    if (!open) return;
    const clean = slugify(slug);
    if (!clean) {
      setCheck({ available: false, error: "Choose a link name." });
      return;
    }
    const t = setTimeout(() => {
      api<{ available: boolean; error: string | null }>(`/api/apps/${app.id}/publish?slug=${encodeURIComponent(clean)}`)
        .then(setCheck)
        .catch(() => setCheck(null));
    }, 300);
    return () => clearTimeout(t);
  }, [slug, open, app.id]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const live = meta.published;
  const url = live ? shareableAppUrl(live.slug) : "";
  // what the address will look like, shown next to the link-name box
  const addressPrefix = ROOT_DOMAIN ? "" : `${origin.replace(/^https?:\/\//, "")}/app/`;
  const addressSuffix = ROOT_DOMAIN ? `.${ROOT_DOMAIN}` : "";
  const outdated = !!live && live.revision !== revision;

  const publish = async (mobileTarget?: MobileTarget) => {
    if (publishing.current) return;
    publishing.current = true;
    setBusy(true);
    try {
      if (ed().saveState !== "saved" && !(await saveNow())) throw new Error("Your latest changes have not been saved. Resolve the save error or wait for saving to finish, then publish again.");
      if (ed().saveState !== "saved") throw new Error("Your design changed while saving. Wait for it to finish and publish again.");
      const res = await api<{ app: AppMeta }>(`/api/apps/${app.id}/publish`, { body: { slug: slugify(slug), explore, exploreDesignConsent: explore, description, expectedRevision: ed().revision, mobileTarget } });
      useEditor.setState({ app: res.app });
      setMeta(res.app);
      toast.success(mobileTarget ? "App published. Your phone test is queued." : live ? "Update published!" : "Your app is live! 🎉");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
      publishing.current = false;
    }
  };

  const unpublish = async () => {
    if (!(await confirmDialog({ title: "Take your app offline?", message: "The public link stops working. Your design and data are kept, and you can publish again any time.", confirmLabel: "Unpublish", danger: true }))) return;
    try {
      const res = await api<{ app: AppMeta }>(`/api/apps/${app.id}/publish`, { method: "DELETE" });
      useEditor.setState({ app: res.app });
      setMeta(res.app);
      toast("Your app is offline now.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      className="publish-dialog"
      icon={
        <span className="empty-icon" style={{ width: 44, height: 44, borderRadius: 13, background: "var(--accent-grad)", color: "#fff" }}>
          <Rocket size={20} />
        </span>
      }
      title={live ? "Your app is live" : "Publish your app"}
      description={live ? `Published ${relativeTime(live.at)}. Design changes go live when you publish an update. Database changes (rows, fields and who can access them) apply to the live app right away.` : "Give it a link and share it with the world. You can keep editing afterwards."}
      footer={
        <>
          {live && (
            <button className="btn danger-ghost" style={{ marginRight: "auto" }} onClick={unpublish} disabled={busy}>
              Unpublish
            </button>
          )}
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn gradient" onClick={() => void publish()} disabled={busy || !!meta.takenDown || !!(check && !check.available)}>
            <Rocket size={15} /> {busy ? "Publishing…" : live ? (outdated ? "Publish update" : "Save & republish") : "Publish now"}
          </button>
        </>
      }
    >
      {meta.takenDown && (
        <div className="alert error" role="alert">
          <ShieldAlert size={16} /> The site&apos;s operators took this app offline: {meta.takenDown.reason}. It can&apos;t be published until they allow it. To appeal, contact {contactLine()}.
        </div>
      )}
      {live && (
        <div className="card publish-live-card" style={{ padding: 14, display: "grid", gap: 10, background: "var(--panel-2)" }}>
          <div className="publish-live-link" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Globe size={16} color="var(--success)" />
            <a href={url} target="_blank" rel="noopener" style={{ fontWeight: 650, color: "var(--brand-ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
              {url}
            </a>
            <button
              className="btn sm"
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success("Link copied");
              }}
            >
              <Copy size={14} /> Copy
            </button>
            <a className="btn sm" href={url} target="_blank" rel="noopener">
              <ExternalLink size={14} /> Open
            </a>
          </div>
          {outdated && <div className="alert info">You have changes that aren&apos;t live yet. Click “Publish update”.</div>}
          <div style={{ display: "flex", alignItems: "baseline", gap: 18, fontSize: 13, color: "var(--muted)" }}>
            <span>
              <strong style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{meta.stats.visits}</strong> visits
            </span>
            <span>
              <strong style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{meta.stats.submissions}</strong> submissions
            </span>
            <span style={{ marginLeft: "auto", fontSize: 12 }}>Last 30 days</span>
          </div>
          <VisitsChart daily={meta.stats.daily} />
        </div>
      )}

      {phoneApp && isOwner && <MobileDeploymentPanel appId={app.id} open={open} publishedAt={live?.at} busy={busy} disabled={!!meta.takenDown || !!(check && !check.available)} onPublish={publish} />}

      {live && (
        <details className="card install-help" open={!phoneApp} style={{ padding: "12px 14px", background: "var(--panel-2)" }}>
          <summary style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 650, cursor: "pointer" }}>
            <Smartphone size={16} color="var(--brand)" /> Put it on phones
          </summary>
          <ol style={{ margin: "10px 0 0", paddingLeft: 20, display: "grid", gap: 6, fontSize: 13.5, lineHeight: 1.45 }}>
            <li>Open the link above on the phone (or scan it from a QR code).</li>
            <li>
              <strong>Android:</strong> tap <em>Install</em> when asked, or the browser menu › <em>Add to Home screen</em>.
            </li>
            <li>
              <strong>iPhone:</strong> in Safari tap <em>Share</em> › <em>Add to Home Screen</em>.
            </li>
            <li>It opens full-screen from the home screen, with its own icon, like any app.</li>
          </ol>
          <div className="mini-note" style={{ marginTop: 8 }}>
            Want it in the Play Store or App Store? Paste your link into pwabuilder.com — it wraps installable apps like this one into store packages.
          </div>
        </details>
      )}

      <div className="field">
        <label htmlFor="pub-slug">Link name</label>
        <div className="publish-address">
          {addressPrefix && (
            <span className="mini-note">
              {addressPrefix}
            </span>
          )}
          <input id="pub-slug" className={`input ${check && !check.available ? "invalid" : ""}`} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))} />
          {addressSuffix && (
            <span className="mini-note">
              {addressSuffix}
            </span>
          )}
        </div>
        {check && (
          <span className={check.available ? "field-hint" : "field-error"} style={{ display: "flex", gap: 5, alignItems: "center", color: check.available ? "var(--success)" : undefined }}>
            {check.available ? <CircleCheck size={14} /> : <CircleAlert size={14} />}
            {check.available ? "That link is available." : check.error}
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor="pub-desc">Short description</label>
        <textarea id="pub-desc" className="textarea" rows={2} maxLength={300} value={description} placeholder="What does your app do? (shown in Explore and link previews)" onChange={(e) => setDescription(e.target.value)} />
      </div>
      <label className="checkbox-row">
        <input type="checkbox" checked={explore} onChange={(e) => setExplore(e.target.checked)} />
        <span>
          <strong>List it in Explore</strong> — share a copy of all page designs, text, images, actions and collection schemas, including pages restricted to users or admins and private field definitions. Remove confidential text, defaults and settings before enabling this. Database rows and uploaded record attachments are never copied by a remix.
        </span>
      </label>

      <DataAccessCheck />

      <div className="field">
        <span className="field-label">People</span>
        <span className="field-hint">
          Invite people to edit with you, or to manage the live app, with <strong>Share</strong> in the top bar.
        </span>
      </div>

      <ActivityPanel appId={app.id} open={open} />
    </Modal>
  );
}

/** Before going live: which collections anyone on the internet can read or add to. */
function DataAccessCheck() {
  const collections = useEditor((s) => s.collections);
  if (!collections.length) return null;
  const open = collections.filter((c) => c.access.read === "anyone" || c.access.create === "anyone");
  return (
    <details className="card" style={{ padding: "12px 14px", background: "var(--panel-2)" }} open={open.length > 0}>
      <summary style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 650, cursor: "pointer" }}>
        <ShieldAlert size={16} color={open.length ? "var(--warning, #d97706)" : "var(--success)"} /> Data access check · {open.length ? `${open.length} public collection${open.length === 1 ? "" : "s"}` : "everything is private"}
      </summary>
      <div style={{ display: "grid", gap: 6, marginTop: 10, fontSize: 13.5 }}>
        {collections.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <strong style={{ minWidth: 120 }}>{c.name}</strong>
            <span className="mini-note">
              Read: {ACCESS_LABELS[c.access.read]} · Add: {ACCESS_LABELS[c.access.create]}
              {c.fields.some((f) => f.private) ? " · private fields hidden from visitors" : ""}
            </span>
          </div>
        ))}
        <div className="mini-note">Don&apos;t put personal information in a collection that anyone can read. Change access in the Database tab › Access.</div>
      </div>
    </details>
  );
}

const ACTIVITY_LABELS: Record<string, string> = {
  "app.published": "Published",
  "app.unpublished": "Unpublished",
  "admin.invited": "Invite link created",
  "admin.invite.revoked": "Invite link cancelled",
  "admin.added": "Someone joined",
  "admin.removed": "Someone was removed",
  "member.role": "Someone's access changed",
  "collection.access": "Access rules changed",
  "collection.deleted": "Collection deleted",
  "records.deleted": "Rows deleted in the editor",
  "record.deleted": "Row deleted in the app",
  "media.deleted": "File deleted",
  "consent.given": "Someone shared their details with the app",
  "consent.revoked": "Someone stopped sharing their details",
};

/** Who changed what: publishing, admins, access rules and deletions (kept for a year). */
function ActivityPanel({ appId, open }: { appId: string; open: boolean }) {
  const [events, setEvents] = useState<{ at: string; action: string; target?: string; detail?: string; byYou: boolean }[] | null>(null);
  const load = () =>
    api<{ events: NonNullable<typeof events> }>(`/api/apps/${appId}/activity`)
      .then((r) => setEvents(r.events))
      .catch(() => setEvents([]));
  return (
    <details
      className="card"
      style={{ padding: "12px 14px", background: "var(--panel-2)" }}
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open && open) void load();
      }}
    >
      <summary style={{ fontWeight: 650, cursor: "pointer" }}>Security activity</summary>
      <div style={{ display: "grid", gap: 4, marginTop: 10, fontSize: 13 }}>
        {events === null ? (
          <span className="mini-note">Loading…</span>
        ) : events.length === 0 ? (
          <span className="mini-note">Nothing yet.</span>
        ) : (
          events.slice(0, 50).map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <span className="mini-note" style={{ minWidth: 110 }}>
                {relativeTime(e.at)}
              </span>
              <span>
                {ACTIVITY_LABELS[e.action] || e.action}
                {e.target ? ` · ${e.target}` : ""} {e.byYou ? <span className="mini-note">(you)</span> : null}
              </span>
            </div>
          ))
        )}
      </div>
    </details>
  );
}
