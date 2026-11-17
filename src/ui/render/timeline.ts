// 전투 연출의 시간축 모델. 연출 명령(plan.ts)을 받아 시간에 따라 변하는 그릴 것 목록을 만든다.
// 그리는 방법(PixiJS)과 분리해서, 브라우저 없이 테스트할 수 있다.
// v0.15.18 battle-view.js(숫자·고리·투사체·사망)와 pixel-vfx.js(픽셀 탄·폭발·연쇄 번개)의 동작을 옮겼다.
// 이 모듈은 전투 상태를 바꾸지 않는다. 무작위도 연출 전용 생성기만 쓴다(게임 RNG와 무관).
import {
  type Command,
  type PixelTheme,
  durations,
  effectStyle,
  flightMs,
  numberText,
  pixelLimits,
  pixelMapping,
  pixelThemes,
} from './plan.ts';

/** 화면 좌표의 칸 중심과 칸 크기 */
export interface Point {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ConsumeContext {
  /** uid의 현재 위치(없으면 pos 칸 위치) */
  point(uid: number | undefined, pos: number | undefined): Point;
  /** pos 칸의 위치(픽셀 VFX는 이벤트 당시 칸을 쓴다) */
  cell(pos: number | undefined): Point | undefined;
  speed: number;
  /** 연출 시계(ms, performance.now 기준) */
  now: number;
  /** 벽시계(ms, Date.now). 500ms보다 오래된 이벤트는 그리지 않는다 */
  wallNow: number;
}

interface FloatingNumber {
  text: string;
  tag?: string;
  tone: string;
  x: number;
  y: number;
  lane: number;
  born: number;
  life: number;
}
interface Ring {
  x: number;
  y: number;
  size: number;
  color: string;
  kind: string;
  born: number;
  life: number;
}
interface Glow {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  born: number;
  life: number;
}
interface Spark {
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  born: number;
  life: number;
}
interface Bolt {
  from: Point;
  to: Point;
  color: string;
  magic: boolean;
  item: boolean;
  born: number;
  life: number;
}
interface Burst {
  x: number;
  y: number;
  theme: PixelTheme;
  born: number;
  life: number;
  radius: number;
  count: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  glow: string;
  born: number;
  life: number;
  tempo: number;
  burst: Burst;
}
interface Shot {
  source: Point;
  target: Point;
  theme: PixelTheme;
  hit: boolean;
  born: number;
  duration: number;
  speed: number;
  onImpact?: () => void;
}
interface Chain {
  source: Point;
  primary: Point;
  targets: Point[];
  landed: boolean;
  born: number;
  flight: number;
  tempo: number;
  speed: number;
  main: boolean;
  hits: boolean[];
  life: number;
}
interface Job {
  at: number;
  run: () => void;
}

/** 한 프레임에 그릴 것(모두 화면 좌표, 투명도 0~1) */
export interface Frame {
  numbers: {
    text: string;
    tag?: string;
    tone: string;
    x: number;
    y: number;
    alpha: number;
    scale: number;
  }[];
  rings: { x: number; y: number; size: number; color: string; alpha: number }[];
  glows: { x: number; y: number; w: number; h: number; color: string; alpha: number }[];
  sparks: { x: number; y: number; color: string; alpha: number; scale: number }[];
  bolts: { x: number; y: number; angle: number; color: string; magic: boolean; item: boolean }[];
  /** 픽셀 탄(회색·노랑): 막대 + 심 */
  shots: { x: number; y: number; angle: number; scale: number; bar: string; core: string }[];
  /** 연쇄 번개 비행체 */
  chainBolts: { x: number; y: number; angle: number }[];
  /** 연쇄 번개 줄기(계단 모양 꺾은선) */
  lightning: { points: { x: number; y: number }[] }[];
  /** 부드러운 빛(더하기 혼합) */
  lights: { x: number; y: number; radius: number; color: string; alpha: number }[];
  /** 불투명한 네모 픽셀 */
  pixels: { x: number; y: number; size: number; color: string }[];
  /** 캐릭터별 움직임: 피격 흔들림·돌진·사망 */
  units: Map<number, { dx: number; dy: number; scale: number; bright: number; dying?: number }>;
}

export interface TimelineOptions {
  /** 움직임 줄이기 설정(prefers-reduced-motion) */
  reduced?: () => boolean;
  /** 연출 전용 무작위(0~1). 기본값은 xorshift */
  random?: () => number;
  /** 화면 크기(밖으로 나간 픽셀은 그리지 않음) */
  bounds?: () => { width: number; height: number };
}

const NUMBER_OFFSETS = [-9, 10, -2, 15];

function xorshift(seed: number) {
  let s = seed | 0 || 17;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** 구간 키프레임 보간(offset 오름차순) */
function keyframes(t: number, frames: [number, number][]) {
  for (let i = 1; i < frames.length; i++) {
    const [o1, v1] = frames[i];
    const [o0, v0] = frames[i - 1];
    if (t <= o1) return v0 + (v1 - v0) * ((t - o0) / (o1 - o0 || 1));
  }
  return frames.at(-1)![1];
}

export function createTimeline(options: TimelineOptions = {}) {
  const reduced = options.reduced ?? (() => false);
  const random = options.random ?? xorshift(Date.now());
  const bounds = options.bounds ?? (() => ({ width: Infinity, height: Infinity }));
  let numbers: FloatingNumber[] = [];
  let rings: Ring[] = [];
  let glows: Glow[] = [];
  let sparks: Spark[] = [];
  let bolts: Bolt[] = [];
  let bursts: Burst[] = [];
  let particles: Particle[] = [];
  let shots: Shot[] = [];
  let chains: Chain[] = [];
  let jobs: Job[] = [];
  const hits = new Map<number, { born: number; life: number }>();
  const lunges = new Map<number, { born: number; life: number; dx: number; dy: number }>();
  const deaths = new Map<number, { at: number; life: number }>();
  const lanes = new Map<number, number>();
  const seen = new Set<string>();
  let speed = 1;

  function accept(c: Command, wallNow: number) {
    if (c.eventId !== undefined) {
      if (seen.has(c.eventId)) return false;
      seen.add(c.eventId);
      if (seen.size > 2048) seen.delete(seen.values().next().value!);
    }
    return c.eventAt === undefined || wallNow - c.eventAt <= 500;
  }

  function burst(p: Point, theme: PixelTheme, kind: 'impact' | 'launch', now: number, sp: number) {
    const impact = kind === 'impact';
    const palette = pixelThemes[theme];
    const count = theme === 'electric' ? (impact ? 28 : 19) : impact ? 22 : 14;
    const scale = Math.max(0.65, Math.min(1.2, (p.w || 90) / 100));
    const tempo = Math.sqrt(sp);
    if (bursts.length >= pixelLimits.bursts) bursts.shift();
    const b: Burst = {
      x: p.x,
      y: p.y,
      theme,
      born: now,
      life: (impact ? 360 : 270) / tempo,
      radius: (impact ? 56 : 40) * scale,
      count,
    };
    bursts.push(b);
    for (let i = 0; i < count; i++) {
      if (particles.length >= pixelLimits.particles) break;
      const angle = random() * Math.PI * 2;
      const velocity = (impact ? 80 : 55) + random() * (impact ? 135 : 95);
      particles.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(angle) * velocity * scale,
        vy: Math.sin(angle) * velocity * scale,
        size: Math.max(2, Math.round((2 + random() * (impact ? 3 : 4)) * scale)),
        color: palette.particles[Math.floor(random() * palette.particles.length)],
        glow: palette.glow,
        born: now,
        life: ((impact ? 145 : 135) + random() * (impact ? 215 : 135)) / tempo,
        tempo,
        burst: b,
      });
    }
  }

