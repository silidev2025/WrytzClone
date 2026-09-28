"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { Action, El, ElementProps, InputType, MenuItem, ShapeKind, Theme } from "@/lib/shared/types";
import { INPUT_TYPE_INFO, isContainerType } from "@/lib/shared/elements";
import { insertElements, removeElements } from "@/lib/shared/doc";
import { instantiateSpec } from "@/lib/shared/elements";
import { layerNames } from "@/lib/shared/doc";
import { uid } from "@/lib/shared/util";
import { guessPageIcon } from "@/lib/shared/pageIcons";
import { Icon } from "@/components/ui/Icon";
import { addSpec, ed, getPage, mutate, select, updateEls, useEditor } from "../store";
import { NumberField, Row, Section, Seg, Select, Slider, TextField, Toggle } from "./controls";
import { BindingField } from "./BindingField";
import { IconPicker } from "./pickers";
import { MediaPickerButton } from "./MediaPicker";

const SHAPES: { value: ShapeKind; icon: string; label: string }[] = [
  { value: "rect", icon: "Square", label: "Rectangle" },
  { value: "ellipse", icon: "Circle", label: "Circle" },
  { value: "triangle", icon: "Triangle", label: "Triangle" },
  { value: "diamond", icon: "Diamond", label: "Diamond" },
  { value: "pentagon", icon: "Pentagon", label: "Pentagon" },
  { value: "hexagon", icon: "Hexagon", label: "Hexagon" },
  { value: "star", icon: "Star", label: "Star" },
  { value: "heart", icon: "Heart", label: "Heart" },
  { value: "arrow", icon: "ArrowBigRight", label: "Arrow" },
  { value: "cross", icon: "Plus", label: "Plus" },
  { value: "blob", icon: "Cloud", label: "Blob" },
  { value: "speech", icon: "MessageSquare", label: "Speech" },
  { value: "wave", icon: "Waves", label: "Wave" },
  { value: "arch", icon: "DoorOpen", label: "Arch" },
];

const MASKS: { value: NonNullable<ElementProps["mask"]>; label: string }[] = [
  { value: "none", label: "None" },
  { value: "rounded", label: "Rounded" },
  { value: "circle", label: "Circle" },
  { value: "arch", label: "Arch" },
  { value: "blob", label: "Blob" },
  { value: "hexagon", label: "Hexagon" },
  { value: "star", label: "Star" },
  { value: "diamond", label: "Diamond" },
  { value: "heart", label: "Heart" },
];

function LinkEditor({ el, set }: { el: El; set: (p: Partial<ElementProps>) => void }) {
  const pages = useEditor((s) => s.doc.pages);
  const link = el.props.link;
  const kind = !link ? "none" : link.pageId ? "page" : "url";
  return (
    <>
      <Row label="Link">
        <Seg
          value={kind}
          onChange={(k) => set({ link: k === "none" ? null : k === "page" ? { pageId: pages[0]?.id } : { url: "https://", newTab: true } })}
          options={[
            { value: "none", label: "None" },
            { value: "page", label: "Page" },
            { value: "url", label: "Website" },
          ]}
        />
      </Row>
      {kind === "page" && (
        <Select value={link?.pageId} onChange={(pageId) => set({ link: { pageId } })} options={pages.map((p) => ({ value: p.id, label: p.name }))} />
      )}
      {kind === "url" && (
        <>
          <TextField value={link?.url || ""} placeholder="https://example.com" onCommit={(url) => set({ link: { ...link, url } })} />
          <Toggle checked={!!link?.newTab} onChange={(newTab) => set({ link: { ...link, newTab } })} label="Open in a new tab" />
        </>
      )}
    </>
  );
}

