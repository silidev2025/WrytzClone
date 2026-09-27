import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const template = fileURLToPath(new URL('../../mobile/expo/', import.meta.url));
const modules = path.join(template, 'node_modules');
const cli = path.join(modules, 'expo/bin/cli');

export async function expoAvailable() { try { await fs.access(cli); await fs.access(path.join(modules, '@expo/ngrok')); return true; } catch { return false; } }

function expoEnvironment() {
  // Never expose database, session, signing, or worker credentials to a public Metro server.
  const env = { CI: '1', EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1', NODE_ENV: 'development' };
  for (const key of ['PATH', 'Path', 'HOME', 'USERPROFILE', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'NUMBER_OF_PROCESSORS', 'EXPO_TOKEN']) if (process.env[key]) env[key] = process.env[key];
  return env;
}

export async function prepareExpo(job, dir) {
  await fs.mkdir(dir, { recursive: true });
  for (const name of ['App.js', 'index.js', 'package.json']) await fs.copyFile(path.join(template, name), path.join(dir, name));
  await fs.symlink(modules, path.join(dir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  await fs.writeFile(path.join(dir, 'app.json'), JSON.stringify({ expo: {
    name: job.appName, slug: job.id, version: '1.0.0', platforms: ['ios'],
    ios: { supportsTablet: true }, extra: { appUrl: job.appUrl, platformUrl: job.platformUrl },
  } }));
  await fs.writeFile(path.join(dir, 'metro.config.js'), `const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.watchFolders = [${JSON.stringify(modules)}];
config.resolver.nodeModulesPaths = [${JSON.stringify(modules)}];
module.exports = config;
`);
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function startIosTunnel(job, dir, signal) {
  await prepareExpo(job, dir);
  const port = await freePort();
  const child = spawn(process.execPath, [cli, 'start', dir, '--tunnel', '--go', '--port', String(port)], {
    cwd: dir, env: expoEnvironment(), shell: false, windowsHide: true,
    detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let ended = false;
  let failure;
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { output = (output + chunk).slice(-8000); });
  child.on('error', (error) => { failure = error; ended = true; });
  const closed = new Promise((resolve) => child.once('close', () => { ended = true; resolve(); }));
  let stopping;
  const stop = () => stopping ||= (async () => {
    if (ended) return;
    if (process.platform === 'win32') {
      // The PID comes directly from spawn, never from request data. Include Metro/ngrok children.
      await new Promise((resolve) => {
        const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.once('error', resolve); killer.once('close', resolve);
      });
    } else { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already closed */ } }
    await Promise.race([closed, delay(3000)]);
    if (!ended && process.platform !== 'win32') { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already closed */ } }
  })();
  const abort = () => { void stop(); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    for (let attempt = 0; attempt < 90; attempt++) {
      signal.throwIfAborted();
      if (ended) throw failure || new Error(`Expo tunnel exited: ${output}`);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/_expo/open?platform=ios&runtime=expo`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const info = await res.json();
          const url = info.url;
          if (typeof url === 'string' && /^exps?:\/\//.test(url) && /\.(exp\.direct|ngrok\.io|ngrok-free\.app|ngrok\.app)(?=[:/]|$)/.test(url)) {
            const statusUrl = new URL(url.replace(/^exps?:/, 'https:'));
            statusUrl.port = ''; statusUrl.pathname = '/status'; statusUrl.search = '';
            const check = async () => {
              const status = await fetch(statusUrl, { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]), redirect: 'error' });
              if (!status.ok || !(await status.text()).includes('packager-status:running')) throw new Error('The public Expo tunnel is unreachable.');
            };
            // Ensure Metro can bundle the shell before displaying a ready link.
            const bundle = await fetch(`http://127.0.0.1:${port}/index.bundle?platform=ios&dev=true&minify=false`, { signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]) });
            if (!bundle.ok) throw new Error('Expo could not bundle the iOS app.');
            await bundle.arrayBuffer();
            await check();
            return { url, closed, check, stop: async () => { signal.removeEventListener('abort', abort); await stop(); } };
          }
        }
      } catch (err) { if (signal.aborted) throw err; }
      await delay(1000, undefined, { signal });
    }
    throw new Error(`Expo tunnel did not become ready: ${output}`);
  } catch (err) { signal.removeEventListener('abort', abort); await stop(); throw err; }
}
