// Worker 전역(postMessage, Date, setInterval, clearInterval, 필요하면 Math)을 가진
// vm 형태의 테스트 컨텍스트에 전투 Worker 호스트를 연결하고, 실제 Worker처럼 그
// 컨텍스트에 `onmessage`를 붙인다.
import { createCombatWorkerHost } from '../../src/worker/combat-worker-host.js';

export function installCombatWorker(ctx) {
  const host = createCombatWorkerHost({
    postMessage: (data) => ctx.postMessage(data),
    now: () => (ctx.Date || Date).now(),
    setInterval: (fn, ms) => ctx.setInterval(fn, ms),
    clearInterval: (id) => ctx.clearInterval(id),
    random: () => (ctx.Math || Math).random(),
  });
  ctx.onmessage = host.onmessage;
  return host;
}
