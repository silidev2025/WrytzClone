"use client";

import { useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type { El } from "@/lib/shared/types";
import { hasBindings } from "@/lib/shared/expressions";
import { fillToCss, fontStack, resolveColor, withAlpha } from "@/lib/shared/theme";
import { defaultRadius } from "@/lib/shared/elements";
import { errorMessage } from "@/lib/client/api";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/toast";
import { isStatic, useRT, useRTStore } from "../store";
import { FormContext, RecordContext, inputValue } from "../context";
import { currentPage } from "../store";
import { useActions, useBindingContext, useRuntimeApi } from "../hooks";
import { useCached } from "../api";
import { effectiveFontSize, radiusCss } from "../styles";

const TEXT_TYPES: Record<string, string> = {
  text: "text",
  email: "email",
  number: "number",
  phone: "tel",
  password: "password",
  url: "url",
  date: "date",
  time: "time",
  datetime: "datetime-local",
  color: "color",
};
const DEBOUNCED = new Set(["text", "email", "number", "phone", "password", "url", "textarea"]);

function useOptions(el: El): string[] {
  const from = el.props.optionsFrom;
  const api = useRuntimeApi();
  const version = useRT((s) => s.dataVersion);
  const thumb = useRT((s) => s.mode === "thumb");
  const key = from?.collectionId && from.field && !thumb ? `opts:${from.collectionId}:${from.field}:${version}` : null;
  const { data } = useCached(key, () => api.query({ collectionId: from!.collectionId, pageSize: 200, sortField: from!.field, sortDir: "asc" }));
  return useMemo(() => {
    if (!from?.collectionId) return el.props.options || [];
    const vals = (data?.records || [])
      .map((r) => {
        const v = r[from.field];
        if (v && typeof v === "object" && "_label" in (v as object)) return String((v as { _label: unknown })._label);
        return Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : String(v);
      })
      .filter(Boolean);
    return Array.from(new Set(vals));
  }, [from, data, el.props.options]);
}

export function InputContent({ el }: { el: El }) {
  const store = useRTStore();
  const theme = useRT((s) => s.doc.theme);
  const bp = useRT((s) => s.bp);
  const mode = useRT((s) => s.mode);
  const appId = useRT((s) => s.appId);
  const scope = useContext(RecordContext);
  const hasStored = useRT((s) => el.id in s.inputs);
  useRT((s) => s.inputs[el.id]);
  const error = useRT((s) => s.inputErrors[el.id]);
  useBindingContext(!hasStored && hasBindings(el.props.defaultValue));
  const value = inputValue(store.getState(), el, scope);
  const { run } = useActions();
  const api = useRuntimeApi();
  const options = useOptions(el);
  const uid = useId();
  const editor = isStatic(mode);
  const t = el.props.inputType || "text";
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const formId = useContext(FormContext);
  // the collection a file is for: the form's own, or the one its submit actions save to
  const fileTarget = useRT((s) => {
    if (el.props.inputType !== "file") return null;
    const form = formId ? currentPage(s)?.elements[formId] : null;
    if (form?.props.collectionId) return form.props.collectionId;
    const act = form?.events?.submit?.find((a) => (a.type === "createRecord" || a.type === "updateRecord") && a.collectionId);
    return act?.collectionId ?? null;
  });

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  void appId;

  const setValue = (v: unknown) => {
    if (editor) return;
    store.setState((st) => {
      const inputErrors = { ...st.inputErrors };
      delete inputErrors[el.id];
      return { inputs: { ...st.inputs, [el.id]: v }, inputErrors };
    });
    const actions = el.events?.change;
    if (!actions?.length) return;
    if (timer.current) clearTimeout(timer.current);
    if (DEBOUNCED.has(t)) timer.current = setTimeout(() => void run(actions, el.id), 450);
    else void run(actions, el.id);
  };

  /* ------------------------------------------------ look */
  const fs = effectiveFontSize(el, bp);
  const s = el.style;
  const textColor = resolveColor(s.color ?? "$text", theme);
  const muted = theme.colors.muted;
  const accent = theme.colors.primary;
  const danger = "#d23a57";
  const borderColor = error ? danger : focused ? accent : resolveColor(s.borderColor ?? "$border", theme);
  const radius = radiusCss(el, theme) ?? `${defaultRadius(el, theme)}px`;
  const font = fontStack(s.fontFamily ?? "$body", theme);
  const styleKind = el.props.inputStyle || "box";
  const controlH = Math.max(34, Math.round(fs * 2.75));
  const bg = fillToCss(s.fill, theme);

  const control: CSSProperties = {
    width: "100%",
    minHeight: controlH,
    padding: styleKind === "line" || styleKind === "none" ? `0 2px` : `0 ${Math.round(fs * 0.8)}px`,
    fontSize: fs,
    fontFamily: font,
    color: textColor,
    outline: "none",
    borderRadius: styleKind === "line" || styleKind === "none" ? 0 : radius,
    transition: "border-color .15s, box-shadow .15s",
  };
  if (styleKind === "box") {
    control.background = bg ?? theme.colors.background;
    control.border = `${s.borderWidth ?? 1.5}px solid ${borderColor}`;
    if (focused && !error) control.boxShadow = `0 0 0 3px ${withAlpha(accent, 0.18)}`;
  } else if (styleKind === "filled") {
    control.background = bg ?? theme.colors.surface;
    control.border = "none";
    control.borderBottom = `2px solid ${error || focused ? borderColor : "transparent"}`;
  } else if (styleKind === "line") {
    control.background = "transparent";
    control.border = "none";
    control.borderBottom = `1.5px solid ${borderColor}`;
  } else {
    control.background = "transparent";
    control.border = "none";
  }

  const labelText = el.props.label || "";
  const showLabel = el.props.showLabel !== false && !!labelText && t !== "toggle";
  const labelEl = showLabel ? (
    <label htmlFor={uid} className="rt-input-label" style={{ fontSize: Math.max(12, Math.round(fs * 0.86)), color: textColor, fontFamily: font }}>
      {labelText}
      {el.props.required && <span style={{ color: danger }}> *</span>}
    </label>
  ) : null;
  const help = el.props.helpText && !error ? (
    <div id={`${uid}-help`} className="rt-input-help" style={{ color: muted, fontSize: Math.max(11, Math.round(fs * 0.8)) }}>
      {el.props.helpText}
    </div>
  ) : null;
  const errorEl = error ? (
    <div id={`${uid}-error`} className="rt-input-error" role="alert" style={{ fontSize: Math.max(11, Math.round(fs * 0.8)) }}>
      {error}
    </div>
  ) : null;

  const common = {
    id: uid,
    "aria-invalid": !!error || undefined,
    "aria-describedby": error ? `${uid}-error` : el.props.helpText ? `${uid}-help` : undefined,
    "aria-label": showLabel ? undefined : labelText || el.name,
    tabIndex: editor ? -1 : undefined,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };

  let body: React.ReactNode;
  const str = value === null || value === undefined ? "" : String(value);

  switch (t) {
    case "textarea":
      body = (
        <textarea
          {...common}
          className="rt-control"
          style={{ ...control, padding: `${Math.round(fs * 0.6)}px ${styleKind === "line" || styleKind === "none" ? 2 : Math.round(fs * 0.8)}px`, flex: 1, minHeight: Math.max(controlH * 2, 80), resize: "none", lineHeight: 1.5 }}
          placeholder={el.props.placeholder}
          value={str}
          readOnly={editor}
          onChange={(e) => setValue(e.target.value)}
        />
      );
      break;
    case "select":
      body = (
        <div style={{ position: "relative" }}>
          <select
            {...common}
            className="rt-control rt-select"
            style={{ ...control, appearance: "none", paddingRight: 36, cursor: editor ? undefined : "pointer", color: str ? textColor : muted }}
            value={str}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">{el.props.placeholder || "Select…"}</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <Icon name="ChevronDown" size={16} color={muted} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        </div>
      );
      break;
    case "radio":
    case "checkbox": {
      const multi = t === "checkbox";
      const selected: string[] = multi ? (Array.isArray(value) ? value.map(String) : str ? str.split(",").map((x) => x.trim()) : []) : [str];
      body = (
        <div className="rt-choices" role={multi ? "group" : "radiogroup"} aria-label={labelText || el.name}>
          {(options.length ? options : ["Option 1", "Option 2"]).map((o) => {
            const on = selected.includes(o);
            return (
              <label key={o} className="rt-choice" style={{ fontSize: fs, color: textColor, fontFamily: font, cursor: editor ? undefined : "pointer" }}>
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={uid}
                  checked={on}
                  tabIndex={editor ? -1 : undefined}
                  onChange={() => {
                    if (multi) setValue(on ? selected.filter((x) => x !== o) : [...selected, o]);
                    else setValue(o);
                  }}
                />
                <span
                  className={multi ? "rt-check" : "rt-radio"}
                  style={{ borderColor: on ? accent : resolveColor("$border", theme), background: on ? accent : theme.colors.background, borderRadius: multi ? 5 : "50%" }}
                >
                  {on && (multi ? <Icon name="Check" size={12} color="#fff" strokeWidth={3} /> : <span className="rt-radio-dot" />)}
                </span>
                <span>{o}</span>
              </label>
            );
          })}
        </div>
      );
      break;
    }
    case "toggle": {
      const on = value === true || value === "true";
      body = (
        <button
          type="button"
          role="switch"
          aria-checked={on}
          tabIndex={editor ? -1 : undefined}
          className="rt-toggle-row"
          onClick={() => setValue(!on)}
          style={{ fontSize: fs, color: textColor, fontFamily: font }}
        >
          <span className="rt-toggle" style={{ background: on ? accent : resolveColor("$border", theme) }}>
            <span style={{ transform: on ? "translateX(18px)" : undefined }} />
          </span>
          {el.props.showLabel !== false && labelText && (
            <span>
              {labelText}
              {el.props.required && <span style={{ color: danger }}> *</span>}
            </span>
          )}
        </button>
      );
      break;
    }
    case "range": {
      const min = el.props.min ?? 0;
      const max = el.props.max ?? 100;
      const n = Number(str || min);
      body = (
        <div className="rt-range" style={{ color: textColor, fontSize: fs }}>
          <input
            {...common}
            type="range"
            min={min}
            max={max}
            step={el.props.step ?? 1}
            value={Number.isFinite(n) ? n : min}
            onChange={(e) => setValue(Number(e.target.value))}
            style={{ accentColor: accent, flex: 1 }}
          />
          <span className="rt-range-value" style={{ background: withAlpha(accent, 0.12), color: accent }}>
            {Number.isFinite(n) ? n : min}
          </span>
        </div>
      );
      break;
    }
    case "rating": {
      const n = Math.round(Number(str || 0));
      body = (
        <div className="rt-rating" role="radiogroup" aria-label={labelText || "Rating"}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={n === i}
              aria-label={`${i} star${i > 1 ? "s" : ""}`}
              tabIndex={editor ? -1 : undefined}
              onClick={() => setValue(n === i ? 0 : i)}
              style={{ color: i <= n ? theme.colors.accent : resolveColor("$border", theme) }}
            >
              <Icon name="Star" size={Math.round(fs * 1.7)} strokeWidth={1.5} style={{ fill: i <= n ? "currentColor" : "transparent" }} />
            </button>
          ))}
        </div>
      );
      break;
    }
    case "file": {
      const fileName = str ? uploadedName || (str.includes("/api/media/") ? "Attached file" : decodeURIComponent(str.split("/").pop() || "file")) : "";
      body = (
        <label className="rt-file" style={{ ...control, borderStyle: styleKind === "box" ? "dashed" : undefined, cursor: editor ? undefined : "pointer" }}>
          <input
            type="file"
            id={uid}
            aria-label={labelText || "Choose a file"}
            aria-invalid={!!error}
            aria-describedby={common["aria-describedby"]}
            className="rt-file-native"
            tabIndex={editor ? -1 : undefined}
            disabled={editor || uploading}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setUploading(true);
              try {
                const res = await api.upload(f, { collectionId: fileTarget || "", field: el.props.name || el.name });
                setValue(res.url);
                setUploadedName(res.name);
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setUploading(false);
              }
            }}
          />
          <Icon name={uploading ? "Loader" : str ? "Paperclip" : "Upload"} size={18} color={accent} />
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: str ? textColor : muted }}>
            {uploading ? "Uploading…" : str ? fileName : el.props.placeholder || "Choose a file to upload"}
          </span>
          {str && !editor && (
            <button
              type="button"
              className="rt-file-clear"
              onClick={(e) => {
                e.preventDefault();
                setValue("");
              }}
              aria-label="Remove file"
            >
              <Icon name="X" size={15} />
            </button>
          )}
        </label>
      );
      break;
    }
    default:
      body = (
        <input
          {...common}
          className="rt-control"
          type={TEXT_TYPES[t] || "text"}
          inputMode={t === "number" ? "decimal" : t === "phone" ? "tel" : undefined}
          autoComplete={t === "email" ? "email" : t === "password" ? "current-password" : t === "phone" ? "tel" : undefined}
          placeholder={el.props.placeholder}
          min={el.props.min}
          max={el.props.max}
          step={el.props.step}
          value={t === "color" ? str || "#6c47ff" : str}
          readOnly={editor}
          onChange={(e) => setValue(e.target.value)}
          style={t === "color" ? { ...control, padding: 4, cursor: "pointer" } : control}
        />
      );
  }

  return (
    <div className="rt-input" style={{ display: "flex", flexDirection: "column", gap: 6, height: "100%" }}>
      {labelEl}
      {body}
      {help}
      {errorEl}
    </div>
  );
}
