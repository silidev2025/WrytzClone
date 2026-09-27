const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Short random id, safe in URLs and as object keys. */
export function uid(prefix = "", length = 10): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return prefix ? `${prefix}_${out}` : out;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Calendar date at the caller's local timezone, without converting it to UTC. */
export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function pluralize(n: number, word: string, plural = `${word}s`): string {
  return `${n} ${n === 1 ? word : plural}`;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.round((now - new Date(iso).getTime()) / 1000);
  if (diff < 45) return "just now";
  if (diff < 90) return "a minute ago";
  const mins = Math.round(diff / 60);
  if (mins < 45) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return days === 1 ? "yesterday" : `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Unique "Name", "Name 2", "Name 3" ... among existing names (case-insensitive). */
export function uniqueName(base: string, existing: Iterable<string>): string {
  const taken = new Set(Array.from(existing, (n) => n.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  const stem = base.replace(/\s+\d+$/, "") || base;
  for (let i = 2; i < 10000; i++) {
    const name = `${stem} ${i}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
  return `${base} ${uid("", 4)}`;
}

/** Layer names for new elements: Button1, Button2 ... (bindings friendly, no spaces). */
export function nextLayerName(base: string, existing: Iterable<string>): string {
  const taken = new Set(Array.from(existing, (n) => n.toLowerCase()));
  const stem = base.replace(/[^A-Za-z0-9_]/g, "") || "Layer";
  for (let i = 1; i < 100000; i++) {
    const name = `${stem}${i}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
  return `${stem}_${uid("", 4)}`;
}

export function safeUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^(https?:|mailto:|tel:|sms:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

/** Only allow image sources we can safely render. */
export function safeImageSrc(src: string | undefined | null): string | null {
  if (!src) return null;
  const s = src.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/api/media/")) return s;
  if (/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);/i.test(s)) return s;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  return null;
}

export function formatNumber(n: number, decimals?: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? (Number.isInteger(n) ? 0 : 2),
  });
}

export function formatCurrency(n: number, currency = "USD"): string {
  if (!Number.isFinite(n)) n = 0;
  try {
    return n.toLocaleString(undefined, { style: "currency", currency });
  } catch {
    return `${currency} ${formatNumber(n, 2)}`;
  }
}

export function formatDate(value: unknown, withTime = false): string {
  if (value === null || value === undefined || value === "") return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  // Date-only values ("2026-05-01") are parsed as UTC; show them as that calendar day.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    ...(dateOnly ? { timeZone: "UTC" } : {}),
  });
}

export function formatTime(value: unknown): string {
  if (!value) return "";
  const m = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(value);
  const h = Number(m[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${m[2]} ${suffix}`;
}

export function csvEscape(value: unknown): string {
  let s = value === null || value === undefined ? "" : Array.isArray(value) ? value.join(", ") : String(value);
  // Text starting with = + - @ (or a tab/CR) would run as a formula in Excel or Sheets.
  // Prefix it with ' so it stays text. Plain numbers (like -5 or +3.2) are left alone.
  if (typeof value !== "number" && /^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Minimal RFC4180 CSV parser (handles quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}
