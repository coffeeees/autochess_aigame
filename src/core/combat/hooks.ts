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

export const AROUND = ['stats', 'heal', 'summon', 'kill', 'cast', 'deal', 'log'] as const;
export const EVENTS = ['start', 'update'] as const;
export type AroundName = (typeof AROUND)[number];
export type EventName = (typeof EVENTS)[number];

// The Battle class is still plain JS; hooks only need `this` to be an object.
type Method = (this: object, ...args: any[]) => any;
type AroundHandler = (this: object, inner: (...args: any[]) => any, ...args: any[]) => any;

export interface EventHandler {
  order: number;
  run: (battle: object) => void;
}

export interface Extension {
  name: string;
  /** position of this extension's around-layers (lower = closer to the core method) */
  order?: number;
  around?: Partial<Record<AroundName, AroundHandler>>;
  on?: Partial<Record<EventName, EventHandler>>;
}

export interface HookedClass extends Function {
  prototype: Record<string, unknown>;
  coreMethods?: Record<AroundName, Method>;
  extensions?: Extension[];
  hookCache?: { version: number; entries: Map<string, unknown> };
  use?: (this: HookedClass, extension: Extension) => void;
}

let version = 0;

/** Extensions registered on Class and its ancestors, base first, without duplicates. */
function extensionsOf(Class: HookedClass): Extension[] {
  const chain: Extension[] = [];
  for (
    let c: HookedClass | null = Class;
    c && c !== Function.prototype;
    c = Object.getPrototypeOf(c) as HookedClass | null
  )
    if (Object.hasOwn(c, 'extensions')) chain.unshift(...(c.extensions as Extension[]));
  return chain;
}

function compose(Class: HookedClass, name: AroundName): Method {
  let fn = (Class.coreMethods as Record<AroundName, Method>)[name];
  const layers = extensionsOf(Class)
    .filter((ext) => ext.around?.[name])
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const ext of layers) {
    const handler = ext.around![name]!,
      inner = fn;
    fn = function (this: object, ...args: any[]) {
      return handler.call(this, (...next: any[]) => inner.apply(this, next), ...args);
    };
  }
  return fn;
}

function cached<T>(Class: HookedClass, key: string, build: () => T): T {
  if (!Object.hasOwn(Class, 'hookCache') || Class.hookCache!.version !== version)
    Class.hookCache = { version, entries: new Map() };
  const entries = Class.hookCache!.entries;
  if (!entries.has(key)) entries.set(key, build());
  return entries.get(key) as T;
}

/** Turn the AROUND methods of Battle into dispatchers and add Battle.use / emit. */
export function enableHooks(Battle: HookedClass): void {
  Battle.coreMethods = Object.fromEntries(
    AROUND.map((name) => [name, Battle.prototype[name] as Method]),
  ) as Record<AroundName, Method>;
  for (const name of AROUND)
    Battle.prototype[name] = function (this: object, ...args: any[]) {
      const Class = this.constructor as HookedClass;
      return cached(Class, name, () => compose(Class, name)).apply(this, args);
    };
  Battle.prototype.emit = function (this: object, event: EventName) {
    const Class = this.constructor as HookedClass;
    const handlers = cached(Class, 'on:' + event, () =>
      extensionsOf(Class)
        .filter((ext) => ext.on?.[event])
        .map((ext) => ext.on![event]!)
        .sort((a, b) => a.order - b.order),
    );
    for (const h of handlers) h.run(this);
  };
  /** Register an extension on this class (and its subclasses). Idempotent by name. */
  Battle.use = function (this: HookedClass, extension: Extension) {
    if (extensionsOf(this).some((ext) => ext.name === extension.name)) return;
    if (!Object.hasOwn(this, 'extensions')) this.extensions = [];
    this.extensions!.push(extension);
    version++;
  };
  Battle.extensions = [];
}
