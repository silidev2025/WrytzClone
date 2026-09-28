"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import type { Collection, DataFilter, DataQuery, El, FieldType, FilterOp, InputType, Field } from "@/lib/shared/types";
import { DEFAULT_LAYOUT, instantiateSpec, type ElementSpec } from "@/lib/shared/elements";
import { descendantIds, inputsOfForm, insertElements, layerNames, removeElements } from "@/lib/shared/doc";
import { FIELD_TYPE_MAP } from "@/lib/shared/fields";
import { api, errorMessage } from "@/lib/client/api";
import { toast } from "@/components/ui/toast";
import { Icon } from "@/components/ui/Icon";
import { getPage, mutate, setCollections, updateEls, useEditor, ed } from "../store";
import { NumberField, Row, Section, Seg, Select, TextField, Toggle } from "./controls";
import { BindingField } from "./BindingField";

const FILTER_OPS: { op: FilterOp; label: string; needsValue: boolean }[] = [
  { op: "equals", label: "is", needsValue: true },
  { op: "notEquals", label: "is not", needsValue: true },
  { op: "contains", label: "contains", needsValue: true },
  { op: "greater", label: "is more than", needsValue: true },
  { op: "less", label: "is less than", needsValue: true },
  { op: "isEmpty", label: "is empty", needsValue: false },
  { op: "isNotEmpty", label: "is filled in", needsValue: false },
  { op: "isTrue", label: "is yes", needsValue: false },
  { op: "isFalse", label: "is no", needsValue: false },
];

function CollectionPicker({ value, onChange, allowNone = true }: { value: string | undefined; onChange: (id: string | undefined) => void; allowNone?: boolean }) {
  const collections = useEditor((s) => s.collections);
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <select className="txt-field" value={value || ""} onChange={(e) => onChange(e.target.value || undefined)}>
        {allowNone && <option value="">Not connected</option>}
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {!collections.length && (
        <button className="btn sm soft" onClick={() => useEditor.setState({ view: "database" })}>
          <Plus size={14} /> Create a collection first
        </button>
      )}
    </div>
  );
}

