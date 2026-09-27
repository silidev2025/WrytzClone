"use client";

import type { ReactNode } from "react";
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  ArrowDown,
  ArrowRight,
  Bold,
  Grid3x3,
  Italic,
  Move,
  Strikethrough,
  Underline,
} from "lucide-react";
import type { AnimationName, El, ElementType, Fill, LayoutMode, Shadow, Style, Theme } from "@/lib/shared/types";
import { DEFAULT_LAYOUT, defaultFontSize, defaultRadius, isContainerType, layoutOf, textDefaults } from "@/lib/shared/elements";
import { SHADOW_PRESETS, findFont } from "@/lib/shared/theme";
import { sizeMode } from "@/lib/shared/layout";
import { effectiveFontSize } from "@/components/runtime/styles";
import {
  alignSelection,
  boxAt,
  distributeSelection,
  ed,
  ensureMobileCustom,
  getPage,
  inFreeParent,
  setBox,
  setStyle,
  updateEls,
  useEditor,
} from "../store";
import { NumberField, Row, Section, Seg, Select, Slider, Toggle } from "./controls";
import { ColorField, FillField } from "./ColorPicker";
import { FontPicker } from "./pickers";

const TEXTY: ElementType[] = ["text", "button", "input", "menu", "table", "stat", "countdown", "tabs"];
const NO_FILL: ElementType[] = ["image", "line", "video", "map", "embed", "chart"];
const THEME_FILL: Partial<Record<ElementType, string>> = { button: "$primary", dialog: "$background", stat: "$surface", progress: "$primary" };

const WEIGHTS = [
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra bold" },
  { value: "900", label: "Black" },
];

const ANIMS: { name: AnimationName; label: string }[] = [
  { name: "none", label: "None" },
  { name: "fade", label: "Fade" },
  { name: "slide-up", label: "Rise" },
  { name: "slide-down", label: "Drop" },
  { name: "slide-left", label: "Slide in" },
  { name: "zoom-in", label: "Zoom" },
  { name: "pop", label: "Pop" },
  { name: "bounce", label: "Bounce" },
  { name: "rotate", label: "Twist" },
  { name: "blur-in", label: "Blur" },
];

const HOVERS: { id: string; label: string; hover: Style["hover"] }[] = [
  { id: "none", label: "None", hover: null },
  { id: "lift", label: "Lift", hover: { lift: true } },
  { id: "grow", label: "Grow", hover: { scale: 1.05 } },
  { id: "shrink", label: "Press", hover: { scale: 0.97 } },
  { id: "fade", label: "Fade", hover: { opacity: 0.8 } },
  { id: "glow", label: "Glow", hover: { lift: true, borderColor: "$primary" } },
];

const FILTER_PRESETS: { id: string; label: string; f: Style["filters"] }[] = [
  { id: "none", label: "Original", f: undefined },
  { id: "bw", label: "B&W", f: { grayscale: 100, contrast: 110 } },
  { id: "vintage", label: "Vintage", f: { sepia: 45, contrast: 95, brightness: 105, saturate: 85 } },
  { id: "warm", label: "Warm", f: { sepia: 20, saturate: 125, hue: -8 } },
  { id: "cool", label: "Cool", f: { saturate: 110, hue: 12, brightness: 102 } },
  { id: "vivid", label: "Vivid", f: { saturate: 160, contrast: 112 } },
  { id: "fade", label: "Faded", f: { contrast: 80, brightness: 112, saturate: 80 } },
  { id: "drama", label: "Drama", f: { contrast: 140, brightness: 90, saturate: 90 } },
];

function Group({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gap: 8 }}>{children}</div>;
}