function ButtonQuickLink({ el }: { el: El }) {
  const pages = useEditor((s) => s.doc.pages);
  const actions = el.events?.click || [];
  const nav = actions.length === 1 && actions[0].type === "navigate" ? actions[0] : null;
  const url = actions.length === 1 && actions[0].type === "openUrl" ? actions[0] : null;
  const kind = nav ? "page" : url ? "url" : actions.length ? "custom" : "none";
  const setActions = (next: Action[]) =>
    updateEls([el.id], (e) => {
      e.events = { ...(e.events || {}), click: next };
    });
  return (
    <>
      <Row label="On click">
        <Seg
          value={kind}
          onChange={(k) => {
            if (k === "none") setActions([]);
            else if (k === "page") setActions([{ id: uid("act"), type: "navigate", pageId: pages[0]?.id }]);
            else if (k === "url") setActions([{ id: uid("act"), type: "openUrl", url: "https://", newTab: true }]);
            else useEditor.setState({ rightTab: "events" });
          }}
          options={[
            { value: "none", label: "Nothing" },
            { value: "page", label: "Page" },
            { value: "url", label: "Link" },
            { value: "custom", label: "More…" },
          ]}
        />
      </Row>
      {nav && <Select value={nav.pageId} onChange={(pageId) => setActions([{ ...nav, pageId }])} options={pages.map((p) => ({ value: p.id, label: p.name }))} />}
      {url && <TextField value={url.url || ""} placeholder="https://example.com" onCommit={(u) => setActions([{ ...url, url: u }])} />}
      {kind === "custom" && <div className="mini-note">This button runs {actions.length} action{actions.length === 1 ? "" : "s"} — see the Events tab.</div>}
      {kind === "none" && !el.props.submit && <div className="mini-note">Choose a destination or action to enable this button in the running app.</div>}
    </>
  );
}

function OptionsEditor({ el, set }: { el: El; set: (p: Partial<ElementProps>) => void }) {
  const collections = useEditor((s) => s.collections);
  const from = el.props.optionsFrom;
  const col = collections.find((c) => c.id === from?.collectionId);
  return (
    <>
      <Toggle
        checked={!!from}
        onChange={(on) => set({ optionsFrom: on ? { collectionId: collections[0]?.id || "", field: collections[0]?.fields[0]?.name || "" } : null })}
        label="Take choices from a collection"
        hint={from ? "The choices update as your data changes." : undefined}
      />
      {from ? (
        collections.length ? (
          <div className="insp-grid2">
            <Select value={from.collectionId} onChange={(collectionId) => set({ optionsFrom: { collectionId, field: collections.find((c) => c.id === collectionId)?.fields[0]?.name || "" } })} options={collections.map((c) => ({ value: c.id, label: c.name }))} />
            <Select value={from.field} onChange={(field) => set({ optionsFrom: { ...from, field } })} options={(col?.fields || []).map((f) => ({ value: f.name, label: f.name }))} />
          </div>
        ) : (
          <div className="mini-note">Create a collection in the Database first.</div>
        )
      ) : (
        <>
          <TextField multiline rows={4} value={(el.props.options || []).join("\n")} placeholder={"One choice per line"} onCommit={(v) => set({ options: v.split("\n").map((s) => s.trim()).filter(Boolean) })} />
          <div className="mini-note">One choice per line.</div>
        </>
      )}
    </>
  );
}

