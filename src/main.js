// Browser entry. Runs before the legacy UI scripts (module scripts and defer
// scripts execute in document order).
import { installLegacyGlobals } from './legacy-globals.js';

installLegacyGlobals(window);
window.AutoCreateCombatWorker = () =>
  new Worker(new URL('./worker/combat.worker.js', import.meta.url), { type: 'module' });
