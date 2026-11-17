// Battle extension points. Item, augment and bond effects and VFX recording are
// registered here instead of overwriting Battle.prototype methods.
//
// Two kinds of hooks:
//   around: middleware for a Battle method. handler(inner, ...args) runs with `this`
//           = the battle and calls inner(...args) for the next layer. Layers are
//           ordered by `order` (lower = closer to the core method), so the chain is
//           fixed no matter in which order extensions are registered.
//   on:     event handlers, { event: { order, run(battle) } }, run in ascending order.
//
// Current order (see each module's `extension`):
//   around  item-effects 10 -> augment-effects 20 -> vfx-events 90 (outermost)
//   start   bond-effects 10 -> item-effects 20 -> augment-effects 30
//   update  item-effects 10 -> augment-effects 20 -> bond-effects 30

export const AROUND = ['stats', 'heal', 'summon', 'kill', 'cast', 'deal', 'log'];
export const EVENTS = ['start', 'update'];

let version = 0;

/** Extensions registered on Class and its ancestors, base first, without duplicates. */
function extensionsOf(Class) {
  const chain = [];
  for (let c = Class; c && c !== Function.prototype; c = Object.getPrototypeOf(c))
    if (Object.hasOwn(c, 'extensions')) chain.unshift(...c.extensions);
  return chain;
}

function compose(Class, name) {
  let fn = Class.coreMethods[name];
  const layers = extensionsOf(Class)
    .filter((ext) => ext.around?.[name])
    .sort((a, b) => a.order - b.order);
  for (const ext of layers) {
    const handler = ext.around[name],
      inner = fn;
    fn = function (...args) {
      return handler.call(this, (...next) => inner.apply(this, next), ...args);
    };
  }
  return fn;
}

function cached(Class, key, build) {
  if (!Object.hasOwn(Class, 'hookCache') || Class.hookCache.version !== version)
    Class.hookCache = { version, entries: new Map() };
  const entries = Class.hookCache.entries;
  if (!entries.has(key)) entries.set(key, build());
  return entries.get(key);
}

/** Turn the AROUND methods of Battle into dispatchers and add Battle.use / emit. */
export function enableHooks(Battle) {
  Battle.coreMethods = Object.fromEntries(AROUND.map((name) => [name, Battle.prototype[name]]));
  for (const name of AROUND)
    Battle.prototype[name] = function (...args) {
      return cached(this.constructor, name, () => compose(this.constructor, name)).apply(
        this,
        args,
      );
    };
  Battle.prototype.emit = function (event) {
    const handlers = cached(this.constructor, 'on:' + event, () =>
      extensionsOf(this.constructor)
        .filter((ext) => ext.on?.[event])
        .map((ext) => ext.on[event])
        .sort((a, b) => a.order - b.order),
    );
    for (const h of handlers) h.run(this);
  };
  /** Register an extension on this class (and its subclasses). Idempotent by name. */
  Battle.use = function (extension) {
    if (extensionsOf(this).some((ext) => ext.name === extension.name)) return;
    if (!Object.hasOwn(this, 'extensions')) this.extensions = [];
    this.extensions.push(extension);
    version++;
  };
  Battle.extensions = [];
}
