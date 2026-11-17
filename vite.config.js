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
  },
});
