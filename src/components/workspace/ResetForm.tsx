"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { Logo } from "./Logo";

/** "Forgot password" (ask for a link) and the page the link opens (choose a new password). */
export function ResetForm({ mode, token, valid = true }: { mode: "request" | "set"; token?: string; valid?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "request") {
        const res = await api<{ message: string }>("/api/auth/reset", { body: { email } });
        setMessage(res.message);
      } else {
        await api("/api/auth/reset", { body: { token, password } });
        setMessage("Your password is changed and every device was signed out. Sign in with the new password.");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="simple-page">
      <form className="simple-card" onSubmit={submit} noValidate>
        <Logo />
        <h1>{mode === "request" ? "Forgot your password?" : "Choose a new password"}</h1>
        {mode === "set" && !valid ? (
          <>
            <p className="sub">This reset link has expired or was already used. Links work once, for one hour.</p>
            <Link className="btn" href="/reset/request">
              Ask for a new link
            </Link>
          </>
        ) : message ? (
          <>
            <div className="alert info">
              <CircleCheck size={17} style={{ flex: "none", marginTop: 1 }} />
              <span>{message}</span>
            </div>
            <Link className="btn gradient" href="/auth">
              Go to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="sub">{mode === "request" ? "Enter your account's email and we'll send you a link to choose a new password." : "At least 8 characters. Every device signed in to your account will be signed out."}</p>
            {mode === "request" ? (
              <div className="field">
                <label htmlFor="r-email">Email</label>
                <input id="r-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="r-pw">New password</label>
                <input id="r-pw" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              </div>
            )}
            {error && (
              <div className="alert" role="alert">
                <CircleAlert size={17} style={{ flex: "none", marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}
            <button className="btn gradient" disabled={busy || (mode === "request" ? !email : password.length < 8)}>
              {busy ? "Please wait…" : mode === "request" ? "Send reset link" : "Save new password"}
            </button>
            <Link className="field-hint" href="/auth" style={{ textAlign: "center" }}>
              Back to sign in
            </Link>
          </>
        )}
      </form>
    </div>
  );
}
