import { startLocalTunnel } from './expo.mjs';
let input = '';
for await (const chunk of process.stdin) { input += chunk; if (input.length > 8192) throw new Error('Invalid job.'); }
const job = JSON.parse(input);
if (!/^mob_[a-z0-9]+$/i.test(job.id)) throw new Error('Invalid job.');
const controller = new AbortController();
process.once('SIGTERM', () => controller.abort());
process.once('SIGINT', () => controller.abort());
const tunnel = await startLocalTunnel(job, `/tmp/${job.id}`, controller.signal);
console.log(JSON.stringify({ url: tunnel.url }));
await tunnel.closed;
