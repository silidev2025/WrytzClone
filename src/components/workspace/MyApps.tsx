"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Eye, LayoutGrid, Monitor, MoreHorizontal, Pencil, Plus, Search, Smartphone, Sparkles, Trash2, Users } from "lucide-react";
import type { AppMeta } from "@/lib/shared/types";
import type { TemplateCard } from "@/lib/server/templateCards";
import { relativeTime } from "@/lib/shared/util";
import { appUrl } from "@/lib/shared/urls";
import { api, errorMessage } from "@/lib/client/api";
import { Dropdown } from "@/components/ui/Popover";
import { confirmDialog, promptDialog } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toast";
import { MiniPreview, type PreviewData } from "./MiniPreview";
import { CreateAppDialog } from "./CreateAppDialog";

export type AppListItem = AppMeta & { preview: PreviewData | null; pageCount: number };

export interface SharedApp {
  id: string;
  name: string;
  emoji: string;
  color: string;
  slug: string | null;
  role: "editor" | "admin";
  updatedAt: string;
}

/** Apps other people shared with you: editors open the editor, admins the live app. */
function SharedWithYou({ apps }: { apps: SharedApp[] }) {
  if (!apps.length) return null;
  return (
    <section className="shared-apps">
      <div className="section-head">
        <h2>
          <Users size={18} /> Shared with you <span className="badge">{apps.length}</span>
        </h2>
      </div>
      <div className="shared-list">
        {apps.map((a) => {
          const href = a.role === "editor" ? `/editor/${a.id}` : a.slug ? appUrl(a.slug) : null;
          const body = (
            <>
              <span className="app-icon">
                {a.emoji}
              </span>
              <span className="shared-meta">
                <strong>{a.name}</strong>
                <small suppressHydrationWarning>
                  {a.role === "editor" ? "You can edit" : "You're an admin of the live app"} · edited {relativeTime(a.updatedAt)}
                </small>
              </span>
              {a.role === "editor" ? <Pencil size={16} /> : <ExternalLink size={16} />}
            </>
          );
          return href ? (
            <a key={a.id} className="shared-item" href={href}>
              {body}
            </a>
          ) : (
            <span key={a.id} className="shared-item disabled" title="This app isn't published right now.">
              {body}
            </span>
          );
        })}
      </div>
    </section>
  );
}

