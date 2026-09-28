"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, Eye, EyeOff, Info } from "lucide-react";
import { BRAND } from "@/lib/shared/brand";
import { LEGAL } from "@/lib/shared/legal";
import { api, errorMessage } from "@/lib/client/api";
import { Logo } from "./Logo";

export function AuthForm({ initialMode, next, app }: { initialMode: "signin" | "signup"; next: string; app: { id: string; name: string } | null }) {
  const appName = app?.name ?? null;
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [terms, setTerms] = useState(false);
  const [age, setAge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (signup && password.length < 8) {
      setError("Passwords need at least 8 characters.");
      return;
    }
    if (signup && (!terms || !age)) {
      setError(!terms ? "Please accept the Terms and the Privacy notice." : `You need to be at least ${LEGAL.minimumAge} to create an account.`);
      return;
    }
    setBusy(true);
    try {
      await api(signup ? "/api/auth/signup" : "/api/auth/login", { body: signup ? { name, email, password, acceptTerms: terms, ageOk: age } : { email, password } });
      // coming from an app: ask before sharing who you are with it
      window.location.href = `/auth?next=${encodeURIComponent(next)}${app ? `&app=${encodeURIComponent(app.id)}` : ""}`;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-art">
        <Logo />
        <div>
          <h2>Your ideas, brought to life — no code needed.</h2>
          <p>Drag and drop your screens like in Canva, fine-tune them like in Figma, and keep your app&apos;s data in a built-in database.</p>
        </div>
        <div className="auth-floats" aria-hidden="true">
          <div className="float-card" style={{ left: 0, top: 0 }}>
            <strong>🎨 Design</strong>
            Drag, snap, style and animate
          </div>
          <div className="float-card" style={{ left: 244, top: 44 }}>
            <strong>🗂️ Database</strong>
            Collections, fields &amp; records
          </div>
          <div className="float-card" style={{ left: 96, top: 124 }}>
            <strong>🚀 Publish</strong>
            Share a real link in one click
          </div>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-box">
          <div className="mobile-only" style={{ marginBottom: 6 }}>
            <Logo />
          </div>
          <div>
            <h1>{signup ? "Create your free account" : "Welcome back"}</h1>
            <p className="sub">{signup ? "Start building apps in minutes." : `Sign in to continue to ${appName || BRAND.name}.`}</p>
          </div>
          {appName && (
            <div className="alert info">
              <Info size={17} style={{ flex: "none", marginTop: 1 }} />
              <span>
                <strong>{appName}</strong> is built with {BRAND.name}. Use your {BRAND.name} account to continue — or create one, it&apos;s free.
              </span>
            </div>
          )}
          <form onSubmit={submit} noValidate>
            {signup && (
              <div className="field">
                <label htmlFor="a-name">Your name</label>
                <input id="a-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" autoFocus />
              </div>
            )}
            <div className="field">
              <label htmlFor="a-email">Email</label>
              <input id="a-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus={!signup} />
            </div>
            <div className="field">
              <label htmlFor="a-pw">Password</label>
              <div className="pw-wrap">
                <input
                  id="a-pw"
                  className="input"
                  type={show ? "text" : "password"}
                  autoComplete={signup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={signup ? "At least 8 characters" : "Your password"}
                  style={{ paddingRight: 44 }}
                />
                <button type="button" className="icon-btn sm" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {signup && (
              <div style={{ display: "grid", gap: 8 }}>
                <label className="checkbox-row">
                  <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                  <span>
                    I agree to the{" "}
                    <Link href="/terms" target="_blank">
                      Terms
                    </Link>{" "}
                    and have read the{" "}
                    <Link href="/privacy" target="_blank">
                      Privacy notice
                    </Link>
                    .
                  </span>
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} />
                  <span>I am {LEGAL.minimumAge} or older.</span>
                </label>
              </div>
            )}
            {error && (
              <div className="alert" role="alert">
                <CircleAlert size={17} style={{ flex: "none", marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}
            <button className="btn gradient lg block" disabled={busy || !email || !password || (signup && (!terms || !age))}>
              {busy ? <span className="spinner" style={{ width: 16, height: 16 }} /> : null}
              {signup ? "Create account" : "Sign in"}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>
          <div className="auth-switch">
            {signup ? "Already have an account? " : "New here? "}
            <button
              type="button"
              onClick={() => {
                setMode(signup ? "signin" : "signup");
                setError(null);
              }}
            >
              {signup ? "Sign in" : "Create a free account"}
            </button>
          </div>
          {!signup && (
            <p className="field-hint" style={{ textAlign: "center" }}>
              <Link href="/reset/request">Forgot your password?</Link>
            </p>
          )}
          <p className="field-hint" style={{ textAlign: "center" }}>
            <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/contact">Contact</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
