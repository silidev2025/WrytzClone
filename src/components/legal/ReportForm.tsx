"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";

export function ReportForm({ reasons, initialApp }: { reasons: string[]; initialApp: string }) {
  const [app, setApp] = useState(initialApp);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done)
    return (
      <div className="alert info">
        <CircleCheck size={17} style={{ flex: "none", marginTop: 1 }} />
        <span>Thank you — we got your report and will look into it.{contact ? " We may contact you if we need more details." : ""}</span>
      </div>
    );

  return (
    <form
      style={{ display: "grid", gap: 14, marginTop: 18 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api("/api/reports", { body: { app, reason, details, contact } });
          setDone(true);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="rp-app">Which app? (its address or name)</label>
        <input id="rp-app" className="input" value={app} onChange={(e) => setApp(e.target.value)} placeholder="https://name.example.com" required />
      </div>
      <div className="field">
        <label htmlFor="rp-reason">What&apos;s wrong?</label>
        <select id="rp-reason" className="select" value={reason} onChange={(e) => setReason(e.target.value)} required>
          <option value="">Choose one</option>
          {reasons.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="rp-details">Details</label>
        <textarea id="rp-details" className="textarea" rows={5} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What did you see? Which page? When?" required />
      </div>
      <div className="field">
        <label htmlFor="rp-contact">Your email (optional)</label>
        <input id="rp-contact" className="input" type="email" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="So we can follow up" />
        <span className="field-hint">Only the site&apos;s operators see it. We use it only to follow up on this report.</span>
      </div>
      {error && (
        <div className="alert" role="alert">
          <CircleAlert size={17} style={{ flex: "none", marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}
      <div>
        <button className="btn gradient" disabled={busy || !app || !reason || details.length < 10}>
          {busy ? "Sending…" : "Send report"}
        </button>
      </div>
    </form>
  );
}
