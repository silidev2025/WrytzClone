"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { El } from "@/lib/shared/types";
import { evaluate, hasBindings } from "@/lib/shared/expressions";
import { safeUrl } from "@/lib/shared/util";
import { Icon } from "@/components/ui/Icon";
import { isStatic, useRT } from "../store";
import { useBindingContext } from "../hooks";

export function parseVideo(url: string): { kind: "youtube" | "vimeo" | "file" | "unknown"; id?: string; src?: string } {
  const u = url.trim();
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i);
  if (m) return { kind: "youtube", id: m[1] };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d{5,})/i);
  if (m) return { kind: "vimeo", id: m[1] };
  if (/^\/api\/media\//.test(u) || /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(u)) return { kind: "file", src: u };
  return { kind: "unknown" };
}

function Placeholder({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="rt-media-placeholder">
      <Icon name={icon} size={30} />
      <span>{label}</span>
    </div>
  );
}

/**
 * Maps, videos and embedded sites come from other companies: the visitor's browser only
 * connects to them after the visitor chooses to (remembered for this browser session).
 */
function ClickToLoad({ provider, icon, action, children }: { provider: string; icon: string; action: string; children: ReactNode }) {
  const key = `cb-embed-ok:${provider}`;
  // starts closed on the server and the first render; the browser then remembers a "yes"
  const [ok, setOk] = useState(false);
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(key) === "1") setOk(true);
    } catch {
      /* ignore */
    }
  }, [key]);
  if (ok) return <>{children}</>;
  return (
    <div className="rt-media-placeholder rt-consent">
      <Icon name={icon} size={28} />
      <button
        type="button"
        className="rt-consent-btn"
        onClick={() => {
          try {
            window.sessionStorage.setItem(key, "1");
          } catch {
            /* ignore */
          }
          setOk(true);
        }}
      >
        {action}
      </button>
      <small>Loads content from {provider}, which can see your IP address.</small>
    </div>
  );
}

export function MediaContent({ el }: { el: El }) {
  const mode = useRT((s) => s.mode);
  const raw = el.type === "map" ? el.props.address || "" : el.props.url || "";
  const ctx = useBindingContext(hasBindings(raw));
  const value = String((ctx ? evaluate(raw, ctx) : raw) ?? "");
  const editor = isStatic(mode);
  const frameStyle = { position: "absolute" as const, inset: 0, width: "100%", height: "100%", border: 0, display: "block" };

  // card thumbnails never load third-party frames
  if (mode === "thumb" && el.type !== "video") return <Placeholder icon={el.type === "map" ? "MapPin" : "Globe"} label="" />;

  if (el.type === "map") {
    if (!value.trim()) return <Placeholder icon="MapPin" label="Add an address" />;
    const src = `https://maps.google.com/maps?q=${encodeURIComponent(value)}&z=${el.props.mapZoom ?? 14}&output=embed`;
    const frame = <iframe title={`Map of ${value}`} src={src} style={frameStyle} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />;
    return editor ? (
      frame
    ) : (
      <ClickToLoad provider="Google Maps" icon="MapPin" action="Show map">
        {frame}
      </ClickToLoad>
    );
  }

  if (el.type === "embed") {
    const url = safeUrl(value);
    if (!url || !/^https:\/\//i.test(url)) return <Placeholder icon="Globe" label="Add a secure (https) link to embed" />;
    const frame = (
      <iframe
        title={el.name}
        src={url}
        style={frameStyle}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
        referrerPolicy="no-referrer"
      />
    );
    return editor ? (
      frame
    ) : (
      <ClickToLoad provider={new URL(url).hostname} icon="Globe" action="Show content">
        {frame}
      </ClickToLoad>
    );
  }

  // video
  const v = parseVideo(value);
  if (v.kind === "youtube") {
    if (editor)
      return (
        <div style={{ position: "absolute", inset: 0, background: "#000" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
          <div className="rt-play-badge">
            <Icon name="Play" size={26} />
          </div>
        </div>
      );
    const p = el.props;
    const params = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      autoplay: p.autoplay ? "1" : "0",
      mute: p.muted || p.autoplay ? "1" : "0",
      controls: p.controls === false ? "0" : "1",
      loop: p.loop ? "1" : "0",
      playsinline: "1",
    });
    if (p.loop) params.set("playlist", v.id!);
    return (
      <ClickToLoad provider="YouTube" icon="Play" action="Play video">
        <iframe
          title={el.name}
          src={`https://www.youtube-nocookie.com/embed/${v.id}?${params}`}
          style={frameStyle}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </ClickToLoad>
    );
  }
  if (v.kind === "vimeo") {
    if (editor) return <Placeholder icon="Video" label="Vimeo video" />;
    const p = el.props;
    return (
      <ClickToLoad provider="Vimeo" icon="Play" action="Play video">
        <iframe
          title={el.name}
          src={`https://player.vimeo.com/video/${v.id}?autoplay=${p.autoplay ? 1 : 0}&muted=${p.muted || p.autoplay ? 1 : 0}&loop=${p.loop ? 1 : 0}`}
          style={frameStyle}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </ClickToLoad>
    );
  }
  if (v.kind === "file") {
    const src = v.src!.startsWith("/") ? v.src! : safeUrl(v.src!);
    if (!src) return <Placeholder icon="Video" label="Add a video link" />;
    const p = el.props;
    return (
      <video
        src={src}
        style={{ ...frameStyle, objectFit: "cover", background: "#000" }}
        controls={!editor && p.controls !== false}
        autoPlay={!editor && !!p.autoplay}
        muted={editor || !!p.muted || !!p.autoplay}
        loop={!!p.loop}
        playsInline
        preload="metadata"
      />
    );
  }
  return <Placeholder icon="Video" label="Paste a YouTube, Vimeo or video file link" />;
}
