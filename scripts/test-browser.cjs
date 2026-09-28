// Run after npm run build. Uses synthetic data in a fresh OS temp folder only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { chromium } = require('@playwright/test');

(async () => {
  const root = path.resolve(__dirname, '..');
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'craftbase-browser-'));
  const socket = net.createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: '', DATABASE_URL_UNPOOLED: '', VERCEL: '', VERCEL_URL: '', VERCEL_PROJECT_PRODUCTION_URL: '', TRUST_PROXY: '',
      CRAFTBASE_DATA_DIR: path.join(artifacts, 'data'), CRAFTBASE_SECRET: 'isolated-browser-test-only-secret-32-characters',
      CRAFTBASE_PUBLIC_URL: 'https://browser.example.invalid', CRAFTBASE_MOBILE_WORKER_TOKEN: '', RESEND_API_KEY: '', MAIL_FROM: '', OPERATOR_IDS: '' },
  });
  let serverLog = '', browser;
  server.stdout.on('data', chunk => { serverLog = (serverLog + chunk).slice(-8000); });
  server.stderr.on('data', chunk => { serverLog = (serverLog + chunk).slice(-8000); });
  try {
    let ready = false;
    for (let i = 0; i < 90; i++) {
      if (server.exitCode !== null) throw new Error('Isolated test server exited.');
      try { ready = (await fetch(`${origin}/auth`, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* starting */ }
      if (ready) break;
      await delay(500);
    }
    assert.ok(ready, 'production test server starts');
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /content security policy|refused to execute/i.test(message.text())) errors.push(message.text()); });
    const response = await page.goto(`${origin}/auth?mode=signup`);
    const policy = response.headers()['content-security-policy'];
    assert.match(policy, /script-src[^;]*'nonce-/);
    assert.doesNotMatch(policy.match(/script-src[^;]*/)[0], /unsafe-inline|unsafe-eval/);
    await page.getByLabel('Your name', { exact: true }).fill('Browser Test');
    await page.getByLabel('Email', { exact: true }).fill(`browser-${Date.now()}@example.invalid`);
    await page.getByLabel('Password', { exact: true }).fill('Browser-Test-Password-123!');
    await page.getByRole('checkbox').nth(0).check();
    await page.getByRole('checkbox').nth(1).check();
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.waitForURL('**/apps');
    const created = await context.request.post(`${origin}/api/apps`, { headers: { Origin: origin }, data: { name: 'Browser coffee', templateId: 'coffee', kind: 'mobile' } });
    assert.equal(created.status(), 200);
    const app = await created.json();
    const appId = (app.app || app).id;
    await page.goto(`${origin}/editor/${appId}`);
    await page.getByRole('button', { name: 'Preview app', exact: true }).waitFor();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `editor fits ${width}px`);
      await page.getByRole('button', { name: 'Publish', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `publish dialog fits ${width}px`);
      assert.equal(await page.locator('[data-live-announcer]').evaluate(el => !!el.closest('[inert]')), false);
      await page.screenshot({ path: path.join(artifacts, `publish-${width}.png`) });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/preview/${appId}`);
    await page.locator('.rt-preview-chip').waitFor();
    const clearOfNavigation = await page.evaluate(() => {
      const chip = document.querySelector('.rt-preview-chip').getBoundingClientRect();
      const nav = [...document.querySelectorAll('.rt-pin-layer.bottom [data-el-id]')].map(el => el.getBoundingClientRect()).filter(rect => rect.height > 0);
      return nav.length > 0 && nav.every(rect => chip.bottom <= rect.top) && document.documentElement.scrollWidth <= innerWidth + 1;
    });
    assert.ok(clearOfNavigation, 'phone preview chip clears the bottom navigation');
    await page.screenshot({ path: path.join(artifacts, 'preview-mobile.png') });
    // Anonymous clients cannot open the synthetic private editor or draft.
    const anonymous = await browser.newContext();
    const draft = await anonymous.request.get(`${origin}/api/apps/${appId}`);
    assert.equal(draft.status(), 401);
    assert.deepEqual(errors, [], 'no browser runtime or script-policy errors');
    console.log(`PASS production signup, CSP hydration, private draft authorization, editor/publish at 320/390/768/1440px, modal announcer and phone preview. Screenshots: ${artifacts}`);
  } catch (error) {
    fs.writeFileSync(path.join(artifacts, 'server.log'), serverLog);
    console.error(`Browser verification artifacts: ${artifacts}`);
    throw error;
  } finally {
    if (browser) await browser.close();
    server.kill();
    await Promise.race([new Promise(resolve => server.once('exit', resolve)), delay(3000)]);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
