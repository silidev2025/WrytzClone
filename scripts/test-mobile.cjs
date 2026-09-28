const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLoader } = require('./ts-loader.cjs');
process.env.CRAFTBASE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'craftbase-mobile-tests-'));
process.env.DATABASE_URL = '';
process.env.CRAFTBASE_SECRET = 'mobile-tests-only-never-used-in-production';
process.env.CRAFTBASE_PUBLIC_URL = 'https://craftbase.example';
process.env.NEXT_PUBLIC_ROOT_DOMAIN = '';
process.env.CRAFTBASE_MOBILE_WORKER_TOKEN = 'mobile-worker-test-secret-with-at-least-32-characters';
const load = createLoader();
const { getStore } = load('src/lib/server/store/index.ts');
const mobile = load('src/lib/server/mobile.ts');
const { publishApp, deleteApp, unpublishApp } = load('src/lib/server/apps.ts');
const { newAppDoc } = load('src/lib/shared/doc.ts');
const { POST: workerRoute } = load('src/app/api/mobile-worker/route.ts');
const user = { id: 'mobile-owner' };
const other = { id: 'other-owner' };
const worker = 'mobile-test-worker';
const tests = [];
const test = (name, run) => tests.push({ name, run });
const isStatus = (status) => (err) => err.status === status;
let store, seq = 0, apps = [];
async function seed(kind = 'mobile') {
  await store.put('users', user);
  await store.put('users', other);
  const id = `mobile-app-${++seq}`;
  const at = new Date().toISOString();
  const doc = newAppDoc(); doc.settings.kind = kind;
  await store.put('apps', { id, ownerId: user.id, name: `Test ${seq}`, description: '', kind, revision: 7, createdAt: at, updatedAt: at, adminIds: [], published: null, stats: { visits: 0, submissions: 0 } });
  await store.put('drafts', { id, doc, revision: 7, updatedAt: at });
  apps.push(id); return id;
}
const publish = (id, target = 'android', extra = {}) => publishApp(user, id, { slug: id, expectedRevision: 7, mobileTarget: target, ...extra });
const claim = () => mobile.claimMobileJob(worker, ['android', 'ios'], ['android', 'ios']);
const apk = Buffer.alloc(1024); apk.writeUInt32LE(0x04034b50);

test('worker API rejects missing/incorrect bearer credentials and accepts only its secret', async () => {
  for (const authorization of ['', 'Bearer incorrect']) {
    const response = await workerRoute(new Request('https://craftbase.example/api/mobile-worker', { method: 'POST', headers: { authorization }, body: '{}' }));
    assert.equal(response.status, 401);
  }
  assert.doesNotThrow(() => mobile.requireMobileWorker(new Request('https://craftbase.example', { headers: { Authorization: `Bearer ${process.env.CRAFTBASE_MOBILE_WORKER_TOKEN}` } })));
});

test('unavailable worker and non-HTTPS origin roll back publishing and queue creation', async () => {
  const id = await seed();
  await store.delete('mobileWorkers', 'primary');
  await assert.rejects(publish(id), isStatus(503));
  assert.equal((await store.get('apps', id)).published, null);
  assert.equal(await store.get('published', id), null);
  await mobile.claimMobileJob(worker, ['android', 'ios'], []);
  const before = process.env.CRAFTBASE_PUBLIC_URL;
  for (const invalid of ['http://localhost:3000', 'https://localhost:3000', 'https://user:password@example.com', 'https://example.com/path']) {
    process.env.CRAFTBASE_PUBLIC_URL = invalid;
    await assert.rejects(publish(id), isStatus(503));
  }
  process.env.CRAFTBASE_PUBLIC_URL = before;
  assert.equal((await store.find('mobileDeployments', 'appId', id)).length, 0);
});

test('publishing rejects unsaved revisions, websites, invalid platforms and other owners', async () => {
  const id = await seed();
  await assert.rejects(publish(id, 'android', { expectedRevision: 6 }), isStatus(409));
  await assert.rejects(publish(id, 'android', { expectedRevision: undefined }), isStatus(400));
  await assert.rejects(publish(id, 'windows'), isStatus(400));
  await assert.rejects(publish(await seed('website')), isStatus(400));
  await assert.rejects(publishApp(other, id, { slug: id }), isStatus(403));
  assert.equal((await store.get('apps', id)).published, null);
});

