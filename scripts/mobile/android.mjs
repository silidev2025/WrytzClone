import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const source = fileURLToPath(new URL('../../mobile/android/MainActivity.java', import.meta.url));
const exe = (name) => process.platform === 'win32' ? `${name}.exe` : name;
const xml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

export function run(command, args, { cwd, signal, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, signal, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { output = (output + chunk).slice(-12000); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(output) : reject(new Error(`${path.basename(command)} exited with ${code}: ${output}`)));
  });
}

export async function androidTools() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.platform === 'win32' ? path.join(os.homedir(), 'AppData/Local/Android/Sdk') : path.join(os.homedir(), process.platform === 'darwin' ? 'Library/Android/sdk' : 'Android/Sdk'));
  const versions = (await fs.readdir(path.join(sdk, 'build-tools'))).filter((v) => /^\d+\.\d+\.\d+$/.test(v)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const build = path.join(sdk, 'build-tools', process.env.CRAFTBASE_ANDROID_BUILD_TOOLS || versions[0] || 'missing');
  const platform = path.join(sdk, 'platforms', 'android-35', 'android.jar');
  const java = (name) => process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', exe(name)) : exe(name);
  await Promise.all([platform, path.join(build, exe('aapt2')), path.join(build, 'lib/d8.jar'), path.join(build, 'lib/apksigner.jar'), path.join(build, exe('zipalign'))].map((p) => fs.access(p)));
  await run(java('javac'), ['-version']);
  return { build, platform, java };
}

/** Build a small, signed WebView APK using official SDK tools. No Gradle downloads or cloud account. */
export async function buildAndroid(job, workDir, keyDir, signal) {
  const tools = await androidTools();
  const appHash = crypto.createHash('sha256').update(job.appId).digest('hex').slice(0, 24);
  const packageName = `com.craftbase.apps.a${appHash}`;
  for (const value of [job.appUrl, job.platformUrl]) if (new URL(value).protocol !== 'https:') throw new Error('Mobile apps require HTTPS.');
  await fs.mkdir(workDir, { recursive: true });
  await fs.mkdir(keyDir, { recursive: true, mode: 0o700 });
  for (const dir of ['assets', 'classes', 'dex', 'res/drawable', 'compiled']) await fs.mkdir(path.join(workDir, dir), { recursive: true });
  await fs.copyFile(source, path.join(workDir, 'MainActivity.java'));
  await fs.writeFile(path.join(workDir, 'assets/deployment.json'), JSON.stringify({ appUrl: job.appUrl, platformUrl: job.platformUrl }));
  // A per-app key makes later test APKs install as updates. Keep the worker's keys directory private and backed up.
  const key = path.join(keyDir, `${appHash}.p12`);
  const passwordFile = path.join(keyDir, `${appHash}.password`);
  try { await fs.access(key); }
  catch {
    try { await fs.writeFile(passwordFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' }); }
    catch (err) { if (err.code !== 'EEXIST') throw err; }
    const temporaryKey = path.join(workDir, 'signing.p12');
    await run(tools.java('keytool'), ['-genkeypair', '-keystore', temporaryKey, '-storetype', 'PKCS12', '-storepass:file', passwordFile, '-alias', 'testing', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '3650', '-dname', 'CN=Craftbase Testing', '-noprompt'], { signal });
    await fs.rename(temporaryKey, key);
    await fs.chmod(key, 0o600);
  }
  await fs.access(passwordFile);
  const versionCode = Math.max(1, Math.floor(Date.now() / 1000) - 1700000000);
  await fs.writeFile(path.join(workDir, 'AndroidManifest.xml'), `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="${packageName}" android:versionCode="${versionCode}" android:versionName="test-r${Number(job.revision)}">
  <uses-sdk android:minSdkVersion="26" android:targetSdkVersion="35" />
  <uses-permission android:name="android.permission.INTERNET" />
  <application android:label="${xml(job.appName)}" android:icon="@drawable/icon" android:theme="@android:style/Theme.Material.Light.NoActionBar" android:allowBackup="false" android:usesCleartextTraffic="false" android:debuggable="false" android:enableOnBackInvokedCallback="false">
    <activity android:name="com.craftbase.preview.MainActivity" android:exported="true" android:windowSoftInputMode="adjustResize">
      <intent-filter><action android:name="android.intent.action.MAIN" /><category android:name="android.intent.category.LAUNCHER" /></intent-filter>
    </activity>
  </application>
</manifest>`);
  await fs.writeFile(path.join(workDir, 'res/drawable/icon.xml'), '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#6C47FF" android:pathData="M0,0h108v108H0z"/><path android:fillColor="#FFFFFF" android:pathData="M76,32L66,42A18,18 0,1 0,66 66L76,76A32,32 0,1 1,76 32Z"/></vector>');
  const opts = { cwd: workDir, signal };
  await run(path.join(tools.build, exe('aapt2')), ['compile', '--dir', 'res', '-o', 'compiled'], opts);
  const resources = (await fs.readdir(path.join(workDir, 'compiled'))).map((name) => path.join('compiled', name));
  await run(path.join(tools.build, exe('aapt2')), ['link', '-o', 'unsigned.apk', '-I', tools.platform, '--manifest', 'AndroidManifest.xml', '-A', 'assets', ...resources], opts);
  await run(tools.java('javac'), ['-encoding', 'UTF-8', '-source', '8', '-target', '8', '-classpath', tools.platform, '-d', 'classes', 'MainActivity.java'], opts);
  const classDir = path.join(workDir, 'classes/com/craftbase/preview');
  const classes = (await fs.readdir(classDir)).filter((name) => name.endsWith('.class')).map((name) => path.join(classDir, name));
  await run(tools.java('java'), ['-cp', path.join(tools.build, 'lib/d8.jar'), 'com.android.tools.r8.D8', '--lib', tools.platform, '--min-api', '26', '--output', 'dex', ...classes], opts);
  await run(tools.java('jar'), ['uf', 'unsigned.apk', '-C', 'dex', 'classes.dex'], opts);
  await run(path.join(tools.build, exe('zipalign')), ['-f', '4', 'unsigned.apk', 'aligned.apk'], opts);
  await run(tools.java('java'), ['-jar', path.join(tools.build, 'lib/apksigner.jar'), 'sign', '--ks', key, '--ks-pass', `file:${passwordFile}`, '--out', 'app.apk', 'aligned.apk'], opts);
  await run(tools.java('java'), ['-jar', path.join(tools.build, 'lib/apksigner.jar'), 'verify', '--verbose', 'app.apk'], opts);
  return path.join(workDir, 'app.apk');
}
