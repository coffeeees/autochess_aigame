import { defineConfig } from 'vite';
import legacyScripts from './tools/vite-legacy-scripts.js';

export default defineConfig({
  // relative URLs so the build works from any static folder
  base: './',
  plugins: [legacyScripts({ dir: 'src/legacy' })],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    include: ['tests/**/*.test.{js,ts}'],
    environment: 'node',
    // Each test file gets its own process: several suites patch shared legacy
    // modules (e.g. bond-effects.init, Battle.prototype) through require().
    pool: 'forks',
    isolate: true,
  },
});
