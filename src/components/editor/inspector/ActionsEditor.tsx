"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2, X } from "lucide-react";
import type { Action, ActionType, Collection, ConditionOp, El, Page, TransactionStep } from "@/lib/shared/types";
import { CONDITION_OPS } from "@/lib/shared/expressions";
import { ELEMENT_INFO } from "@/lib/shared/elements";
import { formOf } from "@/lib/shared/doc";
import { uid } from "@/lib/shared/util";
import { Icon } from "@/components/ui/Icon";
import { Dropdown, type MenuEntry } from "@/components/ui/Popover";
import { promptDialog } from "@/components/ui/confirm";
import { getPage, mutate, useEditor } from "../store";
import { NumberField, Row, Seg, Select, TextField, Toggle } from "./controls";
import { BindingField } from "./BindingField";

interface ActionInfo {
  label: string;
  icon: string;
  group: string;
  hint?: string;
}

export const ACTION_INFO: Record<ActionType, ActionInfo> = {
  navigate: { label: "Go to page", icon: "ArrowRight", group: "Move around" },
  goBack: { label: "Go back", icon: "Undo2", group: "Move around" },
  openUrl: { label: "Open a website link", icon: "ExternalLink", group: "Move around" },
  scrollTo: { label: "Scroll to an element", icon: "ArrowDown", group: "Move around" },
  notify: { label: "Show a message", icon: "MessageCircle", group: "Show & hide" },
  setVisibility: { label: "Show / hide an element", icon: "Eye", group: "Show & hide" },
  openDialog: { label: "Open pop-up", icon: "AppWindow", group: "Show & hide" },
  closeDialog: { label: "Close pop-up", icon: "X", group: "Show & hide" },
  setTab: { label: "Switch tab", icon: "PanelTop", group: "Show & hide" },
  submitForm: { label: "Submit a form", icon: "Send", group: "Forms" },
  validateForm: { label: "Check a form is filled in", icon: "CircleCheck", group: "Forms", hint: "Stops here if a required field is empty or invalid." },
  resetForm: { label: "Clear a form", icon: "RefreshCw", group: "Forms" },
  createRecord: { label: "Save a new record", icon: "Plus", group: "Database" },
  updateRecord: { label: "Update a record", icon: "Pencil", group: "Database" },
  deleteRecord: { label: "Delete a record", icon: "Trash2", group: "Database" },
  adjustNumber: { label: "Add to / subtract from a number", icon: "Hash", group: "Database", hint: "Great for likes, votes, stock and scores." },
  transaction: { label: "Several changes at once", icon: "Layers", group: "Database", hint: "All steps succeed together, or none happen." },
  habitCheckIn: { label: "Check in a habit", icon: "CircleCheck", group: "Database", hint: "One check-in per local day; streaks follow the habit's goal." },
  refreshData: { label: "Refresh lists & tables", icon: "RefreshCw", group: "Database" },
  setVariable: { label: "Set a variable", icon: "Variable", group: "Remember things" },
  setProperty: { label: "Change an element", icon: "Paintbrush", group: "Remember things" },
  copyText: { label: "Copy text", icon: "Copy", group: "Other" },
  signIn: { label: "Ask to sign in", icon: "LogIn", group: "Other" },
  signOut: { label: "Sign out", icon: "LogOut", group: "Other" },
  wait: { label: "Wait a moment", icon: "Timer", group: "Other" },
};

