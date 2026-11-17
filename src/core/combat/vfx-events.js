const contexts = new WeakMap();
const sequences = new WeakMap();
function stamp(battle) {
  const sequence = (sequences.get(battle) || 0) + 1;
  sequences.set(battle, sequence);
  return { id: battle.time + ':' + sequence, atMs: Date.now() };
}
/** Battle hooks for vfx-events (see combat/hooks.js for ordering). */
const extension = {
  name: 'vfx-events',
  order: 90,
  around: {
    deal(inner, source, target, amount, type, options = {}) {
      const previous = contexts.get(this);
      contexts.set(this, {
        source,
        target,
        sourcePos: source?.pos,
        targetPos: target?.pos,
        kind: options.kind || 'skill',
        skillVisual: options.skillVisual,
      });
      try {
        return inner(source, target, amount, type, options);
      } finally {
        if (previous) contexts.set(this, previous);
        else contexts.delete(this);
      }
    },
    log(inner, kind, message, extra = {}) {
      if (kind !== 'damage' && kind !== 'evade') {
        const visual = ['heal', 'shield', 'skill', 'summon', 'death', 'chainLightning'].includes(
          kind,
        );
        return inner(kind, message, visual ? { ...extra, visual: stamp(this) } : extra);
      }
      const context = contexts.get(this);
      const source = this.units.find((unit) => unit.uid === extra.source) || context?.source;
      const target = this.units.find((unit) => unit.uid === extra.target) || context?.target;
      if (!source || !target) return inner(kind, message, extra);
      const sourcePos = context?.source === source ? context.sourcePos : source.pos;
      const targetPos = context?.target === target ? context.targetPos : target.pos;
      const columns = this.config.board.columns;
      const distance =
        Math.abs((sourcePos % columns) - (targetPos % columns)) +
        Math.abs(Math.floor(sourcePos / columns) - Math.floor(targetPos / columns));
      return inner(kind, message, {
        ...extra,
        visual: {
          ...stamp(this),
          source: source.uid,
          sourceId: source.id,
          sourceSummon: !!source.summon,
          sourcePos,
          targetPos,
          skillVisual: context?.skillVisual,
          attackKind: extra.attackKind || context?.kind || 'skill',
          ranged: source.stats.RNG > 1 || distance > 1,
        },
      });
    },
  },
};
/** Register on a Battle class (kept for callers of the old API). */
function install(Battle) {
  Battle.use(extension);
}
const api = {
  extension,
  install,
};

export default api;