export function DesignTab({ els, theme }: { els: El[]; theme: Theme }) {
  const bp = useEditor((s) => s.bp);
  const page = useEditor((s) => getPage(s));
  const first = els[0];
  const ids = els.map((e) => e.id);
  const multi = els.length > 1;
  const allType = (t: ElementType[]) => els.every((e) => t.includes(e.type));
  const anyType = (t: ElementType[]) => els.some((e) => t.includes(e.type));
  const s = first.style;
  const set = (patch: Partial<Style>) => setStyle(ids, patch);
  const free = els.every((e) => inFreeParent(page, e));
  const flowMobile = bp === "mobile" && !page.mobileCustom;
  const box = boxAt(page, first, bp);
  const container = !multi && isContainerType(first.type) && first.type !== "tabs";
  const L = layoutOf(first);
  const parent = first.parentId ? page.elements[first.parentId] : null;
  const inAuto = !!parent && !inFreeParent(page, first);

  const setLayout = (patch: Partial<typeof DEFAULT_LAYOUT>) =>
    updateEls(ids, (el) => {
      el.props.layout = { ...DEFAULT_LAYOUT, ...(el.props.layout || {}), ...patch };
    });

  const moveTo = (patch: { x?: number; y?: number; w?: number; h?: number; r?: number }) => {
    if (bp === "mobile" && free) ensureMobileCustom();
    for (const id of ids) {
      const el = getPage().elements[id];
      if (!el) continue;
      if (inFreeParent(getPage(), el)) setBox(id, patch, ed().bp);
      else
        updateEls([id], (e) => {
          if (patch.w !== undefined) {
            e.box.w = patch.w;
            e.sizing = { w: "fixed", h: e.sizing?.h ?? "fixed" };
          }
          if (patch.h !== undefined) {
            e.box.h = patch.h;
            e.sizing = { w: e.sizing?.w ?? "fixed", h: "fixed" };
          }
        });
    }
  };

  const fontWeight = s.fontWeight ?? (first.type === "text" ? textDefaults(first).weight : first.type === "button" ? 600 : 400);
  const fontSize = s.fontSize ?? defaultFontSize(first);
  const fontDef = findFont(s.fontFamily && !s.fontFamily.startsWith("$") ? s.fontFamily : s.fontFamily === "$heading" ? theme.headingFont : theme.bodyFont);
  const weights = WEIGHTS.filter((w) => !fontDef || fontDef.weights.includes(Number(w.value)));

  return (
    <>
      {free && !flowMobile && (
        <section className="insp-section">
          <div className="align-bar">
            <button title="Align left" onClick={() => alignSelection("left")}>
              <AlignStartVertical size={15} />
            </button>
            <button title="Align centre" onClick={() => alignSelection("hcenter")}>
              <AlignCenterVertical size={15} />
            </button>
            <button title="Align right" onClick={() => alignSelection("right")}>
              <AlignEndVertical size={15} />
            </button>
            <button title="Align top" onClick={() => alignSelection("top")}>
              <AlignStartHorizontal size={15} />
            </button>
            <button title="Align middle" onClick={() => alignSelection("vcenter")}>
              <AlignCenterHorizontal size={15} />
            </button>
            <button title="Align bottom" onClick={() => alignSelection("bottom")}>
              <AlignEndHorizontal size={15} />
            </button>
            <button title="Distribute horizontally (3+ selected)" disabled={els.length < 3} onClick={() => distributeSelection("x")}>
              <AlignHorizontalSpaceAround size={15} />
            </button>
            <button title="Distribute vertically (3+ selected)" disabled={els.length < 3} onClick={() => distributeSelection("y")}>
              <AlignVerticalSpaceAround size={15} />
            </button>
          </div>
          <div className="mini-note">{multi ? "Aligns the selected elements to each other." : "Aligns to the page or the container it's in."}</div>
        </section>
      )}

      {!multi && (
        <Section title={bp === "mobile" ? "Position & size · phone" : "Position & size"}>
          {flowMobile && free && <div className="mini-note brand">This page arranges itself on phones. Changing a position here switches it to a custom phone layout.</div>}
          {free ? (
            <div className="insp-grid2">
              <NumberField label="X" value={Math.round(box.x)} onChange={(x) => moveTo({ x })} />
              <NumberField label="Y" value={Math.round(box.y)} onChange={(y) => moveTo({ y })} />
              <NumberField label="W" value={Math.round(box.w)} min={4} onChange={(w) => moveTo({ w })} />
              <NumberField label="H" value={Math.round(box.h)} min={4} onChange={(h) => moveTo({ h })} disabled={sizeMode(first, "h") === "hug"} title={sizeMode(first, "h") === "hug" ? "Height follows the content" : undefined} />
              <NumberField label="°" value={box.r || 0} min={-360} max={360} onChange={(r) => moveTo({ r })} />
            </div>
          ) : (
            <div className="insp-grid2">
              <NumberField label="W" value={Math.round(first.box.w)} min={4} onChange={(w) => moveTo({ w })} disabled={sizeMode(first, "w") !== "fixed"} />
              <NumberField label="H" value={Math.round(first.box.h)} min={4} onChange={(h) => moveTo({ h })} disabled={sizeMode(first, "h") !== "fixed"} />
            </div>
          )}
          {(inAuto || ["text", "list", "table", "input", "box", "form"].includes(first.type)) && (
            <>
              <Row label="Width">
                <Seg
                  value={sizeMode(first, "w")}
                  onChange={(w) => updateEls(ids, (el) => void (el.sizing = { w, h: el.sizing?.h ?? sizeMode(el as El, "h") }))}
                  options={[
                    { value: "fixed", label: "Fixed" },
                    ...(inAuto ? [{ value: "fill" as const, label: "Fill", title: "Take the space that's left" }] : []),
                    ...(inAuto && ["text", "button", "box"].includes(first.type) ? [{ value: "hug" as const, label: "Hug", title: "As wide as the content" }] : []),
                  ]}
                />
              </Row>
              <Row label="Height">
                <Seg
                  value={sizeMode(first, "h")}
                  onChange={(h) => updateEls(ids, (el) => void (el.sizing = { w: el.sizing?.w ?? sizeMode(el as El, "w"), h }))}
                  options={[
                    { value: "fixed", label: "Fixed" },
                    { value: "hug", label: "Hug", title: "Grows with the content" },
                    ...(inAuto ? [{ value: "fill" as const, label: "Fill" }] : []),
                  ]}
                />
              </Row>
            </>
          )}
        </Section>
      )}

      {!multi && !first.parentId && first.type !== "dialog" && (
        <Section title="Stay on screen">
          <Seg<"none" | "top" | "bottom">
            value={first.pin ?? "none"}
            onChange={(pin) =>
              updateEls(ids, (el) => {
                if (pin === "none") delete el.pin;
                else el.pin = pin;
              })
            }
            options={[
              { value: "none", label: "Scrolls", title: "Moves with the page" },
              { value: "top", label: "Top", title: "Stays at the top of the screen (headers, nav bars)" },
              { value: "bottom", label: "Bottom", title: "Stays at the bottom of the screen (tab bars, buy buttons)" },
            ]}
          />
          <div className="mini-note">
            {first.pin
              ? `Stays at the ${first.pin} of the screen while people scroll. Try it in Preview.`
              : "Pin a header or tab bar so it stays visible while people scroll."}
          </div>
        </Section>
      )}

      {container && (
        <Section title="Layout">
          <Seg<LayoutMode>
            value={L.mode}
            onChange={(mode) => setLayout({ mode })}
            options={[
              { value: "free", label: <Move size={14} />, title: "Free: place things anywhere" },
              { value: "row", label: <ArrowRight size={14} />, title: "Row: side by side" },
              { value: "column", label: <ArrowDown size={14} />, title: "Column: stacked" },
              { value: "grid", label: <Grid3x3 size={14} />, title: "Grid: equal cells" },
            ]}
          />
          <div className="mini-note">
            {L.mode === "free" ? "Drag things anywhere inside." : L.mode === "row" ? "Children line up side by side." : L.mode === "column" ? "Children stack top to bottom." : "Children fill equal cells, row by row."}
          </div>
          {L.mode !== "free" && (
            <Group>
              <div className="insp-grid2">
                <NumberField label="Gap" value={L.gap} min={0} onChange={(gap) => setLayout({ gap })} />
                <NumberField label="Pad" value={L.padding} min={0} onChange={(padding) => setLayout({ padding })} />
              </div>
              {L.mode === "grid" && (
                <div className="insp-grid2">
                  <NumberField label="Cols" value={L.columns} min={1} max={12} onChange={(columns) => setLayout({ columns: Math.round(columns) })} title="Columns on desktop" />
                  <NumberField label="📱" value={L.mobileColumns ?? 1} min={1} max={4} onChange={(mobileColumns) => setLayout({ mobileColumns: Math.round(mobileColumns) })} title="Columns on phones" />
                </div>
              )}
              <Row label="Align">
                <Seg
                  value={L.align}
                  onChange={(align) => setLayout({ align })}
                  options={[
                    { value: "start", label: "Start" },
                    { value: "center", label: "Mid" },
                    { value: "end", label: "End" },
                    { value: "stretch", label: "Fill" },
                  ]}
                />
              </Row>
              {L.mode !== "grid" && (
                <Row label="Spread">
                  <Select
                    value={L.justify}
                    onChange={(justify) => setLayout({ justify })}
                    options={[
                      { value: "start", label: "Packed at start" },
                      { value: "center", label: "Centred" },
                      { value: "end", label: "Packed at end" },
                      { value: "between", label: "Space between" },
                      { value: "around", label: "Space around" },
                    ]}
                  />
                </Row>
              )}
              {L.mode === "row" && <Toggle checked={L.wrap} onChange={(wrap) => setLayout({ wrap })} label="Wrap onto new lines" />}
            </Group>
          )}
        </Section>
      )}

      {!allType(NO_FILL) && (
        <Section title={first.type === "input" ? "Field background" : first.type === "progress" ? "Bar colour" : "Fill"}>
          <FillField value={s.fill} onChange={(fill: Fill | undefined) => set({ fill })} theme={theme} themeDefault={THEME_FILL[first.type]} allowImage={!["input", "progress"].includes(first.type)} />
        </Section>
      )}

      {anyType(TEXTY) && (
        <Section title="Text">
          <FontPicker value={s.fontFamily} onChange={(fontFamily) => set({ fontFamily })} theme={theme} />
          <div className="insp-grid2">
            <NumberField
              label="Aa"
              value={bp === "mobile" ? effectiveFontSize(first, "mobile") : fontSize}
              min={6}
              max={400}
              title={bp === "mobile" ? "Font size on phones" : "Font size"}
              onChange={(v) =>
                bp === "mobile"
                  ? updateEls(ids, (el) => {
                      el.responsive = { ...(el.responsive || {}), mobile: { ...(el.responsive?.mobile || {}), fontSize: v } };
                    })
                  : set({ fontSize: v })
              }
            />
            <Select value={String(fontWeight)} onChange={(w) => set({ fontWeight: Number(w) })} options={weights.length ? weights : WEIGHTS} />
          </div>
          <Row label="Colour">
            <ColorField value={s.color} onChange={(color) => set({ color })} theme={theme} fallback={first.type === "button" ? undefined : "$text"} placeholder="Theme text" />
          </Row>
          <div className="insp-grid2">
            <Seg
              value={s.textAlign || "left"}
              onChange={(textAlign) => set({ textAlign })}
              options={[
                { value: "left", label: <AlignLeft size={14} />, title: "Left" },
                { value: "center", label: <AlignCenter size={14} />, title: "Centre" },
                { value: "right", label: <AlignRight size={14} />, title: "Right" },
                { value: "justify", label: <AlignJustify size={14} />, title: "Justify" },
              ]}
            />
            <div className="seg">
              <button aria-pressed={(s.fontWeight ?? 400) >= 700} title="Bold" onClick={() => set({ fontWeight: (s.fontWeight ?? fontWeight) >= 700 ? 400 : 700 })}>
                <Bold size={14} />
              </button>
              <button aria-pressed={!!s.italic} title="Italic" onClick={() => set({ italic: !s.italic || undefined })}>
                <Italic size={14} />
              </button>
              <button aria-pressed={!!s.underline} title="Underline" onClick={() => set({ underline: !s.underline || undefined })}>
                <Underline size={14} />
              </button>
              <button aria-pressed={!!s.strike} title="Strikethrough" onClick={() => set({ strike: !s.strike || undefined })}>
                <Strikethrough size={14} />
              </button>
            </div>
          </div>
          <div className="insp-grid2">
            <NumberField label="↕" value={s.lineHeight ?? (first.type === "text" ? textDefaults(first).lh : 1.4)} step={0.05} min={0.6} max={4} onChange={(lineHeight) => set({ lineHeight })} title="Line height" />
            <NumberField label="↔" value={s.letterSpacing ?? 0} step={0.1} min={-10} max={40} onChange={(letterSpacing) => set({ letterSpacing: letterSpacing || undefined })} title="Letter spacing" />
          </div>
          <Row label="Case">
            <Seg
              value={s.textTransform || "none"}
              onChange={(textTransform) => set({ textTransform: textTransform === "none" ? undefined : textTransform })}
              options={[
                { value: "none", label: "Aa" },
                { value: "uppercase", label: "AA" },
                { value: "lowercase", label: "aa" },
                { value: "capitalize", label: "Ab" },
              ]}
            />
          </Row>
          {first.type === "text" && (
            <>
              <Row label="Vertical">
                <Seg
                  value={s.verticalAlign || "top"}
                  onChange={(verticalAlign) => set({ verticalAlign })}
                  options={[
                    { value: "top", label: "Top" },
                    { value: "middle", label: "Middle" },
                    { value: "bottom", label: "Bottom" },
                  ]}
                />
              </Row>
              <Row label="Highlight">
                <ColorField value={s.textHighlight ?? undefined} onChange={(textHighlight) => set({ textHighlight })} theme={theme} placeholder="None" />
              </Row>
              <Row label="Outline">
                <div className="insp-grid2" style={{ gridTemplateColumns: "64px 1fr" }}>
                  <NumberField value={s.textStroke?.width ?? 0} min={0} max={10} step={0.5} onChange={(w) => set({ textStroke: w ? { width: w, color: s.textStroke?.color || "$text" } : null })} />
                  <ColorField value={s.textStroke?.color} onChange={(c) => set({ textStroke: { width: s.textStroke?.width || 1, color: c || "$text" } })} theme={theme} placeholder="Colour" />
                </div>
              </Row>
              <Toggle
                checked={!!s.textShadow}
                onChange={(on) => set({ textShadow: on ? { x: 0, y: 2, blur: 8, spread: 0, color: "rgba(0,0,0,0.35)" } : null })}
                label="Text shadow"
              />
              {s.textShadow && <ShadowFields value={s.textShadow} onChange={(textShadow) => set({ textShadow })} theme={theme} noSpread />}
            </>
          )}
          {(first.type === "text" || first.type === "button") && (
            <div className="insp-grid2">
              <NumberField label="⇆" value={s.paddingX ?? s.padding ?? (first.type === "button" ? 18 : 0)} min={0} onChange={(paddingX) => set({ paddingX })} title="Padding left & right" />
              <NumberField label="⇅" value={s.paddingY ?? s.padding ?? 0} min={0} onChange={(paddingY) => set({ paddingY })} title="Padding top & bottom" />
            </div>
          )}
        </Section>
      )}

      {first.type === "line" && (
        <Section title="Line">
          <Row label="Colour">
            <ColorField value={s.color} onChange={(color) => set({ color })} theme={theme} fallback="$border" placeholder="Theme border" />
          </Row>
        </Section>
      )}
      {first.type === "icon" && (
        <Section title="Icon colour">
          <ColorField value={s.color} onChange={(color) => set({ color })} theme={theme} fallback="$primary" placeholder="Theme primary" />
          <NumberField label="Pad" value={s.padding ?? 0} min={0} onChange={(padding) => set({ padding })} title="Space around the icon" />
        </Section>
      )}

      {!allType(["line"]) && (
        <Section title="Border & corners" defaultOpen={!!(s.borderWidth || s.radius || s.radii)}>
          <div className="insp-grid2" style={{ gridTemplateColumns: "76px 1fr" }}>
            <NumberField label="W" value={s.borderWidth ?? 0} min={0} max={40} onChange={(borderWidth) => set({ borderWidth: borderWidth || undefined })} title="Border width" />
            <ColorField value={s.borderColor} onChange={(borderColor) => set({ borderColor })} theme={theme} fallback="$border" placeholder="Theme border" />
          </div>
          {!!s.borderWidth && (
            <Seg
              value={s.borderStyle || "solid"}
              onChange={(borderStyle) => set({ borderStyle })}
              options={[
                { value: "solid", label: "Solid" },
                { value: "dashed", label: "Dashed" },
                { value: "dotted", label: "Dotted" },
              ]}
            />
          )}
          {!(first.type === "shape" && first.props.shape !== "rect") && (
            <>
              <Row label="Corners">
                <Slider value={s.radius ?? defaultRadius(first, theme)} min={0} max={first.type === "button" ? 100 : 200} onChange={(radius) => set({ radius, radii: null })} />
              </Row>
              <Toggle
                checked={!!s.radii}
                onChange={(on) => {
                  const r = s.radius ?? defaultRadius(first, theme);
                  set({ radii: on ? [r, r, r, r] : null });
                }}
                label="Different corner for each side"
              />
              {s.radii && (
                <div className="insp-grid4">
                  {(["↖", "↗", "↘", "↙"] as const).map((lbl, i) => (
                    <NumberField
                      key={lbl}
                      label={lbl}
                      value={s.radii![i]}
                      min={0}
                      onChange={(v) => {
                        const next = [...s.radii!] as [number, number, number, number];
                        next[i] = v;
                        set({ radii: next });
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </Section>
      )}

      <Section title="Shadow" defaultOpen={!!s.shadow}>
        <div className="preset-chips">
          {SHADOW_PRESETS.map((p) => (
            <button key={p.id} aria-pressed={p.shadow ? JSON.stringify(p.shadow) === JSON.stringify(s.shadow) : !s.shadow} onClick={() => set({ shadow: p.shadow })}>
              {p.label}
            </button>
          ))}
        </div>
        {s.shadow && <ShadowFields value={s.shadow} onChange={(shadow) => set({ shadow })} theme={theme} />}
      </Section>

      <Section title="Effects" defaultOpen={first.type === "image"}>
        <Row label="Opacity">
          <Slider value={Math.round((s.opacity ?? 1) * 100)} min={0} max={100} unit="%" onChange={(v) => set({ opacity: v >= 100 ? undefined : v / 100 })} />
        </Row>
        <Row label="Blur">
          <Slider value={s.blur ?? 0} min={0} max={30} unit="px" onChange={(blur) => set({ blur: blur || undefined })} />
        </Row>
        {!NO_FILL.includes(first.type) && (
          <Row label="Frosted glass" title="Blurs whatever is behind this element (works best with a semi-transparent fill)">
            <Slider value={s.backdropBlur ?? 0} min={0} max={40} unit="px" onChange={(backdropBlur) => set({ backdropBlur: backdropBlur || undefined })} />
          </Row>
        )}
        {first.type === "image" && !multi && (
          <>
            <div className="field-label" style={{ marginTop: 4 }}>
              Photo filters
            </div>
            <div className="filter-grid">
              {FILTER_PRESETS.map((p) => (
                <button key={p.id} aria-pressed={JSON.stringify(p.f) === JSON.stringify(s.filters)} onClick={() => set({ filters: p.f })}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={first.props.src || "https://picsum.photos/id/1015/200/200"} alt="" style={{ filter: filterCss(p.f) }} />
                  {p.label}
                </button>
              ))}
            </div>
            {(
              [
                ["brightness", "Brightness", 0, 200, 100],
                ["contrast", "Contrast", 0, 200, 100],
                ["saturate", "Saturation", 0, 300, 100],
                ["grayscale", "Grey", 0, 100, 0],
                ["sepia", "Sepia", 0, 100, 0],
                ["hue", "Hue", -180, 180, 0],
              ] as const
            ).map(([k, label, min, max, def]) => (
              <Row key={k} label={label}>
                <Slider value={(s.filters?.[k] as number | undefined) ?? def} min={min} max={max} onChange={(v) => set({ filters: { ...(s.filters || {}), [k]: v } })} />
              </Row>
            ))}
          </>
        )}
      </Section>

      <Section title="Hover effect" defaultOpen={!!s.hover}>
        <div className="preset-chips">
          {HOVERS.map((h) => (
            <button key={h.id} aria-pressed={JSON.stringify(h.hover ?? null) === JSON.stringify(s.hover ?? null)} onClick={() => set({ hover: h.hover })}>
              {h.label}
            </button>
          ))}
        </div>
        {s.hover !== undefined && s.hover !== null && (
          <>
            <Row label="Fill on hover">
              <ColorField value={s.hover.fill?.type === "solid" ? s.hover.fill.color : undefined} onChange={(c) => set({ hover: { ...s.hover, fill: c ? { type: "solid", color: c } : undefined } })} theme={theme} placeholder="Unchanged" />
            </Row>
            <Row label="Text on hover">
              <ColorField value={s.hover.color} onChange={(color) => set({ hover: { ...s.hover, color } })} theme={theme} placeholder="Unchanged" />
            </Row>
          </>
        )}
        <div className="mini-note">Hover effects play in Preview and in your live app.</div>
      </Section>

      <Section title="Animate" defaultOpen={!!s.animation}>
        <div className="anim-grid">
          {ANIMS.map((a) => (
            <button
              key={a.name}
              aria-pressed={(s.animation?.name ?? "none") === a.name}
              onClick={() => set({ animation: a.name === "none" ? null : { name: a.name, duration: s.animation?.duration ?? 700, delay: s.animation?.delay ?? 0, trigger: s.animation?.trigger ?? "scroll" } })}
            >
              <span className="anim-demo" style={{ animationName: a.name === "none" ? undefined : animKeyframes(a.name), opacity: a.name === "none" ? 0.3 : 1 }} />
              {a.label}
            </button>
          ))}
        </div>
        {s.animation && (
          <>
            <Row label="Starts">
              <Seg
                value={s.animation.trigger}
                onChange={(trigger) => set({ animation: { ...s.animation!, trigger } })}
                options={[
                  { value: "scroll", label: "When seen" },
                  { value: "load", label: "On open" },
                ]}
              />
            </Row>
            <Row label="Duration">
              <Slider value={s.animation.duration} min={100} max={3000} step={50} unit="ms" onChange={(duration) => set({ animation: { ...s.animation!, duration } })} />
            </Row>
            <Row label="Delay">
              <Slider value={s.animation.delay} min={0} max={3000} step={50} unit="ms" onChange={(delay) => set({ animation: { ...s.animation!, delay } })} />
            </Row>
            <Toggle checked={!!s.animation.loop} onChange={(loop) => set({ animation: { ...s.animation!, loop } })} label="Repeat forever" />
          </>
        )}
      </Section>

      <Section title="Visibility" defaultOpen={!!(first.startHidden || first.hideOn)}>
        <Toggle
          checked={!!first.hideOn?.desktop}
          onChange={(v) => updateEls(ids, (el) => void (el.hideOn = { ...(el.hideOn || {}), desktop: v || undefined }))}
          label="Hide on desktop"
          hint="Shown only on phones."
        />
        <Toggle
          checked={!!first.hideOn?.mobile}
          onChange={(v) => updateEls(ids, (el) => void (el.hideOn = { ...(el.hideOn || {}), mobile: v || undefined }))}
          label="Hide on phones"
        />
        <Toggle
          checked={!!first.startHidden}
          onChange={(v) =>
            updateEls(ids, (el) => {
              if (v) el.startHidden = true;
              else delete el.startHidden;
            })
          }
          label="Start hidden"
          hint="Visitors don't see it until a button runs Show element."
        />
      </Section>
    </>
  );
}

function ShadowFields({ value, onChange, theme, noSpread }: { value: Shadow; onChange: (s: Shadow) => void; theme: Theme; noSpread?: boolean }) {
  return (
    <>
      <div className={noSpread ? "insp-grid3" : "insp-grid4"}>
        <NumberField label="X" value={value.x} onChange={(x) => onChange({ ...value, x })} />
        <NumberField label="Y" value={value.y} onChange={(y) => onChange({ ...value, y })} />
        <NumberField label="B" value={value.blur} min={0} onChange={(blur) => onChange({ ...value, blur })} title="Blur" />
        {!noSpread && <NumberField label="S" value={value.spread} onChange={(spread) => onChange({ ...value, spread })} title="Spread" />}
      </div>
      <ColorField value={value.color} allowNone={false} onChange={(c) => c && onChange({ ...value, color: c })} theme={theme} />
    </>
  );
}

function filterCss(f: Style["filters"]): string | undefined {
  if (!f) return undefined;
  const p: string[] = [];
  if (f.brightness !== undefined) p.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== undefined) p.push(`contrast(${f.contrast}%)`);
  if (f.saturate !== undefined) p.push(`saturate(${f.saturate}%)`);
  if (f.grayscale) p.push(`grayscale(${f.grayscale}%)`);
  if (f.sepia) p.push(`sepia(${f.sepia}%)`);
  if (f.hue) p.push(`hue-rotate(${f.hue}deg)`);
  return p.join(" ") || undefined;
}

function animKeyframes(name: AnimationName): string {
  return { fade: "rt-fade", "slide-up": "rt-slide-up", "slide-down": "rt-slide-down", "slide-left": "rt-slide-left", "slide-right": "rt-slide-right", "zoom-in": "rt-zoom-in", pop: "rt-pop-in", bounce: "rt-bounce", rotate: "rt-rotate-in", "blur-in": "rt-blur-in", none: "" }[name];
}