function describe(a: Action, page: Page, collections: Collection[], pages: Page[]): string {
  const elName = (id?: string) => (id ? page.elements[id]?.name || "missing element" : "…");
  const colName = (id?: string) => collections.find((c) => c.id === id)?.name || "…";
  switch (a.type) {
    case "navigate":
      return `Go to ${pages.find((p) => p.id === a.pageId)?.name || "…"}`;
    case "openUrl":
      return `Open ${a.url || "…"}`;
    case "notify":
      return `Say “${(a.message || "").slice(0, 28)}”`;
    case "setVisibility":
      return `${a.mode === "show" ? "Show" : a.mode === "hide" ? "Hide" : "Show/hide"} ${elName(a.targetId)}`;
    case "openDialog":
      return `Open ${elName(a.targetId)}`;
    case "closeDialog":
      return a.targetId ? `Close ${elName(a.targetId)}` : "Close this pop-up";
    case "createRecord":
      return `Save to ${colName(a.collectionId)}`;
    case "updateRecord":
      return `Update ${colName(a.collectionId)}`;
    case "deleteRecord":
      return `Delete from ${colName(a.collectionId)}`;
    case "adjustNumber":
      return `${colName(a.collectionId)} · ${a.fieldName || "…"} ${String(a.amount ?? "1").startsWith("-") ? "" : "+"}${a.amount ?? 1}`;
    case "setVariable":
      return `${a.variable || "…"} ${a.op === "add" ? "+" : a.op === "subtract" ? "−" : a.op === "toggle" ? "flip" : "="} ${a.op === "toggle" ? "" : a.value ?? ""}`;
    case "setProperty":
      return `${elName(a.targetId)}.${a.property || "…"}`;
    case "wait":
      return `Wait ${a.ms ?? 500} ms`;
    default:
      return ACTION_INFO[a.type].label;
  }
}

function newAction(type: ActionType, ctx: { page: Page; elementId: string | null; collections: Collection[]; pages: Page[] }): Action {
  const a: Action = { id: uid("act"), type };
  const form = ctx.elementId ? formOf(ctx.page, ctx.elementId) : null;
  switch (type) {
    case "navigate":
      a.pageId = ctx.pages.find((p) => p.id !== ctx.page.id)?.id || ctx.pages[0]?.id;
      break;
    case "openUrl":
      a.url = "https://";
      a.newTab = true;
      break;
    case "notify":
      a.message = "Done!";
      a.tone = "success";
      break;
    case "setVisibility":
      a.mode = "toggle";
      break;
    case "openDialog":
      a.targetId = Object.values(ctx.page.elements).find((e) => e.type === "dialog")?.id;
      break;
    case "submitForm":
    case "validateForm":
    case "resetForm":
      a.formId = form?.id;
      break;
    case "createRecord":
      a.collectionId = form?.props.collectionId || ctx.collections[0]?.id;
      a.formId = form?.id;
      break;
    case "updateRecord":
    case "deleteRecord":
    case "adjustNumber":
      a.collectionId = ctx.collections[0]?.id;
      if (type === "adjustNumber") {
        a.amount = "1";
        a.fieldName = ctx.collections[0]?.fields.find((f) => ["number", "currency", "rating"].includes(f.type))?.name;
      }
      if (type === "deleteRecord") a.confirmText = "Delete this for good?";
      break;
    case "transaction":
      a.steps = [{ id: uid("st"), kind: "create", collectionId: ctx.collections[0]?.id || "", mapping: {} }];
      break;
    case "setVariable":
      a.op = "set";
      a.value = "";
      break;
    case "wait":
      a.ms = 800;
      break;
  }
  return a;
}

export function ElementSelect({ value, onChange, filter, placeholder = "Choose an element" }: { value: string | undefined; onChange: (id: string) => void; filter?: (el: El) => boolean; placeholder?: string }) {
  const page = useEditor((s) => getPage(s));
  const els = Object.values(page.elements).filter((e) => !filter || filter(e));
  if (!els.length) return <div className="mini-note">There isn&apos;t a matching element on this page yet.</div>;
  return (
    <select className="txt-field" value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {els.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name} · {ELEMENT_INFO[e.type].label}
        </option>
      ))}
    </select>
  );
}

