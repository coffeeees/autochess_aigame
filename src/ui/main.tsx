// 새 UI(next.html)의 진입점. 기존 UI(index.html)는 새 UI가 기능 체크리스트를
// 모두 옮길 때까지 기본 화면으로 둔다.
import { render } from 'preact';
import './styles/tokens.css';
import './styles/base.css';
import { createStore } from './store.ts';
import { createCombatRunner } from './combat/runner.ts';
import { App } from './components/App.tsx';

// 전투는 모듈 Worker(src/worker/combat.worker.js)에서 계산한다
const combat = createCombatRunner({
  createWorker: () =>
    new Worker(new URL('../worker/combat.worker.js', import.meta.url), { type: 'module' }),
  now: () => Date.now(),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id as number),
  hidden: () => document.hidden,
});
document.addEventListener('visibilitychange', () => combat.visibility(document.hidden));
combat.warm();

const store = createStore({
  storage: localStorage,
  newSeed: () => crypto.getRandomValues(new Uint32Array(1))[0],
  combat,
});
store.load();
render(<App store={store} />, document.getElementById('app')!);