export function AppCard({ app, onRename, onDuplicate, onDelete }: { app: AppListItem; onRename: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const router = useRouter();
  return (
    <div className="app-card" data-depth={Math.min(3, Math.max(1, app.pageCount || 1))}>
      <div
        className="app-thumb clickable"
        role="link"
        tabIndex={0}
        aria-label={`Open ${app.name}`}
        onClick={() => router.push(`/editor/${app.id}`)}
        onKeyDown={(e) => e.key === "Enter" && router.push(`/editor/${app.id}`)}
      >
        {app.preview ? (
          <MiniPreview preview={app.preview} />
        ) : (
          <div className="thumb-fallback">
            {app.emoji}
          </div>
        )}
      </div>
      {app.published && (
        <span className="corner badge success" title={`Live at ${appUrl(app.published.slug)}`}>
          Live
        </span>
      )}
      <div className="app-card-body">
        <span className="app-icon">
          {app.emoji}
        </span>
        <div className="app-card-meta">
          <h3 title={app.name}>{app.name}</h3>
          <small suppressHydrationWarning>
            {app.kind === "mobile" ? "Mobile app" : "Website"} · {app.published ? "Published" : "Draft"} · edited {relativeTime(app.updatedAt)}
          </small>
        </div>
        <Dropdown
          trigger={
            <button className="icon-btn sm" aria-label={`More actions for ${app.name}`}>
              <MoreHorizontal size={17} />
            </button>
          }
          items={[
            { label: "Open editor", icon: <Pencil size={15} />, onClick: () => router.push(`/editor/${app.id}`) },
            { label: "Preview", icon: <Eye size={15} />, onClick: () => window.open(`/preview/${app.id}`, "_blank") },
            ...(app.published ? [{ label: "View live app", icon: <ExternalLink size={15} />, onClick: () => window.open(appUrl(app.published!.slug), "_blank") }] : []),
            "sep" as const,
            { label: "Rename", icon: <Pencil size={15} />, onClick: onRename },
            { label: "Duplicate", icon: <Copy size={15} />, onClick: onDuplicate },
            "sep" as const,
            { label: "Delete", icon: <Trash2 size={15} />, onClick: onDelete, danger: true },
          ]}
        />
      </div>
    </div>
  );
}

export function MyApps({ initialApps, userName, templates, shared = [] }: { initialApps: AppListItem[]; userName: string; templates: TemplateCard[]; shared?: SharedApp[] }) {
  const router = useRouter();
  const [apps, setApps] = useState(initialApps);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "live">("all");
  const [sort, setSort] = useState<"edited" | "name" | "created">("edited");
  const [creating, setCreating] = useState<string | null>(null);

  const reload = async () => {
    const { apps: fresh } = await api<{ apps: AppListItem[] }>("/api/apps");
    setApps(fresh);
    router.refresh();
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))
      .filter((a) => (filter === "all" ? true : filter === "live" ? !!a.published : !a.published))
      .sort((a, b) =>
        sort === "name" ? a.name.localeCompare(b.name) : sort === "created" ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt),
      );
  }, [apps, query, filter, sort]);

  const rename = async (app: AppListItem) => {
    const name = await promptDialog({ title: "Rename app", label: "App name", defaultValue: app.name, confirmLabel: "Rename", validate: (v) => (v.length > 60 ? "Keep it under 60 characters" : null) });
    if (!name || name === app.name) return;
    try {
      await api(`/api/apps/${app.id}`, { method: "PATCH", body: { name } });
      setApps((list) => list.map((a) => (a.id === app.id ? { ...a, name } : a)));
      toast.success("Renamed");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const duplicate = async (app: AppListItem) => {
    try {
      await api(`/api/apps/${app.id}/duplicate`, { method: "POST", body: {} });
      await reload();
      toast.success(`Made a copy of ${app.name}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async (app: AppListItem) => {
    const ok = await confirmDialog({
      title: `Delete “${app.name}”?`,
      message: "This deletes the app, its pages, its database and its public link. This can't be undone.",
      confirmLabel: "Delete app",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/apps/${app.id}`, { method: "DELETE" });
      setApps((list) => list.filter((a) => a.id !== app.id));
      router.refresh();
      toast.success("App deleted");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const first = userName.split(" ")[0];
  const featured = templates.slice(0, 3);

  return (
    <div className="page">
      <div className="crumbs">Workspace / My apps</div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Hi {first}, what are we building today?</h1>
          <p className="page-sub">Design screens visually, connect a database, and share a working app — no code needed.</p>
        </div>
        <button className="btn gradient lg" onClick={() => setCreating("blank")}>
          <Plus size={18} /> Create new app
        </button>
      </div>

      <section className="quick-start">
        <button className="quick-tile blank" onClick={() => setCreating("blank")}>
          <span className="quick-plus">
            <Monitor size={22} />
          </span>
          <strong>Blank website</strong>
          <small>Fits computers and phones</small>
        </button>
        <button className="quick-tile blank" onClick={() => setCreating("blank-mobile")}>
          <span className="quick-plus">
            <Smartphone size={22} />
          </span>
          <strong>Blank mobile app</strong>
          <small>Installs on phones like an app</small>
        </button>
        {featured.map((t) => (
          <div
            key={t.id}
            className="quick-tile clickable"
            role="button"
            tabIndex={0}
            onClick={() => setCreating(t.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setCreating(t.id))}
          >
            <div className="quick-thumb">{t.preview ? <MiniPreview preview={t.preview} /> : <span>{t.emoji}</span>}</div>
            <strong>{t.name}</strong>
            <small>{t.tagline}</small>
          </div>
        ))}
        <Link className="quick-tile more" href="/templates">
          <span className="quick-plus">
            <Sparkles size={22} />
          </span>
          <strong>More templates</strong>
          <small>Browse every starter</small>
        </Link>
      </section>

      <div className="section-head">
        <h2>
          <LayoutGrid size={18} /> My apps <span className="badge">{apps.length}</span>
        </h2>
      </div>
      {apps.length > 0 && (
        <div className="toolbar">
          <div className="search-box">
            <Search size={16} />
            <input className="input" placeholder="Search your apps…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search your apps" />
          </div>
          <div className="segmented" role="group" aria-label="Filter apps">
            <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
              All
            </button>
            <button aria-pressed={filter === "draft"} onClick={() => setFilter("draft")}>
              Drafts
            </button>
            <button aria-pressed={filter === "live"} onClick={() => setFilter("live")}>
              Published
            </button>
          </div>
          <select className="select" style={{ width: 170 }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort apps">
            <option value="edited">Last edited</option>
            <option value="created">Newest first</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      )}

      {apps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Sparkles size={26} />
          </div>
          <h3>Let&apos;s build your first app</h3>
          <p>Pick a template for a head start, or begin with a blank canvas. You can always change everything.</p>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button className="btn gradient" onClick={() => setCreating("blank")}>
              <Plus size={16} /> Create new app
            </button>
            <Link className="btn" href="/templates">
              Browse templates
            </Link>
          </div>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          <h3>No apps match</h3>
          <p>Try a different search or filter.</p>
        </div>
      ) : (
        <div className="app-grid">
          {shown.map((app) => (
            <AppCard key={app.id} app={app} onRename={() => rename(app)} onDuplicate={() => duplicate(app)} onDelete={() => remove(app)} />
          ))}
        </div>
      )}

      <SharedWithYou apps={shared} />

      <CreateAppDialog
        open={!!creating}
        onClose={() => setCreating(null)}
        templates={templates}
        initialTemplate={creating?.startsWith("blank") ? "blank" : creating || "blank"}
        initialKind={creating === "blank-mobile" ? "mobile" : "website"}
      />
    </div>
  );
}