function MappingEditor({ mapping, onChange, collection, elementId, hint }: { mapping: Record<string, string>; onChange: (m: Record<string, string>) => void; collection?: Collection; elementId: string | null; hint?: string }) {
  const entries = Object.entries(mapping);
  const unused = (collection?.fields || []).filter((f) => !(f.name in mapping));
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {hint && <div className="mini-note">{hint}</div>}
      {entries.map(([field, value]) => (
        <div key={field} style={{ display: "grid", gridTemplateColumns: "90px 1fr auto", gap: 4, alignItems: "center" }}>
          <span className="mini-note" style={{ fontWeight: 650, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis" }} title={field}>
            {field}
          </span>
          <BindingField value={value} elementId={elementId} forActions onCommit={(v) => onChange({ ...mapping, [field]: v })} placeholder="Value" />
          <button
            className="icon-btn sm"
            aria-label={`Stop setting ${field}`}
            onClick={() => {
              const next = { ...mapping };
              delete next[field];
              onChange(next);
            }}
          >
            <X size={13} />
          </button>
        </div>
      ))}
      {unused.length > 0 && (
        <select
          className="txt-field"
          value=""
          onChange={(e) => {
            if (!e.target.value) return;
            onChange({ ...mapping, [e.target.value]: "" });
          }}
        >
          <option value="">+ Set a field…</option>
          {unused.map((f) => (
            <option key={f.id} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function CollectionSelect({ value, onChange }: { value: string | undefined; onChange: (id: string) => void }) {
  const collections = useEditor((s) => s.collections);
  if (!collections.length) return <div className="mini-note">Create a collection in the Database first.</div>;
  return <Select value={value} onChange={onChange} options={collections.map((c) => ({ value: c.id, label: c.name }))} />;
}

function RecordIdField({ value, onChange, elementId }: { value: string | undefined; onChange: (v: string | undefined) => void; elementId: string | null }) {
  const custom = value !== undefined && value !== "";
  return (
    <>
      <Row label="Which record">
        <Seg
          value={custom ? "custom" : "this"}
          onChange={(v) => onChange(v === "this" ? undefined : "{{record.id}}")}
          options={[
            { value: "this", label: "This one", title: "The record shown by the list row or page" },
            { value: "custom", label: "By id…" },
          ]}
        />
      </Row>
      {custom && <BindingField value={value || ""} elementId={elementId} forActions onCommit={(v) => onChange(v)} placeholder="{{vars.selectedId}}" />}
    </>
  );
}

function ActionBody({ a, set, elementId }: { a: Action; set: (patch: Partial<Action>) => void; elementId: string | null }) {
  const page = useEditor((s) => getPage(s));
  const pages = useEditor((s) => s.doc.pages);
  const collections = useEditor((s) => s.collections);
  const variables = useEditor((s) => s.doc.variables);
  const col = collections.find((c) => c.id === a.collectionId);
  const forms = (el: El) => el.type === "form";
  const enclosingForm = elementId ? formOf(page, elementId) : null;

  switch (a.type) {
    case "navigate": {
      const target = pages.find((p) => p.id === a.pageId);
      return (
        <>
          <Select value={a.pageId} onChange={(pageId) => set({ pageId })} options={pages.map((p) => ({ value: p.id, label: p.name }))} />
          {target?.recordCollectionId && (
            <>
              <div className="mini-note">That page shows one record. Which one?</div>
              <BindingField value={a.recordId ?? "{{record.id}}"} elementId={elementId} forActions onCommit={(recordId) => set({ recordId })} />
            </>
          )}
        </>
      );
    }
    case "openUrl":
      return (
        <>
          <BindingField value={a.url || ""} elementId={elementId} forActions placeholder="https://… or mailto:…" onCommit={(url) => set({ url })} />
          <Toggle checked={!!a.newTab} onChange={(newTab) => set({ newTab })} label="Open in a new tab" />
        </>
      );
    case "notify":
      return (
        <>
          <BindingField value={a.message || ""} elementId={elementId} forActions onCommit={(message) => set({ message })} />
          <Seg
            value={a.tone || "success"}
            onChange={(tone) => set({ tone })}
            options={[
              { value: "success", label: "Success" },
              { value: "info", label: "Info" },
              { value: "error", label: "Warning" },
            ]}
          />
        </>
      );
    case "setVisibility":
      return (
        <>
          <ElementSelect value={a.targetId} onChange={(targetId) => set({ targetId })} filter={(e) => e.id !== elementId} />
          <Seg
            value={a.mode || "toggle"}
            onChange={(mode) => set({ mode })}
            options={[
              { value: "show", label: "Show" },
              { value: "hide", label: "Hide" },
              { value: "toggle", label: "Switch" },
            ]}
          />
        </>
      );
    case "openDialog":
      return <ElementSelect value={a.targetId} onChange={(targetId) => set({ targetId })} filter={(e) => e.type === "dialog"} placeholder="Choose a pop-up" />;
    case "closeDialog":
      return <ElementSelect value={a.targetId} onChange={(targetId) => set({ targetId: targetId || undefined })} filter={(e) => e.type === "dialog"} placeholder="The pop-up this is in" />;
    case "setTab": {
      const tabsEl = a.targetId ? page.elements[a.targetId] : undefined;
      return (
        <>
          <ElementSelect value={a.targetId} onChange={(targetId) => set({ targetId, tabIndex: 0 })} filter={(e) => e.type === "tabs"} />
          {tabsEl && <Select value={String(a.tabIndex ?? 0)} onChange={(v) => set({ tabIndex: Number(v) })} options={(tabsEl.props.tabs || []).map((t, i) => ({ value: String(i), label: t.label }))} />}
        </>
      );
    }
    case "scrollTo":
      return <ElementSelect value={a.targetId} onChange={(targetId) => set({ targetId })} />;
    case "submitForm":
    case "validateForm":
    case "resetForm":
      return <ElementSelect value={a.formId} onChange={(formId) => set({ formId: formId || undefined })} filter={forms} placeholder={enclosingForm ? "The form this is in" : "Choose a form"} />;
    case "createRecord":
      return (
        <>
          <CollectionSelect value={a.collectionId} onChange={(collectionId) => set({ collectionId })} />
          <Row label="Answers from">
            <ElementSelect value={a.formId} onChange={(formId) => set({ formId: formId || undefined })} filter={forms} placeholder={enclosingForm ? "The form this is in" : "No form"} />
          </Row>
          <MappingEditor mapping={a.mapping || {}} onChange={(mapping) => set({ mapping })} collection={col} elementId={elementId} hint="Form inputs fill matching fields automatically. Set extra fields here:" />
          <Toggle checked={!!a.resetAfter} onChange={(resetAfter) => set({ resetAfter })} label="Clear the form afterwards" />
          {variables.length > 0 && (
            <Row label="Remember id in">
              <Select value={a.saveIdTo || ""} onChange={(saveIdTo) => set({ saveIdTo: saveIdTo || undefined })} options={[{ value: "", label: "Don't remember" }, ...variables.map((v) => ({ value: v.name, label: v.name }))]} />
            </Row>
          )}
        </>
      );
    case "updateRecord":
      return (
        <>
          <CollectionSelect value={a.collectionId} onChange={(collectionId) => set({ collectionId })} />
          <RecordIdField value={a.recordId} onChange={(recordId) => set({ recordId })} elementId={elementId} />
          <Row label="Answers from">
            <ElementSelect value={a.formId} onChange={(formId) => set({ formId: formId || undefined })} filter={forms} placeholder={enclosingForm ? "The form this is in" : "No form"} />
          </Row>
          <MappingEditor mapping={a.mapping || {}} onChange={(mapping) => set({ mapping })} collection={col} elementId={elementId} hint="Fields to change:" />
        </>
      );
    case "deleteRecord":
      return (
        <>
          <CollectionSelect value={a.collectionId} onChange={(collectionId) => set({ collectionId })} />
          <RecordIdField value={a.recordId} onChange={(recordId) => set({ recordId })} elementId={elementId} />
          <Row label="Ask first">
            <TextField value={a.confirmText || ""} placeholder="No question" onCommit={(confirmText) => set({ confirmText: confirmText || undefined })} />
          </Row>
        </>
      );
    case "adjustNumber":
      return (
        <>
          <CollectionSelect value={a.collectionId} onChange={(collectionId) => set({ collectionId })} />
          <RecordIdField value={a.recordId} onChange={(recordId) => set({ recordId })} elementId={elementId} />
          <Row label="Number field">
            <Select value={a.fieldName} onChange={(fieldName) => set({ fieldName })} options={(col?.fields || []).filter((f) => ["number", "currency", "rating"].includes(f.type)).map((f) => ({ value: f.name, label: f.name }))} />
          </Row>
          <Row label="Change by">
            <BindingField value={a.amount ?? "1"} elementId={elementId} forActions onCommit={(amount) => set({ amount })} placeholder="1, -1, {{Qty.value}}" />
          </Row>
          <Row label="Never below">
            <TextField value={a.min ?? ""} placeholder="No limit" onCommit={(min) => set({ min: min || undefined })} />
          </Row>
        </>
      );
    case "transaction":
      return <TransactionEditor steps={a.steps || []} onChange={(steps) => set({ steps })} elementId={elementId} />;
    case "habitCheckIn":
      return <>
        <CollectionSelect value={a.collectionId} onChange={(collectionId) => set({ collectionId })} />
        <RecordIdField value={a.recordId} onChange={(recordId) => set({ recordId })} elementId={elementId} />
        <div className="mini-note">Use the habit template's Check-ins collection, with Habit (reference) and Day (date) fields. The linked habit needs Goal and Streak fields. Its time zone is fixed on the first check-in.</div>
      </>;
    case "setVariable":
      return (
        <>
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ flex: 1 }}>
              {variables.length ? (
                <Select value={a.variable} onChange={(variable) => set({ variable })} options={variables.map((v) => ({ value: v.name, label: `${v.name} (${v.type})` }))} />
              ) : (
                <div className="mini-note">No variables yet.</div>
              )}
            </div>
            <button
              className="btn sm"
              onClick={async () => {
                const name = await promptDialog({
                  title: "New variable",
                  label: "Name (letters, numbers and _)",
                  placeholder: "score",
                  validate: (v) => (/^[A-Za-z][A-Za-z0-9_]*$/.test(v) ? (variables.some((x) => x.name === v) ? "That name is taken" : null) : "Start with a letter; use letters, numbers and _"),
                });
                if (!name) return;
                mutate((d) => {
                  d.variables.push({ id: uid("var"), name, type: "number", initial: "0" });
                });
                set({ variable: name });
              }}
            >
              <Plus size={13} /> New
            </button>
          </div>
          <Row label="How">
            <Select
              value={a.op || "set"}
              onChange={(op) => set({ op })}
              options={[
                { value: "set", label: "Set to" },
                { value: "add", label: "Add" },
                { value: "subtract", label: "Subtract" },
                { value: "multiply", label: "Multiply by" },
                { value: "divide", label: "Divide by" },
                { value: "toggle", label: "Flip yes/no" },
                { value: "append", label: "Add text to the end" },
              ]}
            />
          </Row>
          {a.op !== "toggle" && <BindingField value={a.value ?? ""} elementId={elementId} forActions onCommit={(value) => set({ value })} placeholder="Value" />}
        </>
      );
    case "setProperty":
      return (
        <>
          <ElementSelect value={a.targetId} onChange={(targetId) => set({ targetId })} />
          <Row label="What">
            <Select
              value={a.property}
              onChange={(property) => set({ property })}
              options={[
                { value: "text", label: "Text / label" },
                { value: "value", label: "Input value" },
                { value: "color", label: "Text colour" },
                { value: "backgroundColor", label: "Background colour" },
                { value: "source", label: "Image source" },
                { value: "visible", label: "Visible (true/false)" },
              ]}
            />
          </Row>
          <BindingField value={a.value ?? ""} elementId={elementId} forActions onCommit={(value) => set({ value })} placeholder="New value" />
        </>
      );
    case "copyText":
      return <BindingField value={a.text ?? ""} elementId={elementId} forActions onCommit={(text) => set({ text })} placeholder="Text to copy" />;
    case "wait":
      return <NumberField label="ms" value={a.ms ?? 500} min={0} max={10000} step={100} onChange={(ms) => set({ ms })} />;
    default:
      return ACTION_INFO[a.type].hint ? <div className="mini-note">{ACTION_INFO[a.type].hint}</div> : null;
  }
}

function TransactionEditor({ steps, onChange, elementId }: { steps: TransactionStep[]; onChange: (s: TransactionStep[]) => void; elementId: string | null }) {
  const collections = useEditor((s) => s.collections);
  const setStep = (id: string, patch: Partial<TransactionStep>) => onChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="mini-note">Later steps can use the id of a record made earlier: {"{{steps.0.id}}"}.</div>
      {steps.map((st, i) => {
        const col = collections.find((c) => c.id === st.collectionId);
        return (
          <div key={st.id} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 8, display: "grid", gap: 6 }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <strong style={{ fontSize: 11.5 }}>Step {i + 1}</strong>
              <div style={{ flex: 1 }}>
                <Select
                  value={st.kind}
                  onChange={(kind) => setStep(st.id, { kind })}
                  options={[
                    { value: "create", label: "Add a record" },
                    { value: "update", label: "Update a record" },
                    { value: "adjust", label: "Change a number" },
                    { value: "delete", label: "Delete a record" },
                  ]}
                />
              </div>
              <button className="icon-btn sm" onClick={() => onChange(steps.filter((s) => s.id !== st.id))} aria-label="Remove step">
                <Trash2 size={13} />
              </button>
            </div>
            <CollectionSelect value={st.collectionId} onChange={(collectionId) => setStep(st.id, { collectionId })} />
            {st.kind !== "create" && <BindingField value={st.recordId || ""} elementId={elementId} forActions placeholder="Record id, e.g. {{record.id}}" onCommit={(recordId) => setStep(st.id, { recordId })} />}
            {(st.kind === "create" || st.kind === "update") && <MappingEditor mapping={st.mapping || {}} onChange={(mapping) => setStep(st.id, { mapping })} collection={col} elementId={elementId} />}
            {st.kind === "adjust" && (
              <>
                <Select value={st.fieldName} onChange={(fieldName) => setStep(st.id, { fieldName })} options={(col?.fields || []).filter((f) => ["number", "currency", "rating"].includes(f.type)).map((f) => ({ value: f.name, label: f.name }))} />
                <div className="insp-grid2">
                  <TextField value={st.amount ?? "-1"} placeholder="Change by" onCommit={(amount) => setStep(st.id, { amount })} />
                  <TextField value={st.min ?? ""} placeholder="Never below" onCommit={(min) => setStep(st.id, { min })} />
                </div>
              </>
            )}
          </div>
        );
      })}
      {steps.length < 10 && (
        <button className="btn sm" onClick={() => onChange([...steps, { id: uid("st"), kind: "adjust", collectionId: collections[0]?.id || "", amount: "-1", min: "0" }])}>
          <Plus size={13} /> Add a step
        </button>
      )}
    </div>
  );
}

function ConditionEditor({ a, set, elementId }: { a: Action; set: (patch: Partial<Action>) => void; elementId: string | null }) {
  const c = a.condition;
  const op = CONDITION_OPS.find((o) => o.op === c?.op);
  return (
    <>
      <Toggle checked={!!c} onChange={(on) => set({ condition: on ? { left: "", op: "isNotEmpty" } : null })} label="Only if…" hint={c ? "This step is skipped when the condition isn't true." : undefined} />
      {c && (
        <div style={{ display: "grid", gap: 4 }}>
          <BindingField value={c.left} elementId={elementId} forActions onCommit={(left) => set({ condition: { ...c, left } })} placeholder="{{Qty.value}}" />
          <select className="txt-field" value={c.op} onChange={(e) => set({ condition: { ...c, op: e.target.value as ConditionOp } })}>
            {CONDITION_OPS.map((o) => (
              <option key={o.op} value={o.op}>
                {o.label}
              </option>
            ))}
          </select>
          {op?.needsRight && <BindingField value={c.right ?? ""} elementId={elementId} forActions onCommit={(right) => set({ condition: { ...c, right } })} placeholder="Value" />}
        </div>
      )}
    </>
  );
}

export function ActionsEditor({ actions, onChange, elementId, emptyText }: { actions: Action[]; onChange: (a: Action[]) => void; elementId: string | null; emptyText?: string }) {
  const page = useEditor((s) => getPage(s));
  const pages = useEditor((s) => s.doc.pages);
  const collections = useEditor((s) => s.collections);
  const [open, setOpen] = useState<string | null>(actions[actions.length - 1]?.id ?? null);

  const groups = Array.from(new Set(Object.values(ACTION_INFO).map((i) => i.group)));
  const menu: MenuEntry[] = groups.flatMap((g) => [
    { heading: g } as MenuEntry,
    ...(Object.entries(ACTION_INFO) as [ActionType, ActionInfo][])
      .filter(([, i]) => i.group === g)
      .map(
        ([type, info]) =>
          ({
            label: info.label,
            icon: <Icon name={info.icon} size={15} />,
            onClick: () => {
              const a = newAction(type, { page, elementId, collections, pages });
              onChange([...actions, a]);
              setOpen(a.id);
            },
          }) as MenuEntry,
      ),
  ]);

  const update = (id: string, patch: Partial<Action>) => onChange(actions.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {!actions.length && <div className="mini-note">{emptyText || "Nothing happens yet. Add an action below."}</div>}
      {actions.map((a, i) => {
        const info = ACTION_INFO[a.type];
        const isOpen = open === a.id;
        return (
          <div key={a.id} className="action-card">
            <div className="action-head" onClick={() => setOpen(isOpen ? null : a.id)}>
              <span className="step">{i + 1}</span>
              <Icon name={info.icon} size={14} />
              <span className="a-title">{describe(a, page, collections, pages)}</span>
              {a.condition && <span className="badge brand">if</span>}
              <button
                className="icon-btn sm"
                disabled={i === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  const next = actions.slice();
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  onChange(next);
                }}
                aria-label="Move up"
              >
                <ArrowUp size={13} />
              </button>
              <button
                className="icon-btn sm"
                disabled={i === actions.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  const next = actions.slice();
                  [next[i + 1], next[i]] = [next[i], next[i + 1]];
                  onChange(next);
                }}
                aria-label="Move down"
              >
                <ArrowDown size={13} />
              </button>
              <button
                className="icon-btn sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(actions.filter((x) => x.id !== a.id));
                }}
                aria-label="Delete action"
              >
                <Trash2 size={13} />
              </button>
            </div>
            {isOpen && (
              <div className="action-body">
                <div className="field-label">{info.label}</div>
                {info.hint && a.type !== "validateForm" && <div className="mini-note">{info.hint}</div>}
                <ActionBody a={a} set={(patch) => update(a.id, patch)} elementId={elementId} />
                <ConditionEditor a={a} set={(patch) => update(a.id, patch)} elementId={elementId} />
              </div>
            )}
          </div>
        );
      })}
      <Dropdown
        placement="left-start"
        width={250}
        trigger={
          <button className="btn sm soft" style={{ width: "100%" }}>
            <Plus size={14} /> Add action <ChevronDown size={13} />
          </button>
        }
        items={menu}
      />
    </div>
  );
}
