"use client";
import { useState } from "react";
import { LEGAL } from "@/lib/shared/legal";
import { api, errorMessage } from "@/lib/client/api";

export function TermsStep({ next }: { next: string }) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <main className="auth-page"><div className="auth-form-side"><form className="auth-box" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try { await api("/api/auth/terms", { body: { acceptTerms: accepted, version: LEGAL.termsVersion } }); window.location.assign(next); }
    catch (err) { setError(errorMessage(err)); setBusy(false); }
  }}>
    <h1>Review the updated terms</h1>
    <p>Please review the Terms and Privacy notice dated {LEGAL.termsVersion} before continuing to build or manage apps.</p>
    <label className="checkbox-row"><input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /><span>I accept the <a href="/terms" target="_blank" rel="noopener">Terms</a> and acknowledge the <a href="/privacy" target="_blank" rel="noopener">Privacy notice</a>.</span></label>
    {error && <p role="alert">{error}</p>}
    <button className="btn primary" disabled={!accepted || busy}>{busy ? "Saving…" : "Accept and continue"}</button>
    <a href="/settings">Manage, export or delete my account</a>
  </form></div></main>;
}
