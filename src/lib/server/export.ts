import type { AppMeta, Collection, MediaItem, RecordDoc, User } from "@/lib/shared/types";
import type { AuditEvent } from "./audit";
import type { Doc, StoreOps, Table } from "./store/types";
import { getStore } from "./store";
import { publicUser } from "./auth";
import { listConsents } from "./consent";
import { makerRecord, recordForViewer } from "./data";
import { viewerFor } from "./apps";

async function* rows<T extends Doc>(store: StoreOps, table: Table, index: string, value: string): AsyncGenerator<T> {
  let after = "";
  for (;;) {
    const batch = await store.page<T>(table, { index, value, after, limit: 250 });
    if (!batch.length) return;
    for (const row of batch) yield row;
    after = batch[batch.length - 1].id;
  }
}

/** Stream every page without silent row/event caps or a whole-export memory allocation. */
export async function* exportMyData(user: User): AsyncGenerator<string> {
  const store = await getStore();
  const counts = { apps: 0, appRecords: 0, versions: 0, uploads: 0, recordsYouAddedInApps: 0, securityLog: 0 };
  const header = { formatVersion: 2, exportedAt: new Date().toISOString(), consistency: "Live export; concurrent edits may appear. Files are listed with authenticated download URLs, not embedded bytes. Contributions to other apps contain only data you may currently read; passwords and active login tokens are excluded.", account: { ...publicUser(user), createdAt: user.createdAt, termsVersion: user.termsVersion, termsAcceptedAt: user.termsAcceptedAt }, sharedWithApps: await listConsents(user) };
  yield JSON.stringify(header).slice(0, -1) + ',"apps":[';
  let first = true;
  for await (const app of rows<AppMeta>(store, "apps", "ownerId", user.id)) {
    counts.apps++;
    if (!first) yield ","; first = false;
    const design = { id: app.id, name: app.name, description: app.description, createdAt: app.createdAt, published: app.published, draft: await store.get("drafts", app.id), publishedDesign: await store.get("published", app.id), collections: await store.find("collections", "appId", app.id) };
    yield JSON.stringify(design).slice(0, -1) + ',"records":[';
    let firstRecord = true;
    for await (const record of rows<RecordDoc>(store, "records", "appId", app.id)) {
      counts.appRecords++;
      if (!firstRecord) yield ","; firstRecord = false;
      yield JSON.stringify(makerRecord(app.id, record));
    }
    yield '],"versions":[';
    let firstVersion = true;
    for await (const version of rows(store, "versions", "appId", app.id)) {
      counts.versions++;
      if (!firstVersion) yield ","; firstVersion = false; yield JSON.stringify(version);
    }
    yield "]}";
  }
  yield '],"uploads":['; first = true;
  for await (const file of rows<MediaItem>(store, "media", "ownerId", user.id)) {
    counts.uploads++;
    if (!first) yield ","; first = false;
    yield JSON.stringify({ id: file.id, name: file.name, type: file.mime, size: file.size, uploadedAt: file.createdAt, url: `/api/media/${file.id}`, appId: file.appId });
  }
  yield '],"recordsYouAddedInApps":['; first = true;
  for await (const record of rows<RecordDoc>(store, "records", "createdBy", user.id)) {
    const col = await store.get<Collection>("collections", record.collectionId);
    const app = await store.get<AppMeta>("apps", record.appId);
    if (!col || !app) continue;
    const visible = await recordForViewer(col, record, { ...viewerFor(app, user), appId: app.id });
    counts.recordsYouAddedInApps++;
    if (!first) yield ","; first = false;
    yield JSON.stringify({ app: app.name, collection: col.name, ...visible, metadata: { habitTimeZone: (record as RecordDoc & { habitTimeZone?: string }).habitTimeZone } });
  }
  yield '],"securityLog":['; first = true;
  for await (const event of rows<AuditEvent>(store, "audit", "userId", user.id)) {
    counts.securityLog++;
    if (!first) yield ","; first = false;
    yield JSON.stringify({ at: event.at, action: event.action, appId: event.appId, detail: event.detail });
  }
  yield `],"complete":true,"counts":${JSON.stringify(counts)}}`;
}
