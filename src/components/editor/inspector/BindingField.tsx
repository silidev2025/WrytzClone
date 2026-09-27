"use client";

import { useEffect, useRef, useState } from "react";
import { Braces } from "lucide-react";
import type { Page } from "@/lib/shared/types";
import { listOf } from "@/lib/shared/doc";
import { FIELD_TYPE_MAP } from "@/lib/shared/fields";
import { INPUT_TYPE_INFO } from "@/lib/shared/elements";
import { Icon } from "@/components/ui/Icon";
import { Popover } from "@/components/ui/Popover";
import { ed, getPage, useEditor } from "../store";

export interface BindingOption {
  group: string;
  label: string;
  value: string;
  icon: string;
}

/** Everything an element can show with {{…}}, in plain language. */
export function bindingOptions(elementId: string | null, opts: { forActions?: boolean } = {}): BindingOption[] {
  const s = ed();
  const page: Page = getPage(s);
  const out: BindingOption[] = [];
  // the record this element shows
  const list = elementId ? listOf(page, elementId) : null;
  const colId = list?.props.collectionId || (list ? undefined : page.recordCollectionId);
  const col = s.collections.find((c) => c.id === colId);
  if (col) {
    for (const f of col.fields) out.push({ group: `This ${col.name.replace(/s$/, "")} record`, label: f.name, value: `{{record.${f.name}}}`, icon: FIELD_TYPE_MAP[f.type].icon });
    out.push({ group: `This ${col.name.replace(/s$/, "")} record`, label: "Record ID", value: "{{record.id}}", icon: "Hash" });
    out.push({ group: `This ${col.name.replace(/s$/, "")} record`, label: "Date added", value: "{{record.createdAt | date}}", icon: "Calendar" });
  }
  for (const v of s.doc.variables) out.push({ group: "Variables", label: v.name, value: `{{vars.${v.name}}}`, icon: v.type === "number" ? "Hash" : v.type === "boolean" ? "ToggleRight" : "Type" });
  for (const el of Object.values(page.elements)) {
    if (el.type !== "input") continue;
    const t = el.props.inputType || "text";
    out.push({ group: "Inputs on this page", label: `${el.props.label || el.name} (${el.name})`, value: `{{${el.name}.value}}`, icon: INPUT_TYPE_INFO[t].icon });
  }
  out.push({ group: "Signed-in person", label: "Name", value: "{{user.name}}", icon: "User" });
  out.push({ group: "Signed-in person", label: "Email", value: "{{user.email}}", icon: "Mail" });
  out.push({ group: "Signed-in person", label: "Is signed in (yes/no)", value: "{{user.signedIn}}", icon: "LogIn" });
  out.push({ group: "Signed-in person", label: "Is an admin (yes/no)", value: "{{user.isAdmin}}", icon: "Crown" });
  out.push({ group: "Page & app", label: "Record id in the link", value: "{{page.params.id}}", icon: "Link" });
  out.push({ group: "Page & app", label: "Page name", value: "{{page.name}}", icon: "FileText" });
  out.push({ group: "Page & app", label: "App name", value: "{{app.name}}", icon: "Sparkles" });
  out.push({ group: "Date & time", label: "Today's date", value: "{{now.date}}", icon: "Calendar" });
  out.push({ group: "Date & time", label: "Today (YYYY-MM-DD)", value: "{{now.today}}", icon: "Calendar" });
  out.push({ group: "Date & time", label: "Current time", value: "{{now.time}}", icon: "Clock" });
  out.push({ group: "Date & time", label: "This year", value: "{{now.year}}", icon: "CalendarDays" });
  if (opts.forActions) out.unshift({ group: "Previous step", label: "Result of the previous action (e.g. new record id)", value: "{{result}}", icon: "CornerDownRight" });
  return out;
}

export function BindingMenu({ elementId, onInsert, forActions, anchor, onClose }: { elementId: string | null; onInsert: (v: string) => void; forActions?: boolean; anchor: HTMLElement | null; onClose: () => void }) {
  const options = anchor ? bindingOptions(elementId, { forActions }) : [];
  const groups = Array.from(new Set(options.map((o) => o.group)));
  return (
    <Popover anchor={anchor} open={!!anchor} onClose={onClose} placement="left-start">
      <div className="bind-pop">
        {groups.map((g) => (
          <div key={g}>
            <div className="menu-label">{g}</div>
            {options
              .filter((o) => o.group === g)
              .map((o) => (
                <button
                  key={o.value + o.label}
                  className="bind-item"
                  onClick={() => {
                    onInsert(o.value);
                    onClose();
                  }}
                >
                  <Icon name={o.icon} size={14} />
                  <span>{o.label}</span>
                  <code>{o.value.length > 22 ? o.value.slice(0, 21) + "…" : o.value}</code>
                </button>
              ))}
          </div>
        ))}
      </div>
    </Popover>
  );
}

/** A text box with an "Insert data" button that drops a {{binding}} at the cursor. */
export function BindingField({
  value,
  onCommit,
  elementId,
  multiline,
  placeholder,
  rows,
  forActions,
}: {
  value: string;
  onCommit: (v: string) => void;
  elementId: string | null;
  multiline?: boolean;
  placeholder?: string;
  rows?: number;
  forActions?: boolean;
}) {
  const [text, setText] = useState(value);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const focused = useRef(false);
  const caret = useRef<number | null>(null);
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);
  // re-read the page when the editor changes, so the options are fresh
  useEditor((s) => s.pageId);

  const insert = (b: string) => {
    const at = caret.current ?? text.length;
    const next = text.slice(0, at) + b + text.slice(at);
    setText(next);
    onCommit(next);
    caret.current = at + b.length;
  };
  const common = {
    ref,
    className: "txt-field",
    value: text,
    placeholder,
    onFocus: () => {
      focused.current = true;
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement & HTMLTextAreaElement>) => {
      focused.current = false;
      caret.current = e.target.selectionStart;
      if (text !== value) onCommit(text);
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setText(e.target.value),
    onSelect: (e: React.SyntheticEvent<HTMLInputElement & HTMLTextAreaElement>) => {
      caret.current = (e.target as HTMLInputElement).selectionStart;
    },
  };
  return (
    <div className="bind-field">
      {multiline ? <textarea {...common} rows={rows ?? 3} /> : <input {...common} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />}
      <button className="icon-btn sm bind-btn" title="Insert data" aria-label="Insert data" onMouseDown={(e) => e.preventDefault()} onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}>
        <Braces size={14} />
      </button>
      <BindingMenu elementId={elementId} forActions={forActions} anchor={anchor} onClose={() => setAnchor(null)} onInsert={insert} />
    </div>
  );
}
