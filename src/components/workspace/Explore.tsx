"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, ExternalLink, Eye, Repeat2, Search } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { relativeTime } from "@/lib/shared/util";
import { appUrl } from "@/lib/shared/urls";
import { toast } from "@/components/ui/toast";
import { MiniPreview, type PreviewData } from "./MiniPreview";

interface ExploreApp {
  id: string;
  name: string;
  emoji: string;
  color: string;
  slug: string;
  description: string;
  visits: number;
  author: string;
  publishedAt: string;
  preview: PreviewData | null;
}

export function Explore({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [apps, setApps] = useState<ExploreApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api<{ apps: ExploreApp[] }>(`/api/explore?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => {
          setApps(r.apps);
          setError(null);
        })
        .catch((err) => {
          if ((err as Error).name !== "AbortError") setError(errorMessage(err));
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const remix = async (app: ExploreApp) => {
    if (!signedIn) {
      router.push(`/auth?next=${encodeURIComponent("/explore")}`);
      return;
    }
    try {
      const { app: created } = await api<{ app: { id: string } }>(`/api/apps/${app.id}/remix`, { method: "POST", body: {} });
      toast.success(`Remixed ${app.name} into your workspace`);
      router.push(`/editor/${created.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="page">
      <div className="crumbs">Workspace / Explore</div>
      <section className="hero-panel">
        <div className="eyebrow">A little inspiration goes a long way</div>
        <h1>Look what&apos;s possible.</h1>
        <p>Real apps made by curious people. Open one to try it, or remix it to start your own version.</p>
        <div className="hero-actions">
          <div className="search-box" style={{ maxWidth: 420 }}>
            <Search size={16} />
            <input className="input" placeholder="Find something worth exploring…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search public apps" />
          </div>
        </div>
      </section>

      {error ? (
        <div className="alert">{error}</div>
      ) : apps === null ? (
        <div className="empty-state">
          <span className="spinner" />
          <p>Loading community apps…</p>
        </div>
      ) : apps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Compass size={26} />
          </div>
          <h3>{query ? "Nothing found" : "No public apps yet"}</h3>
          <p>{query ? "Try a different search." : "When makers publish an app and list it in Explore, it shows up here. Yours could be the first!"}</p>
        </div>
      ) : (
        <div className="app-grid">
          {apps.map((a) => (
            <div key={a.id} className="app-card">
              <div
                className="app-thumb clickable"
                role="link"
                tabIndex={0}
                aria-label={`Open ${a.name}`}
                onClick={() => window.open(appUrl(a.slug), "_blank", "noopener")}
                onKeyDown={(e) => e.key === "Enter" && window.open(appUrl(a.slug), "_blank", "noopener")}
              >
                {a.preview ? <MiniPreview preview={a.preview} /> : <div className="thumb-fallback">{a.emoji}</div>}
              </div>
              <span className="corner badge">
                <Eye size={11} /> {a.visits}
              </span>
              <div className="app-card-body">
                <span className="app-icon" style={{ background: `${a.color}1f` }}>
                  {a.emoji}
                </span>
                <div className="app-card-meta">
                  <h3>{a.name}</h3>
                  <small suppressHydrationWarning>
                    by {a.author} · {relativeTime(a.publishedAt)}
                  </small>
                </div>
                <a className="icon-btn bordered" href={appUrl(a.slug)} target="_blank" rel="noopener" title="Open app" aria-label={`Open ${a.name}`}>
                  <ExternalLink size={15} />
                </a>
                <button className="icon-btn bordered" onClick={() => remix(a)} title="Remix into my workspace" aria-label={`Remix ${a.name}`}>
                  <Repeat2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
