import { TEMPLATES, type AppTemplate } from "@/lib/templates";
import { previewOf } from "./apps";
import type { PreviewData } from "@/components/workspace/MiniPreview";
import type { SchemaCollection } from "@/components/runtime/store";
import type { AppKind, RuntimeRecord } from "@/lib/shared/types";

export interface TemplateCard {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  emoji: string;
  color: string;
  features: string[];
  kind: AppKind;
  collections: string[];
  pages: string[];
  preview: PreviewData | null;
}

let cache: TemplateCard[] | null = null;

/** Fields and example rows of a template, keyed the way its unbuilt doc refers to them ("@col:key"). */
function templateData(t: AppTemplate): { schema: SchemaCollection[]; samples: Record<string, RuntimeRecord[]> } {
  const schema: SchemaCollection[] = t.collections.map((c) => ({
    id: `@col:${c.key}`,
    name: c.name,
    fields: c.fields.map((f) => ({ id: f.name, name: f.name, type: f.type, required: !!f.required, options: f.options, currency: f.currency, refCollectionId: f.refCollectionId, min: f.min, max: f.max })),
  }));
  const now = Date.now();
  const rows = new Map<string, RuntimeRecord>();
  const samples: Record<string, RuntimeRecord[]> = {};
  for (const c of t.collections) {
    const seed = c.seed || [];
    samples[`@col:${c.key}`] = seed.map((data, i) => {
      const stamp = new Date(now - (seed.length - i) * 3_600_000).toISOString();
      const rec: RuntimeRecord = { id: `@seed:${c.key}:${i}`, createdAt: stamp, updatedAt: stamp, createdBy: null, ...data };
      rows.set(rec.id, rec);
      return rec;
    });
  }
  // references read like the real thing: { id, _label, ...fields }
  for (const c of t.collections) {
    for (const f of c.fields) {
      if (f.type !== "reference" || !f.refCollectionId) continue;
      const target = t.collections.find((x) => `@col:${x.key}` === f.refCollectionId);
      const labelField = target?.fields.find((tf) => tf.type === "text")?.name;
      for (const r of samples[`@col:${c.key}`]) {
        const ref = rows.get(String(r[f.name] ?? ""));
        if (ref) r[f.name] = { ...ref, _label: labelField ? ref[labelField] : ref.id };
      }
    }
  }
  return { schema, samples };
}

/** Template metadata plus a thumbnail of each template's home page (built once). */
export function templateCards(): TemplateCard[] {
  if (cache) return cache;
  cache = TEMPLATES.map((t) => {
    const doc = t.build();
    const preview = previewOf(doc);
    return {
      id: t.id,
      name: t.name,
      tagline: t.tagline,
      description: t.description,
      category: t.category,
      emoji: t.emoji,
      color: t.color,
      features: t.features,
      kind: t.kind || "website",
      collections: t.collections.map((c) => c.name),
      pages: doc.pages.map((p) => p.name),
      preview: preview ? { ...preview, ...templateData(t) } : null,
    };
  });
  return cache;
}