function FiltersEditor({ filters, onChange, collection, elementId }: { filters: DataFilter[]; onChange: (f: DataFilter[]) => void; collection?: Collection; elementId: string }) {
  const fields = collection?.fields || [];
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {filters.map((f, i) => {
        if (f.op === "mine")
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="badge brand" style={{ flex: 1, height: 28 }}>
                Added by the signed-in person
              </span>
              <button className="icon-btn sm" onClick={() => onChange(filters.filter((_, j) => j !== i))} aria-label="Remove filter">
                <Trash2 size={13} />
              </button>
            </div>
          );
        const op = FILTER_OPS.find((o) => o.op === f.op);
        return (
          <div key={i} style={{ display: "grid", gap: 4, padding: 8, border: "1px solid var(--line)", borderRadius: 9 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 4 }}>
              <select className="txt-field" value={f.field} onChange={(e) => onChange(filters.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))}>
                {fields.map((fl) => (
                  <option key={fl.id} value={fl.name}>
                    {fl.name}
                  </option>
                ))}
                <option value="createdAt">Date added</option>
              </select>
              <select className="txt-field" value={f.op} onChange={(e) => onChange(filters.map((x, j) => (j === i ? { ...x, op: e.target.value as FilterOp } : x)))}>
                {FILTER_OPS.map((o) => (
                  <option key={o.op} value={o.op}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button className="icon-btn sm" onClick={() => onChange(filters.filter((_, j) => j !== i))} aria-label="Remove filter">
                <Trash2 size={13} />
              </button>
            </div>
            {op?.needsValue && <BindingField value={f.value || ""} elementId={elementId} placeholder="Value or {{Input.value}}" onCommit={(value) => onChange(filters.map((x, j) => (j === i ? { ...x, value } : x)))} />}
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn sm" style={{ flex: 1 }} disabled={!fields.length} onClick={() => onChange([...filters, { field: fields[0]?.name || "", op: "equals", value: "" }])}>
          <Plus size={13} /> Filter
        </button>
        <button className="btn sm" style={{ flex: 1 }} disabled={filters.some((f) => f.op === "mine")} onClick={() => onChange([...filters, { field: "createdBy", op: "mine" }])} title="Show only what the signed-in visitor added">
          <Plus size={13} /> Only mine
        </button>
      </div>
      <div className="mini-note">A filter with an empty value is ignored — handy for “show everything until they pick something”.</div>
    </div>
  );
}

function QueryEditor({ el, collection }: { el: El; collection?: Collection }) {
  const q: DataQuery = el.props.query || {};
  const setQ = (patch: Partial<DataQuery>) =>
    updateEls([el.id], (e) => {
      e.props.query = { ...(e.props.query || {}), ...patch };
    });
  return (
    <>
      <Section title="Filter">
        <FiltersEditor filters={q.filters || []} onChange={(filters) => setQ({ filters })} collection={collection} elementId={el.id} />
      </Section>
      <Section title="Sort & paging">
        <Row label="Sort by">
          <Select
            value={q.sortField || "createdAt"}
            onChange={(sortField) => setQ({ sortField })}
            options={[{ value: "createdAt", label: "Date added" }, { value: "updatedAt", label: "Last changed" }, ...(collection?.fields || []).map((f) => ({ value: f.name, label: f.name }))]}
          />
        </Row>
        <Row label="Order">
          <Seg
            value={q.sortDir || "desc"}
            onChange={(sortDir) => setQ({ sortDir })}
            options={[
              { value: "desc", label: "Newest / Z–A / 9–1" },
              { value: "asc", label: "Oldest / A–Z / 1–9" },
            ]}
          />
        </Row>
        <Row label="Per page">
          <NumberField value={q.pageSize ?? 10} min={1} max={100} onChange={(pageSize) => setQ({ pageSize: Math.round(pageSize) })} />
        </Row>
        <Toggle checked={!!q.search} onChange={(search) => setQ({ search })} label="Search bar" hint="Visitors can search the text fields." />
        {q.search && <TextField value={q.searchPlaceholder || ""} placeholder="Search…" onCommit={(searchPlaceholder) => setQ({ searchPlaceholder })} />}
      </Section>
    </>
  );
}

/** A nice card for a repeating list, built from the collection's fields. */
export function cardSpecFor(col: Collection, opts: { detailPageId?: string } = {}): ElementSpec {
  const img = col.fields.find((f) => f.type === "image");
  const title = col.fields.find((f) => f.type === "text" || f.type === "email") || col.fields[0];
  const others = col.fields.filter((f) => f !== img && f !== title && !["longText", "file", "reference"].includes(f.type)).slice(0, 3);
  const desc = col.fields.find((f) => f.type === "longText");
  const children: ElementSpec[] = [];
  if (img) children.push({ type: "image", box: { w: 280, h: 170 }, sizing: { w: "fill", h: "fixed" }, style: { radius: 0 }, props: { src: `{{record.${img.name}}}`, alt: "" } });
  const inner: ElementSpec[] = [];
  if (title) inner.push({ type: "text", box: { w: 240, h: 28 }, sizing: { w: "fill", h: "hug" }, props: { text: `{{record.${title.name}}}`, tag: "h3" } });
  if (desc) inner.push({ type: "text", box: { w: 240, h: 40 }, sizing: { w: "fill", h: "hug" }, style: { color: "$muted", fontSize: 14 }, props: { text: `{{record.${desc.name} | truncate:90}}`, tag: "p" } });
  for (const f of others)
    inner.push({
      type: "text",
      box: { w: 240, h: 20 },
      sizing: { w: "fill", h: "hug" },
      style: f.type === "select" ? { color: "$primary", fontWeight: 600, fontSize: 13 } : { color: "$muted", fontSize: 13 },
      props: { text: f.type === "select" || f.type === "multiSelect" ? `{{record.${f.name}}}` : `${f.name}: {{record.${f.name}}}`, tag: "small" },
    });
  if (opts.detailPageId)
    inner.push({ type: "button", box: { w: 120, h: 38 }, props: { label: "View", icon: "ArrowRight", iconPos: "right" }, events: { click: [{ type: "navigate", pageId: opts.detailPageId, recordId: "{{record.id}}" }] } });
  children.push({ type: "box", name: "CardBody", box: { w: 280, h: 120 }, sizing: { w: "fill", h: "hug" }, props: { layout: { ...DEFAULT_LAYOUT, mode: "column", gap: 8, padding: 18, align: "stretch" } }, children: inner });
  return {
    type: "box",
    name: "ItemCard",
    box: { w: 280, h: 300 },
    sizing: { w: "fill", h: "hug" },
    style: { fill: { type: "solid", color: "$background" }, radius: 16, borderWidth: 1, borderColor: "$border", overflow: "hidden", shadow: { x: 0, y: 6, blur: 18, spread: -8, color: "rgba(20,16,40,0.12)" } },
    props: { layout: { ...DEFAULT_LAYOUT, mode: "column", gap: 0, padding: 0, align: "stretch" } },
    children,
  };
}

const INPUT_FOR_FIELD: Partial<Record<FieldType, InputType>> = {
  text: "text",
  longText: "textarea",
  number: "number",
  currency: "number",
  boolean: "toggle",
  date: "date",
  datetime: "datetime",
  time: "time",
  email: "email",
  phone: "phone",
  url: "url",
  select: "select",
  multiSelect: "checkbox",
  image: "file",
  file: "file",
  rating: "rating",
  reference: "select",
};

const FIELD_FOR_INPUT: Record<InputType, FieldType> = {
  text: "text",
  email: "email",
  number: "number",
  phone: "phone",
  password: "text",
  url: "url",
  textarea: "longText",
  select: "select",
  radio: "select",
  checkbox: "multiSelect",
  toggle: "boolean",
  date: "date",
  time: "time",
  datetime: "datetime",
  range: "number",
  file: "file",
  rating: "rating",
  color: "text",
};

export function inputSpecFor(f: Field, refCollection?: Collection): ElementSpec {
  const t = INPUT_FOR_FIELD[f.type] || "text";
  const tall = t === "textarea" ? 150 : t === "checkbox" || t === "radio" ? 60 + (f.options?.length || 2) * 30 : t === "toggle" ? 40 : 74;
  return {
    type: "input",
    name: f.name.replace(/[^A-Za-z0-9_]/g, "") || "Field",
    box: { w: 380, h: tall },
    sizing: { w: "fill", h: "hug" },
    props: {
      inputType: t,
      label: f.name,
      name: f.name,
      required: !!f.required,
      showLabel: true,
      inputStyle: "box",
      options: f.options,
      optionsFrom: f.type === "reference" && refCollection ? { collectionId: refCollection.id, field: refCollection.fields[0]?.name || "" } : undefined,
      placeholder: t === "select" ? "Choose…" : "",
    },
  };
}

function FormData_({ el }: { el: El }) {
  const collections = useEditor((s) => s.collections);
  const page = useEditor((s) => getPage(s));
  const col = collections.find((c) => c.id === el.props.collectionId);
  const inputs = inputsOfForm(page, el.id);
  const [busy, setBusy] = useState(false);

  const createCollection = async () => {
    setBusy(true);
    try {
      const fields = inputs
        .filter((i) => (i.props.name || i.props.label || "").trim())
        .map((i) => ({
          name: (i.props.name || i.props.label || i.name).trim().replace(/[{}.|]/g, ""),
          type: FIELD_FOR_INPUT[i.props.inputType || "text"],
          required: !!i.props.required,
          options: i.props.options,
        }))
        .filter((f, idx, arr) => arr.findIndex((x) => x.name.toLowerCase() === f.name.toLowerCase()) === idx);
      let name = el.name.replace(/Form\d*$/i, "") || "Responses";
      if (name.length < 2 || /^form$/i.test(name)) name = "Responses";
      const taken = new Set(collections.map((c) => c.name.toLowerCase()));
      let final = name;
      for (let n = 2; taken.has(final.toLowerCase()); n++) final = `${name} ${n}`;
      const { collection } = await api<{ collection: Collection }>(`/api/apps/${ed().app.id}/collections`, {
        body: { name: final, fields: fields.length ? fields : [{ name: "Name", type: "text" }], access: { read: "admins", create: "anyone", update: "admins", delete: "admins" } },
      });
      setCollections([...ed().collections, collection]);
      updateEls([el.id], (e) => {
        e.props.collectionId = collection.id;
      });
      toast.success(`Created the “${collection.name}” collection — answers will be saved there.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const generateInputs = () => {
    if (!col) return;
    const have = new Set(inputs.map((i) => (i.props.name || "").toLowerCase()));
    const missing = col.fields.filter((f) => !have.has(f.name.toLowerCase()) && f.type !== "image");
    if (!missing.length) {
      toast("Every field already has an input.");
      return;
    }
    const current = getPage();
    const names = layerNames(current);
    const specs = missing.map((f) => inputSpecFor(f, collections.find((c) => c.id === f.refCollectionId)));
    const hasSubmit = descendantIds(current, el.id).some((id) => current.elements[id]?.type === "button" && current.elements[id]?.props.submit);
    const all = specs.flatMap((s) => instantiateSpec(s, el.id, names));
    if (!hasSubmit) all.push(...instantiateSpec({ type: "button", box: { w: 380, h: 48 }, sizing: { w: "fill", h: "fixed" }, props: { label: "Submit", submit: true } }, el.id, names));
    mutate((_d, pg) => {
      const form = pg.elements[el.id];
      if (form.props.layout?.mode === "free" || !form.props.layout) form.props.layout = { ...DEFAULT_LAYOUT, mode: "column", gap: 14, padding: 24 };
      const submitIdx = (form.childIds || []).findIndex((id) => pg.elements[id]?.type === "button" && pg.elements[id]?.props.submit);
      insertElements(pg as never, all, el.id, submitIdx >= 0 ? submitIdx : undefined);
      form.sizing = { w: form.sizing?.w ?? "fixed", h: "hug" };
    });
    toast.success(`Added ${missing.length} input${missing.length === 1 ? "" : "s"}.`);
  };

  return (
    <>
      <Section title="Save answers to">
        <CollectionPicker value={el.props.collectionId} onChange={(collectionId) => updateEls([el.id], (e) => void (e.props.collectionId = collectionId))} />
        {!el.props.collectionId && (
          <button className="btn sm soft" disabled={busy} onClick={createCollection}>
            <Wand2 size={14} /> Create a collection from this form
          </button>
        )}
        {col && (
          <>
            <div className="mini-note">Each input is saved into the field with the same name:</div>
            <div style={{ display: "grid", gap: 4 }}>
              {inputs.map((i) => {
                const f = col.fields.find((x) => x.name.toLowerCase() === (i.props.name || "").toLowerCase());
                return (
                  <div key={i.id} className="insp-row" style={{ minHeight: 22 }}>
                    {f ? <CircleCheck size={14} color="var(--success)" /> : <CircleAlert size={14} color="var(--warning)" />}
                    <span style={{ fontSize: 12, flex: 1 }}>
                      {i.props.label || i.name} → {f ? <strong>{f.name}</strong> : <em>no field named “{i.props.name}”</em>}
                    </span>
                  </div>
                );
              })}
            </div>
            <button className="btn sm" onClick={generateInputs}>
              <Sparkles size={14} /> Add inputs for missing fields
            </button>
          </>
        )}
      </Section>
    </>
  );
}

export function DataTab({ el }: { el: El }) {
  const collections = useEditor((s) => s.collections);
  const pages = useEditor((s) => s.doc.pages);
  const col = collections.find((c) => c.id === el.props.collectionId);
  const setCol = (collectionId: string | undefined) =>
    updateEls([el.id], (e) => {
      e.props.collectionId = collectionId;
      if (e.type === "table") e.props.columns = [];
      if (e.props.query) e.props.query = { ...e.props.query, filters: [] };
    });

  if (el.type === "form") return <FormData_ el={el} />;

  if (el.type === "list") {
    const detail = pages.find((p) => p.recordCollectionId && p.recordCollectionId === el.props.collectionId);
    return (
      <>
        <Section title="Show records from">
          <CollectionPicker value={el.props.collectionId} onChange={setCol} />
          {col && (
            <button
              className="btn sm soft"
              onClick={() => {
                const spec = cardSpecFor(col, { detailPageId: detail?.id });
                mutate((_d, pg) => {
                  const list = pg.elements[el.id];
                  if (list.childIds?.length) removeElements(pg as never, [...list.childIds]);
                  const els = instantiateSpec(spec, el.id, layerNames(pg as never));
                  insertElements(pg as never, els, el.id);
                });
                toast.success("Made a card from your fields. Style it however you like!");
              }}
            >
              <Wand2 size={14} /> Design a card from the fields
            </button>
          )}
          <div className="mini-note">The first thing inside the list is the card that repeats. Use {"{{record.Field}}"} inside it.</div>
        </Section>
        {col && <QueryEditor el={el} collection={col} />}
      </>
    );
  }

  if (el.type === "table") {
    const cols = el.props.columns || [];
    const shown = cols.length ? cols.map((c) => c.field) : (col?.fields || []).slice(0, 6).map((f) => f.name);
    return (
      <>
        <Section title="Show records from">
          <CollectionPicker value={el.props.collectionId} onChange={setCol} />
        </Section>
        {col && (
          <>
            <Section title="Columns">
              {col.fields.map((f) => (
                <label key={f.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={shown.includes(f.name)}
                    onChange={(e) => {
                      const next = e.target.checked ? [...shown, f.name] : shown.filter((x) => x !== f.name);
                      updateEls([el.id], (x) => void (x.props.columns = next.map((field) => ({ field }))));
                    }}
                  />
                  <span className="field-type-chip">
                    <Icon name={FIELD_TYPE_MAP[f.type].icon} size={12} />
                  </span>
                  {f.name}
                </label>
              ))}
            </Section>
            <QueryEditor el={el} collection={col} />
          </>
        )}
      </>
    );
  }

  if (el.type === "stat" || el.type === "chart") {
    const numeric = (col?.fields || []).filter((f) => ["number", "currency", "rating"].includes(f.type));
    const setP = (patch: Partial<El["props"]>) => updateEls([el.id], (e) => Object.assign(e.props, patch));
    return (
      <>
        <Section title="Count records from">
          {el.type === "chart" && el.props.dataSource !== "collection" && (
            <button className="btn sm soft" onClick={() => setP({ dataSource: "collection" })}>
              Use my database instead of typed-in data
            </button>
          )}
          <CollectionPicker value={el.props.collectionId} onChange={setCol} />
          {col && (
            <>
              <Row label="Show">
                <Select
                  value={el.props.aggregate || "count"}
                  onChange={(aggregate) => setP({ aggregate })}
                  options={[
                    { value: "count", label: "How many records" },
                    { value: "sum", label: "Total of a number" },
                    { value: "avg", label: "Average of a number" },
                    { value: "min", label: "Smallest number" },
                    { value: "max", label: "Largest number" },
                  ]}
                />
              </Row>
              {el.props.aggregate && el.props.aggregate !== "count" && (
                <Row label="Of field">
                  {numeric.length ? <Select value={el.props.field} onChange={(field) => setP({ field })} options={numeric.map((f) => ({ value: f.name, label: f.name }))} /> : <div className="mini-note">No number fields.</div>}
                </Row>
              )}
              {el.type === "chart" && (
                <Row label="Group by">
                  <Select value={el.props.groupBy || "createdAt"} onChange={(groupBy) => setP({ groupBy })} options={[{ value: "createdAt", label: "Day added" }, ...col.fields.filter((f) => !["longText", "image", "file"].includes(f.type)).map((f) => ({ value: f.name, label: f.name }))]} />
                </Row>
              )}
            </>
          )}
        </Section>
        {col && (
          <Section title="Filter">
            <FiltersEditor filters={el.props.query?.filters || []} onChange={(filters) => updateEls([el.id], (e) => void (e.props.query = { ...(e.props.query || {}), filters }))} collection={col} elementId={el.id} />
          </Section>
        )}
      </>
    );
  }

  return (
    <div className="insp-section">
      <div className="mini-note">This element doesn&apos;t use the database. Lists, tables, forms, stat cards and charts do.</div>
    </div>
  );
}
