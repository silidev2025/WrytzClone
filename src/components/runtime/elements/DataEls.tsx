"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { El, Theme } from "@/lib/shared/types";
import { evaluate, hasBindings } from "@/lib/shared/expressions";
import { fillToCss, fontStack, mix, resolveColor, withAlpha } from "@/lib/shared/theme";
import { formatNumber } from "@/lib/shared/util";
import { isStatic, useRT } from "../store";
import { useBindingContext, useRuntimeApi } from "../hooks";
import { useCached } from "../api";
import { aggregateRecords, queryRecords } from "./dataQuery";
import { effectiveFontSize, radiusCss } from "../styles";

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const ro = new ResizeObserver(() => setSize({ w: node.clientWidth, h: node.clientHeight }));
    ro.observe(node);
    setSize({ w: node.clientWidth, h: node.clientHeight });
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

function useAggregate(el: El, groupBy?: string) {
  const live = useLiveAggregate(el, groupBy);
  const thumb = useRT((s) => s.mode === "thumb");
  const examples = useRT((s) => (el.props.collectionId ? s.samples[el.props.collectionId] : undefined));
  // thumbnails: work it out from the example rows
  if (thumb && examples?.length && el.props.dataSource !== "manual") {
    const rows = queryRecords(examples, { filters: el.props.query?.filters });
    return { data: aggregateRecords(rows, el.props.aggregate || "count", el.props.field, groupBy), loading: false, error: null };
  }
  return live;
}

function useLiveAggregate(el: El, groupBy?: string) {
  const api = useRuntimeApi();
  const version = useRT((s) => s.dataVersion);
  const thumb = useRT((s) => s.mode === "thumb");
  const filters = el.props.query?.filters || [];
  const ctx = useBindingContext(filters.some((f) => hasBindings(f.value)));
  const evaluated = filters.map((f) => ({ ...f, value: f.value && ctx ? String(evaluate(f.value, ctx) ?? "") : f.value }));
  const body = {
    collectionId: el.props.collectionId || "",
    aggregate: el.props.aggregate || "count",
    field: el.props.field,
    groupBy,
    filters: evaluated,
  };
  const key = el.props.collectionId && el.props.dataSource !== "manual" && !thumb ? `agg:${JSON.stringify(body)}:${version}` : null;
  return useCached(key, () => api.aggregate(body));
}

export function chartPalette(theme: Theme): string[] {
  const c = theme.colors;
  return [c.primary, c.secondary, c.accent, mix(c.primary, c.secondary, 0.5), mix(c.primary, "#ffffff", 0.45), mix(c.secondary, "#000000", 0.25), mix(c.accent, c.primary, 0.5), mix(c.secondary, "#ffffff", 0.4)];
}

/* ------------------------------------------------------------------ progress */

