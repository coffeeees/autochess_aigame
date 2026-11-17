// Seeded random numbers for all game logic. Nothing in src/core may call Math.random.
//
// The generator is mulberry32: its whole state is one uint32, so it can live in
// plain data (the run state in saves, a Battle sent to the worker) and continue
// exactly where it stopped after a reload or a transfer.

/** Advance a uint32 state; returns [value in [0, 1), next state]. */
export function step(state) {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** A standalone generator: rng() -> [0, 1). rng.state() reads the current state. */
export function createRng(seed) {
  let state = seed >>> 0;
  const rng = () => {
    const [value, next] = step(state);
    state = next;
    return value;
  };
  rng.state = () => state;
  return rng;
}

/**
 * A generator whose state is stored on `holder[key]`, so it is saved/cloned with
 * the holder. `initialSeed()` runs on the first draw only if the key is missing;
 * creating the generator never mutates the holder.
 */
export function storedRng(holder, key, initialSeed) {
  return () => {
    if (!Number.isInteger(holder[key])) holder[key] = initialSeed() >>> 0;
    const [value, next] = step(holder[key]);
    holder[key] = next;
    return value;
  };
}

/** Deterministic uint32 from any JSON-serialisable value (FNV-1a over its JSON). */
export function seedFrom(value) {
  const text = JSON.stringify(value) ?? '';
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The run's generator, stored in state.rngState. New runs get a random seed from
 * the UI; saves from before v0.15.18-rebuild get a seed derived from their content
 * the first time something is drawn.
 */
export function runRng(state) {
  return storedRng(state, 'rngState', () => seedFrom(state));
}

/** Draw a uint32 seed (for a battle) from a generator. */
export function nextSeed(rng) {
  return Math.floor(rng() * 4294967296) >>> 0;
}

export default { step, createRng, storedRng, seedFrom, runRng, nextSeed };
