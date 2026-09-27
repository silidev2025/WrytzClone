"use client";

import { useState } from "react";
import { CircleAlert, UserRound } from "lucide-react";
import { BRAND } from "@/lib/shared/brand";
import { api, errorMessage } from "@/lib/client/api";
import { Logo } from "./Logo";

/** "Continue to <app>?" — the moment an app built by someone else learns who you are. */
export function ConsentStep({ app, user, next }: { app: { id: string; name: string; emoji: string }; user: { name: string; email: string }; next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const agree = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/consents", { body: { appId: app.id } });
      window.location.href = next;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <div className="simple-page">
      <div className="simple-card">
        <Logo />
        <span className="app-icon" style={{ fontSize: 26 }}>
          {app.emoji}
        </span>
        <h1>Continue to {app.name}?</h1>
        <p className="sub">
          {app.name} is made by someone else using {BRAND.name}. If you continue, it will see:
        </p>
        <div className="alert info">
          <UserRound size={17} style={{ flex: "none", marginTop: 1 }} />
          <span>
            Your name (<strong>{user.name}</strong>) and email (<strong>{user.email}</strong>), and it can save what you add in it together with an ID that is only used in this app.
          </span>
        </div>
        <p className="field-hint" style={{ margin: 0 }}>
          The app&apos;s owner decides what they do with this, so only continue if you trust them. You can stop sharing any time in Settings.
        </p>
        {error && (
          <div className="alert" role="alert">
            <CircleAlert size={17} style={{ flex: "none", marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn gradient" onClick={agree} disabled={busy}>
            {busy ? "Please wait…" : `Continue to ${app.name}`}
          </button>
          <a className="btn ghost" href={next}>
            Not now
          </a>
        </div>
      </div>
    </div>
  );
}
