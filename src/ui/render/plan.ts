// 전투 이벤트 → 화면 연출 계획(v0.15.18 combat-visuals.js와 pixel-vfx.js의 규칙을 옮김).
// 순수 함수만 둔다. 전투 상태를 읽기만 하고 절대 바꾸지 않는다.
import { distance } from '../../core/combat/geometry.ts';

/** 특성별 연출 색(combat-visuals.js traitPalette 그대로) */
export const traitPalette: Readonly<Record<string, string>> = Object.freeze({
  화염: '#ff8457',
  빙결: '#a8e8ff',
  번개: '#ffe45c',
  대지: '#b48755',
  바람: '#86dfb6',
  물: '#55baff',
  신성: '#fff4c6',
  암흑: '#b18aff',
  독: '#abd85e',
  혈마법: '#ed718d',
});

export function effectStyle(trait?: string) {
  return { trait: trait || '무속성', color: (trait && traitPalette[trait]) || '#d5cbe3' };
}

/** 피해 숫자 표기: 0 이하는 '0', 1 미만은 '<1', 나머지는 반올림 후 천 단위 쉼표 */
export function numberText(amount: number): string {
  if (!(amount > 0)) return '0';
  return amount < 1 ? '<1' : Math.round(amount).toLocaleString('ko-KR');
}

/** 픽셀 VFX 색 묶음(pixel-vfx.js themes 그대로) */
export const pixelThemes = {
  electric: {
    bar: '#AAB2C0',
    core: '#EFF3FA',
    particles: ['#FFFBE2', '#FFF093', '#FFD44E', '#FFAD29', '#FFEB7E'],
    glow: '#FFD44E',
  },
  yellow: {
    bar: '#FFBF26',
    core: '#FFF08A',
    particles: ['#FFCF42', '#FFD959', '#FFAD39', '#F16C32', '#FFF0A0'],
    glow: '#FFAD39',
  },
  gray: {
    bar: '#ABB2BC',
    core: '#E4E8EE',
    particles: ['#F1F3F6', '#CFD5DF', '#9CA5B3', '#6D7787'],
    glow: '#CFD5DF',
  },
} as const;
export type PixelTheme = keyof typeof pixelThemes;

/** 동시에 살아 있을 수 있는 픽셀 연출 수(pixel-vfx.js limits) */
export const pixelLimits = { particles: 720, shots: 64, bursts: 48, chains: 24 } as const;

export type Tone =
  | 'dot'
  | 'critical'
  | 'incoming'
  | 'magic'
  | 'physical'
  | 'healing'
  | 'shielding'
  | 'evade';

interface PlanBase {
  eventId?: string;
  eventAt?: number;
  source?: number;
  target?: number;
  sourcePos?: number;
  targetPos?: number;
  skillVisual?: unknown;
  sourceId?: string;
  sourceSummon: boolean;
  sourceTrait?: string;
  targetTeam?: string;
  critical: boolean;
}

export interface ChainTarget {
  uid: number;
  pos: number;
  landed?: boolean;
}

export type Command = PlanBase &
  (
    | {
        kind: 'damage';
        amount: number;
        text: string;
        tone: Tone;
        ranged: boolean;
        attackKind: string;
        damageType?: string;
        itemProc: boolean;
      }
    | { kind: 'heal' | 'shield'; amount: number; text: string; tone: Tone }
    | { kind: 'evade'; text: string; tone: Tone; ranged: boolean; attackKind?: string }
    | { kind: 'chainLightning'; primary: ChainTarget; chains: ChainTarget[] }
    | { kind: 'cast' | 'spawn' | 'death' }
  );

/** 연출이 읽는 전투 유닛 필드 */
export interface PlanUnit {
  uid: number;
  id: string;
  pos: number;
  team: string;
  trait?: string;
  summon?: boolean;
  summonKind?: string;
  stats: { RNG: number };
}

/** 연출이 읽는 전투 이벤트 필드(core Battle.log가 남김) */
export interface CombatEvent {
  kind: string;
  source?: number;
  target?: number;
  amount?: number;
  critical?: boolean;
  attackKind?: string;
  damageType?: string;
  sourceTag?: string;
  sourcePos?: number;
  primary?: ChainTarget;
  chains?: ChainTarget[];
  visual?: {
    id?: string;
    atMs?: number;
    source?: number;
    sourcePos?: number;
    targetPos?: number;
    skillVisual?: unknown;
    sourceId?: string;
    sourceSummon?: boolean;
    ranged?: boolean;
    attackKind?: string;
  };
}

const summonTrait: Record<string, string> = { fire: '화염', lightning: '번개', plague: '독' };

