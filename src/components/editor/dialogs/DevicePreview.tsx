"use client";

import { useEffect, useRef, useState } from "react";
import { Laptop, Maximize2, Monitor, QrCode, RotateCw, Smartphone, Tablet } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { toast } from "@/components/ui/toast";

/*
 * Test an app on a specific device: the preview loads in a frame of that device's real screen
 * size (in CSS pixels), so the app lays itself out exactly as it would there, then the frame
 * is scaled down to fit on your screen.
 */

export type DeviceKind = "phone" | "tablet" | "computer" | "fit" | "custom";

export interface Device {
  id: string;
  label: string;
  kind: DeviceKind;
  w: number;
  h: number;
}

export const DEVICES: Device[] = [
  { id: "fit", label: "Fit this window", kind: "fit", w: 0, h: 0 },
  { id: "iphone-se", label: "iPhone SE", kind: "phone", w: 375, h: 667 },
  { id: "iphone-15", label: "iPhone 15 / 15 Pro", kind: "phone", w: 393, h: 852 },
  { id: "iphone-15-max", label: "iPhone 15 Pro Max", kind: "phone", w: 430, h: 932 },
  { id: "pixel-8", label: "Google Pixel 8", kind: "phone", w: 412, h: 915 },
  { id: "galaxy-s24", label: "Samsung Galaxy S24", kind: "phone", w: 360, h: 780 },
  { id: "small-android", label: "Small Android phone", kind: "phone", w: 360, h: 640 },
  { id: "ipad-mini", label: "iPad mini", kind: "tablet", w: 744, h: 1133 },
  { id: "ipad-air", label: "iPad Air", kind: "tablet", w: 820, h: 1180 },
  { id: "ipad-pro", label: 'iPad Pro 12.9"', kind: "tablet", w: 1024, h: 1366 },
  { id: "galaxy-tab", label: "Samsung Galaxy Tab S9", kind: "tablet", w: 800, h: 1280 },
  { id: "laptop", label: "Laptop", kind: "computer", w: 1366, h: 768 },
  { id: "laptop-hd", label: "Laptop (HD+)", kind: "computer", w: 1440, h: 900 },
  { id: "desktop", label: "Desktop monitor", kind: "computer", w: 1920, h: 1080 },
  { id: "custom", label: "Custom size…", kind: "custom", w: 1024, h: 768 },
];

const GROUPS: { label: string; kind: DeviceKind }[] = [
  { label: "Phones", kind: "phone" },
  { label: "Tablets", kind: "tablet" },
  { label: "Computers", kind: "computer" },
];

const STORE_KEY = "cb-preview-device";

function remembered(): { id: string; landscape: boolean; custom: { w: number; h: number } } {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (v && DEVICES.some((d) => d.id === v.id)) return { id: v.id, landscape: !!v.landscape, custom: v.custom?.w ? v.custom : { w: 1024, h: 768 } };
  } catch {
    /* no storage */
  }
  return { id: "iphone-15", landscape: false, custom: { w: 1024, h: 768 } };
}

const clampSize = (n: number) => Math.max(240, Math.min(3840, Math.round(n) || 0));

