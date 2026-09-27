import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { androidTools, buildAndroid } from './mobile/android.mjs';
import { expoAvailable, startIosTunnel } from './mobile/expo.mjs';

const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(fileURLToPath(new URL('../', import.meta.url)));
const token = process.env.CRAFTBASE_MOBILE_WORKER_TOKEN || '';
if (token.length < 32) throw new Error('Set CRAFTBASE_MOBILE_WORKER_TOKEN to the same random 32+ character secret on the server and worker.');
const server = new URL(process.env.CRAFTBASE_MOBILE_SERVER_URL || process.env.CRAFTBASE_PUBLIC_URL || 'http://localhost:3000');
if (server.username || server.password || server.pathname !== '/' || server.search || server.hash || (server.protocol !== 'https:' && !(server.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(server.hostname)))) throw new Error('The worker server URL must be an HTTPS origin (HTTP is allowed only on loopback).');
const endpoint = new URL('/api/mobile-worker', server);
const workerId = crypto.randomUUID();
const workRoot = path.resolve(process.env.CRAFTBASE_MOBILE_WORK_DIR || path.join(os.homedir(), '.craftbase-mobile'));
const jobRoot = path.join(workRoot, 'jobs');
const keyRoot = path.join(workRoot, 'keys');
await fs.mkdir(jobRoot, { recursive: true, mode: 0o700 });
const targets = [];
try { await androidTools(); targets.push('android'); } catch { console.warn('Android unavailable: install JDK 17+ and Android SDK platform 35 + build tools.'); }
if (await expoAvailable()) targets.push('ios');
else console.warn('iOS unavailable: run npm run mobile:install first.');
if (!targets.length) throw new Error('No mobile build tools are available. See docs/mobile-deployment.md.');

const shutdown = new AbortController();
const running = new Map();
const stop = () => { shutdown.abort(); for (const task of running.values()) task.controller.abort(); };
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

async function request(body, job, apk) {
  const url = new URL(endpoint);
  if (job) url.searchParams.set('job', job.id);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': apk ? 'application/vnd.android.package-archive' : 'application/json' };
  if (job) headers['X-Mobile-Lease'] = job.leaseToken;
  const res = await fetch(url, { method: 'POST', headers, body: apk || JSON.stringify(body), signal: AbortSignal.timeout(15_000), redirect: 'error' });
  const data = await res.json();
  if (!res.ok) { const err = new Error(data.error || `Worker request failed (${res.status}).`); err.status = res.status; throw err; }
  return data;
}

async function removeJobDir(dir) {
  const resolved = path.resolve(dir);
  const realRoot = await fs.realpath(jobRoot);
  let realDir;
  try { realDir = await fs.realpath(resolved); } catch (err) { if (err.code === 'ENOENT') return; throw err; }
  if (path.dirname(resolved) !== jobRoot || path.dirname(realDir) !== realRoot || !/^mob_[a-z0-9]+$/i.test(path.basename(resolved))) throw new Error('Refusing to remove a directory outside the mobile job workspace.');
  // fs.rm removes the node_modules link itself; it does not follow symlinks/junctions.
  await fs.rm(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
}

async function execute(job, controller) {
  const dir = path.join(jobRoot, job.id);
  let tunnel;
  let lastHeartbeat = Date.now();
  let complete = false;
  const heartbeat = (async () => {
    while (!controller.signal.aborted && !complete) {
      try {
        await delay(15_000, undefined, { signal: controller.signal });
        if (complete) break;
        if (tunnel) await tunnel.check();
        await request({ action: 'heartbeat' }, job);
        lastHeartbeat = Date.now();
      } catch (err) {
        if (controller.signal.aborted || complete) break;
        if ([401, 403, 404, 409].includes(err.status) || Date.now() - lastHeartbeat > 60_000) controller.abort();
      }
    }
  })();
  const deadline = setTimeout(() => controller.abort(), job.target === 'ios' ? 75 * 60_000 : 15 * 60_000);
  try {
    if (!/^mob_[a-z0-9]+$/i.test(job.id)) throw new Error('Invalid job id.');
    if (job.target === 'android') {
      const apk = await buildAndroid(job, dir, keyRoot, controller.signal);
      controller.signal.throwIfAborted();
      await request(null, job, await fs.readFile(apk));
      console.log(`Android build ready: ${job.id}`);
    } else {
      tunnel = await startIosTunnel(job, dir, controller.signal);
      const ready = await request({ action: 'ready', url: tunnel.url }, job);
      console.log(`iOS tunnel ready: ${job.id}`);
      await Promise.race([tunnel.closed, delay(Math.max(0, Date.parse(ready.expiresAt) - Date.now()), undefined, { signal: controller.signal })]);
      if (!controller.signal.aborted && Date.now() < Date.parse(ready.expiresAt)) throw new Error('The Expo tunnel stopped unexpectedly.');
    }
  } catch (err) {
    if (!controller.signal.aborted) console.error(`Mobile job ${job.id} failed:`, err.message);
    try { await request({ action: 'failed', error: controller.signal.aborted ? 'The mobile worker stopped or lost its connection. Please try again.' : job.target === 'android' ? 'The Android build failed. The operator can check the worker log, then you can retry.' : 'The iOS tunnel could not start or disconnected. Please try again; contact the operator if it continues.' }, job); } catch { /* cancelled, expired, or server unavailable */ }
  } finally {
    complete = true;
    clearTimeout(deadline);
    controller.abort();
    await tunnel?.stop();
    await heartbeat;
    await removeJobDir(dir).catch((err) => console.error('Could not clean mobile job files:', err.message));
  }
}

console.log(`Mobile worker ready (${targets.join(', ')}). Keep this process running while clients test.`);
while (!shutdown.signal.aborted) {
  try {
    const active = [...running.values()];
    const available = targets.filter((target) => active.filter((task) => task.target === target).length < (target === 'ios' ? 2 : 1));
    const { job } = await request({ workerId, targets, available });
    if (job && !shutdown.signal.aborted) {
      const controller = new AbortController();
      const task = { target: job.target, controller, promise: null };
      running.set(job.id, task);
      task.promise = execute(job, controller).finally(() => running.delete(job.id));
    }
  } catch (err) { console.error('Mobile worker connection:', err.message); }
  try { await delay(5000, undefined, { signal: shutdown.signal }); } catch { break; }
}
await Promise.allSettled([...running.values()].map((task) => task.promise));
console.log('Mobile worker stopped.');
