"use client";

import { useEffect, useState } from "react";
import type { Theme, ThemeColors } from "@/lib/shared/types";
import { THEME_COLOR_KEYS, THEME_COLOR_LABELS, THEME_PRESETS, fontStack, readableOn } from "@/lib/shared/theme";
import { loadFonts } from "@/components/runtime/fonts";
import { mutate, useEditor } from "../store";
import { Row, Seg, Slider } from "../inspector/controls";
import { ColorPicker } from "../inspector/ColorPicker";
import { FontPicker } from "../inspector/pickers";
import { Popover } from "@/components/ui/Popover";

function setTheme(patch: Omit<Partial<Theme>, "colors"> & { colors?: Partial<ThemeColors> }) {
  mutate((d) => {
    d.theme = { ...d.theme, ...patch, colors: { ...d.theme.colors, ...(patch.colors || {}) } };
  });
}

function ThemeColor({ k, theme }: { k: keyof ThemeColors; theme: Theme }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <button className="swatch-btn" onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}>
        <span className="swatch">
          <i style={{ background: theme.colors[k] }} />
        </span>
        <span className="label">{THEME_COLOR_LABELS[k]}</span>
        <span className="mini-note" style={{ fontFamily: "var(--mono)" }}>
          {theme.colors[k].toUpperCase()}
        </span>
      </button>
      <Popover anchor={anchor} open={!!anchor} onClose={() => setAnchor(null)} placement="right-start">
        {/* theme colours themselves must be plain colours, so pass a theme copy without tokens */}
        <ColorPicker
          value={theme.colors[k]}
          theme={theme}
          onChange={(v) => {
            if (v && v.startsWith("#")) setTheme({ colors: { [k]: v.slice(0, 7) } as Partial<ThemeColors> });
          }}
        />
      </Popover>
    </>
  );
}

export function ThemePanel() {
  const theme = useEditor((s) => s.doc.theme);
  useEffect(() => {
    loadFonts(THEME_PRESETS.flatMap((p) => [p.headingFont, p.bodyFont]));
  }, []);
  const activePreset = THEME_PRESETS.find((p) => THEME_COLOR_KEYS.every((k) => p.colors[k].toLowerCase() === theme.colors[k].toLowerCase()) && p.headingFont === theme.headingFont && p.bodyFont === theme.bodyFont);
  return (
    <>
      <div className="panel-head">
        <h2>Theme</h2>
      </div>
      <div className="panel-scroll">
        <p className="panel-hint">Your app&apos;s brand kit. Everything using theme colours and fonts updates at once.</p>
        <div className="panel-section-title">Styles</div>
        <div className="theme-presets">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.id}
              className={`theme-preset ${activePreset?.id === p.id ? "active" : ""}`}
              style={{ background: p.colors.background, color: p.colors.text, borderColor: activePreset?.id === p.id ? undefined : p.colors.border }}
              onClick={() => setTheme({ colors: { ...p.colors }, headingFont: p.headingFont, bodyFont: p.bodyFont, radius: p.radius, buttonStyle: p.buttonStyle })}
            >
              <span className="t-sample" style={{ fontFamily: fontStack(p.headingFont, theme) }}>
                Aa
              </span>
              <span className="dots">
                {(["primary", "secondary", "accent", "text"] as const).map((c) => (
                  <i key={c} style={{ background: p.colors[c] }} />
                ))}
              </span>
              <span className="t-name" style={{ fontFamily: fontStack(p.bodyFont, theme) }}>
                {p.name}
              </span>
            </button>
          ))}
        </div>

        <div className="panel-section-title">Colours</div>
        <div style={{ display: "grid", gap: 6 }}>
          {THEME_COLOR_KEYS.map((k) => (
            <ThemeColor key={k} k={k} theme={theme} />
          ))}
        </div>

        <div className="panel-section-title">Fonts</div>
        <div style={{ display: "grid", gap: 8 }}>
          <Row label="Headings">
            <FontPicker value={theme.headingFont} onChange={(f) => f && !f.startsWith("$") && setTheme({ headingFont: f })} theme={theme} allowTheme={false} />
          </Row>
          <Row label="Body">
            <FontPicker value={theme.bodyFont} onChange={(f) => f && !f.startsWith("$") && setTheme({ bodyFont: f })} theme={theme} allowTheme={false} />
          </Row>
        </div>

        <div className="panel-section-title">Shape</div>
        <div style={{ display: "grid", gap: 8 }}>
          <Row label="Corners">
            <Slider value={theme.radius} min={0} max={32} onChange={(radius) => setTheme({ radius })} />
          </Row>
          <Row label="Buttons">
            <Seg
              value={theme.buttonStyle}
              onChange={(buttonStyle) => setTheme({ buttonStyle })}
              options={[
                { value: "filled", label: "Solid" },
                { value: "soft", label: "Soft" },
                { value: "outline", label: "Outline" },
                { value: "pill", label: "Pill" },
              ]}
            />
          </Row>
          <div
            style={{
              marginTop: 4,
              padding: 14,
              borderRadius: 12,
              background: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              display: "grid",
              gap: 8,
            }}
          >
            <span style={{ fontFamily: fontStack(theme.headingFont, theme), fontWeight: 700, fontSize: 20, color: theme.colors.text }}>Preview heading</span>
            <span style={{ fontFamily: fontStack(theme.bodyFont, theme), fontSize: 13, color: theme.colors.muted }}>Body text looks like this.</span>
            <span
              style={{
                justifySelf: "start",
                padding: "8px 16px",
                fontWeight: 600,
                fontSize: 13,
                fontFamily: fontStack(theme.bodyFont, theme),
                borderRadius: theme.buttonStyle === "pill" ? 999 : theme.radius,
                background: theme.buttonStyle === "outline" ? "transparent" : theme.buttonStyle === "soft" ? `${theme.colors.primary}24` : theme.colors.primary,
                color: theme.buttonStyle === "filled" || theme.buttonStyle === "pill" ? readableOn(theme.colors.primary) : theme.colors.primary,
                border: theme.buttonStyle === "outline" ? `2px solid ${theme.colors.primary}` : "none",
              }}
            >
              Button
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
