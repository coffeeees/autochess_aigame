// 기존 화면(legacy.html)의 진입점. 기존 화면 스크립트보다 먼저 실행된다(모듈 스크립트와
// defer 스크립트는 문서 순서대로 실행).
import { installLegacyGlobals } from './legacy-globals.js';

installLegacyGlobals(window);
// 새 원정 시드는 여기서 만든다(src/core는 Math.random이나 crypto를 쓰지 않는다).
window.AutoNewSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
window.AutoCreateCombatWorker = () =>
  new Worker(new URL('./worker/combat.worker.js', import.meta.url), { type: 'module' });
