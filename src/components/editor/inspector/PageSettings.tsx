"use client";

import { Plus, Trash2 } from "lucide-react";
import type { VariableType } from "@/lib/shared/types";
import { slugify, uid } from "@/lib/shared/util";
import { frameWidthFor, isMobileApp } from "@/lib/shared/layout";
import { guessPageIcon } from "@/lib/shared/pageIcons";
import { appUrl } from "@/lib/shared/urls";
import { IconPicker } from "./pickers";
import { ed, getPage, mutate, resetMobile, updatePage, useEditor } from "../store";
import { NumberField, Row, Section, Seg, Select, TextField, Toggle } from "./controls";
import { FillField } from "./ColorPicker";
import { ActionsEditor } from "./ActionsEditor";

export function VariablesEditor() {
  const variables = useEditor((s) => s.doc.variables);
  const add = () =>
    mutate((d) => {
      const taken = new Set(d.variables.map((v) => v.name));
      let n = 1;
      while (taken.has(`myVariable${n}`)) n++;
      d.variables.push({ id: uid("var"), name: `myVariable${n}`, type: "text", initial: "" });
    });
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {!variables.length && <div className="mini-note">Variables remember things while someone uses your app — like a score, a chosen colour or a step number. Show one with {"{{vars.name}}"}.</div>}
      {variables.map((v) => (
        <div key={v.id} style={{ display: "grid", gap: 5, padding: 8, border: "1.5px solid var(--ink)", borderRadius: 4 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ flex: 1 }}>
              <TextField
                value={v.name}
                onCommit={(name) => {
                  const clean = name.replace(/[^A-Za-z0-9_]/g, "");
                  if (!/^[A-Za-z]/.test(clean) || variables.some((x) => x.id !== v.id && x.name === clean)) return;
                  mutate((d) => {
                    const t = d.variables.find((x) => x.id === v.id);
                    if (t) t.name = clean;
                  });
                }}
              />
            </div>
            <button className="icon-btn sm" aria-label={`Delete ${v.name}`} onClick={() => mutate((d) => void (d.variables = d.variables.filter((x) => x.id !== v.id)))}>
              <Trash2 size={13} />
            </button>
          </div>
          <div className="insp-grid2">
            <Select<VariableType>
              value={v.type}
              onChange={(type) =>
                mutate((d) => {
                  const t = d.variables.find((x) => x.id === v.id);
                  if (!t) return;
                  t.type = type;
                  t.initial = type === "number" ? "0" : type === "boolean" ? "false" : "";
                })
              }
              options={[
                { value: "text", label: "Text" },
                { value: "number", label: "Number" },
                { value: "boolean", label: "Yes / no" },
              ]}
            />
            {v.type === "boolean" ? (
              <Select value={v.initial === "true" ? "true" : "false"} onChange={(initial) => mutate((d) => void (d.variables.find((x) => x.id === v.id)!.initial = initial))} options={[{ value: "false", label: "Starts: no" }, { value: "true", label: "Starts: yes" }]} />
            ) : (
              <TextField value={v.initial} placeholder="Starts as…" onCommit={(initial) => mutate((d) => void (d.variables.find((x) => x.id === v.id)!.initial = initial))} />
            )}
          </div>
          <Toggle checked={!!v.persist} onChange={(persist) => mutate((d) => void (d.variables.find((x) => x.id === v.id)!.persist = persist))} label="Remember between visits" />
        </div>
      ))}
      <button className="btn sm" onClick={add}>
        <Plus size={14} /> Add a variable
      </button>
    </div>
  );
}