/** 이벤트 목록을 연출 명령으로 바꾼다(combat-visuals.js plan). */
export function plan(events: readonly CombatEvent[] | undefined, units: readonly PlanUnit[]) {
  const byId = new Map(units.map((u) => [u.uid, u]));
  const out: Command[] = [];
  for (const e of events || []) {
    const source = e.source === undefined ? undefined : byId.get(e.source);
    const target = e.target === undefined ? undefined : byId.get(e.target);
    const base: PlanBase = {
      eventId: e.visual?.id,
      eventAt: e.visual?.atMs,
      source: e.source ?? e.visual?.source,
      target: e.target,
      sourcePos: e.sourcePos ?? e.visual?.sourcePos ?? source?.pos,
      targetPos: e.visual?.targetPos ?? target?.pos,
      skillVisual: e.visual?.skillVisual,
      sourceId: e.visual?.sourceId ?? source?.id,
      sourceSummon: e.visual?.sourceSummon ?? !!source?.summon,
      sourceTrait: (source?.summonKind && summonTrait[source.summonKind]) || source?.trait,
      targetTeam: target?.team,
      critical: !!e.critical,
    };
    const amount = e.amount || 0;
    if (e.kind === 'damage' && target) {
      const ranged = !!source && (source.stats.RNG > 1 || distance(source.pos, target.pos) > 1);
      const kind = e.attackKind || 'skill';
      out.push({
        ...base,
        kind: 'damage',
        amount: Math.max(0, amount),
        text: amount > 0 ? (e.critical ? '치명타 ' : '') + '−' + numberText(amount) : '흡수',
        tone:
          kind === 'dot'
            ? 'dot'
            : e.critical
              ? 'critical'
              : target.team === 'ally'
                ? 'incoming'
                : e.damageType === 'magic'
                  ? 'magic'
                  : 'physical',
        ranged: e.visual?.ranged ?? ranged,
        attackKind: kind,
        damageType: e.damageType,
        itemProc: e.sourceTag === 'ITEM_PROC',
      });
    } else if (e.kind === 'heal' && target && amount > 0)
      out.push({ ...base, kind: 'heal', text: '+' + numberText(amount), amount, tone: 'healing' });
    else if (e.kind === 'shield' && target && amount > 0)
      out.push({
        ...base,
        kind: 'shield',
        text: '보호막 +' + numberText(amount),
        amount,
        tone: 'shielding',
      });
    else if (e.kind === 'evade' && target)
      out.push({
        ...base,
        kind: 'evade',
        text: '회피',
        tone: 'evade',
        ranged: !!e.visual?.ranged,
        attackKind: e.visual?.attackKind,
      });
    else if (e.kind === 'chainLightning' && source && e.primary)
      out.push({ ...base, kind: 'chainLightning', primary: e.primary, chains: e.chains || [] });
    else if (e.kind === 'skill' && source) out.push({ ...base, kind: 'cast' });
    else if (e.kind === 'summon' && target) out.push({ ...base, kind: 'spawn' });
    else if (e.kind === 'death' && target) out.push({ ...base, kind: 'death' });
  }
  return out;
}

/**
 * 픽셀 VFX를 쓰는 명령인지(pixel-vfx.js mapping).
 * 원거리 기본 공격은 회색 탄, C01(녹스) 스킬 적중은 비행 없이 노란 폭발.
 */
export function pixelMapping(
  c: Command,
): { theme: PixelTheme; flight: boolean; hit: boolean } | null {
  if (c.kind !== 'damage' && c.kind !== 'evade') return null;
  if (c.attackKind === 'basic' && c.ranged)
    return { theme: 'gray', flight: true, hit: c.kind === 'damage' };
  if (c.kind === 'damage' && c.sourceId === 'C01' && !c.sourceSummon && c.attackKind === 'skill')
    return { theme: 'yellow', flight: false, hit: true };
  return null;
}

/** 원거리 공격이 날아가는 시간(ms, battle-view.js와 같은 식) */
export function flightMs(dx: number, dy: number, speed: number) {
  return Math.max(65, Math.min(210, 90 + Math.hypot(dx, dy) * 0.35) / speed);
}

/** 숫자·시전·사망 연출 길이(battle-view.js). reduced는 움직임 줄이기 설정 */
export const durations = {
  number: (speed: number, reduced: boolean) =>
    reduced ? 450 : Math.max(500, 900 / Math.sqrt(speed)),
  castGlow: (speed: number) => Math.max(240, 650 / Math.sqrt(speed)),
  castSpark: (speed: number) => Math.max(200, 520 / Math.sqrt(speed)),
  ring: (speed: number) => Math.max(140, 430 / Math.sqrt(speed)),
  hit: (speed: number) => Math.max(90, 180 / speed),
  lunge: (speed: number) => Math.max(100, 230 / speed),
  death: (speed: number, reduced: boolean) =>
    reduced ? 100 : Math.max(160, 320 / Math.sqrt(speed)),
  /** 전투가 끝난 뒤 마지막 장면을 보여 주는 시간 */
  finish: (speed: number, reduced: boolean) =>
    reduced ? 500 : Math.max(700, 1100 / Math.sqrt(speed)),
};
