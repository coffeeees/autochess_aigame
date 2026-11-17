// 모듈 Web Worker 진입점: 브라우저 Worker 전역을 전투 호스트에 연결한다.
import { createCombatWorkerHost } from './combat-worker-host.js';

const host = createCombatWorkerHost({
  postMessage: (data) => self.postMessage(data),
  now: () => Date.now(),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
  random: Math.random,
});
self.onmessage = (event) => host.onmessage(event);
