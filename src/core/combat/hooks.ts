// 전투 확장 지점. 아이템·증강·유대 효과와 VFX 기록은 Battle.prototype 메서드를
// 덮어쓰지 않고 여기에 등록한다.
//
// 훅은 두 종류:
//   around: Battle 메서드를 감싸는 미들웨어. handler(inner, ...args)는 `this` = 전투로
//           실행되고 inner(...args)로 다음 층을 부른다. 층은 `order` 순(낮을수록 원래
//           메서드에 가까움)이라서, 등록 순서와 상관없이 감싸는 순서가 고정된다.
//   on:     이벤트 처리기 { 이벤트: { order, run(battle) } }, order 오름차순으로 실행.
//
// 현재 순서(각 모듈의 `extension` 참고):
//   around  item-effects 10 -> meta-effects 15 -> augment-effects 20 -> vfx-events 90 (outermost)
//   start   augment-setup 5(희생·조합 단계 올림) -> meta-effects 7(메타 영구 강화) -> bond-effects 10
//           -> item-effects 20 -> augment-effects 30
//   update  item-effects 10 -> augment-effects 20 -> bond-effects 30

export const AROUND = ['stats', 'heal', 'summon', 'kill', 'cast', 'deal', 'log'] as const;
export const EVENTS = ['start', 'update'] as const;
export type AroundName = (typeof AROUND)[number];
export type EventName = (typeof EVENTS)[number];

// Battle 클래스는 아직 JS라서, 훅은 `this`가 객체이기만 하면 된다.
type Method = (this: object, ...args: any[]) => any;
type AroundHandler = (this: object, inner: (...args: any[]) => any, ...args: any[]) => any;

export interface EventHandler {
  order: number;
  run: (battle: object) => void;
}

export interface Extension {
  name: string;
  /** 이 확장의 around 층 위치(낮을수록 원래 메서드에 가까움) */
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

/** Class와 그 조상에 등록된 확장(기본 클래스 먼저, 중복 없음). */
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

/** Battle의 AROUND 메서드를 분배 함수로 바꾸고 Battle.use / emit을 추가한다. */
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
  /** 이 클래스(와 하위 클래스)에 확장을 등록한다. 같은 이름은 한 번만 등록된다. */
  Battle.use = function (this: HookedClass, extension: Extension) {
    if (extensionsOf(this).some((ext) => ext.name === extension.name)) return;
    if (!Object.hasOwn(this, 'extensions')) this.extensions = [];
    this.extensions!.push(extension);
    version++;
  };
  Battle.extensions = [];
}
