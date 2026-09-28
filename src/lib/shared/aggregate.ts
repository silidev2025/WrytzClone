import type { FieldType } from "./types";
import { isEmptyValue } from "./fields";

/** Identical numeric semantics in thumbnails and the authorized server query. */
export function numericAggregate(values: unknown[], operation: string, count = values.length): number {
  if (operation === "count") return count;
  const numbers = values.filter((v) => v !== null && v !== undefined && v !== "").map(Number).filter(Number.isFinite);
  if (!numbers.length) return 0;
  switch (operation) {
    case "sum": return numbers.reduce((a, b) => a + b, 0);
    case "avg": return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    case "min": return numbers.reduce((a, b) => Math.min(a, b), Infinity);
    case "max": return numbers.reduce((a, b) => Math.max(a, b), -Infinity);
    default: return count;
  }
}

export function compareForSort(a: unknown, b: unknown, type?: FieldType): number {
  const ea = isEmptyValue(a), eb = isEmptyValue(b);
  if (ea && eb) return 0;
  if (ea) return 1;
  if (eb) return -1;
  if (type === "number" || type === "currency" || type === "rating") return Number(a) - Number(b);
  if (type === "boolean") return Number(!!a) - Number(!!b);
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(Array.isArray(a) ? a.join(",") : a).localeCompare(String(Array.isArray(b) ? b.join(",") : b), undefined, { numeric: true, sensitivity: "base" });
}

export function isDateGroup(name: string, type?: FieldType): boolean {
  return type === "date" || type === "datetime" || /^(createdAt|updatedAt)$/i.test(name);
}

export function orderGroups(groups: { label: string; value: number }[], name: string, field?: { type: FieldType; options?: string[] }) {
  const order = field?.options;
  if (order?.length) groups.sort((a, b) => (order.indexOf(a.label) + 1 || 999) - (order.indexOf(b.label) + 1 || 999));
  else if (isDateGroup(name, field?.type)) groups.sort((a, b) => a.label.localeCompare(b.label));
  else groups.sort((a, b) => b.value - a.value);
  return groups.slice(0, 24);
}