export function DevicePreview({ appId, src, reloadKey, phoneApp }: { appId: string; src: string; reloadKey: number; phoneApp: boolean }) {
  const [choice, setChoice] = useState(() => (typeof window === "undefined" ? { id: "iphone-15", landscape: false, custom: { w: 1024, h: 768 } } : remembered()));
  const [actualSize, setActualSize] = useState(false);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [qr, setQr] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(choice));
    } catch {
      /* no storage */
    }
  }, [choice]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const device = DEVICES.find((d) => d.id === choice.id) || DEVICES[0];
  const base = device.kind === "custom" ? choice.custom : { w: device.w, h: device.h };
  const rotatable = device.kind === "phone" || device.kind === "tablet" || device.kind === "custom";
  const landscape = rotatable && choice.landscape;
  const w = landscape ? base.h : base.w;
  const h = landscape ? base.w : base.h;
  const fit = device.kind === "fit";
  const bezel = device.kind === "phone" ? 12 : device.kind === "tablet" ? 16 : 0;
  // leave room for the bezel and some breathing space
  const scale = fit || actualSize || !stage.w ? 1 : Math.min(1, (stage.w - 32) / (w + bezel * 2), (stage.h - 32) / (h + bezel * 2));
  const url = typeof window !== "undefined" ? new URL(src, window.location.origin).href : src;
  const local = /localhost|127\.0\.0\.1|\[::1\]/.test(url);

  // The QR code carries a one-hour preview pass, so the phone that scans it doesn't need to be
  // signed in to this account (a phone signed in to another account would otherwise be refused).
  const toggleQr = async () => {
    if (qr) return setQr(null);
    setQrBusy(true);
    try {
      const { pass } = await api<{ pass: string; expiresAt: string }>(`/api/apps/${appId}/preview-pass`, { body: {} });
      const origin = window.location.origin;
      const page = new URL(src, origin).pathname.slice(`/preview/${appId}`.length);
      const link = `${origin}/api/apps/${appId}/preview-pass/open?pass=${encodeURIComponent(pass)}${page ? `&path=${encodeURIComponent(page)}` : ""}`;
      const { toDataURL } = await import("qrcode");
      setQr(await toDataURL(link, { width: 240, margin: 2, errorCorrectionLevel: "L" }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setQrBusy(false);
    }
  };

  return (
    <div className="device-preview">
      <div className="device-bar" role="toolbar" aria-label="Device">
        <label className="device-select">
          {device.kind === "phone" ? <Smartphone size={15} /> : device.kind === "tablet" ? <Tablet size={15} /> : device.kind === "computer" ? <Laptop size={15} /> : <Monitor size={15} />}
          <select value={device.id} onChange={(e) => setChoice((c) => ({ ...c, id: e.target.value }))} aria-label="Device to test on">
            <option value="fit">Fit this window</option>
            {GROUPS.map((g) => (
              <optgroup key={g.kind} label={g.label}>
                {DEVICES.filter((d) => d.kind === g.kind).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} · {d.w}×{d.h}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="custom">Custom size…</option>
          </select>
        </label>
        {device.kind === "custom" && (
          <span className="device-custom">
            <input className="input sm" type="number" min={240} max={3840} value={choice.custom.w} aria-label="Width in pixels" onChange={(e) => setChoice((c) => ({ ...c, custom: { ...c.custom, w: clampSize(Number(e.target.value)) } }))} />
            ×
            <input className="input sm" type="number" min={240} max={3840} value={choice.custom.h} aria-label="Height in pixels" onChange={(e) => setChoice((c) => ({ ...c, custom: { ...c.custom, h: clampSize(Number(e.target.value)) } }))} />
          </span>
        )}
        {rotatable && (
          <button className={`btn sm ${landscape ? "primary" : ""}`} onClick={() => setChoice((c) => ({ ...c, landscape: !c.landscape }))} aria-pressed={landscape} title="Rotate">
            <RotateCw size={14} /> {landscape ? "Landscape" : "Portrait"}
          </button>
        )}
        {!fit && (
          <button className="btn sm" onClick={() => setActualSize((v) => !v)} aria-pressed={actualSize} title={actualSize ? "Scale the device to fit" : "Show at actual size (scroll to see all of it)"}>
            <Maximize2 size={14} /> {actualSize ? "Actual size" : `Fit · ${Math.round(scale * 100)}%`}
          </button>
        )}
        <button className="btn sm" onClick={() => void toggleQr()} disabled={qrBusy} aria-pressed={!!qr} title="Open this preview on a real device">
          <QrCode size={14} /> On a real device
        </button>
      </div>
      {qr && (
        <div className="device-qr">
          <img src={qr} alt="QR code for this preview" width={160} height={160} />
          <span>
            Scan with your phone or tablet camera. It opens this draft for one hour without signing in on that device, so only show the code to people you trust.
            {local && <strong> This address only works on this computer: publish the app, or run the site on your network, to test on other devices.</strong>}
            {phoneApp && " Phone apps can also be installed from the published link."}
          </span>
        </div>
      )}
      <div ref={stageRef} className={`device-stage ${fit ? "fit" : ""} ${actualSize ? "actual" : ""}`}>
        {fit ? (
          <iframe key={reloadKey} title="App preview" src={src} className="device-screen" style={{ width: "100%", height: "100%" }} />
        ) : (
          <div className="device-scaled" style={{ width: (w + bezel * 2) * scale, height: (h + bezel * 2) * scale }}>
            <div className={`device-body ${device.kind}`} style={{ width: w + bezel * 2, height: h + bezel * 2, padding: bezel, transform: `scale(${scale})` }}>
              <iframe key={`${reloadKey}-${w}x${h}`} title={`App preview on ${device.label}`} src={src} className="device-screen" style={{ width: w, height: h }} />
            </div>
          </div>
        )}
      </div>
      <p className="device-note">
        {fit
          ? "The app fills this window. Pick a device above to see it at that screen size."
          : `${device.label}: ${w}×${h} CSS pixels${landscape ? ", landscape" : ""}. Layout and text sizes match the device; touch gestures are simulated with your mouse.`}
      </p>
    </div>
  );
}
