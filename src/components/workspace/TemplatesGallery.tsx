"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleCheck, Database, FileText, Monitor, Plus, Search, Smartphone } from "lucide-react";
import type { AppKind } from "@/lib/shared/types";
import type { TemplateCard } from "@/lib/server/templateCards";
import { Modal } from "@/components/ui/Modal";
import { MiniPreview } from "./MiniPreview";
import { CreateAppDialog } from "./CreateAppDialog";

export function TemplatesGallery({ templates, signedIn }: { templates: TemplateCard[]; signedIn: boolean }) {
  const router = useRouter();
  const [cat, setCat] = useState("All");
  const [kind, setKind] = useState<"all" | AppKind>("all");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<TemplateCard | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const cats = useMemo(() => ["All", ...Array.from(new Set(templates.filter((t) => kind === "all" || t.kind === kind).map((t) => t.category)))], [templates, kind]);

  const shown = templates.filter((t) => {
    const q = query.trim().toLowerCase();
    return (
      (kind === "all" || t.kind === kind) &&
      (cat === "All" || t.category === cat) &&
      (!q || `${t.name} ${t.tagline} ${t.description} ${t.category} ${t.kind === "mobile" ? "mobile phone app" : "website"}`.toLowerCase().includes(q))
    );
  });

  const use = (id: string) => {
    if (!signedIn) {
      router.push(`/auth?mode=signup&next=${encodeURIComponent("/templates")}`);
      return;
    }
    setDetail(null);
    setCreating(id);
  };

  return (
    <div className="page">
      <div className="crumbs">Workspace / Templates</div>
      <section className="hero-panel">
        <div className="eyebrow">Your ideas, brought to life</div>
        <h1>A head start for your next idea.</h1>
        <p>Every template is a working app — pages, a database and actions already wired up. Pick one, then make every detail yours.</p>
        <div className="hero-actions">
          <div className="search-box" style={{ maxWidth: 380 }}>
            <Search size={16} />
            <input className="input" placeholder="Search templates…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search templates" />
          </div>
          <button className="btn lg" onClick={() => use("blank")}>
            <Plus size={17} /> Blank canvas
          </button>
        </div>
      </section>

      <div className="gallery-filters">
        <div className="segmented" role="group" aria-label="Websites or mobile apps">
          {(
            [
              ["all", "All", null],
              ["website", "Websites", <Monitor key="m" size={14} />],
              ["mobile", "Mobile apps", <Smartphone key="s" size={14} />],
            ] as const
          ).map(([k, label, ic]) => (
            <button
              key={k}
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                setCat("All");
              }}
            >
              {ic} {label}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Template categories">
          {cats.map((c) => (
            <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="empty-state">
          <h3>No templates match “{query}”</h3>
          <p>Try another word, or start from a blank canvas.</p>
        </div>
      ) : (
        <div className="app-grid">
          {shown.map((t) => (
            <div key={t.id} className="app-card template-card">
              <div
                className="app-thumb clickable"
                role="button"
                tabIndex={0}
                onClick={() => setDetail(t)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setDetail(t))}
                aria-label={`Preview ${t.name}`}
              >
                {t.preview ? <MiniPreview preview={t.preview} /> : <div className="thumb-fallback">{t.emoji}</div>}
              </div>
              <span className="corner badge">
                {t.kind === "mobile" && <Smartphone size={12} style={{ verticalAlign: -2, marginRight: 4 }} />}
                {t.kind === "mobile" ? "Mobile app" : t.category}
              </span>
              <div className="app-card-body">
                <span className="app-icon" style={{ background: `${t.color}1f` }}>
                  {t.emoji}
                </span>
                <div className="app-card-meta">
                  <h3>{t.name}</h3>
                  <p>{t.tagline}</p>
                </div>
                <button className="icon-btn bordered" onClick={() => use(t.id)} aria-label={`Use ${t.name}`} title="Use this template">
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        size="xl"
        title={detail ? `${detail.emoji} ${detail.name}` : ""}
        description={detail?.tagline}
        footer={
          <>
            <button className="btn ghost" onClick={() => setDetail(null)}>
              Close
            </button>
            <button className="btn gradient" onClick={() => detail && use(detail.id)}>
              Use this template <ArrowRight size={16} />
            </button>
          </>
        }
      >
        {detail && (
          <div className="template-detail">
            <div className="big-thumb">{detail.preview && <MiniPreview preview={detail.preview} />}</div>
            <div>
              <p style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>{detail.description}</p>
              <ul className="feature-list">
                {detail.features.map((f) => (
                  <li key={f}>
                    <CircleCheck size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="field-label" style={{ marginTop: 14 }}>
                <FileText size={13} style={{ verticalAlign: -2 }} /> Pages
              </div>
              <div className="meta-row">
                {detail.pages.map((p) => (
                  <span key={p} className="badge">
                    {p}
                  </span>
                ))}
              </div>
              {detail.collections.length > 0 && (
                <>
                  <div className="field-label" style={{ marginTop: 14 }}>
                    <Database size={13} style={{ verticalAlign: -2 }} /> Database collections
                  </div>
                  <div className="meta-row">
                    {detail.collections.map((c) => (
                      <span key={c} className="badge brand">
                        {c}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      <CreateAppDialog open={!!creating} onClose={() => setCreating(null)} templates={templates} initialTemplate={creating || "blank"} initialKind={kind === "mobile" ? "mobile" : "website"} />
    </div>
  );
}
