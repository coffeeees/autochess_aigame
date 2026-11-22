// 화면 연출의 순수 계산(시간·수치). 컴포넌트(ScreenCues, VitalEffects)와 테스트가 함께 쓴다.

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const cueDurations = {
  round: (reduced: boolean) => (reduced ? 600 : 2200),
  stage: (reduced: boolean) => (reduced ? 350 : 1600),
  health: (reduced: boolean) => (reduced ? 500 : 3000),
  mergeFlight: (reduced: boolean) => (reduced ? 120 : 900),
  mergeFlare: (reduced: boolean) => (reduced ? 180 : 680),
  /** 회수기(v0.20.0, 테스트용 임시값): 장비마다 100ms 간격으로 출발, 개당 500ms 이동, 도착 칸 260ms 발광. 움직임 줄이기면 생략 */
  recoveryStagger: (reduced: boolean) => (reduced ? 0 : 100),
  recoveryFlight: (reduced: boolean) => (reduced ? 0 : 500),
  recoveryGlow: (reduced: boolean) => (reduced ? 0 : 260),
};

/** 하트 안 물결(impact-health.js water) */
export function water(hp: number, time: number) {
  const y = 89 * (1 - hp / 100);
  const points: string[] = [];
  for (let x = 0; x <= 100; x += 2)
    points.push((x ? 'L' : 'M') + x + ' ' + (y + Math.sin(x * 0.12 + time * 0.005) * 2));
  return points.join(' ') + ' L100 100 L0 100Z';
}

/** 시작 뒤 elapsed ms에 보이는 체력(900ms 대기 후 800ms 동안 부드럽게) */
export function healthAt(before: number, after: number, elapsed: number, reduced: boolean) {
  const t = reduced ? 1 : Math.max(0, Math.min(1, (elapsed - 900) / 800));
  return before + (after - before) * t * t * (3 - 2 * t);
}

/** 줄어든 체력을 한 칸씩 세는 간격(ms): 차이가 커도 1.6초 안에 끝난다 */
export function countdownGap(before: number, after: number) {
  return Math.min(80, 1600 / Math.max(1, before - after));
}

export interface HealthCounterEnv {
  /** 보이는 숫자를 그린다(shake: 한 칸 줄어드는 중) */
  paint: (value: number, shake: boolean) => void;
  /** 줄어들기 시작할 때 한 번(하트 흔들림·조각). 정리 함수를 돌려준다 */
  burst?: () => (() => void) | void;
  later?: (fn: () => void, ms: number) => unknown;
  clear?: (id: unknown) => void;
  reduced?: () => boolean;
  visible?: () => boolean;
}

/**
 * HUD 체력 숫자(v0.15.18 health-effects.js create를 그대로 옮김). 표시 전용이다.
 * 줄어들 때만 한 칸씩 세고, 늘어나거나 움직임 줄이기·숨은 화면이면 바로 바꾼다.
 */
export function createHealthCounter({
  paint,
  burst = () => {},
  later = (fn, ms) => setTimeout(fn, ms),
  clear = (id) => clearTimeout(id as number),
  reduced = () => false,
  visible = () => true,
}: HealthCounterEnv) {
  let shown: number | null = null;
  let target: number | null = null;
  let timer: unknown = null;
  let cleanup: () => void = () => {};
  function stop() {
    if (timer !== null) clear(timer);
    timer = null;
    cleanup();
    cleanup = () => {};
  }
  function cancel() {
    stop();
    if (target !== null) {
      shown = target;
      paint(shown, false);
    }
  }
  function render(value: number) {
    value = Math.max(0, Math.trunc(value));
    if (value === target) return;
    stop();
    const before = shown;
    target = value;
    if (before === null || value >= before || reduced() || !visible()) {
      shown = value;
      paint(shown, false);
      return;
    }
    cleanup = burst() || (() => {});
    const gap = countdownGap(before, value);
    const step = () => {
      shown = Math.max(target!, shown! - 1);
      paint(shown, true);
      if (shown > target!) timer = later(step, gap);
      else {
        timer = null;
        cleanup();
        cleanup = () => {};
      }
    };
    timer = later(step, gap);
  }
  return {
    render,
    cancel,
    get displayed() {
      return shown;
    },
    get target() {
      return target;
    },
  };
}

/** 액체 XP 상태(liquid-xp.js의 계산을 그대로 옮김) */
export interface Liquid {
  level: number;
  xp: number;
  view: number;
  target: number;
  from: number;
  start: number | null;
  impact: number;
  flash: number;
  dots: { start: number; life: number; x: number; vx: number; vy: number }[];
}

export function observeLiquid(a: Liquid, level: number, xp: number, ratio: number, now: number) {
  if (level > a.level || (level === a.level && xp > a.xp)) {
    a.from = a.view;
    a.target = ratio;
    a.start = now;
    a.impact = now + 1000;
    if (level > a.level) {
      a.view = 1;
      a.from = 1;
      a.flash = now + 650;
      a.start = now + 350;
    }
    for (let i = 0; i < (level > a.level ? 24 : 12); i++)
      a.dots.push({
        start: now,
        life: 320 + (i % 6) * 55,
        x: (i + 0.5) / 24,
        vx: Math.cos(i * 2.4) * 25,
        vy: -20 - (i % 4) * 10,
      });
  } else if (level < a.level || xp < a.xp) {
    a.view = a.target = a.from = ratio;
    a.dots = [];
    a.flash = 0;
  } else if (a.start === null) a.view = a.target = ratio;
  a.level = level;
  a.xp = xp;
}

/** now 시점의 물 높이(0~1). 600ms 동안 ease-out으로 다가간다. */
export function liquidLevel(a: Liquid, now: number) {
  if (a.start !== null && now >= a.start) {
    const t = Math.min(1, (now - a.start) / 600);
    a.view = a.from + (a.target - a.from) * (1 - (1 - t) ** 3);
    if (t === 1) {
      a.start = null;
      a.view = a.target;
    }
  }
  return a.view;
}
