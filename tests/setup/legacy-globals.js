// Legacy UI modules required by tests read their core dependencies from globals,
// as they do in the page. VFX recording is not installed globally here; tests
// that need it install it themselves, as before.
import { installLegacyGlobals } from '../../src/legacy-globals.js';

installLegacyGlobals(globalThis, { vfx: false });
