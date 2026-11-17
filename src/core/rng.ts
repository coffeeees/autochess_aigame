import type { RunState } from './types.ts';

// 게임 로직 전체가 쓰는 시드 기반 난수. src/core에서는 Math.random을 호출하지 않는다.
//
// 생성기는 mulberry32이다. 상태 전체가 uint32 하나라서 일반 데이터(저장 파일의 원정
// 상태, Worker로 보내는 전투)에 넣을 수 있고, 다시 불러오거나 넘겨받은 뒤에도 멈춘
// 곳에서 그대로 이어진다.

/** uint32 상태를 한 단계 진행: [0~1 사이 값, 다음 상태]를 돌려준다. */
export function step(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

export interface Rng {
  (): number;
  state(): number;
}

/** 독립 생성기: rng()는 0~1 값, rng.state()는 현재 상태. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const rng = (() => {
    const [value, next] = step(state);
    state = next;
    return value;
  }) as Rng;
  rng.state = () => state;
  return rng;
}

/**
 * 상태를 `holder[key]`에 보관하는 생성기라서 holder와 함께 저장·복사된다.
 * `initialSeed()`는 키가 없을 때 첫 추첨에서만 실행되고, 생성기를 만들기만
 * 해서는 holder를 바꾸지 않는다.
 */
export function storedRng<K extends string>(
  holder: { [key in K]?: number },
  key: K,
  initialSeed: () => number,
): () => number {
  return () => {
    if (!Number.isInteger(holder[key])) holder[key] = initialSeed() >>> 0;
    const [value, next] = step(holder[key] as number);
    holder[key] = next;
    return value;
  };
}

/** JSON으로 바꿀 수 있는 값에서 항상 같은 uint32를 만든다(JSON에 FNV-1a 적용). */
export function seedFrom(value: unknown): number {
  const text = JSON.stringify(value) ?? '';
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * 원정의 생성기(state.rngState에 보관). 새 원정은 UI가 무작위 시드를 넣고,
 * 재구축 이전 저장은 처음 추첨할 때 저장 내용에서 시드를 만든다.
 */
export function runRng(state: Pick<RunState, 'rngState'>): () => number {
  return storedRng(state, 'rngState', () => seedFrom(state));
}

/** 생성기에서 (전투용) uint32 시드를 하나 뽑는다. */
export function nextSeed(rng: () => number): number {
  return Math.floor(rng() * 4294967296) >>> 0;
}

export default { step, createRng, storedRng, seedFrom, runRng, nextSeed };
