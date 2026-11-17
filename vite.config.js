import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import legacyScripts from './tools/vite-legacy-scripts.js';

export default defineConfig({
  // relative URLs so the build works from any static folder
  base: './',
  plugins: [preact(), legacyScripts({ dir: 'src/legacy' })],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // index.html: current UI; next.html: the UI being rebuilt (stage 5)
    rollupOptions: { input: { main: 'index.html', next: 'next.html' } },
  },
  test: {
    include: ['tests/**/*.test.{js,ts}'],
    environment: 'node',
    setupFiles: ['tests/setup/legacy-globals.js'],
    // Each test file gets its own process: several suites patch shared legacy
    // modules (e.g. bond-effects.init, Battle.prototype) through require().
    pool: 'forks',
    isolate: true,
  },
});
