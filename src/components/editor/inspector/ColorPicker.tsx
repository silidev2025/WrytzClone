"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { Ban, ImageIcon, Plus, Trash2 } from "lucide-react";
import type { AppDoc, Fill, GradientStop, Theme } from "@/lib/shared/types";
import { GRADIENT_PRESETS, SWATCHES, THEME_COLOR_KEYS, THEME_COLOR_LABELS, fillToCss, gradientCss, parseHex, resolveColor, toHex } from "@/lib/shared/theme";
import { Popover } from "@/components/ui/Popover";
import { beginGesture, endGesture, useEditor } from "../store";
import { NumberField, Seg, Slider } from "./controls";
import { MediaPickerButton } from "./MediaPicker";

/* ------------------------------------------------------------------ colour maths */

function hexToHsv(hex: string): { h: number; s: number; v: number; a: number } {
  const rgb = parseHex(hex) ?? [0, 0, 0, 1];
  const [r, g, b] = rgb.slice(0, 3).map((x) => x / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max, a: rgb[3] };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function withAlphaHex(hex: string, a: number): string {
  if (a >= 0.999) return hex.slice(0, 7);
  return hex.slice(0, 7) + Math.round(a * 255).toString(16).padStart(2, "0");
}

/** Colours used across the document, most frequent first. */
function useDocColors(): string[] {
  const doc = useEditor((s) => s.doc);
  return useMemo(() => docColors(doc), [doc]);
}

function docColors(doc: AppDoc): string[] {
  const count = new Map<string, number>();
  const add = (c: unknown) => {
    if (typeof c === "string" && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(c)) count.set(c.toLowerCase(), (count.get(c.toLowerCase()) || 0) + 1);
  };
  for (const p of doc.pages)
    for (const el of Object.values(p.elements)) {
      const st = el.style;
      if (st.fill?.type === "solid") add(st.fill.color);
      if (st.fill?.type === "gradient") st.fill.stops.forEach((s) => add(s.color));
      add(st.color);
      add(st.borderColor);
    }
  return Array.from(count.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([c]) => c);
}

/* ------------------------------------------------------------------ picker */

export function ColorPicker({ value, onChange, theme, allowNone }: { value: string | undefined; onChange: (v: string | undefined) => void; theme: Theme; allowNone?: boolean }) {
  const resolved = resolveColor(value, theme, "#000000");
  const hex = resolved.startsWith("#") ? resolved : "#000000";
  const initial = hexToHsv(hex);
  const [hsv, setHsv] = useState(initial);
  const [hexText, setHexText] = useState(hex.slice(0, 7));
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null);
  const doc = useDocColors();
  const token = value?.startsWith("$") ? value.slice(1).split("/")[0] : null;
  const tokenAlpha = value?.startsWith("$") && value.includes("/") ? Number(value.split("/")[1]) / 100 : 1;

  const emit = (next: { h: number; s: number; v: number; a: number }) => {
    setHsv(next);
    const h = hsvToHex(next.h, next.s, next.v);
    setHexText(h);
    onChange(withAlphaHex(h, next.a));
  };

  const drag = (ref: React.RefObject<HTMLDivElement | null>, fn: (x: number, y: number) => void) => (e: React.PointerEvent) => {
    const node = ref.current;
    if (!node) return;
    e.preventDefault();
    node.setPointerCapture(e.pointerId);
    beginGesture();
    const apply = (ev: { clientX: number; clientY: number }) => {
      const r = node.getBoundingClientRect();
      fn(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)));
    };
    apply(e);
    const move = (ev: PointerEvent) => apply(ev);
    const up = () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      endGesture();
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
  };

  const pure = hsvToHex(hsv.h, 1, 1);
  const current = hsvToHex(hsv.h, hsv.s, hsv.v);

  return (
    <div className="color-pop">
      <div className="pop-title">Theme colours</div>
      <div className="swatch-row">
        {THEME_COLOR_KEYS.map((k) => (
          <button
            key={k}
            title={`${THEME_COLOR_LABELS[k]} (follows your theme)`}
            aria-pressed={token === k}
            style={{ background: theme.colors[k] }}
            onClick={() => onChange(`$${k}`)}
          />
        ))}
      </div>
      {token && (
        <div className="insp-row">
          <label>Opacity</label>
          <div className="grow">
            <Slider value={Math.round(tokenAlpha * 100)} min={0} max={100} unit="%" onChange={(v) => onChange(v >= 100 ? `$${token}` : `$${token}/${Math.round(v)}`)} />
          </div>
        </div>
      )}
      {doc.length > 0 && (
        <>
          <div className="pop-title">Used in this app</div>
          <div className="swatch-row">
            {doc.map((c) => (
              <button key={c} title={c} aria-pressed={value?.toLowerCase() === c} style={{ background: c }} onClick={() => onChange(c)} />
            ))}
          </div>
        </>
      )}
      <div className="pop-title">Default colours</div>
      <div className="swatch-row six">
        {SWATCHES.map((c) => (
          <button key={c} title={c} aria-pressed={value?.toLowerCase() === c} style={{ background: c }} onClick={() => onChange(c)} />
        ))}
      </div>
      <div className="pop-title">Custom</div>
      <div
        ref={svRef}
        className="sv-box"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pure})` }}
        onPointerDown={drag(svRef, (x, y) => emit({ ...hsv, s: x, v: 1 - y }))}
      >
        <span className="sv-knob" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: current }} />
      </div>
      <div ref={hueRef} className="hue-bar" onPointerDown={drag(hueRef, (x) => emit({ ...hsv, h: Math.min(359.9, x * 360) }))}>
        <span className="hue-knob" style={{ left: `${(hsv.h / 360) * 100}%`, background: pure }} />
      </div>
      <div
        ref={alphaRef}
        className="alpha-bar swatch"
        style={{ width: "100%", height: 12, borderRadius: 6 }}
        onPointerDown={drag(alphaRef, (x) => emit({ ...hsv, a: Math.round(x * 100) / 100 }))}
      >
        <i style={{ background: `linear-gradient(90deg, transparent, ${current})` }} />
        <span className="hue-knob" style={{ left: `${hsv.a * 100}%`, background: current }} />
      </div>
      <div className="insp-grid2" style={{ gridTemplateColumns: "1fr 70px" }}>
        <input
          className="txt-field"
          value={hexText}
          aria-label="Hex colour"
          onChange={(e) => setHexText(e.target.value)}
          onBlur={() => {
            const v = hexText.trim().startsWith("#") ? hexText.trim() : `#${hexText.trim()}`;
            if (parseHex(v)) {
              const next = { ...hexToHsv(v), a: hsv.a };
              emit(next);
            } else setHexText(current);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <NumberField value={Math.round(hsv.a * 100)} unit="%" min={0} max={100} onChange={(v) => emit({ ...hsv, a: v / 100 })} />
      </div>
      {allowNone && (
        <button className="btn sm ghost" onClick={() => onChange(undefined)}>
          <Ban size={14} /> No colour / theme default
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ field */

export function colorLabel(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (value.startsWith("$")) {
    const [tok, alpha] = value.slice(1).split("/");
    const name = THEME_COLOR_LABELS[tok as keyof typeof THEME_COLOR_LABELS] || tok;
    return alpha ? `${name} · ${alpha}%` : name;
  }
  return value.toUpperCase();
}

export function ColorField({
  value,
  onChange,
  theme,
  placeholder = "Default",
  allowNone = true,
  fallback,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  theme: Theme;
  placeholder?: string;
  allowNone?: boolean;
  /** colour shown in the swatch when no value is set */
  fallback?: string;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const shown = value ? resolveColor(value, theme) : fallback ? resolveColor(fallback, theme) : "transparent";
  return (
    <>
      <button className="swatch-btn" onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}>
        <span className="swatch">
          <i style={{ background: shown }} />
        </span>
        <span className="label">{colorLabel(value, placeholder)}</span>
      </button>
      <Popover anchor={anchor} open={!!anchor} onClose={() => setAnchor(null)} placement="left-start">
        <ColorPicker value={value ?? fallback} onChange={onChange} theme={theme} allowNone={allowNone} />
      </Popover>
    </>
  );
}

/* ------------------------------------------------------------------ fills */

type FillKind = "auto" | "none" | "solid" | "gradient" | "image";

/**
 * Fill editor. `themeDefault` is for elements that get a colour from the theme when no fill
 * is set (buttons, pop-ups…): they show a separate "Theme" choice next to "None".
 */
export function FillField({
  value,
  onChange,
  theme,
  allowImage = true,
  themeDefault,
}: {
  value: Fill | undefined;
  onChange: (f: Fill | undefined) => void;
  theme: Theme;
  allowImage?: boolean;
  /** colour token the element uses when no fill is set, e.g. "$primary" */
  themeDefault?: string;
}) {
  const kind: FillKind = value === undefined ? (themeDefault ? "auto" : "none") : value.type;
  const setKind = (k: FillKind) => {
    if (k === kind) return;
    if (k === "auto") onChange(undefined);
    else if (k === "none") onChange(themeDefault ? { type: "none" } : undefined);
    else if (k === "solid") onChange({ type: "solid", color: value?.type === "gradient" ? value.stops[0]?.color || "$primary" : themeDefault || "$primary" });
    else if (k === "gradient") onChange(GRADIENT_PRESETS[11]);
    else onChange({ type: "image", src: "https://picsum.photos/id/1015/1200/800", fit: "cover" });
  };
  const options: { value: FillKind; label: ReactNode; title: string }[] = [];
  if (themeDefault) options.push({ value: "auto", label: "Theme", title: "Use the theme colour" });
  options.push({ value: "none", label: <Ban size={13} />, title: "No fill" });
  options.push({ value: "solid", label: "Color", title: "Solid colour" });
  options.push({ value: "gradient", label: "Gradient", title: "Gradient" });
  if (allowImage) options.push({ value: "image", label: <ImageIcon size={13} />, title: "Image" });
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <Seg value={kind} onChange={setKind} options={options} />
      {value?.type === "solid" && <ColorField value={value.color} onChange={(c) => onChange(c ? { type: "solid", color: c } : undefined)} theme={theme} />}
      {value?.type === "gradient" && <GradientEditor value={value} onChange={onChange} theme={theme} />}
      {value?.type === "image" && (
        <div style={{ display: "grid", gap: 8 }}>
          <div className="swatch" style={{ width: "100%", height: 70, borderRadius: 9 }}>
            <i style={{ background: fillToCss(value, theme) }} />
          </div>
          <MediaPickerButton label="Change image" onPick={(src) => onChange({ ...value, src })} />
          <div className="insp-row">
            <label>Fit</label>
            <div className="grow">
              <Seg
                value={value.fit}
                onChange={(fit) => onChange({ ...value, fit })}
                options={[
                  { value: "cover", label: "Fill" },
                  { value: "contain", label: "Fit" },
                  { value: "tile", label: "Tile" },
                ]}
              />
            </div>
          </div>
          <div className="insp-row">
            <label>Tint</label>
            <div className="grow">
              <ColorField value={value.overlay} onChange={(overlay) => onChange({ ...value, overlay })} theme={theme} placeholder="No tint" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function GradientEditor({ value, onChange, theme }: { value: Extract<Fill, { type: "gradient" }>; onChange: (f: Fill) => void; theme: Theme }) {
  const [active, setActive] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const stops = value.stops;
  const setStops = (next: GradientStop[]) => onChange({ ...value, stops: next });
  const stop = stops[Math.min(active, stops.length - 1)];

  const dragStop = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    setActive(i);
    const bar = barRef.current;
    if (!bar) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    beginGesture();
    const move = (ev: PointerEvent) => {
      const r = bar.getBoundingClientRect();
      const at = Math.round(Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100)));
      setStops(stops.map((s, j) => (j === i ? { ...s, at } : s)));
    };
    const up = (ev: PointerEvent) => {
      (ev.target as HTMLElement).removeEventListener("pointermove", move);
      (ev.target as HTMLElement).removeEventListener("pointerup", up);
      endGesture();
    };
    (e.target as HTMLElement).addEventListener("pointermove", move);
    (e.target as HTMLElement).addEventListener("pointerup", up);
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="swatch-row">
        {GRADIENT_PRESETS.map((g, i) => (
          <button key={i} style={{ background: gradientCss(g, theme) }} title="Use this gradient" onClick={() => onChange(g)} />
        ))}
      </div>
      <div
        ref={barRef}
        className="grad-bar"
        style={{ background: gradientCss({ ...value, kind: "linear", angle: 90 }, theme) }}
        title="Click to add a colour stop"
        onPointerDown={(e) => {
          if (e.target !== barRef.current) return;
          const r = barRef.current!.getBoundingClientRect();
          const at = Math.round(((e.clientX - r.left) / r.width) * 100);
          const next = [...stops, { color: stop.color, at }].sort((a, b) => a.at - b.at);
          setStops(next);
          setActive(next.findIndex((s) => s.at === at));
        }}
      >
        {stops.map((s, i) => (
          <span key={i} className={`grad-stop ${i === active ? "active" : ""}`} style={{ left: `${s.at}%`, background: resolveColor(s.color, theme) }} onPointerDown={dragStop(i)} />
        ))}
      </div>
      <div className="insp-row">
        <label>Stop colour</label>
        <div className="grow" style={{ display: "flex", gap: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <ColorField value={stop.color} allowNone={false} onChange={(c) => c && setStops(stops.map((s, j) => (j === active ? { ...s, color: c } : s)))} theme={theme} />
          </div>
          <button
            className="icon-btn sm"
            title="Remove stop"
            disabled={stops.length <= 2}
            onClick={() => {
              setStops(stops.filter((_, j) => j !== active));
              setActive(0);
            }}
          >
            <Trash2 size={14} />
          </button>
          <button
            className="icon-btn sm"
            title="Add stop"
            onClick={() => {
              const next = [...stops, { color: stop.color, at: 50 }].sort((a, b) => a.at - b.at);
              setStops(next);
            }}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <div className="insp-row">
        <label>Style</label>
        <div className="grow">
          <Seg
            value={value.kind}
            onChange={(kind) => onChange({ ...value, kind })}
            options={[
              { value: "linear", label: "Linear" },
              { value: "radial", label: "Radial" },
            ]}
          />
        </div>
      </div>
      {value.kind === "linear" && (
        <div className="insp-row">
          <label>Angle</label>
          <div className="grow">
            <Slider value={value.angle} min={0} max={360} unit="°" onChange={(angle) => onChange({ ...value, angle })} />
          </div>
        </div>
      )}
    </div>
  );
}