test('simultaneous publish clicks create one job, and competing claims take it once', async () => {
  const id = await seed();
  const results = await Promise.allSettled([publish(id), publish(id), publish(id)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await store.find('mobileDeployments', 'appId', id)).length, 1);
  const claims = await Promise.all([claim(), claim()]);
  assert.equal(claims.filter(Boolean).length, 1);
  const job = claims.find(Boolean);
  assert.equal(job.revision, 7);
  assert.equal(job.appUrl, `https://craftbase.example/app/${id}`);
  const listed = (await mobile.listMobileDeployments(user, id)).deployments[0];
  for (const secret of ['leaseToken', 'workerId', 'artifactId', 'ownerId']) assert.equal(listed[secret], undefined);
});

test('APK completion requires a valid lease and Android target; downloads are scoped to their owner and app', async () => {
  const id = await seed(); const otherApp = await seed();
  await publish(id); const job = await claim();
  await assert.rejects(mobile.uploadMobileApk(job.id, 'wrong-lease', apk), isStatus(403));
  await assert.rejects(mobile.uploadMobileApk(job.id, job.leaseToken, Buffer.from('bad')), isStatus(400));
  await mobile.uploadMobileApk(job.id, job.leaseToken, apk);
  const listed = (await mobile.listMobileDeployments(user, id)).deployments[0];
  assert.equal(listed.status, 'ready'); assert.equal(listed.sha256.length, 64);
  assert.equal((await mobile.downloadMobileApk(user, id, job.id)).data.length, apk.length);
  await assert.rejects(mobile.downloadMobileApk(other, id, job.id), isStatus(403));
  await assert.rejects(mobile.downloadMobileApk(user, otherApp, job.id), isStatus(404));
  await assert.rejects(mobile.listMobileDeployments(other, id), isStatus(403));
  await assert.rejects(mobile.stopMobileDeployment(other, id, job.id), isStatus(403));
  await assert.rejects(mobile.uploadMobileApk(job.id, job.leaseToken, apk), isStatus(409));
  await mobile.stopMobileDeployment(user, id, job.id);
  await assert.rejects(mobile.downloadMobileApk(user, id, job.id), isStatus(404));
});

test('APK parts are retryable, validate checksums, and assemble files above the hosting request limit', async () => {
  const id = await seed(); await publish(id); const job = await claim();
  const large = Buffer.alloc(5 * 1024 * 1024 + 33, 7); large.writeUInt32LE(0x04034b50);
  const digest = require('node:crypto').createHash('sha256').update(large).digest('hex');
  const size = 1024 * 1024;
  await assert.rejects(mobile.uploadMobilePart(job.id, 'wrong', 0, large.length, digest, large.subarray(0, size)), isStatus(403));
  for (let part = 0; part < Math.ceil(large.length / size); part++) {
    const bytes = large.subarray(part * size, (part + 1) * size);
    await mobile.uploadMobilePart(job.id, job.leaseToken, part, large.length, digest, bytes);
    if (!part) await mobile.uploadMobilePart(job.id, job.leaseToken, part, large.length, digest, bytes);
  }
  await assert.rejects(mobile.completeMobileUpload(job.id, job.leaseToken, '0'.repeat(64)), isStatus(400));
  await mobile.completeMobileUpload(job.id, job.leaseToken, digest);
  await mobile.completeMobileUpload(job.id, job.leaseToken, digest);
  assert.deepEqual((await mobile.downloadMobileApk(user, id, job.id)).data, large);
});