export function ProgressContent({ el }: { el: El }) {
  const theme = useRT((s) => s.doc.theme);
  const bp = useRT((s) => s.bp);
  const ctx = useBindingContext(hasBindings(el.props.value) || hasBindings(el.props.maxValue));
  const val = Number(ctx ? evaluate(el.props.value ?? "0", ctx) : el.props.value) || 0;
  const max = Number(ctx ? evaluate(el.props.maxValue ?? "100", ctx) : el.props.maxValue) || 100;
  const pct = Math.max(0, Math.min(100, (val / max) * 100));
  const color = fillToCss(el.style.fill, theme) ?? theme.colors.primary;
  const track = withAlpha(theme.colors.border.startsWith("#") ? theme.colors.border : "#e5e5e5", 0.9);
  const fs = effectiveFontSize(el, bp);

  if (el.props.variant === "ring") {
    const stroke = 10;
    const r = 50 - stroke / 2;
    const circ = 2 * Math.PI * r;
    const solid = el.style.fill?.type === "solid" ? resolveColor(el.style.fill.color, theme) : theme.colors.primary;
    return (
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
          <circle cx="50" cy="50" r={r} fill="none" stroke={track} strokeWidth={stroke} />
          <circle cx="50" cy="50" r={r} fill="none" stroke={solid} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(pct / 100) * circ} ${circ}`} style={{ transition: "stroke-dasharray .5s" }} />
        </svg>
        {el.props.showValue !== false && (
          <span style={{ position: "absolute", fontFamily: fontStack("$heading", theme), fontWeight: 700, fontSize: fs * 1.3, color: theme.colors.text }}>{Math.round(pct)}%</span>
        )}
      </div>
    );
  }
  const radius = radiusCss(el, theme) ?? "999px";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, height: "100%" }}>
      <div style={{ flex: 1, height: "100%", minHeight: 4, borderRadius: radius, background: track, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: radius, transition: "width .5s" }} />
      </div>
      {el.props.showValue && <span style={{ fontSize: fs * 0.85, fontWeight: 600, color: theme.colors.text, fontFamily: fontStack("$body", theme) }}>{Math.round(pct)}%</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ stat */

export function StatContent({ el }: { el: El }) {
  const theme = useRT((s) => s.doc.theme);
  const bp = useRT((s) => s.bp);
  const manual = el.props.dataSource === "manual";
  const ctx = useBindingContext(manual && hasBindings(el.props.value));
  const { data, loading } = useAggregate(el);
  let value: number | string = 0;
  if (manual) value = (ctx ? evaluate(el.props.value ?? "", ctx) : el.props.value) as string;
  else value = data?.value ?? 0;
  const num = Number(value);
  const shown = typeof value === "number" || (value !== "" && Number.isFinite(num)) ? formatNumber(num, el.props.decimals) : String(value ?? "");
  const fs = effectiveFontSize(el, bp);
  const pad = el.style.padding ?? 20;
  const align = el.style.textAlign || "left";
  const style: CSSProperties = { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start", gap: 4, height: "100%", padding: pad };
  return (
    <div style={style}>
      {el.props.label && (
        <span style={{ fontFamily: fontStack("$body", theme), fontSize: Math.max(12, fs * 0.4), fontWeight: 600, color: theme.colors.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{el.props.label}</span>
      )}
      <span
        style={{
          fontFamily: fontStack(el.style.fontFamily ?? "$heading", theme),
          fontSize: fs,
          fontWeight: el.style.fontWeight ?? 700,
          color: resolveColor(el.style.color ?? "$text", theme),
          lineHeight: 1.1,
          opacity: loading && !data ? 0.4 : 1,
        }}
      >
        {el.props.prefix}
        {shown}
        {el.props.suffix}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ chart */

function parseManual(text: string | undefined): { label: string; value: number }[] {
  return (text || "")
    .split(/\n/)
    .map((line) => {
      const m = line.match(/^\s*(.+?)\s*[:=,]\s*(-?[\d.,]+)\s*$/);
      return m ? { label: m[1], value: Number(m[2].replace(/,/g, "")) || 0 } : null;
    })
    .filter((x): x is { label: string; value: number } => !!x)
    .slice(0, 30);
}

export function ChartContent({ el }: { el: El }) {
  const theme = useRT((s) => s.doc.theme);
  const bp = useRT((s) => s.bp);
  const { ref, w, h } = useSize<HTMLDivElement>();
  const manual = el.props.dataSource !== "collection";
  const { data: agg } = useAggregate(el, el.props.groupBy || "createdAt");
  // dates read better as "Sep 24"
  const rows = (manual ? parseManual(el.props.manualData) : (agg?.groups ?? [])).map((r) =>
    /^\d{4}-\d{2}-\d{2}$/.test(r.label) ? { ...r, label: new Date(`${r.label}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) } : r,
  );
  const palette = chartPalette(theme);
  const type = el.props.chartType || "bar";
  const fs = Math.max(10, effectiveFontSize(el, bp) * 0.75);
  const muted = theme.colors.muted;
  const font = fontStack("$body", theme);
  const grid = withAlpha(theme.colors.border.startsWith("#") ? theme.colors.border : "#dddddd", 0.9);
  const showLegend = el.props.showLegend !== false;

  let chart: React.ReactNode = null;
  if (w > 20 && h > 20 && rows.length) {
    if (type === "pie" || type === "donut") {
      const total = rows.reduce((a, r) => a + Math.max(0, r.value), 0) || 1;
      const legendW = showLegend && w > 260 ? Math.min(160, w * 0.4) : 0;
      const size = Math.min(w - legendW - 8, h - 8);
      const R = size / 2;
      const cx = R + 4;
      const cy = h / 2;
      let angle = -Math.PI / 2;
      const inner = type === "donut" ? R * 0.58 : 0;
      chart = (
        <svg width={w} height={h} style={{ display: "block" }}>
          {rows.map((r, i) => {
            const frac = Math.max(0, r.value) / total;
            const a0 = angle;
            const a1 = angle + frac * Math.PI * 2;
            angle = a1;
            const large = a1 - a0 > Math.PI ? 1 : 0;
            const p = (a: number, rad: number) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
            const d =
              frac >= 0.9999
                ? `M ${cx - R} ${cy} A ${R} ${R} 0 1 1 ${cx + R} ${cy} A ${R} ${R} 0 1 1 ${cx - R} ${cy}` + (inner ? ` M ${cx - inner} ${cy} A ${inner} ${inner} 0 1 0 ${cx + inner} ${cy} A ${inner} ${inner} 0 1 0 ${cx - inner} ${cy}` : "")
                : inner
                  ? `M ${p(a0, R)} A ${R} ${R} 0 ${large} 1 ${p(a1, R)} L ${p(a1, inner)} A ${inner} ${inner} 0 ${large} 0 ${p(a0, inner)} Z`
                  : `M ${cx} ${cy} L ${p(a0, R)} A ${R} ${R} 0 ${large} 1 ${p(a1, R)} Z`;
            return (
              <path key={r.label} d={d} fill={palette[i % palette.length]} fillRule="evenodd" stroke={theme.colors.background} strokeWidth={1.5}>
                <title>{`${r.label}: ${formatNumber(r.value)}`}</title>
              </path>
            );
          })}
          {legendW > 0 &&
            rows.slice(0, Math.floor(h / (fs + 10))).map((r, i) => (
              <g key={r.label} transform={`translate(${cx + R + 16}, ${Math.max(10, cy - (rows.length * (fs + 10)) / 2) + i * (fs + 10)})`}>
                <rect width={10} height={10} rx={3} y={-fs / 2 - 1} fill={palette[i % palette.length]} />
                <text x={16} y={4} fontSize={fs} fontFamily={font} fill={theme.colors.text}>
                  {r.label.length > 16 ? r.label.slice(0, 15) + "…" : r.label} · {Math.round((Math.max(0, r.value) / total) * 100)}%
                </text>
              </g>
            ))}
        </svg>
      );
    } else {
      const dataMax = Math.max(...rows.map((r) => r.value), 0) || 1;
      const min = Math.min(0, ...rows.map((r) => r.value));
      // round tick steps (1, 2, 2.5, 5 × 10ⁿ); whole numbers when the data is whole numbers
      const rawTick = (dataMax - min) / 4 || 1;
      const mag = Math.pow(10, Math.floor(Math.log10(rawTick)));
      let tick = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rawTick - 1e-9) ?? rawTick;
      if (rows.every((r) => Number.isInteger(r.value))) tick = Math.max(1, Math.round(tick));
      const max = Math.ceil(dataMax / tick) * tick;
      const gridLines: number[] = [];
      for (let v = min; v <= max + 1e-9 && gridLines.length < 12; v += tick) gridLines.push(Math.round(v * 1000) / 1000);
      const padL = Math.max(28, String(formatNumber(max)).length * fs * 0.62 + 8);
      const padB = fs + 14;
      const padT = 10;
      const cw = w - padL - 8;
      const ch = h - padB - padT;
      const y = (v: number) => padT + ch - ((v - min) / (max - min || 1)) * ch;
      const step = cw / rows.length;
      const labelEvery = Math.max(1, Math.ceil((rows.length * (fs * 3.2)) / cw));
      const pts = rows.map((r, i) => [padL + step * i + step / 2, y(r.value)] as const);
      chart = (
        <svg width={w} height={h} style={{ display: "block" }}>
          {gridLines.map((g) => (
            <g key={g}>
              <line x1={padL} x2={w - 4} y1={y(g)} y2={y(g)} stroke={grid} strokeDasharray="3 4" />
              <text x={padL - 6} y={y(g) + fs / 3} fontSize={fs} fontFamily={font} fill={muted} textAnchor="end">
                {formatNumber(Math.round(g * 10) / 10)}
              </text>
            </g>
          ))}
          {type === "bar" &&
            rows.map((r, i) => {
              const bw = Math.max(4, step * 0.62);
              const x = padL + step * i + (step - bw) / 2;
              const top = y(Math.max(0, r.value));
              return (
                <rect key={r.label + i} x={x} y={top} width={bw} height={Math.max(1, y(0) - top)} rx={Math.min(8, bw / 3)} fill={palette[i % palette.length]}>
                  <title>{`${r.label}: ${formatNumber(r.value)}`}</title>
                </rect>
              );
            })}
          {(type === "line" || type === "area") && (
            <>
              {type === "area" && <path d={`M ${pts[0][0]} ${y(min)} ${pts.map((p) => `L ${p[0]} ${p[1]}`).join(" ")} L ${pts[pts.length - 1][0]} ${y(min)} Z`} fill={withAlpha(palette[0], 0.18)} />}
              <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={palette[0]} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={3.5} fill={theme.colors.background} stroke={palette[0]} strokeWidth={2}>
                  <title>{`${rows[i].label}: ${formatNumber(rows[i].value)}`}</title>
                </circle>
              ))}
            </>
          )}
          {rows.map((r, i) =>
            i % labelEvery === 0 ? (
              <text key={"l" + i} x={padL + step * i + step / 2} y={h - 6} fontSize={fs} fontFamily={font} fill={muted} textAnchor="middle">
                {r.label.length > 12 ? r.label.slice(0, 11) + "…" : r.label}
              </text>
            ) : null,
          )}
        </svg>
      );
    }
  }

  return (
    <div ref={ref} style={{ position: "absolute", inset: el.style.padding ?? 8 }}>
      {chart ?? (
        <div className="rt-list-message" style={{ color: muted, fontFamily: font, height: "100%", display: "grid", placeItems: "center" }}>
          {manual ? "Add some data: one “Label: number” per line." : "No data yet."}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ countdown */

export function CountdownContent({ el }: { el: El }) {
  const theme = useRT((s) => s.doc.theme);
  const bp = useRT((s) => s.bp);
  const mode = useRT((s) => s.mode);
  // the clock starts in the browser, so server and client render the same first frame
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (isStatic(mode)) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [mode]);
  const target = new Date(el.props.target || "").getTime();
  const fs = effectiveFontSize(el, bp);
  const color = resolveColor(el.style.color ?? "$text", theme);
  const font = fontStack(el.style.fontFamily ?? "$heading", theme);
  if (!Number.isFinite(target)) return <div className="rt-list-message">Set a date and time</div>;
  let diff = now === null ? 0 : Math.max(0, Math.floor((target - now) / 1000));
  if (diff === 0 && now !== null)
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%", fontFamily: font, fontSize: fs * 0.8, fontWeight: 700, color }}>{el.props.doneText || "It's here!"}</div>
    );
  const d = Math.floor(diff / 86400);
  diff %= 86400;
  const h = Math.floor(diff / 3600);
  diff %= 3600;
  const m = Math.floor(diff / 60);
  const sec = diff % 60;
  const box = el.style.fill ? undefined : withAlpha(theme.colors.primary, 0.08);
  const parts: [number, string][] = [
    [d, "Days"],
    [h, "Hours"],
    [m, "Minutes"],
    [sec, "Seconds"],
  ];
  return (
    <div style={{ display: "flex", gap: 10, height: "100%", justifyContent: el.style.textAlign === "left" ? "flex-start" : "center", alignItems: "stretch" }}>
      {parts.map(([n, label]) => (
        <div key={label} style={{ flex: "1 1 0", maxWidth: 140, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: theme.radius, background: box }}>
          <span style={{ fontFamily: font, fontSize: fs, fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{String(n).padStart(2, "0")}</span>
          <span style={{ fontFamily: fontStack("$body", theme), fontSize: Math.max(10, fs * 0.28), color: theme.colors.muted, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
