"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleAlert, ShieldCheck } from "lucide-react";
import { appUrl } from "@/lib/shared/urls";
import { api, errorMessage } from "@/lib/client/api";
import { Logo } from "./Logo";

interface Info {
  appId: string;
  appName: string;
  emoji: string;
  ownerName: string;
  expiresAt: string;
}

export function InviteAccept({ token, info, userName }: { token: string; info: Info | null; userName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; slug: string | null } | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const { app } = await api<{ app: { name: string; slug: string | null } }>("/api/invites/accept", { body: { token } });
      setDone(app);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="simple-page">
      <div className="simple-card">
        <Logo />
        {!info && !done ? (
          <>
            <h1>This invite doesn&apos;t work anymore</h1>
            <p className="sub">Invite links work once and expire after 7 days. Ask the app&apos;s owner for a new one.</p>
            <Link className="btn" href="/apps">
              Go to my apps
            </Link>
          </>
        ) : done ? (
          <>
            <h1>You&apos;re an admin of {done.name} 🎉</h1>
            <p className="sub">You can open its admin-only pages and manage its records from inside the app.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {done.slug && (
                <a className="btn gradient" href={appUrl(done.slug)}>
                  Open {done.name}
                </a>
              )}
              <Link className="btn" href="/apps">
                My apps
              </Link>
            </div>
          </>
        ) : (
          <>
            <span className="app-icon" style={{ fontSize: 26 }}>
              {info!.emoji}
            </span>
            <h1>
              Help run {info!.appName}?
            </h1>
            <p className="sub">
              {info!.ownerName} invited you to be an admin. You&apos;re signed in as <strong>{userName}</strong>.
            </p>
            <div className="alert info">
              <ShieldCheck size={17} style={{ flex: "none", marginTop: 1 }} />
              <span>Admins can open admin-only pages and see, change and delete every record in this app — including private fields. Only accept if you know the owner.</span>
            </div>
            {error && (
              <div className="alert" role="alert">
                <CircleAlert size={17} style={{ flex: "none", marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn gradient" onClick={accept} disabled={busy}>
                {busy ? "Accepting…" : "Accept invite"}
              </button>
              <Link className="btn ghost" href="/apps">
                No thanks
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