export function PageSettings() {
  const page = useEditor((s) => getPage(s));
  const theme = useEditor((s) => s.doc.theme);
  const homeId = useEditor((s) => s.doc.homePageId);
  const collections = useEditor((s) => s.collections);
  const bp = useEditor((s) => s.bp);
  const settings = useEditor((s) => s.doc.settings);
  const set = (fn: Parameters<typeof updatePage>[1]) => updatePage(page.id, fn);
  const isHome = page.id === homeId;
  const slug = useEditor((s) => s.app.published?.slug);

  return (
    <>
      <Section title="Page">
        <Row label="Name">
          <TextField value={page.name} onCommit={(name) => name.trim() && set((p) => void (p.name = name.trim().slice(0, 60)))} />
        </Row>
        <Row label="Link" title="The address of this page">
          {isHome ? (
            <div className="mini-note">{slug ? appUrl(slug).replace(/^https?:\/\//, "") : "/"} (home page)</div>
          ) : (
            <TextField
              value={page.path}
              onCommit={(v) => {
                const path = slugify(v);
                if (!path || ed().doc.pages.some((p) => p.id !== page.id && p.path === path)) return;
                set((p) => void (p.path = path));
              }}
            />
          )}
        </Row>
        <Row label="Tab title">
          <TextField value={page.title || ""} placeholder={page.name} onCommit={(title) => set((p) => void (p.title = title || undefined))} />
        </Row>
        <Row label="Icon" title="Shown in tab bars and menus with icons">
          <IconPicker value={page.icon || guessPageIcon(page.name)} onChange={(icon) => set((p) => void (p.icon = icon))} />
        </Row>
        {!page.recordCollectionId && (
          <Toggle
            checked={!page.hideInNav}
            onChange={(show) => set((p) => void (show ? delete p.hideInNav : (p.hideInNav = true)))}
            label="Show in menus"
            hint={page.hideInNav ? "Menus that list pages automatically skip this one. Link to it with a button." : undefined}
          />
        )}
        <Row label="Who can open">
          <Seg
            value={page.access}
            onChange={(access) => set((p) => void (p.access = access))}
            options={[
              { value: "public", label: "Everyone" },
              { value: "users", label: "Signed in" },
              { value: "admins", label: "Admins" },
            ]}
          />
        </Row>
        {page.access !== "public" && <div className="mini-note brand">Visitors who aren&apos;t allowed see a friendly sign-in screen instead.</div>}
      </Section>

      <Section title="Background">
        <FillField value={page.background} onChange={(f) => set((p) => void (p.background = f || { type: "solid", color: "$background" }))} theme={theme} />
      </Section>

      <Section title={bp === "mobile" ? "Height · phone" : "Height"}>
        {bp === "desktop" ? (
          <NumberField label="H" value={page.height} min={200} max={40000} onChange={(h) => set((p) => void (p.height = Math.round(h)))} />
        ) : page.mobileCustom ? (
          <>
            <NumberField label="H" value={page.heights?.mobile ?? 800} min={300} max={40000} onChange={(h) => set((p) => void (p.heights = { ...(p.heights || {}), mobile: Math.round(h) }))} />
            <button className="btn sm" onClick={() => resetMobile()}>
              Go back to automatic phone layout
            </button>
          </>
        ) : (
          <div className="mini-note">On phones this page grows with its content automatically.</div>
        )}
        <div className="mini-note">
          Page width: {frameWidthFor(ed().doc, bp)}px {isMobileApp(ed().doc) ? "(a phone screen)" : bp === "desktop" ? "on desktop (scaled to fit every screen)" : "on phones"}. Drag the handle under the page to change its height.
        </div>
      </Section>

      <Section title="Shows one record" defaultOpen={!!page.recordCollectionId}>
        <div className="mini-note">Turn this page into a detail page — e.g. one product or one post. Link to it from a list with “Go to page”.</div>
        <select
          className="txt-field"
          value={page.recordCollectionId || ""}
          onChange={(e) => set((p) => void (p.recordCollectionId = e.target.value || undefined))}
        >
          <option value="">No — a normal page</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              One record from {c.name}
            </option>
          ))}
        </select>
        {page.recordCollectionId && <div className="mini-note">Use {"{{record.Field}}"} in any text on this page.</div>}
      </Section>

      <Section title="When the page opens" defaultOpen={!!page.onLoad?.length}>
        <ActionsEditor actions={page.onLoad || []} onChange={(onLoad) => set((p) => void (p.onLoad = onLoad))} elementId={null} emptyText="Nothing runs when this page opens." />
      </Section>

      <Section title="Variables" defaultOpen={false}>
        <VariablesEditor />
      </Section>

      <Section title="App" defaultOpen={false}>
        <Toggle
          checked={settings.showBadge !== false}
          onChange={(showBadge) => mutate((d) => void (d.settings = { ...d.settings, showBadge }))}
          label="Show “Made with” badge"
          hint="A small link in the corner of your live app."
        />
      </Section>
    </>
  );
}
