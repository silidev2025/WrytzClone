const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLoader } = require('./ts-loader.cjs');
process.env.DATABASE_URL = '';
delete process.env.VERCEL;
process.env.CRAFTBASE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'craftbase-security-'));
process.env.CRAFTBASE_SECRET = 'isolated-security-tests-secret-not-for-production';
process.env.CRAFTBASE_PUBLIC_URL = 'https://test.example';
const jar = { token: null, get() { return this.token ? { value: this.token } : undefined; }, set(_, token) { this.token = token; } };
const load = createLoader({ 'next/headers': { cookies: async () => jar, headers: async () => new Headers() } });
const tests = []; const test = (name, run) => tests.push({ name, run });
let store, owner, app, admin;
const data = load('src/lib/server/data.ts'), media = load('src/lib/server/media.ts'), apps = load('src/lib/server/apps.ts'), auth = load('src/lib/server/auth.ts');
const getMedia = (id) => load('src/app/api/media/[mediaId]/route.ts').GET(new Request(`https://test.example/api/media/${id}`), { params: Promise.resolve({ mediaId: id }) });
const allAccess = { read: 'anyone', create: 'anyone', update: 'anyone', delete: 'admins', adjust: 'admins' };
const collection = (name, fields, access = allAccess) => data.createCollection(app.id, { name, fields, access });