  function figure(c: Command & { text?: string; amount?: number }, p: Point, now: number) {
    if (c.target === undefined || !('text' in c)) return;
    const lane = (lanes.get(c.target) || 0) % 4;
    lanes.set(c.target, lane + 1);
    const { width } = bounds();
    const special = (c.critical && (c.amount ?? 0) > 0) || c.kind === 'shield';
    numbers.push({
      text: special
        ? (c.kind === 'shield' ? '+' : '−') + numberText(c.amount ?? 0)
        : (c.text as string),
      tag: special ? (c.kind === 'shield' ? '보호막' : '치명타') : undefined,
      tone: (c as { tone: string }).tone,
      x: Math.max(27, Math.min(width - 27, p.x + NUMBER_OFFSETS[lane])),
      y: Math.max(18, p.y - p.h * 0.48 - lane * 11),
      lane,
      born: now,
      life: durations.number(speed, reduced()),
    });
  }

  function pulse(p: Point, kind: string, color: string, now: number) {
    rings.push({
      x: p.x,
      y: p.y,
      size: p.w * (kind === 'cast' ? 1.4 : 1.1),
      color,
      kind,
      born: now,
      life: durations.ring(speed),
    });
  }

  function impact(c: Command, ctx: ConsumeContext, now: number) {
    if (c.target !== undefined && !deaths.has(c.target) && !reduced())
      hits.set(c.target, { born: now, life: durations.hit(speed) });
    figure(c, ctx.point(c.target, c.targetPos), now);
    if (c.critical && !pixelMapping(c))
      pulse(ctx.point(c.target, c.targetPos), 'critical', '#f4ce71', now);
  }