test('tunnels accept only Expo addresses, cannot receive APKs, and stop cannot be undone by a late callback', async () => {
  const id = await seed(); await publish(id, 'ios'); const job = await claim();
  for (const url of ['javascript:alert(1)', 'exp://localhost:8081', 'https://app.exp.direct', 'exp://app.exp.direct.evil.example', 'exp://user:pass@app.exp.direct']) assert.throws(() => mobile.validateTunnelUrl(url), isStatus(400));
  await assert.rejects(mobile.uploadMobileApk(job.id, job.leaseToken, apk), isStatus(409));
  await mobile.updateMobileJob(job.id, job.leaseToken, { action: 'ready', url: 'exp://test-app.exp.direct:80' });
  assert.equal((await mobile.listMobileDeployments(user, id)).deployments[0].status, 'ready');
  await mobile.stopMobileDeployment(user, id, job.id);
  await assert.rejects(mobile.updateMobileJob(job.id, job.leaseToken, { action: 'heartbeat' }), isStatus(409));
  assert.equal((await mobile.listMobileDeployments(user, id)).deployments[0].tunnelUrl, undefined);
});

test('expired worker leases and expired tunnel sessions remove ready links', async () => {
  const id = await seed(); await publish(id, 'ios'); const job = await claim();
  await mobile.updateMobileJob(job.id, job.leaseToken, { action: 'ready', url: 'exp://test-app.exp.direct:80' });
  const stale = await store.get('mobileDeployments', job.id); stale.leaseUntil = '2000-01-01T00:00:00Z'; await store.put('mobileDeployments', stale);
  assert.equal((await mobile.listMobileDeployments(user, id)).deployments[0].status, 'expired');
  await publish(id, 'ios'); const next = await claim();
  await mobile.updateMobileJob(next.id, next.leaseToken, { action: 'ready', url: 'exp://another.exp.direct:80' });
  const timed = await store.get('mobileDeployments', next.id); timed.expiresAt = '2000-01-01T00:00:00Z'; await store.put('mobileDeployments', timed);
  assert.equal((await mobile.listMobileDeployments(user, id)).deployments.find((d) => d.id === next.id).status, 'expired');
});

test('unpublishing revokes APK downloads and active tunnels', async () => {
  const id = await seed(); await publish(id); const android = await claim(); await mobile.uploadMobileApk(android.id, android.leaseToken, apk);
  await publish(id, 'ios'); const ios = await claim(); await mobile.updateMobileJob(ios.id, ios.leaseToken, { action: 'ready', url: 'exp://test-app.exp.direct:80' });
  await unpublishApp(user, id);
  await assert.rejects(mobile.downloadMobileApk(user, id, android.id), isStatus(404));
  await assert.rejects(mobile.updateMobileJob(ios.id, ios.leaseToken, { action: 'heartbeat' }), isStatus(409));
  assert.ok((await mobile.listMobileDeployments(user, id)).deployments.every((d) => d.status === 'stopped'));
  await publishApp(user, id, { slug: id, expectedRevision: 7 });
  await assert.rejects(mobile.downloadMobileApk(user, id, android.id), isStatus(404));
});

test('deleting an app removes build records and APK blobs', async () => {
  const id = await seed(); await publish(id); const job = await claim(); await mobile.uploadMobileApk(job.id, job.leaseToken, apk);
  const artifact = (await store.get('mobileDeployments', job.id)).artifactId;
  await deleteApp(user, id);
  assert.equal(await store.get('mobileDeployments', job.id), null);
  assert.equal(await store.getBlob(artifact), null);
  apps = apps.filter((value) => value !== id);
});

test('maintenance removes expired artifacts and build history older than 30 days', async () => {
  const id = await seed(); await publish(id); const job = await claim(); await mobile.uploadMobileApk(job.id, job.leaseToken, apk);
  const stored = await store.get('mobileDeployments', job.id);
  stored.createdAt = stored.expiresAt = '2000-01-01T00:00:00Z'; await store.put('mobileDeployments', stored);
  await mobile.cleanMobileDeployments(store);
  assert.equal(await store.getBlob(stored.artifactId), null);
  assert.equal(await store.get('mobileDeployments', job.id), null);
});

(async () => {
  store = await getStore(); let failed = 0;
  for (const { name, run } of tests) {
    try { await mobile.claimMobileJob(worker, ['android', 'ios'], []); await run(); console.log(`PASS ${name}`); }
    catch (err) { failed++; console.error(`FAIL ${name}\n${err.stack}`); }
    finally { for (const id of apps) await deleteApp(user, id); apps = []; }
  }
  console.log(`${tests.length - failed}/${tests.length} mobile deployment checks passed.`);
  process.exitCode = failed ? 1 : 0;
})();
