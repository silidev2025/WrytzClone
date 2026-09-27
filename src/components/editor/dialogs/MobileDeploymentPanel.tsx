"use client";

import { useEffect, useState } from "react";
import { Copy, Download, ExternalLink, LoaderCircle, Radio, Smartphone, Square } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { DEPLOYMENT_LABELS, type MobileDeployment, type MobileDeploymentList, type MobileTarget } from "@/lib/shared/mobile";
import { toast } from "@/components/ui/toast";

function TunnelCode({ url }: { url: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    setSrc("");
    void import("qrcode").then((qr) => qr.toDataURL(url, { width: 192, margin: 2, errorCorrectionLevel: "M" }))
      .then((value) => { if (active) setSrc(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [url]);
  // Generated locally: the tunnel link is never sent to a QR-code service.
  return src ? <img src={src} width={192} height={192} alt="Scan with your iPhone camera to open the app in Expo Go" /> : null;
}

export function MobileDeploymentPanel({ appId, open, publishedAt, busy, disabled, onPublish }: {
  appId: string; open: boolean; publishedAt?: string; busy: boolean; disabled: boolean;
  onPublish: (target: MobileTarget) => Promise<void>;
}) {
  const [target, setTarget] = useState<MobileTarget>("android");
  const [result, setResult] = useState<MobileDeploymentList | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [stopping, setStopping] = useState("");
  useEffect(() => {
    if (!open) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const data = await api<MobileDeploymentList>(`/api/apps/${appId}/deployments`, { signal: controller.signal });
        if (!disposed) { setResult(data); setError(""); }
      } catch (err) {
        if (!disposed) setError(errorMessage(err));
      } finally {
        if (!disposed) timer = setTimeout(poll, 4000);
      }
    };
    void poll();
    return () => { disposed = true; clearTimeout(timer); controller.abort(); };
  }, [open, appId, publishedAt, refresh]);

  const stop = async (job: MobileDeployment) => {
    setStopping(job.id);
    try {
      await api(`/api/apps/${appId}/deployments/${job.id}`, { method: "DELETE" });
      setRefresh((n) => n + 1);
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setStopping(""); }
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Tunnel link copied"); }
    catch { toast.error("Could not copy the link. Select and copy the address below."); }
  };
  const active = result?.deployments.some((job) => job.target === target &&
    (job.status === "queued" || job.status === "building" || (target === "ios" && job.status === "ready")));
  const unavailable = result?.availability[target];
  return <section className="card mobile-deployment" aria-labelledby="mobile-test-title">
    <h3 id="mobile-test-title"><Smartphone size={18} /> Publish &amp; test on a phone</h3>
    <p className="mini-note">Choose how to test your mobile app. Publishing makes the latest saved design live.</p>
    <fieldset className="mobile-targets" disabled={busy}>
      <legend className="sr-only">Testing method</legend>
      <label className={target === "android" ? "selected" : ""}>
        <input type="radio" name="mobile-target" value="android" checked={target === "android"} onChange={() => setTarget("android")} />
        <span><strong>Android APK</strong><small>Download and install a signed testing app.</small></span>
      </label>
      <label className={target === "ios" ? "selected" : ""}>
        <input type="radio" name="mobile-target" value="ios" checked={target === "ios"} onChange={() => setTarget("ios")} />
        <span><strong>iOS live tunnel</strong><small>Open on an iPhone using Expo Go.</small></span>
      </label>
    </fieldset>
    {target === "android"
      ? <p className="mini-note">For Android 8 or newer. Android may ask you to allow installation from your browser. APK downloads are kept for 7 days.</p>
      : <p className="mini-note">Install Expo Go on your iPhone, then scan the QR code with Camera. Sessions last up to 1 hour while the worker stays connected. Anyone with the tunnel link can open the published app; its sign-in and data rules still apply.</p>}
    {error && <div className="alert error" role="alert">{error} <button className="btn sm" onClick={() => setRefresh((n) => n + 1)}>Retry</button></div>}
    {!error && unavailable && !unavailable.available && <p className="alert info">{unavailable.reason}</p>}
    <button className="btn primary" disabled={busy || disabled || !!error || !unavailable?.available || active} onClick={() => void onPublish(target)}>
      {busy ? <LoaderCircle size={16} className="mobile-spin" /> : target === "android" ? <Download size={16} /> : <Radio size={16} />}
      {busy ? "Publishing…" : target === "android" ? "Publish & build APK" : "Publish & start iOS tunnel"}
    </button>
    {active && <p className="mini-note">A {target === "android" ? "build is already in progress" : "tunnel is already active"}. You can stop it below.</p>}
    <p className="mini-note">Both options open your published web app inside a mobile wrapper and need internet access. Later publishes update its content. These are testing builds; store submission is a separate step.</p>
    <div className="mobile-build-list" aria-live="polite" aria-atomic="false">
      {result?.deployments.map((job) => <article key={job.id} className="mobile-build">
        <div className="mobile-build-heading"><strong>{job.target === "android" ? "Android APK" : "iOS live tunnel"} · revision {job.revision}</strong><span>{DEPLOYMENT_LABELS[job.status]}</span></div>
        <small className="mini-note">{new Date(job.createdAt).toLocaleString()}</small>
        {(job.status === "queued" || job.status === "building") && <p className="mini-note"><LoaderCircle size={14} className="mobile-spin" /> {job.status === "queued" ? "Waiting for the worker. You can close this dialog and return later." : job.target === "android" ? "Compiling and signing your APK…" : "Starting the Expo Go tunnel…"}</p>}
        {job.error && <p className="field-error">{job.error}</p>}
        {job.status === "ready" && <>
          <p className="mini-note">Available until {new Date(job.expiresAt).toLocaleString()}.</p>
          {job.target === "android" ? <>
            <a className="btn primary" href={`/api/apps/${appId}/deployments/${job.id}/apk`} download><Download size={15} /> Download APK{job.size ? ` (${Math.ceil(job.size / 1024)} KB)` : ""}</a>
            <details className="mini-note"><summary>Verify download</summary><code className="mobile-link">SHA-256: {job.sha256}</code></details>
          </> : job.tunnelUrl && <>
            <TunnelCode url={job.tunnelUrl} />
            <div className="mobile-build-actions">
              <a className="btn primary" href={job.tunnelUrl}><ExternalLink size={15} /> Open in Expo Go</a>
              <button className="btn" onClick={() => void copy(job.tunnelUrl!)}><Copy size={15} /> Copy link</button>
            </div>
            <code className="mobile-link">{job.tunnelUrl}</code>
          </>}
        </>}
        {["queued", "building", "ready"].includes(job.status) && <button className="btn sm ghost" disabled={stopping === job.id} onClick={() => void stop(job)}>
          <Square size={13} /> {stopping === job.id ? "Stopping…" : job.status === "ready" && job.target === "android" ? "Remove download" : job.target === "ios" ? "Stop tunnel" : "Cancel build"}
        </button>}
      </article>)}
    </div>
  </section>;
}
