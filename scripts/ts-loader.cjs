// Load project TypeScript in Node tests without emitting build files or adding dependencies.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function createLoader(overrides = {}) {
  const cache = new Map();
  return function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    const localRequire = (name) => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (!name.startsWith('@/') && !name.startsWith('.')) return require(name);
      const base = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(filename), name);
      for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
        if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return load(base + ext);
      }
      throw new Error(`Cannot resolve ${name} from ${filename}`);
    };
    new Function('require', 'module', 'exports', source)(localRequire, mod, mod.exports);
    return mod.exports;
  };
}
module.exports = { createLoader };
