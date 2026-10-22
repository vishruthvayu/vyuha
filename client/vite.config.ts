import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const python = resolve(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
let source = { commit: 'unavailable', source_hash: 'unavailable', working_tree_source_dirty: true };
try {
  if (existsSync(python)) source = {
    working_tree_source_dirty: !!execFileSync('git', ['status', '--porcelain', '--', 'server', 'client/src', 'client/public', 'client/scripts', 'scripts', 'examples', 'client/vite.config.ts', 'client/package.json', 'client/package-lock.json', 'Dockerfile', '.github/workflows'], { cwd: root, encoding: 'utf8' }).trim(),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    source_hash: execFileSync(python, ['-c', 'from server.evidence import source_hash; print(source_hash())'], { cwd: root, encoding: 'utf8' }).trim(),
  };
} catch { console.warn('Build source provenance unavailable; diagnostics will disclose this.'); }
export default defineConfig({
  plugins: [react()],
  define: { __VYUHA_BUILD__: JSON.stringify(source) },
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8000' } },
});
