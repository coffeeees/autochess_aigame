// Browser entry. Runs before the legacy UI scripts (module scripts and defer
// scripts execute in document order).
import { installLegacyGlobals } from './legacy-globals.js';

installLegacyGlobals(window);
// New runs are seeded here (src/core never touches Math.random or crypto).
window.AutoNewSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
window.AutoCreateCombatWorker = () =>
  new Worker(new URL('./worker/combat.worker.js', import.meta.url), { type: 'module' });
