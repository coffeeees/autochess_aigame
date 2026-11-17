// Module Web Worker entry: wires the browser worker globals into the combat host.
import { createCombatWorkerHost } from './combat-worker-host.js';

const host = createCombatWorkerHost({
  postMessage: (data) => self.postMessage(data),
  now: () => Date.now(),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
  random: Math.random,
});
self.onmessage = (event) => host.onmessage(event);
