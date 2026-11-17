// Combat simulation that runs inside the Web Worker (moved from src/legacy/combat-worker.js).
// The environment (messaging, clock, timers, randomness) is injected so the same
// code runs in the real worker (combat.worker.js) and in tests.
import Engine from '../core/combat/battle.js';
import Clock from '../core/combat/clock.js';
import VfxEvents from '../core/combat/vfx-events.js';
import { storedRng } from '../core/rng.ts';

// A seeded battle (rngState) continues its own sequence; battles created with an
// explicit rng function cannot carry it over, so they use the injected random.
const workerRng = (battle, random) =>
  Number.isInteger(battle.rngState) ? storedRng(battle, 'rngState', () => 0) : random;

// Worker battles record VFX events. Installing on a subclass keeps the shared
// Battle class untouched when the host runs in the same realm (tests).
class WorkerBattle extends Engine.Battle {}
VfxEvents.install(WorkerBattle);

export function createCombatWorkerHost({ postMessage, now, setInterval, clearInterval, random }) {
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
      timing: { ...timing, snapshotAt: now() },
    });
    pendingEvents = [];
    kills = [];
    lastSent = now();
  }
  function pump() {
    if (!simulation || !clock) return;
    const ticks = clock.advance(now());
    for (let i = 0; i < ticks && !simulation.result; i++) {
      if (timing.firstTickAt === undefined) timing.firstTickAt = now();
      simulation.tick();
      pendingEvents.push(...simulation.events);
      if (pendingEvents.length > 1600) pendingEvents.splice(0, pendingEvents.length - 1600);
    }
    if (simulation.result || (ticks > 0 && (!hidden || now() - lastSent >= 1000))) snapshot();
    if (simulation.result) {
      clearInterval(timer);
      timer = null;
    }
  }
  function onmessage({ data }) {
    if (data.type === 'prepare') {
      clearInterval(timer);
      timer = null;
      clock = null;
      prepared = data;
      timing = { preparedAt: now() };
      simulation = Object.assign(Object.create(WorkerBattle.prototype), data.battle);
      pendingEvents = [...simulation.events];
      simulation.rng = workerRng(simulation, random);
      simulation.onUnitKilled = (unit, source) => kills.push({ unit, source });
      hidden = data.hidden;
      postMessage({ type: 'ready', preparedAt: now() });
      return;
    }
    if (data.type === 'begin' && prepared) {
      timing.beginAt = now();
      clock = new Clock.StepClock(
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
      simulation = Object.assign(Object.create(WorkerBattle.prototype), data.battle);
      simulation.rng = workerRng(simulation, random);
      simulation.onUnitKilled = (unit, source) => kills.push({ unit, source });
      clock = new Clock.StepClock(
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
      clock.last = now();
      clock.paused = false;
    }
    if (data.type === 'visibility') {
      hidden = data.hidden;
      if (!hidden) snapshot();
    }
  }
  return { onmessage };
}
