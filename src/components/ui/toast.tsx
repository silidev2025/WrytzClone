"use client";

import { useEffect, useState } from "react";
import { CircleCheck, CircleAlert, Info } from "lucide-react";

export type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
  duration: number;
}

type Listener = (items: ToastItem[]) => void;
let items: ToastItem[] = [];
const listeners = new Set<Listener>();
let nextId = 1;

function emit() {
  for (const l of listeners) l(items);
}

export function toast(message: string, opts: { tone?: ToastTone; action?: ToastItem["action"]; duration?: number } = {}) {
  const item: ToastItem = { id: nextId++, message, tone: opts.tone || "info", action: opts.action, duration: opts.duration ?? (opts.action ? 6000 : 3200) };
  items = [...items.slice(-3), item];
  emit();
  setTimeout(() => dismiss(item.id), item.duration);
  return item.id;
}

toast.success = (message: string, opts: { action?: ToastItem["action"]; duration?: number } = {}) => toast(message, { ...opts, tone: "success" });
toast.error = (message: string, opts: { action?: ToastItem["action"]; duration?: number } = {}) => toast(message, { ...opts, tone: "error" });

export function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  if (!list.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span className="toast-icon">
            {t.tone === "success" ? <CircleCheck size={17} /> : t.tone === "error" ? <CircleAlert size={17} /> : <Info size={17} />}
          </span>
          <span>{t.message}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