  function skillEffect(c: Command, ctx: ConsumeContext, now: number) {
    const style = effectStyle(c.sourceTrait);
    const p = ctx.point(c.source, c.sourcePos);
    pulse(p, 'cast', style.color, now);
    glows.push({
      ...p,
      w: p.w * 1.7,
      h: p.h * 1.7,
      color: style.color,
      born: now,
      life: durations.castGlow(speed),
    });
    if (reduced()) return;
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      sparks.push({
        x: p.x,
        y: p.y,
        dx: Math.cos(angle) * p.w * 0.8,
        dy: Math.sin(angle) * p.w * 0.8,
        color: style.color,
        born: now,
        life: durations.castSpark(speed),
      });
    }
  }

  function playPixel(
    c: Command,
    source: Point,
    target: Point,
    duration: number,
    now: number,
    onImpact?: () => void,
  ) {
    const mode = pixelMapping(c);
    if (!mode) return;
    if (!mode.flight) {
      burst(target, mode.theme, 'impact', now, speed);
      onImpact?.();
      return;
    }
    burst(source, mode.theme, 'launch', now, speed);
    if (reduced() || shots.length >= pixelLimits.shots) {
      if (mode.hit) {
        burst(target, mode.theme, 'impact', now, speed);
        onImpact?.();
      }
      return;
    }
    shots.push({
      source: { ...source },
      target: { ...target },
      theme: mode.theme,
      hit: mode.hit,
      born: now,
      duration: Math.max(1, duration),
      speed,
      onImpact,
    });
  }

  function die(uid: number, delay: number, now: number) {
    if (deaths.has(uid)) return;
    deaths.set(uid, { at: now + delay, life: durations.death(speed, reduced()) });
  }

  /** 이번 스냅샷의 연출 명령을 받는다(battle-view.js consume). */
  function consume(commands: Command[], ctx: ConsumeContext, dead: Iterable<number> = []) {
    speed = ctx.speed;
    const now = ctx.now;
    const delays = new Map<number, number>();
    const attacked = new Set<number>();
    for (const c of commands) {
      if (!accept(c, ctx.wallNow)) continue;
      if (c.kind === 'chainLightning') {
        if (c.sourceId !== 'C07' || c.sourceSummon) continue;
        const source = ctx.cell(c.sourcePos) ?? ctx.point(c.source, c.sourcePos);
        const primary = ctx.cell(c.primary.pos) ?? ctx.point(c.primary.uid, c.primary.pos);
        const targets = c.chains.map((t) => ctx.cell(t.pos) ?? ctx.point(t.uid, t.pos));
        const tempo = Math.sqrt(speed);
        burst(source, 'electric', 'launch', now, speed);
        if (reduced()) {
          if (c.primary.landed) burst(primary, 'electric', 'impact', now, speed);
          for (const t of targets) burst(t, 'electric', 'impact', now, speed);
          continue;
        }
        if (chains.length >= pixelLimits.chains) chains.shift();
        chains.push({
          source,
          primary,
          targets,
          landed: !!c.primary.landed,
          born: now,
          flight: 160 / tempo,
          tempo,
          speed,
          main: false,
          hits: [],
          life: 650 / tempo,
        });
        continue;
      }
      if (c.kind === 'damage') {
        if (c.sourceId === 'C07' && c.skillVisual) {
          impact(c, ctx, now);
          continue;
        }
        const isAttack = c.attackKind !== 'dot' && c.source !== c.target;
        const custom = pixelMapping(c);
        let to = ctx.point(c.target, c.targetPos);
        let from = ctx.point(c.source, c.sourcePos);
        if (custom && c.eventAt !== undefined) {
          from = ctx.cell(c.sourcePos) ?? from;
          to = ctx.cell(c.targetPos) ?? to;
        }
        let delay = 0;
        if (isAttack && c.ranged && !reduced()) {
          delay = flightMs(to.x - from.x, to.y - from.y, speed);
          if (!custom) {
            const style = effectStyle(c.sourceTrait);
            bolts.push({
              from,
              to,
              color: style.color,
              magic: c.damageType === 'magic',
              item: c.itemProc,
              born: now,
              life: delay,
            });
          }
        }
        if (custom && !custom.flight) delay = 0;
        if (isAttack && c.source !== undefined && !attacked.has(c.source) && !reduced()) {
          attacked.add(c.source);
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.max(1, Math.hypot(dx, dy));
          const step = c.ranged ? 4 : Math.min(13, from.w * 0.28);
          lunges.set(c.source, {
            born: now,
            life: durations.lunge(speed),
            dx: (dx / len) * step,
            dy: (dy / len) * step,
          });
        }
        if (!custom && isAttack && !c.ranged && c.amount > 0)
          pulse(to, 'slash', effectStyle(c.sourceTrait).color, now);
        if (c.target !== undefined)
          delays.set(c.target, Math.max(delays.get(c.target) || 0, delay));
        if (custom) playPixel(c, from, to, delay, now, () => impact(c, ctx, now + delay));
        else if (delay) jobs.push({ at: now + delay, run: () => impact(c, ctx, now + delay) });
        else impact(c, ctx, now);
      } else if (c.kind === 'heal' || c.kind === 'shield' || c.kind === 'evade') {
        if (c.kind === 'evade' && pixelMapping(c)) {
          const from = ctx.cell(c.sourcePos) ?? ctx.point(c.source, c.sourcePos);
          const to = ctx.cell(c.targetPos) ?? ctx.point(c.target, c.targetPos);
          playPixel(c, from, to, flightMs(to.x - from.x, to.y - from.y, speed), now);
        }
        figure(c, ctx.point(c.target, c.targetPos), now);
        if (c.kind !== 'evade')
          pulse(
            ctx.point(c.target, c.targetPos),
            c.kind,
            c.kind === 'heal' ? '#8dd5ac' : '#8ebbea',
            now,
          );
      } else if (c.kind === 'cast') skillEffect(c, ctx, now);
      else if (c.kind === 'spawn') pulse(ctx.point(c.target, c.targetPos), 'spawn', '#d7c18d', now);
      else if (c.kind === 'death' && c.target !== undefined)
        die(c.target, delays.get(c.target) || 0, now);
    }
    for (const uid of dead) die(uid, delays.get(uid) || 0, now);
  }

  function lightningPath(a: Point, b: Point, elapsed: number, tempo: number, i: number) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const phase = Math.floor((elapsed * tempo) / 42);
    const raw = [{ x: a.x, y: a.y }];
    for (let j = 1; j < 10; j++) {
      const f = j / 10;
      const noise = Math.sin(j * 39 + phase * 71 + i * 121) * 9 * Math.sin(Math.PI * f);
      raw.push({
        x: Math.round(a.x + dx * f - (dy / len) * noise),
        y: Math.round(a.y + dy * f + (dx / len) * noise),
      });
    }
    raw.push({ x: b.x, y: b.y });
    // 계단 모양: 가로로 먼저, 그다음 세로로(pixel-vfx.js drawChains)
    const points = [{ x: Math.round(a.x), y: Math.round(a.y) }];
    for (let j = 1; j < raw.length; j++) {
      points.push({ x: Math.round(raw[j].x), y: Math.round(raw[j - 1].y) });
      points.push({ x: Math.round(raw[j].x), y: Math.round(raw[j].y) });
    }
    return points;
  }

  /** now 시점의 그릴 것. 끝난 연출은 여기서 버린다. */
  function frame(now: number): Frame {
    for (const job of jobs.filter((j) => j.at <= now)) job.run();
    jobs = jobs.filter((j) => j.at > now);
    const small = reduced();
    const out: Frame = {
      numbers: [],
      rings: [],
      glows: [],
      sparks: [],
      bolts: [],
      shots: [],
      chainBolts: [],
      lightning: [],
      lights: [],
      pixels: [],
      units: new Map(),
    };
    const unit = (uid: number) => {
      let u = out.units.get(uid);
      if (!u) out.units.set(uid, (u = { dx: 0, dy: 0, scale: 1, bright: 1 }));
      return u;
    };

    // 연쇄 번개(비행 → 주 대상 폭발 → 50ms 간격으로 다음 대상)
    for (const chain of chains) {
      const age = now - chain.born;
      if (age >= chain.life) continue;
      const t = chain.tempo;
      if (age < chain.flight) {
        const p = age / chain.flight;
        const dx = chain.primary.x - chain.source.x;
        const dy = chain.primary.y - chain.source.y;
        out.chainBolts.push({
          x: Math.round(chain.source.x + dx * p),
          y: Math.round(chain.source.y + dy * p),
          angle: Math.atan2(dy, dx),
        });
      } else if (!chain.main) {
        chain.main = true;
        if (chain.landed)
          burst(chain.primary, 'electric', 'impact', chain.born + chain.flight, chain.speed);
      }
      chain.targets.forEach((target, i) => {
        const start = chain.flight + (i * 50) / t;
        const elapsed = age - start;
        if (elapsed < 0) return;
        if (elapsed >= 70 / t && !chain.hits[i]) {
          chain.hits[i] = true;
          burst(target, 'electric', 'impact', chain.born + start + 70 / t, chain.speed);
        }
        if (elapsed > 190 / t) return;
        out.lightning.push({ points: lightningPath(chain.primary, target, elapsed, t, i) });
        out.lights.push({ x: target.x, y: target.y, radius: 35, color: '#FFD44E', alpha: 0.3 });
      });
    }
    chains = chains.filter((c) => now - c.born < c.life);

    // 픽셀 탄 도착
    for (const shot of [...shots]) {
      if (now - shot.born < shot.duration) continue;
      shots.splice(shots.indexOf(shot), 1);
      if (shot.hit) {
        burst(shot.target, shot.theme, 'impact', now, shot.speed);
        shot.onImpact?.();
      }
    }
    particles = particles.filter((d) => now - d.born < d.life);
    const surviving = new Map<Burst, number>();
    for (const d of particles) surviving.set(d.burst, (surviving.get(d.burst) || 0) + 1);
    bursts = bursts.filter((b) => surviving.has(b) && now - b.born < b.life);
    for (const b of bursts) {
      const progress = (now - b.born) / b.life;
      out.lights.push({
        x: b.x,
        y: b.y,
        radius: b.radius * (0.4 + progress * 0.9),
        color: pixelThemes[b.theme].glow,
        alpha: 0.7 * (1 - progress) * Math.sqrt(surviving.get(b)! / b.count),
      });
    }
    const { width, height } = bounds();
    for (const d of particles) {
      const age = Math.max(0, ((now - d.born) / 1000) * d.tempo);
      const motion = small ? 0.15 : 1;
      const x = Math.round(d.x + d.vx * age * motion);
      const y = Math.round(d.y + d.vy * age * motion);
      if (x < 0 || y < 0 || x > width || y > height) continue;
      out.lights.push({ x, y, radius: d.size * 2.2, color: d.glow, alpha: 0.18 });
      out.pixels.push({ x, y, size: d.size, color: d.color });
    }
    for (const shot of shots) {
      const progress = Math.min(1, (now - shot.born) / shot.duration);
      const dx = shot.target.x - shot.source.x;
      const dy = shot.target.y - shot.source.y;
      out.shots.push({
        x: Math.round(shot.source.x + dx * progress),
        y: Math.round(shot.source.y + dy * progress),
        angle: Math.atan2(dy, dx),
        scale: Math.max(0.65, Math.min(1.2, (shot.source.w || 90) / 100)),
        bar: pixelThemes[shot.theme].bar,
        core: pixelThemes[shot.theme].core,
      });
    }

    // 일반 투사체
    bolts = bolts.filter((b) => now - b.born < b.life);
    for (const b of bolts) {
      const p = Math.max(0, (now - b.born) / b.life);
      out.bolts.push({
        x: b.from.x + (b.to.x - b.from.x) * p,
        y: b.from.y + (b.to.y - b.from.y) * p,
        angle: Math.atan2(b.to.y - b.from.y, b.to.x - b.from.x),
        color: b.color,
        magic: b.magic,
        item: b.item,
      });
    }

    // 피해 숫자(나타남 → 위로 떠오름 → 사라짐)
    numbers = numbers.filter((n) => now - n.born < n.life);
    for (const n of numbers) {
      const t = Math.max(0, (now - n.born) / n.life);
      const side = n.lane % 2 ? 1 : -1;
      if (small) {
        out.numbers.push({ ...n, alpha: 1 - t, scale: 1 });
        continue;
      }
      out.numbers.push({
        text: n.text,
        tag: n.tag,
        tone: n.tone,
        x:
          n.x +
          keyframes(t, [
            [0, 0],
            [0.15, 0],
            [0.68, 8 * side],
            [1, 13 * side],
          ]),
        y:
          n.y +
          keyframes(t, [
            [0, 0],
            [0.15, -8],
            [0.68, -27],
            [1, -47],
          ]),
        alpha: keyframes(t, [
          [0, 0],
          [0.15, 1],
          [0.68, 1],
          [1, 0],
        ]),
        scale: keyframes(t, [
          [0, 0.7],
          [0.15, 1.08],
          [0.68, 1],
          [1, 0.96],
        ]),
      });
    }

    rings = rings.filter((r) => now - r.born < r.life);
    for (const r of rings) {
      const t = Math.max(0, (now - r.born) / r.life);
      out.rings.push({
        x: r.x,
        y: r.y,
        color: r.color,
        size: r.size * (small ? 1 : 0.4 + t),
        alpha: (small ? 0.65 : 0.9) * (1 - t),
      });
    }
    glows = glows.filter((g) => now - g.born < g.life);
    for (const g of glows) {
      const t = Math.max(0, (now - g.born) / g.life);
      const s = small
        ? 1
        : keyframes(t, [
            [0, 0.6],
            [0.3, 1],
            [1, 1.25],
          ]);
      out.glows.push({
        x: g.x,
        y: g.y,
        w: g.w * s,
        h: g.h * s,
        color: g.color,
        alpha: small
          ? 0.45 * (1 - t)
          : keyframes(t, [
              [0, 0],
              [0.3, 0.7],
              [1, 0],
            ]),
      });
    }
    sparks = sparks.filter((s) => now - s.born < s.life);
    for (const s of sparks) {
      const t = Math.max(0, (now - s.born) / s.life);
      out.sparks.push({
        x: s.x + s.dx * t,
        y: s.y + s.dy * t,
        color: s.color,
        alpha: 0.9 * (1 - t),
        scale: 0.4 + 0.4 * t,
      });
    }

    // 캐릭터 움직임
    for (const [uid, h] of hits) {
      const t = (now - h.born) / h.life;
      if (t >= 1) {
        hits.delete(uid);
        continue;
      }
      const u = unit(uid);
      u.bright = keyframes(t, [
        [0, 1.8],
        [0.4, 1.25],
        [1, 1],
      ]);
      u.dx += keyframes(t, [
        [0, -2],
        [0.4, 2],
        [1, 0],
      ]);
    }
    for (const [uid, l] of lunges) {
      const t = (now - l.born) / l.life;
      if (t >= 1) {
        lunges.delete(uid);
        continue;
      }
      const k = keyframes(t, [
        [0, 0],
        [0.35, 1],
        [1, 0],
      ]);
      const u = unit(uid);
      u.dx += l.dx * k;
      u.dy += l.dy * k;
      u.scale *= 1 + 0.06 * k;
    }
    for (const [uid, d] of deaths) {
      const u = unit(uid);
      u.dying = now < d.at ? 0 : Math.min(1, (now - d.at) / d.life);
    }
    return out;
  }

  /** 진행 중인 연출을 모두 지운다(일시정지·화면 크기 변경·전투 종료). 사망 표시는 남긴다. */
  function clear() {
    numbers = [];
    rings = [];
    glows = [];
    sparks = [];
    bolts = [];
    bursts = [];
    particles = [];
    shots = [];
    chains = [];
    jobs = [];
    hits.clear();
    lunges.clear();
    for (const [uid, d] of deaths) deaths.set(uid, { at: -Infinity, life: d.life });
  }

  /** 새 전투를 시작할 때 사망 기록까지 비운다. */
  function reset() {
    clear();
    deaths.clear();
    lanes.clear();
    seen.clear();
  }

  return {
    consume,
    frame,
    clear,
    reset,
    /** 그릴 연출이 남아 있는지 */
    get busy() {
      return (
        numbers.length +
          rings.length +
          glows.length +
          sparks.length +
          bolts.length +
          particles.length +
          shots.length +
          chains.length +
          jobs.length +
          hits.size +
          lunges.size >
        0
      );
    },
    /** 사망 연출이 끝난 uid인지(그리지 않아도 됨) */
    gone(uid: number, now: number) {
      const d = deaths.get(uid);
      return !!d && now >= d.at + d.life;
    },
  };
}

export type Timeline = ReturnType<typeof createTimeline>;
