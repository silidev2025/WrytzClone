"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { beginGesture, endGesture } from "../store";

export function Section({ title, children, defaultOpen = true, right }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; right?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="insp-section">
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button className="sec-title" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span>{title}</span>
          <ChevronDown size={14} className="chev" />
        </button>
        {right}
      </div>
      {open && children}
    </section>
  );
}

export function Row({ label, children, title }: { label: ReactNode; children: ReactNode; title?: string }) {
  return (
    <div className="insp-row" title={title}>
      <label>{label}</label>
      <div className="grow">{children}</div>
    </div>
  );
}

/**
 * Number input. Drag the little label left/right to scrub the value (like Figma);
 * arrow keys step by 1 (Shift: 10).
 */
export function NumberField({
  value,
  onChange,
  label,
  unit,
  min,
  max,
  step = 1,
  placeholder,
  title,
  disabled,
}: {
  value: number | undefined | null;
  onChange: (v: number) => void;
  label?: ReactNode;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value === undefined || value === null ? "" : String(round(value)));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value === undefined || value === null ? "" : String(round(value)));
  }, [value]);
  const clamp = (n: number) => Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n));
  const commit = (raw: string) => {
    const expr = raw.trim();
    if (!expr) return;
    // simple maths like "120+20" or "300/2" is allowed
    let n = Number(expr);
    if (!Number.isFinite(n)) n = calc(expr);
    if (Number.isFinite(n)) onChange(clamp(n));
    else setText(value === undefined || value === null ? "" : String(round(value)));
  };
  const scrub = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    const startX = e.clientX;
    const start = value ?? 0;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    beginGesture();
    const move = (ev: PointerEvent) => {
      const delta = Math.round((ev.clientX - startX) / (ev.shiftKey ? 1 : 2)) * step * (ev.shiftKey ? 10 : 1);
      onChange(clamp(round(start + delta)));
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      endGesture();
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  };
  return (
    <div className={`num-field ${value === null ? "mixed" : ""}`} title={title}>
      {label !== undefined && (
        <span className="scrub" onPointerDown={scrub}>
          {label}
        </span>
      )}
      <input
        inputMode="decimal"
        value={text}
        disabled={disabled}
        placeholder={value === null ? "Mixed" : placeholder}
        style={label === undefined ? { paddingLeft: 8 } : undefined}
        onFocus={(e) => {
          focused.current = true;
          e.target.select();
        }}
        onBlur={(e) => {
          focused.current = false;
          commit(e.target.value);
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const n = clamp(round((value ?? 0) + (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1)));
            onChange(n);
            setText(String(n));
          } else if (e.key === "Escape") {
            setText(value === undefined || value === null ? "" : String(round(value)));
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {unit && <span className="unit">{unit}</span>}
    </div>
  );
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/** Tiny arithmetic parser: numbers, + - * / and parentheses. Returns NaN for anything else. */
export function calc(src: string): number {
  const s = src.replace(/\s+/g, "");
  let i = 0;
  const num = (): number => {
    if (s[i] === "(") {
      i++;
      const v = expr();
      if (s[i] !== ")") return NaN;
      i++;
      return v;
    }
    if (s[i] === "-") {
      i++;
      return -num();
    }
    const m = s.slice(i).match(/^\d*\.?\d+/);
    if (!m) return NaN;
    i += m[0].length;
    return Number(m[0]);
  };
  const term = (): number => {
    let v = num();
    while (s[i] === "*" || s[i] === "/") {
      const op = s[i++];
      const r = num();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (s[i] === "+" || s[i] === "-") {
      const op = s[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  const v = expr();
  return i === s.length ? v : NaN;
}

export function TextField({
  value,
  onChange,
  placeholder,
  multiline,
  rows,
  onCommit,
  autoFocus,
  maxLength,
}: {
  value: string;
  onChange?: (v: string) => void;
  onCommit?: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  autoFocus?: boolean;
  maxLength?: number;
}) {
  const [text, setText] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);
  const props = {
    className: "txt-field",
    value: text,
    placeholder,
    autoFocus,
    maxLength,
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
      if (onCommit && text !== value) onCommit(text);
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setText(e.target.value);
      onChange?.(e.target.value);
    },
  };
  if (multiline) return <textarea {...props} rows={rows ?? 3} />;
  return (
    <input
      {...props}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function Select<T extends string>({ value, onChange, options }: { value: T | undefined; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select className="txt-field" value={value ?? ""} onChange={(e) => onChange(e.target.value as T)}>
      {value === undefined && <option value="">Choose…</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Seg<T extends string>({ value, onChange, options }: { value: T | undefined; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[] }) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button key={o.value} aria-pressed={value === o.value} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <div className="insp-row" style={{ alignItems: hint ? "flex-start" : "center" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 550 }}>{label}</div>
        {hint && <div className="mini-note">{hint}</div>}
      </div>
      <button type="button" className="switch sm" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} />
    </div>
  );
}

export function Slider({ value, onChange, min, max, step = 1, unit }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string }) {
  return (
    <div className="slider-row">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={() => {
          // one undo step for the whole drag, however it ends
          beginGesture();
          window.addEventListener("pointerup", () => endGesture(), { once: true });
        }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <NumberField value={value} onChange={onChange} min={min} max={max} step={step} unit={unit} />
    </div>
  );
}
