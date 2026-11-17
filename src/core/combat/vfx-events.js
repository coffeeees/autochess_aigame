const installed = new WeakSet();
const contexts = new WeakMap();
const sequences = new WeakMap();
function stamp(battle) {
  const sequence = (sequences.get(battle) || 0) + 1;
  sequences.set(battle, sequence);
  return { id: battle.time + ':' + sequence, atMs: Date.now() };
}
function install(Battle) {
  if (installed.has(Battle)) return;
  installed.add(Battle);
  const deal = Battle.prototype.deal;
  const log = Battle.prototype.log;

  // Read-only event geometry, captured before nested item/skill damage can move on.
  Battle.prototype.deal = function (source, target, amount, type, options = {}) {
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
      return deal.call(this, source, target, amount, type, options);
    } finally {
      if (previous) contexts.set(this, previous);
      else contexts.delete(this);
    }
  };
  Battle.prototype.log = function (kind, message, extra = {}) {
    if (kind !== 'damage' && kind !== 'evade') {
      const visual = ['heal', 'shield', 'skill', 'summon', 'death', 'chainLightning'].includes(
        kind,
      );
      return log.call(this, kind, message, visual ? { ...extra, visual: stamp(this) } : extra);
    }
    const context = contexts.get(this);
    const source = this.units.find((unit) => unit.uid === extra.source) || context?.source;
    const target = this.units.find((unit) => unit.uid === extra.target) || context?.target;
    if (!source || !target) return log.call(this, kind, message, extra);
    const sourcePos = context?.source === source ? context.sourcePos : source.pos;
    const targetPos = context?.target === target ? context.targetPos : target.pos;
    const columns = this.config.board.columns;
    const distance =
      Math.abs((sourcePos % columns) - (targetPos % columns)) +
      Math.abs(Math.floor(sourcePos / columns) - Math.floor(targetPos / columns));
    return log.call(this, kind, message, {
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
  };
}
const api = { install };

export default api;
