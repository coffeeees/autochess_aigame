// Runs the combat worker host against a vm-style test context that provides the
// worker globals (postMessage, Date, setInterval, clearInterval and optionally
// Math), then exposes `onmessage` on that context like the real worker scope.
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
