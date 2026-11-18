// 화면 연출(저장소의 cues를 차례로 재생하고 doneCue로 지운다). 게임 상태는 바꾸지 않는다.
//   ROUND/STAGE 안내: v0.15.18 screen-effects.js(2200ms / 1600ms, 움직임 줄이기 600 / 350ms)
//   하트 체력:       impact-health.js(3000ms, 900ms 뒤 800ms 동안 숫자·물 높이 변화, 움직임 줄이기 500ms)
//   합성:           presentation-effects.js(재료가 900ms 동안 날아간 뒤 680ms 섬광, 움직임 줄이기 120 / 180ms)
import { useEffect, useRef, useState } from 'preact/hooks';
import P from '../../core/progression.js';
import type { Cue } from '../store.ts';
import type { GameProps } from './Game.tsx';
import { CharacterImage } from './CharacterImage.tsx';
import { cueDurations, healthAt, reducedMotion, water } from '../render/screen.ts';
import styles from './ScreenCues.module.css';

const HEART = 'M50 89 12 52C-8 27 17 1 39 20L50 30 61 20C83 1 108 27 88 52Z';

export function ScreenCues({ ui, actions }: GameProps) {
  // 안내·체력은 한 번에 하나씩, 합성은 동시에 여러 개
  const banner = ui.cues.find((c) => c.kind !== 'merge');
  const merges = ui.cues.filter((c) => c.kind === 'merge');
  return (
    <>
      {banner && <Banner key={banner.key} cue={banner} done={() => actions.doneCue(banner.key)} />}
      {merges.map((m) => (
        <MergeFlight key={m.key} cue={m} done={() => actions.doneCue(m.key)} />
      ))}
    </>
  );
}

function useTimer(ms: number, done: () => void) {
  useEffect(() => {
    const id = setTimeout(done, ms);
    return () => clearTimeout(id);
  }, []);
}

function Banner({ cue, done }: { cue: Cue; done: () => void }) {
  if (cue.kind === 'health') return <HealthImpact cue={cue} done={done} />;
  if (cue.kind === 'round' || cue.kind === 'stage') return <RoundCover cue={cue} done={done} />;
  return null;
}

function RoundCover({
  cue,
  done,
}: {
  cue: Extract<Cue, { kind: 'round' | 'stage' }>;
  done: () => void;
}) {
  const reduced = reducedMotion();
  const ms = cueDurations[cue.kind](reduced);
  useTimer(ms, done);
  const style = { '--cue-ms': `${ms}ms` };
  if (cue.kind === 'stage')
    return (
      <div class={styles.stage} role="status" aria-live="polite" style={style}>
        <strong>
          STAGE {cue.stage}-{cue.round}
        </strong>
      </div>
    );
  const type = P.roundType(cue.stage, cue.round) as string;
  return (
    <div class={styles.round} role="dialog" aria-label="다음 라운드 안내" style={style}>
      <section>
        <span>AUTOCHESS · NEXT ROUND</span>
        <strong>ROUND {Math.max(1, Math.trunc(cue.stage) || 1)}</strong>
        <b>
          {cue.stage}-{cue.round} ·{' '}
          {type === 'SUPPLY' ? '보급' : type === 'BOSS' ? '보스전' : '전투 준비'}
        </b>
      </section>
    </div>
  );
}

function HealthImpact({ cue, done }: { cue: Extract<Cue, { kind: 'health' }>; done: () => void }) {
  const reduced = reducedMotion();
  const ms = cueDurations.health(reduced);
  const before = Math.max(0, Math.min(100, cue.before));
  const after = Math.max(0, Math.min(100, cue.after));
  const delta = after - before;
  const [elapsed, setElapsed] = useState(0);
  useTimer(ms, done);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      setElapsed(now - start);
      if (now - start < ms) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  const value = healthAt(before, after, elapsed, reduced);
  return (
    <div
      class={styles.impact}
      data-win={cue.win}
      role="status"
      aria-label={`체력 ${before} → ${after}`}
      style={{ '--cue-ms': `${ms}ms` }}
      onClick={done}
    >
      <section class={styles.heartBody}>
        <i class={styles.ring} />
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <clipPath id="cue-heart-clip">
              <path d={HEART} />
            </clipPath>
          </defs>
          <path fill="#233c41" d={HEART} />
          <g clip-path="url(#cue-heart-clip)">
            <path d={water(value, reduced ? 0 : elapsed)} fill={cue.win ? '#65e2b7' : '#ee6d86'} />
          </g>
          <path fill="none" stroke="#eafff2" stroke-width="2" d={HEART} />
        </svg>
        <strong>{Math.round(value)}</strong>
        {delta !== 0 && (
          <b class={styles.delta}>
            {delta > 0 ? '+' : '−'}
            {Math.abs(delta)} HP
          </b>
        )}
        {!reduced &&
          Array.from({ length: 24 }, (_, i) => {
            const angle = i * 2.39996;
            return (
              <i
                key={i}
                class={styles.dot}
                style={{
                  '--dx': `${Math.cos(angle) * (55 + (i % 5) * 12)}px`,
                  '--dy': `${Math.sin(angle) * (55 + (i % 4) * 12)}px`,
                  '--life': `${260 + (i % 6) * 50}ms`,
                  '--delay': `${i < 18 ? 520 : 2800}ms`,
                }}
              />
            );
          })}
      </section>
    </div>
  );
}

