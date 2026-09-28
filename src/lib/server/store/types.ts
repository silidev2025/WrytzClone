export type Table =
  | "users"
  | "sessions"
  | "apps"
  | "drafts"
  | "published"
  | "versions"
  | "collections"
  | "records"
  | "media"
  /** who is an admin of which app (by account id) */
  | "memberships"
  /** single-use links that make someone an app admin */
  | "invites"
  /** which apps a person agreed to share their name and email with */
  | "consents"
  /** password-reset links */
  | "tokens"
  /** security-relevant events */
  | "audit"
  /** reports of abusive or illegal apps */
  | "reports"
  | "mobileDeployments"
  | "mobileWorkers"
  /** live-collaboration events too big for a Postgres notification (kept for an hour) */
  | "live"
  | "rateLimits"
  | "idempotency"
  | "blobDeletes"
  | "jobs";

export interface Doc {
  id: string;
}

/**
 * Secondary indexes per table. Each index maps a document to a lookup key; the JSON store
 * scans with these functions, Postgres stores them in indexed columns (k1, k2, k3 in order).
 */
export const INDEXES: Record<Table, Record<string, (doc: any) => string | null | undefined>> = {
  users: { email: (d) => d.email?.toLowerCase() },
  sessions: { userId: (d) => d.userId },
  apps: {
    ownerId: (d) => d.ownerId,
    slug: (d) => d.published?.slug?.toLowerCase() ?? null,
    explore: (d) => (d.published?.explore ? "1" : null),
  },
  drafts: {},
  published: {},
  versions: { appId: (d) => d.appId },
  collections: { appId: (d) => d.appId },
  records: { collectionId: (d) => d.collectionId, appId: (d) => d.appId, createdBy: (d) => d.createdBy },
  media: { ownerId: (d) => d.ownerId, appId: (d) => d.appId, recordId: (d) => d.recordId ?? null },
  memberships: { appId: (d) => d.appId, userId: (d) => d.userId },
  invites: { appId: (d) => d.appId },
  consents: { userId: (d) => d.userId, appId: (d) => d.appId },
  tokens: { userId: (d) => d.userId },
  audit: { appId: (d) => d.appId ?? null, userId: (d) => d.userId ?? null },
  reports: { appId: (d) => d.appId ?? null, status: (d) => d.status },
  mobileDeployments: { appId: (d) => d.appId, status: (d) => d.status },
  mobileWorkers: {},
  live: { appId: (d) => d.appId },
  rateLimits: {},
  idempotency: {},
  blobDeletes: {},
  jobs: { kind: (d) => d.kind },
};

/** Values that must be unique across a table (enforced by the database with Postgres). */
export const UNIQUE: Partial<Record<Table, string[]>> = {
  users: ["email"],
  apps: ["slug"],
};

export interface StoreOps {
  recordPage?(options: { collectionId: string; ownerId?: string; ids?: string[]; offset: number; limit: number; ascending: boolean }): Promise<{ records: import("@/lib/shared/types").RecordDoc[]; total: number }>;
  get<T extends Doc>(table: Table, id: string): Promise<T | null>;
  put<T extends Doc>(table: Table, doc: T): Promise<void>;
  delete(table: Table, id: string): Promise<void>;
  /** Documents whose index `index` equals `value`. */
  find<T extends Doc>(table: Table, index: string, value: string): Promise<T[]>;
  count(table: Table, index: string, value: string): Promise<number>;
  /** Stable ID pagination; suitable for exports and bounded maintenance work. */
  page<T extends Doc>(table: Table, options?: { index?: string; value?: string; after?: string; limit?: number }): Promise<T[]>;
  /** Delete every document whose index equals value; returns how many. */
  deleteWhere(table: Table, index: string, value: string): Promise<number>;
  /**
   * Reserve a value in a uniqueness scope for a document (Postgres: backed by a unique key,
   * so racing requests can't both succeed). Stores that serialize writes can skip this.
   */
  claimUnique?(scope: string, value: string, docId: string): Promise<void>;
  /** Free a document's reservation in a scope (all scopes when scope is ""). */
  releaseUnique?(scope: string, docId: string): Promise<void>;
  releaseUniqueScope?(scope: string): Promise<void>;
}

export interface Store extends StoreOps {
  kind: "json" | "postgres";
  /** Atomic, serializable writes. PostgreSQL may retry fn: keep external effects outside it. */
  transaction<R>(fn: (tx: StoreOps) => Promise<R>): Promise<R>;
  consumeRateLimit(key: string, limit: number, windowMs: number): Promise<boolean>;
  putBlob(id: string, data: Buffer): Promise<void>;
  getBlob(id: string, range?: { start: number; end: number }): Promise<Buffer | null>;
  deleteBlob(id: string): Promise<void>;
  /** Every document of a table (maintenance jobs only). */
  scan<T extends Doc>(table: Table): Promise<T[]>;
  /** Postgres only: tell every server something happened (LISTEN/NOTIFY). */
  notify?(channel: string, payload: string): Promise<void>;
  listen?(channel: string, onMessage: (payload: string) => void, onReconnect?: () => void): Promise<void>;
}
