// 캐릭터 설정 편집 규칙(v0.26.4 관리자): 종족·직업·특성·성별. 순수 함수.
// 값은 지금 게임에 있는 값 중에서만 고른다(새 이름을 만들지 않음 — 유대·연출·규칙이 이 이름으로 판정하므로).
// 게임 영향: 직업이 마법사·사제·주술사·소환사면 전투 MP 획득 ×1.5(battle.gainMana), 특성은 스킬·투사체 색(연출).
// 종족은 지금 화면 표시용. 유대(테마 유대 2개)는 별도 데이터라 여기서 바꾸지 않는다. 코스트·스킬도 바꾸지 않는다.
import D from './data/units.js';

export type ProfileKey = 'race' | 'job' | 'trait' | 'gender';
export type UnitProfile = Record<ProfileKey, string>;

type Unit = {
  id: string;
  race: string;
  job: string;
  trait: string;
  gender: string;
  sourceProfile: UnitProfile;
};
const roster = D.roster as unknown as Unit[];
const uniq = (k: ProfileKey) =>
  [...new Set(roster.map((u) => u.sourceProfile[k]))].sort((a, b) => a.localeCompare(b, 'ko'));

export const profileFields: readonly {
  key: ProfileKey;
  label: string;
  options: readonly string[];
  note?: string;
}[] = [
  { key: 'race', label: '종족', options: uniq('race'), note: '지금은 화면 표시용' },
  {
    key: 'job',
    label: '직업',
    options: uniq('job'),
    note: '마법사·사제·주술사·소환사는 전투 MP 획득 ×1.5',
  },
  { key: 'trait', label: '특성', options: uniq('trait'), note: '스킬·투사체 색' },
  { key: 'gender', label: '성별', options: ['female', 'male'] },
];
export const profileKeys = profileFields.map((f) => f.key);
export const genderLabel: Record<string, string> = { female: '여', male: '남' };

const unit = (id: string) => roster.find((u) => u.id === id);
/** 지금 게임 값(원본 + 반영본) */
export const gameProfile = (id: string): UnitProfile | undefined => {
  const u = unit(id);
  return u ? { race: u.race, job: u.job, trait: u.trait, gender: u.gender } : undefined;
};
/** 원본 값 */
export const sourceProfile = (id: string): UnitProfile | undefined => {
  const u = unit(id);
  return u ? { ...u.sourceProfile } : undefined;
};

/** 고를 수 있는 값인지(키별 오류, 없으면 빈 객체) */
export function checkProfile(
  p: Partial<Record<string, unknown>>,
): Partial<Record<ProfileKey, string>> {
  const out: Partial<Record<ProfileKey, string>> = {};
  for (const f of profileFields)
    if (typeof p[f.key] !== 'string' || !f.options.includes(p[f.key] as string))
      out[f.key] = '목록에 있는 값만 고를 수 있습니다';
  for (const k of Object.keys(p))
    if (!profileKeys.includes(k as ProfileKey)) out[k as ProfileKey] = '알 수 없는 항목';
  return out;
}

export const sameProfile = (a?: UnitProfile | null, b?: UnitProfile | null) =>
  !!a && !!b && profileKeys.every((k) => a[k] === b[k]);

/** 원본과 다른 항목만(반영본 파일에 쓰는 형태) */
export function profileDiff(id: string, p: UnitProfile): Partial<UnitProfile> {
  const src = sourceProfile(id);
  if (!src) return {};
  return Object.fromEntries(profileKeys.filter((k) => p[k] !== src[k]).map((k) => [k, p[k]]));
}

export default {
  profileFields,
  profileKeys,
  genderLabel,
  gameProfile,
  sourceProfile,
  checkProfile,
  sameProfile,
  profileDiff,
};
