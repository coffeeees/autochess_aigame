// HUD 체력 숫자와 레벨 버튼의 표시 전용 연출. 원정 체력·XP는 읽기만 한다.
//   하트 체력: v0.15.18 health-effects.js(줄어들 때 한 칸씩, 간격 min(80, 1600/차이)ms, 하트 흔들림·조각 6개)
//   액체 XP:  liquid-xp.js(물결이 600ms 동안 차오름, 레벨업 때 가득 찼다가 섬광·물방울)
//   레벨업:   presentation-effects.js observeLevelEffects(520ms 흔들림, 움직임 줄이기 260ms 빛)
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  createHealthCounter,
  liquidLevel,
  observeLiquid,
  reducedMotion,
  type Liquid,
} from '../render/screen.ts';
import styles from './VitalEffects.module.css';

export function HealthCounter({ value }: { value: number }) {
  const [shown, setShown] = useState(Math.max(0, Math.trunc(value)));
  const [ticking, setTicking] = useState(false);
  const [burst, setBurst] = useState(0);
  const counter = useRef<ReturnType<typeof createHealthCounter> | null>(null);
  if (!counter.current)
    counter.current = createHealthCounter({
      paint: (n, shake) => {
        setShown(n);
        setTicking(shake);
      },
      burst: () => {
        setBurst((b) => b + 1);
      },
      reduced: reducedMotion,
      visible: () => !document.hidden,
    });
  useEffect(() => counter.current!.render(value), [value]);
  useEffect(() => () => counter.current!.cancel(), []);
  return (
    <b class={styles.health} aria-label={`체력 ${shown}`}>
      <span key={'heart' + burst} class={styles.heart} data-burst={burst > 0} aria-hidden="true">
        ♥
      </span>
      {burst > 0 &&
        Array.from({ length: 6 }, (_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          return (
            <i
              key={`${burst}-${i}`}
              class={styles.shard}
              style={{
                '--dx': `${Math.cos(angle) * 26}px`,
                '--dy': `${Math.sin(angle) * 23 + 12}px`,
              }}
            />
          );
        })}{' '}
      <span key={shown} class={styles.value} data-ticking={ticking}>
        {shown}
      </span>
    </b>
  );
}

function drawLiquid(c: CanvasRenderingContext2D, a: Liquid, w: number, h: number, now: number) {
  c.clearRect(0, 0, w, h);
  const view = liquidLevel(a, now);
  const strength = Math.max(0, (a.impact - now) / 1000);
  const amp = 5 * (1 + strength * 1.8);
  const y = h * (1 - view);
  const wave = (x: number) =>
    Math.sin(x * 0.06 + now * 0.0024) * amp * 0.7 + Math.sin(x * 0.115 - now * 0.0014) * amp * 0.3;
  if (view > 0) {
    c.beginPath();
    c.moveTo(0, y + wave(0));
    for (let x = 2; x <= w + 2; x += 2) c.lineTo(x, y + wave(x));
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.closePath();
    const g = c.createLinearGradient(0, y, 0, h);
    g.addColorStop(0, '#c998f5');
    g.addColorStop(1, '#57307e');
    c.fillStyle = g;
    c.fill();
    c.beginPath();
    for (let x = 0; x <= w; x += 2) {
      if (x) c.lineTo(x, y + wave(x));
      else c.moveTo(x, y + wave(x));
    }
    c.strokeStyle = '#f1c5ff';
    c.lineWidth = 1.5;
    c.stroke();
    for (let i = 0; i < 5; i++) {
      const sy = y + 12 + ((i * 23 + now * 0.008) % Math.max(22, h - y - 16));
      if (sy < h - 5) {
        c.fillStyle = '#ead7ff';
        c.fillRect(10 + (i * (w - 20)) / 5, sy, 2, 2);
      }
    }
  }
  a.dots = a.dots.filter((p) => now - p.start < p.life);
  for (const p of a.dots) {
    const t = (now - p.start) / 1000;
    c.fillStyle = '#fbddff';
    c.fillRect(Math.round(w * p.x + p.vx * t), Math.round(y + p.vy * t + 35 * t * t), 3, 3);
  }
  if (a.flash > now) {
    c.fillStyle = 'rgba(240,200,255,' + Math.max(0, (a.flash - now) / 1500) + ')';
    c.fillRect(0, 0, w, h);
  }
}

/** 레벨 버튼 뒤에 깔리는 액체 XP 캔버스. 레벨이 오르면 버튼을 흔든다(onLevelUp). */
export function LiquidXp({
  level,
  xp,
  ratio,
  onLevelUp,
}: {
  level: number;
  xp: number;
  ratio: number;
  onLevelUp: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const liquid = useRef<Liquid | null>(null);
  useEffect(() => {
    const now = performance.now();
    if (!liquid.current) {
      liquid.current = {
        level,
        xp,
        view: ratio,
        target: ratio,
        from: ratio,
        start: null,
        impact: 0,
        flash: 0,
        dots: [],
      };
      return;
    }
    const before = liquid.current.level;
    observeLiquid(liquid.current, level, xp, ratio, now);
    if (level > before) onLevelUp();
  }, [level, xp, ratio]);
  useEffect(() => {
    let raf = 0;
    const frame = (now: number) => {
      const el = canvas.current;
      const a = liquid.current;
      if (el && a && !document.hidden) {
        const r = el.getBoundingClientRect();
        const d = Math.min(devicePixelRatio || 1, 2);
        if (r.width > 0 && r.height > 0) {
          if (el.width !== Math.round(r.width * d) || el.height !== Math.round(r.height * d)) {
            el.width = Math.round(r.width * d);
            el.height = Math.round(r.height * d);
          }
          const c = el.getContext('2d');
          if (c) {
            c.setTransform(d, 0, 0, d, 0, 0);
            if (reducedMotion()) {
              a.view = a.target;
              a.start = null;
              a.dots = [];
              a.flash = 0;
            }
            drawLiquid(c, a, r.width, r.height, now);
          }
        }
      } else if (a) {
        // 숨은 탭: 진행 중인 연출은 끝난 상태로
        a.view = a.target;
        a.start = null;
        a.dots = [];
        a.flash = 0;
        a.impact = 0;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvas} class={styles.liquid} aria-hidden="true" />;
}

/** 레벨업 때 버튼을 흔든다(움직임 줄이기면 빛만). 돌려준 ref를 버튼에 단다. */
export function useLevelShake<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const running = useRef<Animation | null>(null);
  const trigger = () => {
    const el = ref.current;
    if (!el?.animate) return;
    running.current?.cancel();
    running.current = reducedMotion()
      ? el.animate(
          [
            { boxShadow: '0 0 0 transparent' },
            { boxShadow: '0 0 24px #ffdfa4', offset: 0.4 },
            { boxShadow: '0 0 0 transparent' },
          ],
          { duration: 260, easing: 'ease-out' },
        )
      : el.animate(
          [
            { transform: 'translateX(0)', boxShadow: '0 0 0 transparent' },
            {
              transform: 'translateX(-3px) rotate(-1deg)',
              boxShadow: '0 0 24px #ffdfa4',
              offset: 0.22,
            },
            { transform: 'translateX(3px) rotate(1deg)', offset: 0.45 },
            { transform: 'translateX(-2px)', offset: 0.68 },
            { transform: 'translateX(0)', boxShadow: '0 0 0 transparent' },
          ],
          { duration: 520, easing: 'ease-out' },
        );
  };
  return { ref, trigger };
}
