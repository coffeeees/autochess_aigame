import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  // 상대 경로로 빌드해서 어느 정적 폴더에 두어도 동작하게 한다
  base: './',
  plugins: [preact()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    include: ['tests/**/*.test.{js,ts}'],
    environment: 'node',
    // 테스트 파일마다 별도 프로세스: 몇몇 스위트가 공유 모듈(bond-effects.init,
    // Battle.prototype 등)을 덮어쓰기 때문.
    pool: 'forks',
    isolate: true,
  },
});
