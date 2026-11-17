'use strict';
importScripts(
  'higher-cost-drafts.js',
  'board.js',
  'bonds.js',
  'data.js',
  'items.js',
  'augments.js',
  'progression.js',
  'encounters.js',
  'item-effects.js',
  'augment-effects.js',
  'bond-effects.js',
  'engine.js',
  'vfx-events.js',
  'combat-clock.js',
);
let simulation = null,
  clock = null,
  timer = null,
  hidden = false,
  lastSent = 0,
  kills = [],
  prepared = null,
  pendingEvents = [],
  timing = {};
function snapshot() {
  const { rng, onUnitKilled, ...data } = simulation;
  postMessage({
    battle: { ...data, events: pendingEvents },
    kills,
    timing: { ...timing, snapshotAt: Date.now() },
  });
  pendingEvents = [];
  kills = [];
  lastSent = Date.now();
}
function pump() {
  if (!simulation || !clock) return;
  const ticks = clock.advance(Date.now());
  for (let i = 0; i < ticks && !simulation.result; i++) {
    if (timing.firstTickAt === undefined) timing.firstTickAt = Date.now();
    simulation.tick();
    pendingEvents.push(...simulation.events);
    if (pendingEvents.length > 1600) pendingEvents.splice(0, pendingEvents.length - 1600);
  }
  if (simulation.result || (ticks > 0 && (!hidden || Date.now() - lastSent >= 1000))) snapshot();
  if (simulation.result) {
    clearInterval(timer);
    timer = null;
  }
}
onmessage = ({ data }) => {
  if (data.type === 'prepare') {
    clearInterval(timer);
    timer = null;
    clock = null;
    prepared = data;
    timing = { preparedAt: Date.now() };
    simulation = Object.assign(Object.create(AutoEngine.Battle.prototype), data.battle);
    pendingEvents = [...simulation.events];
    simulation.rng = Math.random;
    simulation.onUnitKilled = (unit, source) => kills.push({ unit, source });
    hidden = data.hidden;
    postMessage({ type: 'ready', preparedAt: Date.now() });
    return;
  }
  if (data.type === 'begin' && prepared) {
    timing.beginAt = Date.now();
    clock = new AutoCombatClock.StepClock(
      data.now,
      simulation.config.combat.tickSeconds * 1000,
      data.speed,
    );
    clock.paused = !!data.paused;
    prepared = null;
    snapshot();
    timer = setInterval(pump, 50);
    return;
  }
  if (data.type === 'start') {
    clearInterval(timer);
    simulation = Object.assign(Object.create(AutoEngine.Battle.prototype), data.battle);
    simulation.rng = Math.random;
    simulation.onUnitKilled = (unit, source) => kills.push({ unit, source });
    clock = new AutoCombatClock.StepClock(
      data.now,
      simulation.config.combat.tickSeconds * 1000,
      data.speed,
    );
    hidden = data.hidden;
    timer = setInterval(pump, 50);
    pump();
    return;
  }
  if (!simulation) return;
  if (!clock) {
    if (data.type === 'visibility') hidden = data.hidden;
    return;
  }
  pump();
  if (data.type === 'speed') clock.speed = data.speed;
  if (data.type === 'pause') clock.paused = true;
  if (data.type === 'resume') {
    clock.last = Date.now();
    clock.paused = false;
  }
  if (data.type === 'visibility') {
    hidden = data.hidden;
    if (!hidden) snapshot();
  }
};