function MenuItemsEditor({ el, set }: { el: El; set: (p: Partial<ElementProps>) => void }) {
  const pages = useEditor((s) => s.doc.pages);
  const items = el.props.items || [];
  const auto = items.length === 0;
  const icons = el.props.variant === "tabbar" || !!el.props.showIcons;
  const update = (next: MenuItem[]) => set({ items: next });
  const iconFor = (it: MenuItem) => {
    const p = it.pageId ? pages.find((pg) => pg.id === it.pageId) : null;
    return it.icon || (p ? p.icon || guessPageIcon(p.name) : guessPageIcon(it.label));
  };
  return (
    <>
      <Toggle
        checked={auto}
        onChange={(on) => update(on ? [] : pages.filter((p) => !p.recordCollectionId && !p.hideInNav).map((p) => ({ id: uid("mi"), label: p.name, pageId: p.id })))}
        label="Show every page automatically"
        hint={auto ? (icons ? "New pages appear by themselves. Set each page's icon in its page settings, or pick links yourself." : "New pages appear in the menu by themselves.") : undefined}
      />
      {!auto && (
        <div style={{ display: "grid", gap: 6 }}>
          {items.map((it, i) => (
            <div key={it.id} style={{ display: "grid", gap: 4, padding: 8, border: "1px solid var(--line)", borderRadius: 9 }}>
              <div style={{ display: "flex", gap: 4 }}>
                <div style={{ flex: 1 }}>
                  <TextField value={it.label} onCommit={(label) => update(items.map((x) => (x.id === it.id ? { ...x, label } : x)))} />
                </div>
                <button className="icon-btn sm" disabled={i === 0} onClick={() => update(swap(items, i, i - 1))} aria-label="Move up">
                  <ArrowUp size={13} />
                </button>
                <button className="icon-btn sm" disabled={i === items.length - 1} onClick={() => update(swap(items, i, i + 1))} aria-label="Move down">
                  <ArrowDown size={13} />
                </button>
                <button className="icon-btn sm" onClick={() => update(items.filter((x) => x.id !== it.id))} aria-label="Remove">
                  <Trash2 size={13} />
                </button>
              </div>
              <Select
                value={it.pageId ? it.pageId : "__url"}
                onChange={(v) => update(items.map((x) => (x.id === it.id ? (v === "__url" ? { id: x.id, label: x.label, url: "https://" } : { id: x.id, label: x.label, pageId: v }) : x)))}
                options={[...pages.map((p) => ({ value: p.id, label: `Page: ${p.name}` })), { value: "__url", label: "A website link…" }]}
              />
              {!it.pageId && <TextField value={it.url || ""} placeholder="https://" onCommit={(url) => update(items.map((x) => (x.id === it.id ? { ...x, url } : x)))} />}
              {icons && <IconPicker value={iconFor(it)} onChange={(icon) => update(items.map((x) => (x.id === it.id ? { ...x, icon } : x)))} />}
            </div>
          ))}
          <button className="btn sm" onClick={() => update([...items, { id: uid("mi"), label: "New link", pageId: pages[0]?.id }])}>
            <Plus size={14} /> Add a link
          </button>
        </div>
      )}
    </>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const next = arr.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function TabsEditor({ el }: { el: El }) {
  const tabs = el.props.tabs || [];
  const shown = useEditor((s) => s.tabsShown[el.id] ?? el.props.activeTab ?? 0);
  const addTab = () => {
    const page = getPage();
    const [panel] = instantiateSpec({ type: "box", name: "Panel", box: { x: 0, y: 0, w: el.box.w, h: Math.max(100, el.box.h - 50) } }, el.id, layerNames(page));
    mutate((_d, pg) => {
      const t = pg.elements[el.id];
      t.props.tabs = [...(t.props.tabs || []), { id: uid(), label: `Tab ${(t.props.tabs?.length || 0) + 1}` }];
      insertElements(pg as never, [panel], el.id);
    });
    useEditor.setState((s) => ({ tabsShown: { ...s.tabsShown, [el.id]: tabs.length } }));
  };
  const removeTab = (i: number) => {
    const panelId = el.childIds?.[i];
    mutate((_d, pg) => {
      const t = pg.elements[el.id];
      t.props.tabs = (t.props.tabs || []).filter((_, j) => j !== i);
      if (panelId) removeElements(pg as never, [panelId]);
    });
    useEditor.setState((s) => ({ tabsShown: { ...s.tabsShown, [el.id]: 0 } }));
  };
  return (
    <>
      {tabs.map((t, i) => (
        <div key={t.id} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button className={`icon-btn sm ${shown === i ? "active" : ""}`} title="Show this tab on the canvas" onClick={() => useEditor.setState((s) => ({ tabsShown: { ...s.tabsShown, [el.id]: i } }))}>
            {i + 1}
          </button>
          <div style={{ flex: 1 }}>
            <TextField
              value={t.label}
              onCommit={(label) =>
                updateEls([el.id], (e) => {
                  e.props.tabs = (e.props.tabs || []).map((x, j) => (j === i ? { ...x, label } : x));
                })
              }
            />
          </div>
          <button className="icon-btn sm" disabled={tabs.length <= 1} onClick={() => removeTab(i)} aria-label="Remove tab">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button className="btn sm" onClick={addTab}>
        <Plus size={14} /> Add a tab
      </button>
      <div className="mini-note">Tip: click a tab label on the canvas to design that tab&apos;s panel.</div>
    </>
  );
}

export function ContentTab({ el, theme }: { el: El; theme: Theme }) {
  const pages = useEditor((s) => s.doc.pages);
  const set = (patch: Partial<ElementProps>) =>
    updateEls([el.id], (e) => {
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete (e.props as Record<string, unknown>)[k];
        else (e.props as Record<string, unknown>)[k] = v;
      }
    });
  const p = el.props;
  void theme;

  switch (el.type) {
    case "text":
      return (
        <>
          <Section title="Text">
            <BindingField value={p.text || ""} multiline rows={4} elementId={el.id} onCommit={(text) => set({ text })} placeholder="Type something…" />
            <div className="mini-note">Tip: double-click text on the canvas to edit it in place. Use {"{ }"} to show data.</div>
            <Row label="Style">
              <Select
                value={p.tag || "p"}
                onChange={(tag) => set({ tag })}
                options={[
                  { value: "h1", label: "Heading 1 (largest)" },
                  { value: "h2", label: "Heading 2" },
                  { value: "h3", label: "Heading 3" },
                  { value: "p", label: "Paragraph" },
                  { value: "small", label: "Small text" },
                ]}
              />
            </Row>
          </Section>
          <Section title="Link">
            <LinkEditor el={el} set={set} />
          </Section>
        </>
      );
    case "button":
      return (
        <Section title="Button">
          <Row label="Label">
            <BindingField value={p.label || ""} elementId={el.id} onCommit={(label) => set({ label })} />
          </Row>
          <Row label="Accessible name">
            <TextField value={p.ariaLabel || ""} placeholder="Purpose of an icon-only button" onCommit={(ariaLabel) => set({ ariaLabel: ariaLabel || undefined })} />
          </Row>
          <Row label="Icon">
            <IconPicker value={p.icon} onChange={(icon) => set({ icon })} allowNone />
          </Row>
          {p.icon && (
            <Row label="Icon side">
              <Seg
                value={p.iconPos || "left"}
                onChange={(iconPos) => set({ iconPos })}
                options={[
                  { value: "left", label: "Left" },
                  { value: "right", label: "Right" },
                ]}
              />
            </Row>
          )}
          <Toggle checked={!!p.submit} onChange={(submit) => set({ submit })} label="Submits its form" hint="Inside a form, clicking saves the answers." />
          <ButtonQuickLink el={el} />
        </Section>
      );
    case "image":
      return (
        <>
          <Section title="Image">
            <MediaPickerButton label="Replace image" onPick={(src, name) => set({ src, alt: p.alt || name || "" })} />
            <Row label="Source">
              <BindingField value={p.src || ""} elementId={el.id} placeholder="https://… or {{record.Photo}}" onCommit={(src) => set({ src })} />
            </Row>
            <Row label="Alt text" title="Describes the image for screen readers">
              <TextField value={p.alt || ""} placeholder="What's in the picture?" onCommit={(alt) => set({ alt })} />
            </Row>
            <Row label="Fit">
              <Seg
                value={p.fit || "cover"}
                onChange={(fit) => set({ fit })}
                options={[
                  { value: "cover", label: "Fill frame" },
                  { value: "contain", label: "Show all" },
                ]}
              />
            </Row>
          </Section>
          <Section title="Crop & shape">
            <div className="preset-chips">
              {MASKS.map((m) => (
                <button key={m.value} aria-pressed={(p.mask || "none") === m.value} onClick={() => set({ mask: m.value })}>
                  {m.label}
                </button>
              ))}
            </div>
            <Row label="Zoom">
              <Slider value={Math.round((p.zoom || 1) * 100)} min={100} max={300} unit="%" onChange={(v) => set({ zoom: v / 100 })} />
            </Row>
            <Row label="Focus ←→">
              <Slider value={p.focusX ?? 50} min={0} max={100} unit="%" onChange={(focusX) => set({ focusX })} />
            </Row>
            <Row label="Focus ↑↓">
              <Slider value={p.focusY ?? 50} min={0} max={100} unit="%" onChange={(focusY) => set({ focusY })} />
            </Row>
          </Section>
          <Section title="Link" defaultOpen={!!p.link}>
            <LinkEditor el={el} set={set} />
          </Section>
        </>
      );
    case "icon":
      return (
        <>
          <Section title="Icon">
            <IconPicker value={p.icon} onChange={(icon) => icon && set({ icon })} />
            <Row label="Thickness">
              <Slider value={p.strokeWidth ?? 2} min={0.5} max={4} step={0.25} onChange={(strokeWidth) => set({ strokeWidth })} />
            </Row>
          </Section>
          <Section title="Link" defaultOpen={!!p.link}>
            <LinkEditor el={el} set={set} />
          </Section>
        </>
      );
    case "shape":
      return (
        <Section title="Shape">
          <div className="icon-grid" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
            {SHAPES.map((s) => (
              <button key={s.value} title={s.label} style={{ background: (p.shape || "rect") === s.value ? "var(--brand-soft)" : undefined, cursor: "pointer" }} onClick={() => set({ shape: s.value })}>
                <Icon name={s.icon} size={18} />
              </button>
            ))}
          </div>
        </Section>
      );
    case "line":
      return (
        <Section title="Line">
          <Row label="Thickness">
            <Slider value={p.thickness ?? 2} min={1} max={24} onChange={(thickness) => set({ thickness })} />
          </Row>
          <Row label="Style">
            <Seg
              value={p.dash || "solid"}
              onChange={(dash) => set({ dash })}
              options={[
                { value: "solid", label: "Solid" },
                { value: "dashed", label: "Dashed" },
                { value: "dotted", label: "Dotted" },
              ]}
            />
          </Row>
          <Toggle checked={!!p.arrowEnd} onChange={(arrowEnd) => set({ arrowEnd })} label="Arrow at the end" />
        </Section>
      );
    case "video":
      return (
        <Section title="Video">
          <BindingField value={p.url || ""} elementId={el.id} placeholder="YouTube, Vimeo or .mp4 link" onCommit={(url) => set({ url })} />
          <Toggle checked={!!p.autoplay} onChange={(autoplay) => set({ autoplay, muted: autoplay ? true : p.muted })} label="Play automatically" hint="Autoplaying videos start muted." />
          <Toggle checked={!!p.loop} onChange={(loop) => set({ loop })} label="Loop" />
          <Toggle checked={!!p.muted} onChange={(muted) => set({ muted })} label="Muted" />
          <Toggle checked={p.controls !== false} onChange={(controls) => set({ controls })} label="Show controls" />
        </Section>
      );
    case "map":
      return (
        <Section title="Map">
          <Row label="Address">
            <BindingField value={p.address || ""} elementId={el.id} placeholder="Street, city or place" onCommit={(address) => set({ address })} />
          </Row>
          <Row label="Zoom">
            <Slider value={p.mapZoom ?? 14} min={2} max={20} onChange={(mapZoom) => set({ mapZoom })} />
          </Row>
        </Section>
      );
    case "embed":
      return (
        <Section title="Website embed">
          <TextField value={p.url || ""} placeholder="https://…" onCommit={(url) => set({ url })} />
          <div className="mini-note">Some websites don&apos;t allow being shown inside other sites; if it stays blank, that site blocks embedding.</div>
        </Section>
      );
    case "input": {
      const t = p.inputType || "text";
      const choice = t === "select" || t === "radio" || t === "checkbox";
      return (
        <>
          <Section title="Input">
            <Row label="Type">
              <Select value={t} onChange={(inputType: InputType) => set({ inputType })} options={Object.entries(INPUT_TYPE_INFO).map(([value, v]) => ({ value: value as InputType, label: v.label }))} />
            </Row>
            <Row label="Label">
              <TextField value={p.label || ""} onCommit={(label) => set({ label })} />
            </Row>
            <Toggle checked={p.showLabel !== false} onChange={(showLabel) => set({ showLabel })} label="Show the label" />
            {!["radio", "checkbox", "toggle", "range", "rating", "color"].includes(t) && (
              <Row label="Placeholder">
                <TextField value={p.placeholder || ""} onCommit={(placeholder) => set({ placeholder })} />
              </Row>
            )}
            <Row label="Field name" title="Answers are saved into the database column with this name">
              <TextField value={p.name || ""} onCommit={(name) => set({ name: name.replace(/[{}.|]/g, "").trim() })} />
            </Row>
            <Toggle checked={!!p.required} onChange={(required) => set({ required })} label="Required" hint="Visitors must fill this in before the form sends." />
            <Row label="Help text">
              <TextField value={p.helpText || ""} placeholder="Optional hint under the field" onCommit={(helpText) => set({ helpText })} />
            </Row>
            <Row label="Default">
              <BindingField value={p.defaultValue || ""} elementId={el.id} placeholder="Starts empty" onCommit={(defaultValue) => set({ defaultValue })} />
            </Row>
            <Row label="Look">
              <Seg
                value={p.inputStyle || "box"}
                onChange={(inputStyle) => set({ inputStyle })}
                options={[
                  { value: "box", label: "Box" },
                  { value: "filled", label: "Filled" },
                  { value: "line", label: "Line" },
                  { value: "none", label: "Plain" },
                ]}
              />
            </Row>
          </Section>
          {choice && (
            <Section title="Choices">
              <OptionsEditor el={el} set={set} />
            </Section>
          )}
          {(t === "number" || t === "range") && (
            <Section title="Limits">
              <div className="insp-grid3">
                <NumberField label="Min" value={p.min} onChange={(min) => set({ min })} />
                <NumberField label="Max" value={p.max} onChange={(max) => set({ max })} />
                <NumberField label="Step" value={p.step ?? 1} min={0.01} onChange={(step) => set({ step })} />
              </div>
            </Section>
          )}
        </>
      );
    }
    case "form":
      return (
        <Section title="Form">
          <Row label="After sending">
            <TextField multiline rows={2} value={p.successMessage || ""} placeholder="Message shown after sending (optional)" onCommit={(successMessage) => set({ successMessage })} />
          </Row>
          <div className="mini-note">Choose where answers are saved in the Data tab. Add more steps (like going to a thank-you page) in Events.</div>
        </Section>
      );
    case "list":
    case "table":
      return (
        <Section title={el.type === "list" ? "List" : "Table"}>
          <Row label="When empty">
            <TextField value={p.emptyText || ""} placeholder="Nothing here yet." onCommit={(emptyText) => set({ emptyText })} />
          </Row>
          {el.type === "table" && <Toggle checked={p.striped !== false} onChange={(striped) => set({ striped })} label="Striped rows" />}
          <div className="mini-note">Pick the collection, filters and columns in the Data tab.</div>
        </Section>
      );
    case "menu":
      return (
        <Section title="Menu">
          <MenuItemsEditor el={el} set={set} />
          <Row label="Style">
            <Select
              value={(p.variant as string) || "links"}
              onChange={(variant) => set(variant === "tabbar" ? { variant, orientation: "horizontal" } : { variant })}
              options={[
                { value: "links", label: "Links" },
                { value: "pills", label: "Pills" },
                { value: "underline", label: "Underline" },
                { value: "buttons", label: "Buttons" },
                { value: "tabbar", label: "Phone tab bar (icons)" },
              ]}
            />
          </Row>
          {p.variant !== "tabbar" && (
            <>
              <Row label="Direction">
                <Seg
                  value={p.orientation || "horizontal"}
                  onChange={(orientation) => set({ orientation })}
                  options={[
                    { value: "horizontal", label: "Across" },
                    { value: "vertical", label: "Down" },
                  ]}
                />
              </Row>
              <Toggle checked={!!p.showIcons} onChange={(showIcons) => set({ showIcons })} label="Icons next to labels" />
            </>
          )}
          {p.variant === "tabbar" && <div className="mini-note">Tip: put it at the bottom of the screen and set Design › Stay on screen › Bottom.</div>}
        </Section>
      );
    case "tabs":
      return (
        <Section title="Tabs">
          <TabsEditor el={el} />
          <Row label="Style">
            <Seg
              value={(p.variant as "underline") || "underline"}
              onChange={(variant) => set({ variant })}
              options={[
                { value: "underline", label: "Line" },
                { value: "pills", label: "Pills" },
                { value: "boxed", label: "Boxed" },
              ]}
            />
          </Row>
        </Section>
      );
    case "dialog":
      return (
        <Section title="Pop-up">
          <Row label="Name">
            <TextField value={p.title || ""} placeholder="For screen readers" onCommit={(title) => set({ title })} />
          </Row>
          <Toggle checked={p.closeOnBackdrop !== false} onChange={(closeOnBackdrop) => set({ closeOnBackdrop })} label="Close when clicking outside" />
          <div className="mini-note">Pop-ups stay hidden until a button runs <strong>Open pop-up</strong>.</div>
          <button
            className="btn sm"
            onClick={() => {
              const id = addSpec(
                { type: "button", box: { w: 180, h: 48 }, props: { label: "Open pop-up" }, events: { click: [{ type: "openDialog", targetId: el.id }] } },
                { parentId: null, at: { x: el.box.x + el.box.w / 2, y: el.box.y + el.box.h + 60 } },
              );
              select([id]);
            }}
          >
            <Plus size={14} /> Add a button that opens it
          </button>
        </Section>
      );
    case "progress":
      return (
        <Section title="Progress">
          <Row label="Value">
            <BindingField value={p.value || ""} elementId={el.id} placeholder="e.g. 65 or {{vars.score}}" onCommit={(value) => set({ value })} />
          </Row>
          <Row label="Out of">
            <BindingField value={p.maxValue || ""} elementId={el.id} placeholder="100" onCommit={(maxValue) => set({ maxValue })} />
          </Row>
          <Row label="Look">
            <Seg
              value={(p.variant as "bar") || "bar"}
              onChange={(variant) => set({ variant })}
              options={[
                { value: "bar", label: "Bar" },
                { value: "ring", label: "Ring" },
              ]}
            />
          </Row>
          <Toggle checked={!!p.showValue} onChange={(showValue) => set({ showValue })} label="Show the percentage" />
        </Section>
      );
    case "stat":
      return (
        <Section title="Stat card">
          <Row label="Label">
            <TextField value={p.label || ""} onCommit={(label) => set({ label })} />
          </Row>
          <Row label="Number from">
            <Seg
              value={p.dataSource || "collection"}
              onChange={(dataSource) => set({ dataSource })}
              options={[
                { value: "collection", label: "Database" },
                { value: "manual", label: "I'll type it" },
              ]}
            />
          </Row>
          {p.dataSource === "manual" ? (
            <Row label="Value">
              <BindingField value={p.value || ""} elementId={el.id} placeholder="e.g. 1,200 or {{vars.total}}" onCommit={(value) => set({ value })} />
            </Row>
          ) : (
            <div className="mini-note">Choose the collection and how to count it in the Data tab.</div>
          )}
          <div className="insp-grid3">
            <TextField value={p.prefix || ""} placeholder="Before" onCommit={(prefix) => set({ prefix })} />
            <TextField value={p.suffix || ""} placeholder="After" onCommit={(suffix) => set({ suffix })} />
            <NumberField label=".0" value={p.decimals ?? 0} min={0} max={4} onChange={(decimals) => set({ decimals: Math.round(decimals) })} title="Decimal places" />
          </div>
        </Section>
      );
    case "chart":
      return (
        <Section title="Chart">
          <Seg
            value={p.chartType || "bar"}
            onChange={(chartType) => set({ chartType })}
            options={[
              { value: "bar", label: "Bars" },
              { value: "line", label: "Line" },
              { value: "area", label: "Area" },
              { value: "pie", label: "Pie" },
              { value: "donut", label: "Donut" },
            ]}
          />
          <Row label="Data from">
            <Seg
              value={p.dataSource === "collection" ? "collection" : "manual"}
              onChange={(dataSource) => set({ dataSource })}
              options={[
                { value: "manual", label: "I'll type it" },
                { value: "collection", label: "Database" },
              ]}
            />
          </Row>
          {p.dataSource !== "collection" ? (
            <>
              <TextField multiline rows={6} value={p.manualData || ""} placeholder={"Mon: 12\nTue: 19"} onCommit={(manualData) => set({ manualData })} />
              <div className="mini-note">One “Label: number” per line.</div>
            </>
          ) : (
            <div className="mini-note">Choose the collection and grouping in the Data tab.</div>
          )}
          {(p.chartType === "pie" || p.chartType === "donut") && <Toggle checked={p.showLegend !== false} onChange={(showLegend) => set({ showLegend })} label="Show legend" />}
        </Section>
      );
    case "countdown":
      return (
        <Section title="Countdown">
          <Row label="Counts to">
            <input className="txt-field" type="datetime-local" value={(p.target || "").slice(0, 16)} onChange={(e) => set({ target: e.target.value })} />
          </Row>
          <Row label="When done">
            <TextField value={p.doneText || ""} onCommit={(doneText) => set({ doneText })} />
          </Row>
        </Section>
      );
    default:
      return (
        <div className="insp-section">
          <div className="mini-note">
            {isContainerType(el.type)
              ? "Boxes group other elements. Drop things inside, or change how they're arranged in Design → Layout."
              : "Nothing to set here for this element."}
          </div>
          {el.type === "box" && pages.length > 0 && <ButtonQuickLink el={el} />}
        </div>
      );
  }
}

export { ed };
