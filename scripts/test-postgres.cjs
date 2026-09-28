const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const { createLoader } = require('./ts-loader.cjs');
const connection = process.env.TEST_DATABASE_URL;
if (!connection) { console.error('Set TEST_DATABASE_URL to a disposable local database named wrytz_test.'); process.exit(1); }
const url = new URL(connection);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !/^\/wrytz_test(?:_[a-z0-9]+)?$/.test(url.pathname)) throw new Error('Postgres tests only run against a disposable local wrytz_test database.');
const schema = 'test_' + crypto.randomBytes(8).toString('hex');
process.env.CRAFTBASE_SECRET = 'isolated-postgres-test-only-secret-32-characters';
process.env.DATABASE_URL = connection;
delete process.env.VERCEL;
const pool = new Pool({ connectionString: connection });
const load = createLoader();
const tests = []; const test = (name, run) => tests.push({ name, run });
let store, app, owner, viewer, counter, col;
const data = load('src/lib/server/data.ts'), apps = load('src/lib/server/apps.ts');
test('shared rate limits are atomic across database connections', async () => {
  const results = await Promise.all(Array.from({ length: 30 }, () => store.consumeRateLimit('parallel', 7, 60000)));
  assert.equal(results.filter(Boolean).length, 7);
});
test('serializable transactions retry concurrent increments without lost updates', async () => {
  await Promise.all(Array.from({ length: 8 }, () => data.adjustNumber(col, counter.id, 'Count', 1, undefined, viewer)));
  const row = await store.get('records', counter.id); assert.equal(row.data[col.fields[0].id], 8);
});
test('parallel creation cannot duplicate collection names', async () => {
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => data.createCollection(app.id, { name: 'Parallel name' })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
});
test('unique-field migrations cover existing values and release disabled claims', async () => {
  let c = await data.createCollection(app.id, { name: 'Unique migration', fields: [{ name: 'Code', type: 'text' }] });
  await data.createRecord(c, { Code: 'old' }, viewer);
  c = await data.updateCollection(app.id, c.id, { fields: c.fields.map((f) => ({ ...f, unique: true })) });
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => data.createRecord(c, { Code: 'parallel' }, viewer)));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  await assert.rejects(data.createRecord(c, { Code: 'OLD' }, viewer), (e) => e.status === 409);
  // Simulate a legacy schema that has a unique flag without a reservation.
  await pool.query(`DELETE FROM "${schema}".cb_unique WHERE scope=$1`, [`${c.id}:${c.fields[0].id}`]);
  await assert.rejects(data.createRecord(c, { Code: 'OLD' }, viewer), (e) => e.status === 409);
  c = await data.updateCollection(app.id, c.id, { fields: c.fields.map((f) => ({ ...f, unique: false })) });
  await data.createRecord(c, { Code: 'old' }, viewer);
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".cb_unique WHERE scope=$1`, [`${c.id}:${c.fields[0].id}`])).rows[0].n, 0);
});
test('record updates cannot resurrect a field removed by a concurrent schema change', async () => {
  const c = await data.createCollection(app.id, { name: 'Schema race', fields: [{ name: 'Name', type: 'text' }, { name: 'Remove', type: 'text' }] });
  const row = await data.createRecord(c, { Name: 'before', Remove: 'private' }, viewer);
  const result = await Promise.allSettled([data.updateRecord(c, row.id, { Name: 'after' }, viewer), data.updateCollection(app.id, c.id, { fields: [c.fields[0]] })]);
  assert.ok(result.every((r) => r.status === 'fulfilled'));
  assert.equal((await store.get('records', row.id)).data[c.fields[1].id], undefined);
  assert.equal((await store.get('records', row.id)).data[c.fields[0].id], 'after');
});
test('idempotency result and write commit exactly once across connections', async () => {
  const { idempotent } = load('src/lib/server/idempotency.ts');
  const before = (await store.get('records', counter.id)).data[col.fields[0].id];
  const results = await Promise.all(Array.from({ length: 8 }, () => idempotent('pg', 'pg-submission-123', {}, async (tx) => {
    const row = await tx.get('records', counter.id); row.data[col.fields[0].id]++; await tx.put('records', row); return row.id;
  })));
  assert.ok(results.every((id) => id === counter.id)); assert.equal((await store.get('records', counter.id)).data[col.fields[0].id], before + 1);
});
test('database pagination enforces owner scope and blob ranges return only requested bytes', async () => {
  const rows = await store.recordPage({ collectionId: col.id, ownerId: 'other', offset: 0, limit: 5, ascending: false }); assert.equal(rows.total, 0);
  await store.putBlob('range', Buffer.from('abcdefghij')); assert.equal((await store.getBlob('range', { start: 2, end: 5 })).toString(), 'cdef');
});

test('batch imports roll back invalid chunks and retain valid rows exactly once', async () => {
  const collection = await data.createCollection(app.id, { name: 'Batch import', fields: [{ name: 'Code', type: 'text', unique: true }] });
  const rows = Array.from({ length: 55 }, (_, i) => ({ Code: `batch-${i}` })); rows[15] = { Code: 'batch-1' };
  const result = await data.importRecords(collection, rows, viewer);
  assert.equal(result.added, 54); assert.deepEqual(result.errors.map(e => e.row), [16]);
  assert.equal(await store.count('records', 'collectionId', collection.id), 54);
});
test('LISTEN reconnects after connection loss and signals clients to resynchronize', async () => {
  let last = ''; let reconnect;
  const recovered = new Promise((resolve) => { reconnect = resolve; });
  await store.listen('test_live', (payload) => { last = payload; }, reconnect);
  await store.notify('test_live', 'first');
  for (let i = 0; i < 20 && last !== 'first'; i++) await new Promise((r) => setTimeout(r, 25));
  assert.equal(last, 'first');
  const terminated = await pool.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='wrytz_test' AND application_name=$1 AND query='LISTEN test_live'", [schema]);
  assert.equal(terminated.rowCount, 1);
  await Promise.race([recovered, new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('LISTEN did not recover')), 10000); timer.unref(); })]);
  await store.notify('test_live', 'after');
  for (let i = 0; i < 20 && last !== 'after'; i++) await new Promise((r) => setTimeout(r, 25));
  assert.equal(last, 'after');
});
(async () => {
  let failed = 0;
  try {
    await pool.query(`CREATE SCHEMA "${schema}"`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    url.searchParams.set('application_name', schema);
    process.env.DATABASE_URL_UNPOOLED = url.href;
    store = await load('src/lib/server/store/pg.ts').createPgStore(url.href);
    global.__craftbaseStore = Promise.resolve(store);
    owner = { id: 'postgres-owner', name: 'Test owner' }; await store.put('users', owner);
    app = await apps.createApp(owner, { name: 'Postgres fixture' }); viewer = { user: owner, isAdmin: true };
    col = await data.createCollection(app.id, { name: 'Counter', fields: [{ name: 'Count', type: 'number', counter: true }] }); counter = await data.createRecord(col, { Count: 0 }, viewer);
    for (const { name, run } of tests) { try { await run(); console.log(`PASS ${name}`); } catch (err) { failed++; console.error(`FAIL ${name}\n${err.stack}`); } }
    console.log(`${tests.length - failed}/${tests.length} PostgreSQL checks passed.`);
  } catch (err) { failed++; console.error(err); }
  finally { await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await pool.end(); }
  // The application pool is process-scoped; all assertions and cleanup have completed.
  process.exit(failed ? 1 : 0);
})();
