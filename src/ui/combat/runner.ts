// 전투 실행기: 전투를 Web Worker에서 돌리고 스냅샷을 받아 화면용 전투 객체에 반영한다
// (v0.15.18 combat-runner.js와 같은 순서: prepare → ready → begin → 스냅샷 → 결과).
// Worker를 만들 수 없거나 오류가 나면 메인 스레드에서 같은 틱 규칙으로 계산한다.
import D from '../../core/data/units.js';

const TICK_MS = (D.prototypeConfig.combat.tickSeconds as number) * 1000;

/** 화면이 들고 있는 전투 객체(core Battle). 필요한 부분만 적는다. */
export interface LiveBattle {
  result: { winner: string; time: number } | null;
  time: number;
  events: unknown[];
  tick(): LiveBattle['result'];
  onUnitKilled?: (unit: unknown, source: unknown) => void;
  [key: string]: unknown;
}

export interface RunnerEnv {
  /** 모듈 Worker를 만든다. 없으면 항상 메인 스레드에서 계산한다. */
  createWorker?: () => Worker;
  now: () => number;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (id: unknown) => void;
  hidden: () => boolean;
}

export interface RunHandlers {
  /** 스냅샷이 반영될 때마다(화면 갱신용) */
  onUpdate: () => void;
  /** 전투가 끝났을 때 한 번 */
  onEnd: (result: NonNullable<LiveBattle['result']>) => void;
}

export function createCombatRunner(env: RunnerEnv) {
  let idle: Worker | null = null;
  let worker: Worker | null = null;
  let owner: LiveBattle | null = null;
  let timer: unknown = null;
  let speed = 1;
  let paused = false;

  function make(): Worker | null {
    if (!env.createWorker) return null;
    try {
      return env.createWorker();
    } catch {
      return null;
    }
  }
  /** 다음 전투를 빨리 시작하려고 Worker를 미리 만들어 둔다. */
  function warm() {
    if (idle || worker) return;
    idle = make();
    if (idle)
      idle.onerror = () => {
        idle?.terminate();
        idle = null;
      };
  }
  function stop() {
    worker?.terminate();
    worker = null;
    env.clearInterval(timer);
    timer = null;
    owner = null;
  }

  /** 메인 스레드 계산(Worker를 쓸 수 없을 때). 경과 시간 × 배속만큼 틱을 진행한다. */
  function runFallback(battle: LiveBattle, h: RunHandlers) {
    env.clearInterval(timer);
    let last = env.now(),
      credit = 0;
    timer = env.setInterval(() => {
      if (owner !== battle) return;
      const now = env.now();
      if (!paused) credit += Math.max(0, now - last) * speed;
      last = now;
      let result: LiveBattle['result'] = null;
      const frame: unknown[] = [];
      while (credit >= TICK_MS && !result) {
        credit -= TICK_MS;
        result = battle.tick();
        frame.push(...battle.events);
      }
      battle.events = frame.slice(-1600);
      if (result) {
        stop();
        h.onEnd(result);
      } else h.onUpdate();
    }, TICK_MS / speed);
  }

  function start(battle: LiveBattle, h: RunHandlers, startSpeed: number) {
    stop();
    owner = battle;
    speed = startSpeed;
    paused = false;
    const w = idle || make();
    idle = null;
    if (!w) return runFallback(battle, h);
    worker = w;
    let waiting = true;
    let pending: unknown[] = [];
    w.onmessage = ({ data }: MessageEvent) => {
      if (owner !== battle) return;
      if (data.type === 'ready') {
        if (!waiting) return;
        waiting = false;
        w.postMessage({ type: 'begin', now: env.now(), speed, paused });
        return;
      }
      pending.push(...(data.battle.events || []));
      if (pending.length > 1600) pending = pending.slice(-1600);
      Object.assign(battle, data.battle);
      battle.events = pending;
      for (const kill of data.kills) battle.onUnitKilled?.(kill.unit, kill.source);
      if (battle.result) {
        const result = battle.result;
        stop();
        h.onEnd(result);
      } else h.onUpdate();
      pending = [];
    };
    w.onerror = () => {
      if (owner !== battle) return;
      worker?.terminate();
      worker = null;
      runFallback(battle, h);
    };
    w.postMessage({
      type: 'prepare',
      battle: JSON.parse(JSON.stringify(battle)),
      now: env.now(),
      speed,
      hidden: env.hidden(),
    });
  }

  return {
    warm,
    start,
    stop,
    setSpeed(next: number) {
      speed = next;
      worker?.postMessage({ type: 'speed', speed });
    },
    pause() {
      paused = true;
      worker?.postMessage({ type: 'pause' });
    },
    resume() {
      paused = false;
      worker?.postMessage({ type: 'resume' });
    },
    visibility(hidden: boolean) {
      worker?.postMessage({ type: 'visibility', hidden });
    },
    get running() {
      return owner !== null;
    },
  };
}

export type CombatRunner = ReturnType<typeof createCombatRunner>;
