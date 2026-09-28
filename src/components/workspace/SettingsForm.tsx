"use client";

import { useEffect, useState } from "react";
import { Download, LogOut, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import type { PublicUser } from "@/lib/shared/types";
import { LEGAL } from "@/lib/shared/legal";
import { relativeTime } from "@/lib/shared/util";
import { appUrl } from "@/lib/shared/urls";
import { api, errorMessage } from "@/lib/client/api";
import { toast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/Modal";
import { useColorMode } from "./ColorMode";
import { Avatar } from "./Shell";

export function SettingsForm({ user }: { user: PublicUser }) {
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || "");
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [mode, setMode] = useColorMode();
  const [deleting, setDeleting] = useState(false);
  const [delPw, setDelPw] = useState("");
  const [delBusy, setDelBusy] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api("/api/account", { method: "PATCH", body: { name, bio } });
      toast.success("Profile saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setPwBusy(true);
    try {
      await api("/api/account/password", { body: { current, next } });
      setCurrent("");
      setNext("");
      toast.success("Password changed. Other devices were signed out.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPwBusy(false);
    }
  };

  const deleteAccount = async () => {
    setDelBusy(true);
    try {
      await api("/api/account", { method: "DELETE", body: { password: delPw } });
      window.location.href = "/";
    } catch (err) {
      toast.error(errorMessage(err));
      setDelBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="crumbs">Workspace / Settings</div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Your account</h1>
          <p className="page-sub">Manage your profile, password and how the workspace looks.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="card settings-card">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Avatar user={{ name, avatarColor: user.avatarColor }} size={52} />
            <div>
              <h2>Profile</h2>
              <div className="sub">Your name appears on apps you share in Explore.</div>
            </div>
          </div>
          <div className="settings-row">
            <div className="field">
              <label htmlFor="s-name">Name</label>
              <input id="s-name" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="s-email">Email</label>
              <input id="s-email" className="input" value={user.email} disabled />
              <span className="field-hint">To change it, write to the privacy contact on the Contact page. Account id: {user.id}</span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="s-bio">About you</label>
            <textarea id="s-bio" className="textarea" value={bio} maxLength={300} placeholder="A sentence or two (optional)" onChange={(e) => setBio(e.target.value)} />
          </div>
          <div>
            <button className="btn primary" onClick={saveProfile} disabled={saving || !name.trim()}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </section>

        <section className="card settings-card">
          <div>
            <h2>Appearance</h2>
            <div className="sub">Choose how the workspace and editor look. Your apps keep their own theme.</div>
          </div>
          <div className="segmented" role="group" aria-label="Color mode" style={{ width: "fit-content" }}>
            <button aria-pressed={mode === "light"} onClick={() => setMode("light")}>
              <Sun size={14} /> Light
            </button>
            <button aria-pressed={mode === "dark"} onClick={() => setMode("dark")}>
              <Moon size={14} /> Dark
            </button>
            <button aria-pressed={mode === "system"} onClick={() => setMode("system")}>
              <Monitor size={14} /> Match device
            </button>
          </div>
        </section>

        <section className="card settings-card">
          <div>
            <h2>Password</h2>
            <div className="sub">Use at least 8 characters. Changing it signs you out on other devices.</div>
          </div>
          <div className="settings-row">
            <div className="field">
              <label htmlFor="s-cur">Current password</label>
              <input id="s-cur" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="s-new">New password</label>
              <input id="s-new" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
          </div>
          <div>
            <button className="btn" onClick={changePassword} disabled={pwBusy || !current || next.length < 8}>
              {pwBusy ? "Changing…" : "Change password"}
            </button>
          </div>
        </section>

        <SessionsCard />

        <SharedAppsCard />

        <section className="card settings-card">
          <div>
            <h2>Your data</h2>
            <div className="sub">
              Download your profile, owned app designs and data, upload details, contributions you can still read in other apps, and security log. Files are listed with download links; their contents are not included in the JSON. Concurrent edits may appear during the export.
              {LEGAL.privacyEmail ? ` Other privacy requests (correcting your email, objections, questions): ${LEGAL.privacyEmail}.` : ""}
            </div>
          </div>
          <div>
            <a className="btn" href="/api/account/export">
              <Download size={15} /> Download my data
            </a>
          </div>
        </section>

        <section className="card settings-card danger">
          <div>
            <h2>Delete account</h2>
            <div className="sub">
              Permanently deletes your account, every app you made (with its database and files), all your uploads, your admin roles and sign-ins. Things you added to other people&apos;s apps belong to those apps: they stay, but are no longer linked to you — ask each app&apos;s owner if you want them removed.
            </div>
          </div>
          <div>
            <button className="btn danger-ghost" onClick={() => setDeleting(true)}>
              Delete my account…
            </button>
          </div>
        </section>
      </div>

      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete your account?"
        description="This can't be undone. Access ends immediately, and your apps, data and files are queued for deletion. Type your password to confirm."
        footer={
          <>
            <button className="btn ghost" onClick={() => setDeleting(false)}>
              Cancel
            </button>
            <button className="btn danger" disabled={!delPw || delBusy} onClick={deleteAccount}>
              {delBusy ? "Deleting…" : "Delete everything"}
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="del-pw">Password</label>
          <input id="del-pw" className="input" type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} autoFocus />
        </div>
      </Modal>
    </div>
  );
}

interface SessionRow {
  id: string;
  device: string;
  createdAt: string;
  current: boolean;
}

function SessionsCard() {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const load = () =>
    api<{ sessions: SessionRow[] }>("/api/account/sessions")
      .then((r) => setRows(r.sessions))
      .catch(() => setRows([]));
  useEffect(() => {
    void load();
  }, []);
  const signOutOthers = async () => {
    try {
      const r = await api<{ ended: number }>("/api/account/sessions", { method: "DELETE" });
      toast.success(r.ended ? `Signed out ${r.ended} other device${r.ended === 1 ? "" : "s"}` : "No other devices were signed in");
      void load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <section className="card settings-card">
      <div>
        <h2>Signed-in devices</h2>
        <div className="sub">If you see a device you don&apos;t recognise, sign out everywhere else and change your password.</div>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {rows?.map((r) => (
          <div key={r.id} className="insp-row">
            <span style={{ flex: 1 }}>
              {r.device} {r.current && <span className="badge success">This device</span>}
            </span>
            <span className="mini-note" suppressHydrationWarning>
              signed in {relativeTime(r.createdAt)}
            </span>
          </div>
        ))}
      </div>
      <div>
        <button className="btn" onClick={() => void signOutOthers()}>
          <LogOut size={15} /> Sign out everywhere else
        </button>
      </div>
    </section>
  );
}

interface SharedApp {
  appId: string;
  name: string;
  emoji: string;
  slug: string | null;
  at: string;
}

/** Apps made by other people that you chose to share your name and email with. */
function SharedAppsCard() {
  const [rows, setRows] = useState<SharedApp[] | null>(null);
  const load = () =>
    api<{ apps: SharedApp[] }>("/api/consents")
      .then((r) => setRows(r.apps))
      .catch(() => setRows([]));
  useEffect(() => {
    void load();
  }, []);
  const stop = async (a: SharedApp) => {
    try {
      await api("/api/consents", { method: "DELETE", body: { appId: a.appId } });
      toast.success(`${a.name} can't see your details anymore`);
      void load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <section className="card settings-card">
      <div>
        <h2>Apps you shared your details with</h2>
        <div className="sub">These apps see your name and email when you use them. Stop sharing and they treat you like any visitor. What they already saved stays with them.</div>
      </div>
      {rows && !rows.length && <div className="mini-note">None yet.</div>}
      <div style={{ display: "grid", gap: 6 }}>
        {rows?.map((a) => (
          <div key={a.appId} className="insp-row">
            <span style={{ flex: 1 }}>
              {a.emoji}{" "}
              {a.slug ? (
                <a href={appUrl(a.slug)} target="_blank" rel="noopener">
                  {a.name}
                </a>
              ) : (
                a.name
              )}{" "}
              <span className="mini-note" suppressHydrationWarning>
                since {relativeTime(a.at)}
              </span>
            </span>
            <button className="icon-btn sm" onClick={() => void stop(a)} aria-label={`Stop sharing with ${a.name}`} title="Stop sharing">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
