// 메타 레벨 수치(테스트용 임시값, 요청서 v0.17.2). 최대 레벨 100만 확정.
// 사용자 승인 없이 바꾸지 않는다. 계산은 src/core/meta.ts.
export default {
  maxLevel: 100,
  /** 원정 보상: 기본 + 정규 구간 완료 스테이지 × perStage + 6-5 클리어 보너스(정규 구간 최대 80) */
  reward: { base: 5, perStage: 2, clearBonus: 15, regularStages: 30 },
  /** 레벨 L → L+1 필요 XP = start + step × (L − from), from ≤ L ≤ to */
  curve: [
    { from: 1, to: 10, start: 8, step: 2 },
    { from: 11, to: 25, start: 28, step: 4 },
    { from: 26, to: 50, start: 92, step: 8 },
    { from: 51, to: 75, start: 300, step: 12 },
    { from: 76, to: 99, start: 620, step: 20 },
  ],
};