test('redirects reject raw control characters, backslashes and external origins', () => {
  const { safeNext } = load('src/lib/shared/urls.ts');
  for (const next of ['/\t/evil.example', '/\n/evil.example', '//evil.example', '/\\evil.example', 'https://evil.example']) assert.equal(safeNext(next), '/apps');
  assert.equal(safeNext('/apps?x=1'), '/apps?x=1');
});
test('malformed design types are rejected and legacy malformed thumbnails fail closed', () => {
  const { newAppDoc, sanitizeDoc } = load('src/lib/shared/doc.ts');
  const doc = newAppDoc(); doc.theme.colors.surface = { invalid: true };
  assert.throws(() => sanitizeDoc(doc), /Invalid design/); assert.equal(apps.previewOf(doc), null);
  const huge = newAppDoc(); huge.pages[0].height = Infinity; assert.throws(() => sanitizeDoc(huge), /number/);
});
test('number, date and time fields reject non-finite and impossible values', () => {
  const { coerceFieldValue } = load('src/lib/shared/fields.ts');
  const field = (type) => ({ id: 'f', name: 'Value', type });
  for (const value of [Infinity, -Infinity, 'Infinity', '1e400']) assert.equal(coerceFieldValue(field('number'), value).ok, false);
  for (const value of ['2026-02-30', '2026-13-01', '2026-02-28junk']) assert.equal(coerceFieldValue(field('date'), value).ok, false);
  for (const value of ['14:00 PM', '00:30 AM', '12:30:99']) assert.equal(coerceFieldValue(field('time'), value).ok, false);
  assert.equal(coerceFieldValue(field('date'), '2024-02-29').ok, true);
});
test('rate limits are atomic across concurrent callers and ignore spoofed Cloudflare IPs', async () => {
  const accepted = await Promise.all(Array.from({ length: 20 }, () => store.consumeRateLimit('shared-limit', 5, 60000)));
  assert.equal(accepted.filter(Boolean).length, 5);
  process.env.VERCEL = '1';
  try { assert.equal(load('src/lib/server/http.ts').clientIp(new Request('https://test.example', { headers: { 'x-forwarded-for': '198.51.100.5', 'cf-connecting-ip': '198.51.100.99' } })), '198.51.100.5'); }
  finally { delete process.env.VERCEL; }
});
test('moving an attachment to a private field changes its effective access', async () => {
  const col = await collection('Attachment move', [{ name: 'Public', type: 'file' }, { name: 'Private', type: 'file', private: true }]);
  const file = await media.saveAttachment(new File(['private'], 'file.txt', { type: 'text/plain' }), { uploader: owner, appId: app.id, collectionId: col.id, fieldId: col.fields[0].id });
  const record = await data.createRecord(col, { Public: `/api/media/${file.id}` }, admin);
  assert.equal((await getMedia(file.id)).status, 200);
  await data.updateRecord(col, record.id, { Public: null, Private: `/api/media/${file.id}` }, admin);
  assert.equal((await getMedia(file.id)).status, 404);
  assert.equal((await media.getMediaItem(file.id)).fieldId, col.fields[1].id);
  await data.updateCollection(app.id, col.id, { fields: [col.fields[0]] }, owner);
  assert.equal((await getMedia(file.id)).status, 404);
  assert.ok(await store.get('blobDeletes', file.id));
  await load('src/lib/server/maintenance.ts').runMaintenance(store);
  assert.equal(await store.getBlob(file.id), null);
});
test('one attachment cannot be bound to both public and private fields', async () => {
  const col = await collection('Attachment duplicate binding', [{ name: 'Public', type: 'file' }, { name: 'Private', type: 'file', private: true }]);
  const file = await media.saveAttachment(new File(['test'], 'file.txt', { type: 'text/plain' }), { uploader: owner, appId: app.id, collectionId: col.id, fieldId: col.fields[0].id });
  await assert.rejects(data.createRecord(col, { Public: `/api/media/${file.id}`, Private: `/api/media/${file.id}` }, admin), /one field/);
});
test('a removed field never grants read access', async () => {
  const col = await collection('Missing field', [{ name: 'Name', type: 'text' }]);
  assert.equal(data.canReadField(col, { createdBy: owner.id, data: {} }, 'missing', { user: null, isAdmin: false }), false);
});
test('duplicate apps own independent record attachments', async () => {
  const col = await collection('Copy file', [{ name: 'File', type: 'file' }]);
  const file = await media.saveAttachment(new File(['copy data'], 'copy.txt', { type: 'text/plain' }), { uploader: owner, appId: app.id, collectionId: col.id, fieldId: col.fields[0].id });
  await data.createRecord(col, { File: `/api/media/${file.id}` }, admin);
  const copy = await apps.duplicateApp(owner, app.id);
  const target = (await store.find('collections', 'appId', copy.id)).find((c) => c.name === col.name);
  const [row] = await store.find('records', 'collectionId', target.id);
  const id = row.data[target.fields[0].id].split('/').at(-1);
  assert.notEqual(id, file.id); assert.equal((await store.get('media', id)).appId, copy.id);
  await media.deleteMedia(owner, file.id, () => true);
  assert.equal((await store.getBlob(id)).toString(), 'copy data');
});
test('enabling uniqueness rejects existing duplicates; disabling frees reservations', async () => {
  const col = await collection('Unique lifecycle', [{ name: 'Code', type: 'text' }]);
  await data.createRecord(col, { Code: 'same' }, admin); await data.createRecord(col, { Code: 'SAME' }, admin);
  await assert.rejects(data.updateCollection(app.id, col.id, { fields: col.fields.map((f) => ({ ...f, unique: true })) }), /duplicate/);
  assert.equal((await data.getCollection(app.id, col.id)).fields[0].unique, undefined);
});
test('concurrent collection creation preserves name uniqueness and long icons', async () => {
  const results = await Promise.allSettled([collection('Concurrent name', []), collection('Concurrent name', [])]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const col = await data.createCollection(app.id, { name: 'Icon test', icon: 'ShoppingCart' }); assert.equal(col.icon, 'ShoppingCart');
});
test('stale schema and revoked administrator snapshots cannot authorize writes', async () => {
  const col = await collection('Fresh schema', [{ name: 'Name', type: 'text' }]);
  await data.updateCollection(app.id, col.id, { access: { ...allAccess, create: 'admins' } });
  await assert.rejects(data.createRecord(col, { Name: 'stale' }, { user: null, isAdmin: false }), /permission|admin|access/i);
  const editor = { id: 'editor', name: 'Editor' }; await store.put('users', editor);
  await assert.rejects(data.createRecord(col, { Name: 'stale admin' }, { user: editor, isAdmin: true }), /access/);
});
test('preview and server aggregates agree when values are empty', async () => {
  const col = await collection('Averages', [{ name: 'Amount', type: 'number' }]);
  await data.createRecord(col, { Amount: 10 }, admin); await data.createRecord(col, { Amount: null }, admin);
  const live = await data.aggregateRecords(col, { aggregate: 'avg', field: 'Amount' }, admin);
  const preview = load('src/components/runtime/elements/dataQuery.ts').aggregateRecords([{ Amount: 10 }, { Amount: null }], 'avg', 'Amount');
  assert.equal(live.value, 10); assert.equal(preview.value, live.value);
});

test('preview sorting, empty filters and chart groups match live queries', async () => {
  const col = await collection('Query parity', [{ name: 'Amount', type: 'number' }, { name: 'Status', type: 'select', options: ['Second', 'First'] }]);
  for (const values of [{ Amount: 10, Status: 'First' }, { Amount: null, Status: 'Second' }, { Amount: 2, Status: 'First' }]) await data.createRecord(col, values, admin);
  const preview = load('src/components/runtime/elements/dataQuery.ts');
  const rows = await data.toRuntimeRecords(col, await store.find('records', 'collectionId', col.id), admin);
  const query = { sortField: 'Amount', sortDir: 'asc', filters: [{ field: 'Status', op: 'eq', value: '' }] };
  const live = await data.queryRawRecords(col, query, admin);
  assert.deepEqual(preview.queryRecords(rows, query, undefined, col).map(r => r.id), live.records.map(r => r.id));
  const grouped = await data.aggregateRecords(col, { aggregate: 'count', groupBy: 'Status' }, admin);
  assert.deepEqual(preview.aggregateRecords(rows, 'count', undefined, 'Status', col).groups, grouped.groups);
});

test('reference expansion fetches only linked rows and preserves target privacy', async () => {
  const target = await collection('Reference target', [{ name: 'Name', type: 'text' }, { name: 'Secret', type: 'text', private: true }]);
  const col = await collection('Reference source', [{ name: 'Link', type: 'reference', refCollectionId: target.id }]);
  const linked = await data.createRecord(target, { Name: 'Visible', Secret: 'hidden' }, admin);
  const record = await data.createRecord(col, { Link: linked.id }, admin);
  const find = store.find.bind(store);
  store.find = async (table, index, value) => { assert.ok(!(table === 'records' && index === 'collectionId' && value === target.id), 'must not scan reference collection'); return find(table, index, value); };
  try { const [result] = await data.toRuntimeRecords(col, [record], { user: null, isAdmin: false }); assert.equal(result.Link.Name, 'Visible'); assert.equal(result.Link.Secret, undefined); }
  finally { store.find = find; }
});
test('durable idempotency commits once and rejects changed payloads', async () => {
  const { idempotent } = load('src/lib/server/idempotency.ts');
  let calls = 0;
  const operation = (tx) => { calls++; return tx.put('reports', { id: 'idempotency-result', value: calls }).then(() => ({ id: 'result' })); };
  const results = await Promise.all(Array.from({ length: 8 }, () => idempotent('scope', 'retry-key-123', { a: 1 }, operation)));
  assert.equal(calls, 1); assert.ok(results.every((r) => r.id === 'result'));
  await assert.rejects(idempotent('scope', 'retry-key-123', { a: 2 }, operation), /different data/);
  await assert.rejects(idempotent('rollback', 'retry-key-456', {}, async (tx) => { await tx.put('reports', { id: 'rolled-back' }); throw Error('rollback'); }), /rollback/);
  assert.equal(await store.get('reports', 'rolled-back'), null);
});

test('bounded imports preserve valid rows, row numbers and unique constraints after a chunk rollback', async () => {
  const col = await collection('Import chunks', [{ name: 'Code', type: 'text', unique: true }]);
  const rows = Array.from({ length: 65 }, (_, i) => ({ Code: `Code ${i}` })); rows[25] = { Code: 'Code 1' };
  const result = await data.importRecords(col, rows, admin);
  assert.equal(result.added, 64); assert.equal(result.errors.length, 1); assert.equal(result.errors[0].row, 26);
  assert.equal(await store.count('records', 'collectionId', col.id), 64);
});
test('browser retries retain submission keys across lost responses and discard them after success', async () => {
  const memory = new Map(); global.sessionStorage = { getItem: (k) => memory.get(k) || null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) };
  const keys = []; let fail = true;
  const { ApiError } = load('src/lib/client/api.ts');
  const client = createLoader({ '@/lib/client/api': { ApiError, api: async (_url, opts) => { keys.push(opts.body.idempotencyKey); if (fail) { fail = false; throw new ApiError(0, 'lost response'); } return { record: { id: 'saved' } }; } } })('src/components/runtime/api.ts');
  await assert.rejects(client.runtimeApi('retry-app', 'user').create('collection', { Name: 'same' }), /lost response/);
  await client.runtimeApi('retry-app', 'user').create('collection', { Name: 'same' });
  await client.runtimeApi('retry-app', 'user').create('collection', { Name: 'same' });
  assert.equal(keys[0], keys[1]); assert.notEqual(keys[1], keys[2]); assert.equal(memory.size, 0);
});
test('password-reset races cannot create a session for the old password', async () => {
  const original = owner.passwordHash;
  const next = await load('src/lib/server/account.ts').changePassword(owner.id, 'Security-Test-Password-123!', 'Updated-Security-Test-Password-123!');
  await assert.rejects(auth.createSession(owner.id, false, 'test', original), /changed/);
  await auth.createSession(owner.id, false, 'test', next); assert.equal((await auth.currentUser()).id, owner.id);
  const stored = await store.get('users', owner.id); assert.match(stored.passwordHash, /^scrypt\$16384\$8\$5\$/);
  owner.passwordHash = next; jar.token = null;
});
test('design copying reserves quota and rejects copies over the limit', async () => {
  await store.put('media', { id: 'med_quota', ownerId: owner.id, public: true, size: media.USER_QUOTA });
  await store.put('media', { id: 'med_source', ownerId: 'someone', public: true, size: 4, mime: 'text/plain', name: 'test.txt' });
  await store.putBlob('med_source', Buffer.from('test'));
  try { await assert.rejects(media.copyDesignFiles({ url: '/api/media/med_source' }, owner, 'app_copy'), /storage/); }
  finally { await store.delete('media', 'med_quota'); }
});
test('Explore cards omit restricted home pages and private field definitions', async () => {
  const { newAppDoc } = load('src/lib/shared/doc.ts'); const doc = newAppDoc();
  doc.pages[0].access = 'admins'; doc.pages[0].name = 'confidential-marker';
  await store.put('published', { id: app.id, doc, publishedAt: new Date().toISOString() });
  const meta = await store.get('apps', app.id); meta.published.explore = true; await store.put('apps', meta);
  assert.equal((await apps.listExplore('')).find((a) => a.id === app.id).preview, null);
  await assert.rejects(apps.publishApp(owner, app.id, { explore: true }), /Confirm/);
});
test('media responses support bounded byte ranges and reject invalid ranges', async () => {
  const { blobResponse } = load('src/lib/server/blob-response.ts');
  await store.putBlob('range-test', Buffer.from('0123456789'));
  const res = await blobResponse(new Request('https://test.example', { headers: { Range: 'bytes=2-5' } }), 'range-test', 10, {});
  assert.equal(res.status, 206); assert.equal(await res.text(), '2345'); assert.equal(res.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal((await blobResponse(new Request('https://test.example', { headers: { Range: 'bytes=99-' } }), 'range-test', 10, {})).status, 416);
});
test('renamed ZIP files and forged audio/video uploads are rejected', async () => {
  const zip = Buffer.alloc(100); zip.writeUInt32LE(0x04034b50);
  for (const [bytes, name, type] of [[zip, 'fake.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], [Buffer.from('not video'), 'fake.mp4', 'video/mp4'], [Buffer.from('not audio'), 'fake.mp3', 'audio/mpeg']])
    await assert.rejects(media.saveDesignUpload(new File([bytes], name, { type }), owner, app.id), /document|match/);
});

test('valid Office package structure remains accepted', () => {
  const { deflateRawSync, crc32 } = require('node:zlib');
  const entries = [['[Content_Types].xml', '<Types><Override PartName="/word/document.xml" /></Types>'], ['word/document.xml', '<w:document xmlns:w="test"><w:body /></w:document>']];
  const locals = [], directory = []; let offset = 0;
  for (const [name, text] of entries) {
    const data = Buffer.from(text), bytes = deflateRawSync(data), filename = Buffer.from(name), checksum = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(checksum, 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10); central.writeUInt32LE(checksum, 16); central.writeUInt32LE(bytes.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, filename, bytes); directory.push(central, filename); offset += local.length + filename.length + bytes.length;
  }
  const central = Buffer.concat(directory), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  const bytes = Buffer.concat([...locals, central, end]);
  const { isOfficePackage } = load('src/lib/server/office-file.ts');
  assert.equal(isOfficePackage(bytes, 'docx'), true); assert.equal(isOfficePackage(bytes, 'xlsx'), false);
});

test('outdated terms require explicit versioned acceptance while account access remains available', async () => {
  const { LEGAL } = load('src/lib/shared/legal.ts');
  await store.put('users', { ...await store.get('users', owner.id), termsVersion: 'old-version' });
  await auth.createSession(owner.id, false, 'terms-test', owner.passwordHash);
  try {
    await assert.rejects(auth.requireUser(), (err) => err.status === 428);
    assert.equal((await auth.requireUser(true)).id, owner.id);
    const { POST } = load('src/app/api/auth/terms/route.ts');
    const request = (version) => new Request('https://test.example/api/auth/terms', { method: 'POST', headers: { Host: 'test.example', Origin: 'https://test.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ acceptTerms: true, version }) });
    assert.equal((await POST(request('old-version'))).status, 400);
    assert.equal((await POST(request(LEGAL.termsVersion))).status, 200);
    assert.equal((await auth.requireUser()).termsVersion, LEGAL.termsVersion);
  } finally { jar.token = null; }
});
test('cold writers notify without a LISTEN connection and Unicode payloads spill safely', async () => {
  delete global.__cbLive; let notified = 0, listened = 0, spills = 0;
  const mock = { kind: 'postgres', put: async (table) => { if (table === 'live') spills++; }, delete: async () => {}, notify: async (_, payload) => { assert.ok(Buffer.byteLength(payload) < 8000); notified++; }, listen: async () => listened++ };
  const live = createLoader({ './store': { getStore: async () => mock } })('src/lib/server/live.ts');
  await live.dataChanged(app.id, 'records');
  await live.publish(app.id, { type: 'change', rev: 2, clientId: 'test', userId: owner.id, changes: [{ k: 'theme', v: '字'.repeat(3000) }], accepted: [], adjusted: [] });
  assert.equal(notified, 2); assert.equal(listened, 0); assert.equal(spills, 1);
});
test('exports include more than the former record and audit limits', async () => {
  const col = await collection('Export fixture', [{ name: 'Name', type: 'text' }]);
  await store.transaction(async (tx) => {
    for (let i = 0; i < 5001; i++) await tx.put('records', { id: `export_${String(i).padStart(5, '0')}`, collectionId: col.id, appId: app.id, createdBy: owner.id, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', data: { [col.fields[0].id]: `Row ${i}` } });
    for (let i = 0; i < 501; i++) await tx.put('audit', { id: `export_audit_${i}`, userId: owner.id, at: new Date().toISOString(), action: 'login' });
  });
  let output = ''; for await (const part of load('src/lib/server/export.ts').exportMyData(owner)) output += part;
  const result = JSON.parse(output); assert.ok(result.recordsYouAddedInApps.length >= 5001); assert.ok(result.securityLog.length >= 501);
  assert.equal(result.complete, true); assert.equal(result.counts.securityLog, result.securityLog.length); assert.equal(result.counts.recordsYouAddedInApps, result.recordsYouAddedInApps.length);
  assert.equal(result.apps.find((a) => a.id === app.id).records.filter((r) => r.collectionId === col.id).length, 5001);
});
test('account deletion revokes access before durable cleanup finishes', async () => {
  const user = await auth.createUser({ name: 'Delete test', email: 'delete@example.invalid', password: 'Delete-Test-Password-123!', acceptTerms: true, ageOk: true });
  await apps.createApp(user, { name: 'Delete app', templateId: 'blank' });
  const account = load('src/lib/server/account.ts'); await account.deleteAccount(user, 'Delete-Test-Password-123!');
  await assert.rejects(apps.createApp(user, { name: 'Must not survive' }), /available/);
  for (let i = 0; i < 5 && await store.get('users', user.id); i++) await account.resumeAccountDeletion(user.id);
  assert.equal(await store.get('users', user.id), null); assert.equal(await store.count('apps', 'ownerId', user.id), 0);
});
test('cron authentication and production script policy fail closed', async () => {
  const { GET } = load('src/app/api/maintenance/route.ts');
  assert.equal((await GET(new Request('https://test.example/api/maintenance'))).status, 401);
  const csp = load('src/lib/shared/csp.ts').contentSecurityPolicy('testnonce');
  assert.match(csp, /script-src 'self' 'nonce-testnonce'/); assert.doesNotMatch(csp.split(';')[1], /unsafe-inline|unsafe-eval/);
});

(async () => {
  store = await load('src/lib/server/store/index.ts').getStore();
  owner = await auth.createUser({ name: 'Security test', email: 'security@example.invalid', password: 'Security-Test-Password-123!', acceptTerms: true, ageOk: true });
  app = await apps.createApp(owner, { name: 'Security fixture', templateId: 'blank' });
  await store.put('apps', { ...app, published: { slug: 'security-fixture', at: new Date().toISOString(), explore: false } });
  admin = { user: owner, isAdmin: true, appId: app.id };
  let failures = 0;
  for (const { name, run } of tests) { try { await run(); console.log(`PASS ${name}`); } catch (err) { failures++; console.error(`FAIL ${name}\n${err.stack}`); } }
  console.log(`${tests.length - failures}/${tests.length} security checks passed.`); process.exitCode = failures ? 1 : 0;
})().catch((err) => { console.error(err); process.exitCode = 1; });
