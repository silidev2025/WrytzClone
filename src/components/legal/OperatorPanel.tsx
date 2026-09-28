"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, Copy } from "lucide-react";
import { relativeTime } from "@/lib/shared/util";
import { appUrl } from "@/lib/shared/urls";
import { api, errorMessage } from "@/lib/client/api";
import { toast } from "@/components/ui/toast";
import { confirmDialog, promptDialog } from "@/components/ui/confirm";

interface ReportRow {
  id: string;
  appRef: string;
  reason: string;
  details: string;
  contact?: string;
  createdAt: string;
  resolution?: string;
  app: { id: string; name: string; slug: string | null } | null;
}

interface Moderation {
  apps: { id: string; name: string; takenDown: { at: string; reason: string; bySuspension?: boolean } }[];
  users: { email: string; name: string; suspended: { at: string; reason: string } }[];
}

export function OperatorPanel({ checks }: { checks: { ok: boolean; label: string }[] }) {
  const [data, setData] = useState<{ open: ReportRow[]; resolved: ReportRow[] } | null>(null);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [mod, setMod] = useState<Moderation | null>(null);
  const [takedown, setTakedown] = useState({ app: "", reason: "" });
  const [suspend, setSuspend] = useState({ email: "", reason: "" });
  const load = () =>
    api<{ open: ReportRow[]; resolved: ReportRow[] }>("/api/operator/reports")
      .then(setData)
      .catch((err) => toast.error(errorMessage(err)));
  const loadMod = () =>
    api<Moderation>("/api/operator/moderation")
      .then(setMod)
      .catch((err) => toast.error(errorMessage(err)));
  useEffect(() => {
    void load();
    void loadMod();
  }, []);
  const moderate = async <T,>(body: Record<string, unknown>, done: (r: T) => string) => {
    try {
      const r = await api<T>("/api/operator/moderation", { body });
      toast.success(done(r));
      void loadMod();
      void load();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  };
  const act = async (id: string, action: "resolve" | "unpublish") => {
    const note = await promptDialog({
      title: action === "unpublish" ? "Take this app offline?" : "Close this report?",
      label: action === "unpublish" ? "Reason (the owner sees it if they try to publish again)" : "Note (optional)",
      defaultValue: "",
      confirmLabel: action === "unpublish" ? "Take offline" : "Close report",
    });
    if (note === null) return;
    try {
      await api("/api/operator/reports", { body: { id, action, note } });
      toast.success(action === "unpublish" ? "App taken offline" : "Report closed");
      void load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <div className="page" style={{ maxWidth: 960, margin: "0 auto" }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Operator</div>
          <h1 className="page-title">Reports, moderation and setup</h1>
          <p className="page-sub">Only the accounts listed in OPERATOR_IDS can open this page.</p>
        </div>
      </div>

      <section className="card settings-card">
        <h2>Setup checks</h2>
        {checks.map((c) => (
          <div key={c.label} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            {c.ok ? <CircleCheck size={17} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} /> : <CircleAlert size={17} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />}
            <span>{c.label}</span>
          </div>
        ))}
      </section>

      <section className="card settings-card" style={{ marginTop: 16 }}>
        <h2>Open reports {data ? `(${data.open.length})` : ""}</h2>
        {data?.open.length === 0 && <div className="mini-note">Nothing to review.</div>}
        {data?.open.map((r) => (
          <div key={r.id} className="card" style={{ padding: 14, display: "grid", gap: 6 }}>
            <div>
              <strong>{r.reason}</strong> · <span className="mini-note">{relativeTime(r.createdAt)}</span>
            </div>
            <div>
              App:{" "}
              {r.app ? (
                r.app.slug ? (
                  <a href={appUrl(r.app.slug)} target="_blank" rel="noopener noreferrer">
                    {r.app.name}
                  </a>
                ) : (
                  `${r.app.name} (offline)`
                )
              ) : (
                <span className="mini-note">not found — they wrote “{r.appRef}”</span>
              )}
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{r.details}</div>
            {r.contact && <div className="mini-note">Reporter: {r.contact}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {r.app?.slug && (
                <button className="btn danger-ghost sm" onClick={() => void act(r.id, "unpublish")}>
                  Take the app offline
                </button>
              )}
              <button className="btn sm" onClick={() => void act(r.id, "resolve")}>
                Close without action
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="card settings-card" style={{ marginTop: 16 }}>
        <h2>Take an app offline</h2>
        <div className="sub">It stays offline — its owner can&apos;t publish it again (or a copy of it) until you allow it. Their design and data are kept.</div>
        <form
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await moderate<{ app: { name: string } }>({ action: "takedown", ...takedown }, (r) => `${r.app.name} is offline`);
            if (ok) setTakedown({ app: "", reason: "" });
          }}
        >
          <input className="input" style={{ flex: "1 1 220px" }} value={takedown.app} onChange={(e) => setTakedown({ ...takedown, app: e.target.value })} placeholder="app address or id" />
          <input className="input" style={{ flex: "2 1 260px" }} value={takedown.reason} onChange={(e) => setTakedown({ ...takedown, reason: e.target.value })} placeholder="reason (the owner sees it)" />
          <button className="btn danger-ghost">Take offline</button>
        </form>
        {mod?.apps.map((a) => (
          <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 200 }}>
              <strong>{a.name}</strong> <span className="mini-note">· {relativeTime(a.takenDown.at)} · {a.takenDown.reason}</span>
            </span>
            {!a.takenDown.bySuspension && (
              <button
                className="btn sm"
                onClick={async () => {
                  if (await confirmDialog({ title: `Allow “${a.name}” again?`, message: "Its owner will be able to publish it again.", confirmLabel: "Allow" }))
                    void moderate({ action: "allow", appId: a.id }, () => "The owner can publish it again");
                }}
              >
                Allow publishing again
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="card settings-card" style={{ marginTop: 16 }}>
        <h2>Suspend an account</h2>
        <div className="sub">They are signed out everywhere, can&apos;t sign in, and their published apps go offline. Lifting the suspension lets them publish those apps again.</div>
        <form
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!(await confirmDialog({ title: `Suspend ${suspend.email}?`, message: "They are signed out right away.", confirmLabel: "Suspend", danger: true }))) return;
            const ok = await moderate<{ apps: number }>({ action: "suspend", ...suspend }, (r) => `Suspended${r.apps ? ` · ${r.apps} app(s) taken offline` : ""}`);
            if (ok) setSuspend({ email: "", reason: "" });
          }}
        >
          <input className="input" type="email" style={{ flex: "1 1 220px" }} value={suspend.email} onChange={(e) => setSuspend({ ...suspend, email: e.target.value })} placeholder="their account email" />
          <input className="input" style={{ flex: "2 1 260px" }} value={suspend.reason} onChange={(e) => setSuspend({ ...suspend, reason: e.target.value })} placeholder="reason (kept in the security log)" />
          <button className="btn danger-ghost">Suspend</button>
        </form>
        {mod?.users.map((u) => (
          <div key={u.email} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 200 }}>
              <strong>{u.email}</strong> <span className="mini-note">· {relativeTime(u.suspended.at)} · {u.suspended.reason}</span>
            </span>
            <button className="btn sm" onClick={() => void moderate<{ apps: number }>({ action: "unsuspend", email: u.email }, (r) => `Suspension lifted${r.apps ? ` · they can publish ${r.apps} app(s) again` : ""}`)}>
              Lift suspension
            </button>
          </div>
        ))}
      </section>

      <section className="card settings-card" style={{ marginTop: 16 }}>
        <h2>Emergency</h2>
        <div className="sub">If accounts may be at risk (for example after a leak), sign everyone out. Everyone except you has to sign in again.</div>
        <div>
          <button
            className="btn danger-ghost"
            onClick={async () => {
              if (await confirmDialog({ title: "Sign everyone out?", message: "Everyone except you has to sign in again.", confirmLabel: "Sign everyone out", danger: true }))
                void moderate<{ signedOut: number }>({ action: "sign-out-everyone" }, (r) => `${r.signedOut} session(s) ended`);
            }}
          >
            Sign everyone out
          </button>
        </div>
      </section>

      <section className="card settings-card" style={{ marginTop: 16 }}>
        <h2>Account recovery</h2>
        <div className="sub">When someone lost access and email isn&apos;t set up: first make sure it&apos;s really them, then create a one-hour reset link and send it to them privately.</div>
        <form
          style={{ display: "flex", gap: 8 }}
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const { path } = await api<{ path: string }>("/api/operator/reset-link", { body: { email } });
              setLink(window.location.origin + path);
            } catch (err) {
              toast.error(errorMessage(err));
            }
          }}
        >
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their account email" />
          <button className="btn">Create reset link</button>
        </form>
        {link && (
          <div style={{ display: "flex", gap: 6 }}>
            <input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <button
              className="btn sm"
              onClick={() => {
                void navigator.clipboard.writeText(link);
                toast.success("Copied");
              }}
            >
              <Copy size={14} /> Copy
            </button>
          </div>
        )}
      </section>

      {data && data.resolved.length > 0 && (
        <section className="card settings-card" style={{ marginTop: 16 }}>
          <h2>Recently closed</h2>
          {data.resolved.map((r) => (
            <div key={r.id} className="mini-note">
              {relativeTime(r.createdAt)} · {r.reason} · {r.app?.name ?? r.appRef} — {r.resolution}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
