'use strict';
let idleCombatWorker = null;
function makeCombatWorker() {
  const embedded = typeof AutoCombatWorkerSource === 'string',
    url = embedded
      ? URL.createObjectURL(new Blob([AutoCombatWorkerSource], { type: 'text/javascript' }))
      : 'combat-worker.js';
  const worker = new Worker(url);
  if (embedded) URL.revokeObjectURL(url);
  return worker;
}
function warmCombatWorker() {
  if (typeof Worker === 'undefined' || idleCombatWorker || combatWorker) return;
  try {
    idleCombatWorker = makeCombatWorker();
    idleCombatWorker.onerror = () => {
      idleCombatWorker?.terminate();
      idleCombatWorker = null;
    };
  } catch {
    idleCombatWorker = null;
  }
}
let combatWorker = null,
  workerBattle = null,
  combatRenderFrame = null,
  pendingCombatEvents = [];
function paintCombat() {
  combatRenderFrame = null;
  if (!battle || document.hidden || $('gameView').hidden) return;
  $('clock').textContent = `${battle.time.toFixed(1)}초 · ${speed}배속`;
  renderBoard();
  getCombatView().consume(battle, battle.events);
  pendingCombatEvents = [];
  renderDetail();
  renderDebug();
  positionCombatDamage();
  if (!battle.startupFirstPaint && battle.time > 0) {
    battle.startupFirstPaint = true;
    globalThis.performance?.mark('autochess:first-tick-frame');
  }
}
function requestCombatPaint() {
  if (!document.hidden && combatRenderFrame === null)
    combatRenderFrame = requestAnimationFrame(paintCombat);
}
function stopCombatClock(pause = false) {
  if (pause) {
    combatWorker?.postMessage({ type: 'pause' });
    return;
  }
  combatWorker?.terminate();
  combatWorker = null;
  workerBattle = null;
  pendingCombatEvents = [];
  if (combatRenderFrame !== null) cancelAnimationFrame(combatRenderFrame);
  combatRenderFrame = null;
}
function startCombatWorker() {
  if (typeof Worker === 'undefined') return false;
  if (combatWorker && workerBattle === battle) {
    combatWorker.postMessage({ type: 'speed', speed });
    combatWorker.postMessage({ type: 'resume' });
    return true;
  }
  stopCombatClock();
  workerBattle = battle;
  const owner = battle;
  let firstSnapshot = true,
    waiting = true;
  globalThis.performance?.mark('autochess:worker-start');
  try {
    combatWorker = idleCombatWorker || makeCombatWorker();
    idleCombatWorker = null;
    $('clock').textContent = '전투 준비 중';
    if ($('phase')) $('phase').textContent = '전투 준비 중';
    combatWorker.onmessage = ({ data }) => {
      if (battle !== owner) return;
      if (data.type === 'ready') {
        globalThis.performance?.mark('autochess:worker-ready');
        const begin = () => {
          if (battle !== owner || !waiting) return;
          waiting = false;
          if ($('phase')) $('phase').textContent = '자동 전투 중';
          globalThis.performance?.mark('autochess:simulation-begin');
          combatWorker?.postMessage({
            type: 'begin',
            now: Date.now(),
            speed,
            paused: $('gameView').hidden,
          });
        };
        if (document.hidden) begin();
        else
          requestAnimationFrame(() => {
            if (battle !== owner) return;
            paintCombat();
            globalThis.performance?.mark('autochess:initial-actors-frame');
            requestAnimationFrame(begin);
          });
        return;
      }
      globalThis.AutoCombatStartup = {
        ...(data.timing || {}),
        receivedAt: Date.now(),
        simulationTime: data.battle.time,
      };
      if (firstSnapshot) {
        firstSnapshot = false;
        globalThis.performance?.mark('autochess:worker-first-snapshot');
        globalThis.performance?.measure(
          'autochess:worker-first-snapshot',
          'autochess:worker-start',
          'autochess:worker-first-snapshot',
        );
      }
      if (data.battle.time > 0 && !owner.startupFirstTick) {
        owner.startupFirstTick = true;
        globalThis.performance?.mark('autochess:first-tick-received');
      }
      pendingCombatEvents.push(...(data.battle.events || []));
      if (pendingCombatEvents.length > 1600)
        pendingCombatEvents.splice(0, pendingCombatEvents.length - 1600);
      Object.assign(owner, data.battle);
      owner.events = pendingCombatEvents;
      for (const kill of data.kills) owner.onUnitKilled?.(kill.unit, kill.source);
      if (owner.result) {
        if (!document.hidden && !$('gameView').hidden) paintCombat();
        endBattle(owner.result);
      } else requestCombatPaint();
    };
    combatWorker.onerror = () => {
      if (battle !== owner) return;
      stopCombatClock();
      if ($('phase')) $('phase').textContent = '자동 전투 중';
      runTimer(true);
    };
    combatWorker.postMessage({
      type: 'prepare',
      battle: JSON.parse(JSON.stringify(owner)),
      now: Date.now(),
      speed,
      hidden: document.hidden,
    });
    return true;
  } catch {
    stopCombatClock();
    if ($('phase')) $('phase').textContent = '자동 전투 중';
    return false;
  }
}
document.addEventListener('visibilitychange', () => {
  combatWorker?.postMessage({ type: 'visibility', hidden: document.hidden });
  combatView?.clearTransient();
  if (document.hidden || $('gameView').hidden) return;
  if (battle) requestCombatPaint();
  else if (state?.roundPhase === 'result' && !$('modal').open) showResult(state.lastResult);
});
