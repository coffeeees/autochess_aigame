import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import legacyScripts from './tools/vite-legacy-scripts.js';

export default defineConfig({
  // 상대 경로로 빌드해서 어느 정적 폴더에 두어도 동작하게 한다
  base: './',
  plugins: [preact(), legacyScripts({ dir: 'src/legacy' })],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // index.html: 새 UI(기본), legacy.html: 기존 UI(6단계 연출 이전까지 비교용으로 보관)
    rollupOptions: { input: { main: 'index.html', legacy: 'legacy.html' } },
  },
  test: {
    include: ['tests/**/*.test.{js,ts}'],
    environment: 'node',
    setupFiles: ['tests/setup/legacy-globals.js'],
    // 테스트 파일마다 별도 프로세스: 몇몇 스위트가 공유 모듈(bond-effects.init,
    // Battle.prototype 등)을 덮어쓰기 때문.
    pool: 'forks',
    isolate: true,
  },
});
