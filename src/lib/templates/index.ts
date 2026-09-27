import type { AppDoc, AppKind, CollectionAccess, Field, StockRule } from "@/lib/shared/types";

export interface TemplateCollection {
  /** local key; the app doc refers to the collection as "@col:<key>" */
  key: string;
  name: string;
  icon?: string;
  fields: Omit<Field, "id">[];
  access: CollectionAccess;
  /** server-side stock keeping for order-like collections */
  stock?: StockRule;
  /** sample rows keyed by field name; "@seed:<key>:<index>" links to another sample row */
  seed?: Record<string, unknown>[];
}

export interface AppTemplate {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  emoji: string;
  color: string;
  features: string[];
  /** "mobile" templates are phone apps; default "website" */
  kind?: AppKind;
  collections: TemplateCollection[];
  build: () => AppDoc;
}

import { rsvp, survey, waitlist } from "./marketing";
import { feedback, resources } from "./community";
import { blog, portfolio } from "./showcase";
import { onlineStore, restaurant } from "./commerce";
import { tasks } from "./productivity";
import { coffee, habits } from "./mobile";
import { repairTemplateDoc } from "@/lib/shared/templateRepairs";

/** Shown in this order: websites first, then phone apps. */
export const TEMPLATES: AppTemplate[] = [waitlist, onlineStore, portfolio, feedback, survey, restaurant, blog, rsvp, tasks, resources, habits, coffee]
  .map((template) => ({ ...template, build: () => repairTemplateDoc(template.build(), template.id) }));

export function getTemplate(id: string): AppTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