/** 재료 캐릭터가 남는 캐릭터 쪽으로 날아가 합쳐진다. 위치는 칸의 data-drop으로 찾는다. */
function MergeFlight({ cue, done }: { cue: Extract<Cue, { kind: 'merge' }>; done: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<{ parts: DOMRect[]; target: DOMRect } | null>(null);
  useEffect(() => {
    const target =
      document.querySelector(`[data-unit-uid="${cue.keep}"]`)?.getBoundingClientRect() ?? null;
    if (!target?.width) return done();
    setRects({
      target,
      parts: cue.parts.map(
        (p) => document.querySelector(`[data-drop="${p.drop}"]`)?.getBoundingClientRect() ?? target,
      ),
    });
  }, []);
  useEffect(() => {
    if (!rects || !host.current) return;
    const reduced = reducedMotion();
    const { target } = rects;
    const flights = Array.from(host.current.querySelectorAll<HTMLElement>('[data-flight]')).map(
      (el, i) => {
        const r = rects.parts[i];
        const dx = target.left + target.width / 2 - r.left - r.width / 2;
        const dy = target.top + target.height / 2 - r.top - r.height / 2;
        return el.animate(
          reduced
            ? [{ opacity: 0.7 }, { opacity: 0 }]
            : [
                { transform: 'translate(0,0) scale(1)', opacity: 0.95 },
                { transform: `translate(${dx}px,${dy}px) scale(.2)`, opacity: 0.1 },
              ],
          {
            duration: cueDurations.mergeFlight(reduced),
            easing: 'cubic-bezier(.35,0,.2,1)',
            fill: 'forwards',
          },
        );
      },
    );
    let flare: Animation | null = null;
    let alive = true;
    void Promise.all(flights.map((a) => a.finished.catch(() => {}))).then(() => {
      const el = host.current?.querySelector<HTMLElement>('[data-flare]');
      if (!alive || !el) return;
      el.hidden = false;
      flare = el.animate(
        [
          { opacity: 0, transform: 'translate(-50%,-50%) scale(.45)' },
          { opacity: 1, offset: 0.3 },
          { opacity: 0, transform: 'translate(-50%,-50%) scale(1.25)' },
        ],
        { duration: cueDurations.mergeFlare(reduced), easing: 'ease-out' },
      );
      void flare.finished.catch(() => {}).then(() => alive && done());
    });
    return () => {
      alive = false;
      flights.forEach((a) => a.cancel());
      flare?.cancel();
    };
  }, [rects]);
  if (!rects) return null;
  const t = rects.target;
  return (
    // 감싸는 div는 화면 격자(.screen)의 직속 자식이다. 상자를 만들면 격자에 빈 행과 간격이 하나 더 생겨
    // 합성 연출 동안 전장이 줄고 대기석이 올라갔다(v0.17.1 수정). 그래서 display: contents로 상자를 없앤다.
    <div ref={host} class={styles.mergeLayer} aria-hidden="true">
      {cue.parts.map((p, i) => {
        const r = rects.parts[i];
        return (
          <div
            key={i}
            data-flight
            class={styles.flight}
            style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
          >
            <CharacterImage id={p.id} context="field" />
          </div>
        );
      })}
      <div
        data-flare
        hidden
        class={styles.flare}
        style={{
          left: t.left + t.width / 2,
          top: t.top + t.height / 2,
          width: Math.max(t.width, t.height) * 1.35,
        }}
      />
    </div>
  );
}
