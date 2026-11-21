# AUTOCHESS 전체 게임 기획·현재 실행 명세

기준 버전: **0.18.4**. 0.16.0은 코드 구조(재구축)와 화면 표시를 바꿨고, 0.17.0은 증강을 54종 1차 후보안으로 바꾸고 이전 증강·0.17.0 이전 저장을 지웠고, 0.18.0은 전장을 좌우 대치 8열×7행으로 바꿨고, 0.18.1은 패널 테두리·보드 크기·그림자만 다듬었습니다. 그 밖의 게임 규칙·수치·밸런스는 **0.15.18**과 같습니다(화면·동작 차이는 패치노트의 "재구축 변경 사항" 탭). 원래 조사 기준: **0.15.18** (package.json / dist/patch-notes.js / 화면 표기 대조). 조사 기준 소스는 v0.15.12 커밋 4fc1087634a3743c0459438d9ebd20bb372b3b3c에서 이어진 현재 작업 트리입니다. 작성 기준일: 2026-11-15 (Asia/Seoul). 이번 0.15.18은 상점·보관함·도감의 UI/이미지 표시만 변경했습니다. 보드 이미지와 좌표는 유지합니다. 게임 규칙·밸런스는 유지합니다.

**구분:** [확정 기획] 원문에 명시되거나 이후 사용자 요청으로 승인한 구조/정책. [구현] 현재 실행 경로 존재. [임시] 실행되지만 최종 밸런스 미확정. [미구현] 데이터/계획만 존재. [확인 필요] 승인·의도 또는 현재 검증으로 확정할 수 없는 부분. 구현되었다고 모든 숫자가 최종 확정인 것은 아닙니다.

[전체 기획](GAME_DESIGN.md) · [용어집](GLOSSARY.md) · [미구현/확인 필요](UNIMPLEMENTED.md) · [변경 이력/불일치](CHANGELOG.md)

## 1. 문서 기준과 게임 범위

싱글플레이 PvE 자동 전투 웹 프로토타입입니다. 게임 판정은 브라우저JavaScript,저장은localStorage이며 서버 권위 판정이나 온라인 대전은 확인되지 않습니다. UI의 부드러운 이동은 타일 판정을 시각화한 것이며 자유 이동 물리는 없습니다.

- [확정 기획]45명 ID/코스트/종족·직업·특성 각1개,종족9·직업9·특성10은메타데이터이며별도테마유대16종.
- [구현]1코스트12명+2코스트11명+3코스트10명+4코스트8명+5코스트4명=45명 모두 플레이.
- [임시]모든 캐릭터stats의provisional=true. 스킬계수/전투공식/적스케일 등은 테스트값을 포함합니다. 이름은0.15.9 사용자 매핑으로 승인된 표시값입니다.
- [미구현]메타성장 지급,능력치/뽑기 콘텐츠,특수아이템 기능.

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [docs/README_AUTCHESS_CODEX.md:11](specs/README_AUTCHESS_CODEX.md#L11) · `## 1. 확정된 기본 설정`, [docs/AUTOCHESS_02.md:3](specs/AUTOCHESS_02.md#L3) · `상태:`.

## 2. 시작·진행·종료

시작화면→난이도1~10→새원정. 시작7G,Lv3/XP0,무작위서로다른1코스트2명+2코스트1명은 대기석. 초기상점은 무작위가 아니라C02/C04/C09/C10/C11 고정후보입니다. 다음상점부터 레벨확률 사용.

[src/core/run.ts:21](../src/core/run.ts#L21) · `function newRun`, [src/core/preparation.js:274](../src/core/preparation.js#L274) · `function startingRoster`.

| 계층/필드 | 의미 |
| --- | --- |
| stage | 상위구간:1,2,… UI ROUND N의N |
| round | 구간내1~5노드 |
| wave / ordinal | (stage−1)×5+round. 패배HP·적규모에사용 |
| label | stage-round표기. completedRounds와보너스장부키 |

| 상위구간 | 노드1 | 노드2 | 노드3 | 노드4 | 노드5 |
| --- | --- | --- | --- | --- | --- |
| 1 | SUPPLY | SUPPLY | BATTLE | BATTLE | BOSS |
| 2이후 | BATTLE | BATTLE | SUPPLY | BATTLE | BOSS |


증강은1-3/3-3/5-3 진입직전. 선택대기중에는이전노드값이남고pendingPick.node에목적지가저장될수있습니다. 선택후목적지로갱신합니다. 보급은전투없음/적없음/HP손실없음.

6-5 정산후HP>0이면 종료/계속 선택.종료는complete 상태로기록보존,계속은7-1. HP0은gameover가우선. 이미7+구간인기존세이브는소급팝업없음.7+는동일패턴기록용이며 메타XP미지급을안내하지만 실제메타XP지급은1~6을포함해모두비활성입니다.

[src/core/progression.js:495](../src/core/progression.js#L495) · `function advanceRound`, [src/core/progression.js:518](../src/core/progression.js#L518) · `function chooseCompletion`.

## 3. 난이도·플레이어 체력

| 난이도 | 시작HP | 최대HP | 적전투피해배율 | 적피해증감 |
| --- | --- | --- | --- | --- |
| 1 | 100 | 100 | 0.6 | -40% |
| 2 | 90 | 100 | 0.7 | -30% |
| 3 | 90 | 100 | 0.8 | -20% |
| 4 | 80 | 100 | 0.9 | -10% |
| 5 | 80 | 100 | 1 | 0% |
| 6 | 70 | 100 | 1.1 | 10% |
| 7 | 70 | 100 | 1.2 | 20% |
| 8 | 60 | 100 | 1.3 | 30% |
| 9 | 60 | 100 | 1.4 | 40% |
| 10 | 50 | 100 | 1.5 | 50% |


승리newHP=min(100,oldHP+2),일반/보스동일.보급/증강은회복없음.패배기본손실=10+ordinal×2,실제손실=min(현재HP,기본손실).적생존수는기록하지만loss.mode=legacy-round에서는사용하지않습니다. 무승부·시간초과도패배로처리.

적피해배율은적의기본/스킬/DOT/소환공격에적용되며 플레이어패배HP손실배율은아닙니다. 난이도는시작HP가낮아져도최대HP100을유지합니다.

[src/core/encounters.js:13](../src/core/encounters.js#L13) · `const difficulties=`, [src/core/progression.js:428](../src/core/progression.js#L428) · `legacyDamage=`.

## 4. 전장·준비 조작

8열×7행 좌우 대치(v0.18.0, 이전 7열×8행 상하 대치). 왼쪽 4열(col 0~3)은 아군, 오른쪽 4열(col 4~7)은 적이고 칸 번호 pos = 행×8 + 열. 아군은 오른쪽, 적은 왼쪽을 바라봅니다. 적 진영에 놓으면 "아군 진영 왼쪽 4열에만 배치할 수 있습니다."(T14). 배치한도=인게임레벨(최대10),P12선택시+1/최대11. 대기석10칸. 기존세이브의초과대기동료는별도이전보유목록으로보존하며새영입으로10칸을초과시키지않습니다.

동일캐릭터ID는전장1명.클릭정보/드래그이동·교환.빈아군이면실제전투시작차단.1명이상이고정원미달이면확인창과이번원정다시묻지않음.보급/증강/결과확인은이차단대상이아닙니다. 장비는준비단계만조작,캐릭터실제드래그(7px초과)에서양쪽판매영역. v0.18.3: 일반 팝업(영입창·설정·더보기·유대/증강 미리보기·아이템·캐릭터 상세)이 열린 채 대기석·전장 캐릭터나 아이템을 누르고 끌면 팝업을 닫고 같은 누름으로 바로 드래그한다(끌기 시작 때 남은 일반 팝업도 모두 닫음). 움직이지 않고 떼면 팝업 닫기로만 쓰고, 팝업 밖 버튼 클릭도 닫기로만 쓴다. 보급·증강·결과·배치 확인 같은 확인 창은 뒤쪽 입력을 계속 막는다.

[src/core/board.js:1](../src/core/board.js#L1) · `const config=`, [src/core/preparation.js:74](../src/core/preparation.js#L74) · `function moveUnit`, [src/ui/store.ts:360](../src/ui/store.ts#L360) · `function beginBattle`.

## 5. 경제·상점·합성

| 항목 | 현재규칙 |
| --- | --- |
| 시작골드 | 7 |
| 후보 | 5 |
| 구매 | 코스트1/2/3G |
| 수동리롤 | 2G,S11선택시1G |
| 일반승/패 | 3G/1G |
| 보스승/패 | 5G/3G |
| 연승 | 첫승부터+1G씩최대5G,패배초기화,보급유지/지급없음 |
| 이자 | 정산전소지금10G당1G/최대5G,승패모두,보급없음 |
| 보급추가 | 50%발동,당첨시2G/3G각50% |
| 보스추가골드 | 승리시독립60%,stage1~6=5/7/9/11/13/15G,7+=15G(테스트금액) |
| 보너스몬스터골드 | 처치시즉시3~5G중하나.정산전에입금되어이자기준잔고에포함될수있음 |
| 증강승리추가 | v0.17.0: P07 승리마다+2G, S11 사망0승리+2G, P12 승리시보유골드10%(최대5G), G10 패배시+3G·무료새로고침1, S12/G11 전투횟수지연보상, 보급제외 |
| 판매 | cost×3^(star−1),합성가격과일치 |
| 합성 | 같은ID/같은성급3명→다음성급,최대3성,1성9명분=3성 |
| 성급기본스탯 | HP/AD/AP에2^(star−1),나머지기본스탯미증가 |


보스승리확정아이템은골드추가와독립. total=base+interest+bonusGold+streakBonus+augmentGold. totalEarned는전투중이미입금된보너스몬스터골드를더한보고값이며다시입금하지않습니다. completedRounds[key]가이미있으면같은영수증만반환하고재지급/재XP없음.

합성기준은전장동료우선,없으면가장왼쪽대기석.소모동료장비는보관함반환,유지동료장비보존. 영입후연쇄합성이즉시처리되며900/680ms효과는별도.영입예고는실제로구매했을때도달하는2/3성만표시하고보유강조/추천강조와공존합니다. 대기석가득차도그구매로합성되면영입가능.

보유3성ID는상점풀에서제외(새로 뽑을 때만),판매후복귀. v0.18.3(사용자 요청): 구매로 3성이 돼도 이미 떠 있는 같은 캐릭터 후보와 잠근 후보는 바꾸지 않고 그대로 살 수 있다(1성으로 들어옴, 구매한 칸만 빈칸). 상점 칸 밖의 영입(도감 무료 영입)은 3성 보유면 T04로 거절. 다음 라운드 준비에 들어갈 때마다 영입창을 한 번 자동으로 연다(v0.18.4 사용자 정정: 같은 구간 안 이동·증강 선택 뒤 포함. ROUND·STAGE 안내 뒤, 새 원정 1-1·원정 종료·불러오기·화면 복귀로는 열지 않음). 영입창은 0.2초 동안 위에서 아래로 펼쳐지며 열린다(카드는 왼쪽부터 25ms 간격). 1회성잠금은다음노드의후보/매진빈칸유지후해제.수동리롤성공시해제,돈부족등실패시상태유지.증강이끼면shopCarry로목적지까지이월.추천은최대3개,확률에는영향없음.

[src/core/progression.js:366](../src/core/progression.js#L366) · `function settleRound`, [src/core/shop.ts:47](../src/core/shop.ts#L47) · `function salePrice`, [src/core/merge.ts:29](../src/core/merge.ts#L29) · `function mergeAll`, [src/core/preparation.js:195](../src/core/preparation.js#L195) · `function enterShop`.

### 레벨별 원본 코스트 가중치와 현재 출현율

원본표는코드에전사된고정값이며이문서는외부게임의최신확률을재검증한문서가아닙니다.출처URL은preparation.js의oddsSource에보관.해금/보유3성제외후해당코스트에후보가없으면그가중치를제외하고재정규화.동일코스트내캐릭터는균등추첨,공유재고/상점유닛수량제한없음.

| Lv | 원본1G | 2G | 3G | 4G | 5G | 현재1G% | 현재2G% | 현재3G% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 100 | 0 | 0 | 0 | 0 | 100 | 0 | 0 |
| 2 | 100 | 0 | 0 | 0 | 0 | 100 | 0 | 0 |
| 3 | 100 | 0 | 0 | 0 | 0 | 100 | 0 | 0 |
| 4 | 65 | 25 | 10 | 0 | 0 | 65 | 25 | 10 |
| 5 | 45 | 33 | 20 | 2 | 0 | 45 | 33 | 20 |
| 6 | 30 | 40 | 25 | 5 | 0 | 30 | 40 | 25 |
| 7 | 19 | 30 | 40 | 10 | 1 | 19 | 30 | 40 |
| 8 | 18 | 25 | 32 | 22 | 3 | 18 | 25 | 32 |
| 9 | 15 | 20 | 25 | 30 | 10 | 15 | 20 | 25 |
| 10 | 5 | 10 | 20 | 40 | 25 | 5 | 10 | 20 |


[src/core/preparation.js:160](../src/core/preparation.js#L160) · `const baseOdds=`.

## 6. 인게임 레벨·메타 레벨

| 레벨 | 다음레벨요구XP |
| --- | --- |
| 1 | 2 |
| 2 | 2 |
| 3 | 6 |
| 4 | 10 |
| 5 | 20 |
| 6 | 36 |
| 7 | 56 |
| 8 | 68 |
| 9 | 68 |


인게임시작Lv3,4G로4XP,모든노드정산시자동2XP(보급·패배포함/임시),초과XP이월,다중레벨업,최고10에서는XP0. 증강S08/P09은즉시10/20XP(P09는스테이지5라운드정산마다+3XP), G12는레벨상승마다2·3코스트동료1명(이전 증강 LS10/LG11/LP10은즉시8/16/32XP).

메타 레벨(v0.17.2, 수치 임시값 `src/core/data/meta.js`): Lv.1·0 XP에서 시작, 최대 Lv.100(확정). 레벨 L→L+1 필요 XP는 1~10: 8+2×(L−1), 11~25: 28+4×(L−11), 26~50: 92+8×(L−26), 51~75: 300+12×(L−51), 76~99: 620+20×(L−76). 누적 Lv.7 78, Lv.10 144, Lv.50 5,426, Lv.100 37,210. 원정이 끝날 때(HP 0 게임 오버, 6-5 뒤 게임 종료, 무한 라운드 게임 오버) 한 번 지급: 5 + 정규 구간(1-1~6-5) 완료 스테이지(보급 포함, 패배 제외) × 2 + 6-5 승리 시 15, 최대 80. 7-1 이후 추가 0. 원정 ID(runId)로 같은 원정에 한 번만 지급하고, 남는 XP는 이월, Lv.100에서는 더 쌓지 않음. 프로필 저장 키 `autochess-meta-v1`(메타 레벨·현재 XP·누적 XP·최근 지급 20건). 인게임 레벨·XP와 별개이고, 레벨업 보상·영구 강화는 없음(growthEnabled=false, 능력치·뽑기 메뉴 준비 중). v0.17.3·v0.17.4(사용자 결정): 끝내지 않은 원정을 새 원정으로 바꾸면 기본 5 없이 그때까지 완료한 스테이지 × 2로 지급(포기, 아무것도 안 했으면 0), 6-5 뒤 계속 진행을 고르면 그 순간 정규 구간 보상 확정(이후 추가 없음). 6-5 패배 생존은 29스테이지·보너스 없음, 살아남은 패배 노드는 완료 수에서 제외.

[src/core/progression.js:126](../src/core/progression.js#L126) · `function addXp`, [src/core/meta.ts:5](../src/core/meta.ts#L5) · `META_KEY`, [src/core/meta.ts:159](../src/core/meta.ts#L159) · `export function settleRun`.

## 7. 전투 판정 상세(구현된 임시 수치 포함)

- tick=0.1초,제한90초. UI배속1/2/4는실제tick간격을바꾸며tick내dt는0.1초입니다.
- 살아있는UID순서로순차행동.동시피해일괄계산이아닙니다.대상은맨해튼거리→절대현재HP낮음→UID 순.
- 사거리RNG도맨해튼거리.4방향BFS,다른생존유닛칸은통과불가,이동1칸후공통moveCooldown0.35초.스킬돌진은기존BFS로마지막도달칸까지.
- 기본공격은AD물리,소환수의fire/lightning은마법예외.공격쿨다운=1/max(0.1,현재AS).기본공격만일반회피/치명타.
- 스킬은충분한MP및사거리또는globalSkill/돌진예외로시전.MP는0으로초기화,시전중0.25초행동제한.최대MP감소는시전필요량도줄입니다.
- MP는공격시12,피격시6,마법사/사제/주술사/소환사계열1.5배,manaGain보정.실제HP피해0의완전흡수타도피격MP를얻지만회피는반환되어못얻음.
- 시작MP0.QuickMana테스트는100%,S03·P02는최종최대MP의20%·50%로시작(여러개면큰값하나).

### 계산 순서

1. 기본HP/AD/AP에성급배율×적scale 적용.
2. 장비고정스탯가산,장비AS%는합산후곱.
3. 증강flat가산,증강AS합산곱,최대MP감소율합산(최소1).
4. 상태이상stat/mult와아이템중첩,증강전투시간버프등현재stats조회.
5. raw=공격계수×적난이도배율(적만)×치명배율(발생시CTH/100)×skillPower(스킬/DOT만).
6. damage=max(raw,0)×100/(100+max(GD,0)).물리/마법동일.
7. 보호막순서대로흡수→죽음방지검사→실제HP피해=min(남은HP,피해).초과살상은딜량에미포함.
8. 피해로그/피격마나/반격/흡혈/처치후효과.시각투사체도달은실제판정을늦추지않음.

치유=요청량×source.healingPower×(1−min(0.9,max(고정치유감소,유효한시간제치유감소))),최대HP빈칸까지만. C33과실험유대치유감소는큰값우선.현재regen은직접HP갱신으로이공식우회(의도확인필요). 보호막은별도스택으로유효시간까지소모순서대로흡수.

DOT는대체로1초간격,마지막유효틱포함.같은key+source는지속시간갱신(일부amount갱신),다른시전자DOT중첩.시전자사망후에도units에남아있어기존DOT는지속할수있습니다. harmful상태하나정화는배열의첫항목.

[src/core/combat/battle.js:568](../src/core/combat/battle.js#L568) · `tick(dt=`, [src/core/combat/battle.js:241](../src/core/combat/battle.js#L241) · `deal(source,target`, [src/core/combat/battle.js:210](../src/core/combat/battle.js#L210) · `heal(target,amount`, [src/core/items.js:561](../src/core/items.js#L561) · `function applyStats`, [src/core/augments.js:349](../src/core/augments.js#L349) · `function applyStats`.

### 전투 공통 임시 설정 원문값

```json
{
  "tickSeconds": 0.1,
  "maxSeconds": 90,
  "defenseDenominator": 100,
  "startMana": 0,
  "manaOnAttack": 12,
  "manaOnHit": 6,
  "magicManaMultiplier": 1.5,
  "castTime": 0.25,
  "skillsCrit": false,
  "basicDodge": true,
  "skillsDodge": false,
  "statusPolicy": "같은 시전자·같은 효과는 갱신, 다른 시전자 DOT는 중첩",
  "duplicateSynergy": "서로 다른 ID만 집계",
  "summonPlacementRadius": 3,
  "chargeStepSeconds": 0.12
}
```

## 8. 적군·보스·보너스 몬스터

적은E01~E08 별도명칭·ID이며기본스탯과skillId는기존아군원형을재사용합니다.적전용새고유스킬이모두설계된상태는아닙니다. wave=ordinal,n=min(10,2+floor(wave×0.8)),scale=0.72+wave×0.055.상위구간마다총2회승급을n명에분산,최대3성.

보스노드의첫유닛에boss표시가붙지만전용HP/AD배율이나별도보스스킬분기는확인되지않습니다. 적배치는고정전열/후열목록. encounter는키당캐시해리렌더/재접속시재추첨하지않습니다.

전투마다10%로적1명이E99보물슬라임으로교체.처치관여source가아군일때1회만장부지급:40%전체40종균등아이템/60%3~5G균등.보급의티어분포와다른추첨입니다. 소환수사망은보너스제외.

| 적ID | 이름 | 재사용스킬 | HP | MP | AD | AP | GD |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E01 | 해골 궁수 | C01 | 550 | 80 | 55 | 25 | 18 |
| E02 | 역병 거미 | C02 | 520 | 70 | 35 | 55 | 16 |
| E03 | 고블린 검병 | C03 | 750 | 100 | 55 | 20 | 30 |
| E04 | 그림자 박쥐 | C04 | 540 | 80 | 60 | 20 | 18 |
| E05 | 심해 슬라임 | C08 | 500 | 60 | 35 | 60 | 15 |
| E06 | 바위 골렘 | C10 | 800 | 100 | 40 | 20 | 40 |
| E07 | 잿불 정령 | C11 | 600 | 80 | 40 | 50 | 25 |
| E08 | 가시 수호자 | C12 | 760 | 100 | 45 | 30 | 38 |
| E99 | 보물 슬라임 | C10 | 650 | 100 | 35 | 20 | 20 |


[src/core/encounters.js:82](../src/core/encounters.js#L82) · `function encounter`, [src/core/encounters.js:75](../src/core/encounters.js#L75) · `function stageStars`, [src/core/encounters.js:110](../src/core/encounters.js#L110) · `function claimBonusLoot`.

## 9. 테마 유대16종 · 임시 밸런스 v1

새 유대는 항상 적용되며 옛28종 효과는 폐기했습니다. 종족/직업/속성 메타데이터와 직업별 마나 규칙은 유지합니다. 서로 다른 ID만 세고 최고 단계 하나만 적용합니다.

| 유대 | 단계 | 단계별 실제 효과 | 현재 해금 멤버 수 |
| --- | --- | --- | --- |
| 혈광 | 2/4/6 | 2명: AD +10%<br>4명: AD +15% · HP 50% 이하 AS +25%<br>6명: AD +20% · HP 60% 이하 AS +40% · 가한 피해 10% 흡혈 | 6 |
| 월하 | 2/4 | 2명: AS +10%<br>4명: AS +15% · 동일 대상 연속 기본 공격 +5%p · 최대 4중첩 | 5 |
| 종언 | 2/4/6 | 2명: AD +10%<br>4명: AD +15% · 대상 HP 30% 이하 피해 +20%<br>6명: AD +20% · 대상 HP 40% 이하 피해 +35% · 처치 MP +20 | 6 |
| 흑월 | 2/4/6 | 2명: 치명타 +10%p<br>4명: 치명타 +15%p · 치명타 추가 물리 피해 AD 30%<br>6명: 치명타 +20%p · 치명타 추가 물리 피해 AD 50% · 치명타 처치 후 다음 기본 공격 확정 치명타 | 7 |
| 무극 | 2/4/6 | 2명: AS +10%<br>4명: AS +15% · 기본 공격마다 AS +3%p · 최대 5중첩<br>6명: AS +20% · 기본 공격마다 AS +4%p · 최대 8중첩 · 최대 중첩 기본 공격 피해 +20% | 6 |
| 철혈 | 2/4 | 2명: GD +10<br>4명: GD +15 · 시작 시 최대 HP 15% 보호막 · 8초 | 5 |
| 성약 | 2/4 | 2명: HP +10%<br>4명: HP +15% · 인접 아군 피해 15% 분담 · 1회 전달 | 5 |
| 생명 | 2/4/6 | 2명: 제공 회복·보호막 +15%<br>4명: 제공 회복·보호막 +25% · 유대 전체 5초마다 최저 HP 비율 아군 최대 HP 5% 회복<br>6명: 제공 회복·보호막 +35% · 유대 전체 5초마다 최저 HP 비율 아군 최대 HP 8% 회복 · 같은 대상 최대 HP 8% 보호막 · 5초 | 6 |
| 윤회 | 2/4/6 | 2명: HP +10%<br>4명: HP +15% · 아군 사망 시 AD/AP +5% · 최대 4중첩<br>6명: HP +20% · 아군 사망 시 AD/AP +7% · 최대 5중첩 · 각 유닛 첫 사망 시 HP 30% 즉시 부활 · 전투당 1회 | 6 |
| 천명 | 2/4 | 2명: GD +10<br>4명: GD +15 · 시작 인접 아군 GD +10 · 중복 미중첩 | 5 |
| 왕권 | 2/4 | 2명: HP +10%<br>4명: HP +15% · 자신의 군중제어 대상 받는 피해 +10% · 3초 | 5 |
| 아르카나 | 2/4 | 2명: AP +10%<br>4명: AP +15% · 시전 후 MP +15 | 5 |
| 공명 | 2/4/6 | 2명: AP +10%<br>4명: AP +15% · 직접 스킬 명중 대상당 시전당 1회 AP 30% 추가 마법 피해<br>6명: AP +20% · 직접 스킬 명중 대상당 시전당 1회 AP 50% 추가 마법 피해 · 인접 적 1명에 추가 피해의 50% | 6 |
| 심연 | 2/4 | 2명: AP +10%<br>4명: AP +15% · 스킬 명중 대상 받는 회복 -30% · 4초 | 5 |
| 운명 | 2/4 | 2명: AD +8% · AP +8%<br>4명: AD +12% · AP +12% · 시작 시 유대 공통 무작위: AD/AP +10% / GD +15 / 시작 MP +20 | 5 |
| 금단 | 2/4/6 | 2명: 스킬 피해 +10%<br>4명: 스킬 피해 +20% · 시전 시 현재 HP 4% 소모 · 최소 HP 1 · 다음 스킬 피해 +15% · 중복 미중첩<br>6명: 스킬 피해 +30% · 시전 시 현재 HP 5% 소모 · 최소 HP 1 · 다음 스킬 피해 +25% · 중복 미중첩 · 실제 스킬 피해 10% 회복 | 7 |


45명×2유대=90배정. 전체45명 모두해금. 16종전부4인단계,8종은6인단계활성가능. 전투의 상태/부활/분담/재귀 차단은 bond-effects.js, 기본 단계 데이터는 bonds.js, 이전 추천은 preparation.normalize에서 유효 ID만 남깁니다.

[src/core/combat/bond-effects.js:7](../src/core/combat/bond-effects.js#L7) · `function init`, [src/core/data/bonds.js:8](../src/core/data/bonds.js#L8) · `const rules=`.

## 10. 캐릭터45명 전체 데이터와 스킬

표는data.js로최종이름/해금여부를합친실행데이터입니다.higher-cost-drafts.js 원래이름/implemented=false를그대로사용하지않습니다. 모든수치는기본1성/장비없음/증강없음.CTH/CTC/DOD는%.AS는초당공격횟수,RNG는칸.45명모두실행분기구현.

### C01 · 녹스

- 1G · 언데드 / 궁수 / 화염
- 유대: 종언 / 흑월
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 550 | 80 | 55 | 25 | 150 | 10 | 18 | 0.8 | 4 | 5 |

**불씨 화살** · 계수 AD

대상에게 AD 160% 물리 피해. 4초 화상: 매초 AD 15% 마법 피해.



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/units.js:144](../src/core/data/units.js#L144) · `C01:`, [src/core/combat/skills/cost1.js:6](../src/core/combat/skills/cost1.js#L6) · `C01(u, target, s)`.

### C02 · 아즈칼

- 1G · 마족 / 소환사 / 독
- 유대: 심연 / 금단
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 520 | 70 | 35 | 55 | 150 | 5 | 16 | 0.65 | 3 | 0 |

**맹독의 하수인** · 계수 AP

8초 역병충 소환, 최대 2마리. AP 40% 공격력, 공격 시 3초 중독. 소환수 수치·독 피해는 임시.

역병충 HP180×성급배율,AS0.8,RNG1,8초,최대2,AD=시전자AP×0.4. 독=AP×0.12/초×3초(임시).

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/units.js:149](../src/core/data/units.js#L149) · `C02:`, [src/core/combat/skills/cost1.js:10](../src/core/combat/skills/cost1.js#L10) · `C02(u, target, s)`.

### C03 · 태건

- 1G · 인간 / 전사 / 암흑
- 유대: 철혈 / 윤회
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 750 | 100 | 55 | 20 | 150 | 5 | 30 | 0.7 | 1 | 0 |

**그림자 베기** · 계수 AD

대상에게 AD 180% 물리 피해. 4초간 대상 AD 15% 감소.



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/units.js:154](../src/core/data/units.js#L154) · `C03:`, [src/core/combat/skills/cost1.js:13](../src/core/combat/skills/cost1.js#L13) · `C03(u, target, s)`.

### C04 · 리엔

- 1G · 엘프 / 암살자 / 번개
- 유대: 월하 / 무극
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 540 | 80 | 60 | 20 | 150 | 15 | 18 | 0.85 | 1 | 10 |

**섬광 찌르기** · 계수 AD

AD 200% 물리 피해, 이 공격의 치명타 확률 +20%p. 치명타 시 AD 50% 추가 마법 피해.



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/units.js:159](../src/core/data/units.js#L159) · `C04:`, [src/core/combat/skills/cost1.js:17](../src/core/combat/skills/cost1.js#L17) · `C04(u, target, s)`.

### C05 · 루아

- 1G · 엘프 / 주술사 / 물
- 유대: 생명 / 운명
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 550 | 70 | 35 | 50 | 150 | 5 | 18 | 0.65 | 3 | 5 |

**치유의 물결** · 계수 AP

HP 비율이 가장 낮은 아군 AP 180% 회복. 해로운 상태이상 1개 제거.



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/units.js:164](../src/core/data/units.js#L164) · `C05:`, [src/core/combat/skills/cost1.js:24](../src/core/combat/skills/cost1.js#L24) · `C05(u, target, s)`.

### C06 · 카인

- 1G · 마족 / 암살자 / 바람
- 유대: 월하 / 무극
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 560 | 80 | 55 | 25 | 150 | 15 | 20 | 0.85 | 1 | 10 |

**바람 가르기** · 계수 AD

각각 AD 140% 물리 피해 2회. 4초간 자신의 공격속도 +20%.



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/units.js:169](../src/core/data/units.js#L169) · `C06:`, [src/core/combat/skills/cost1.js:37](../src/core/combat/skills/cost1.js#L37) · `C06(u, target, s)`.

### C07 · 유하

- 1G · 인간 / 궁수 / 번개
- 유대: 아르카나 / 운명
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 530 | 80 | 60 | 20 | 150 | 10 | 16 | 0.9 | 4 | 5 |

**연속 사격** · 계수 AD

AD 75% 물리 피해 3회. 마지막 공격은 주 대상 외 전장 생존 적 중 주 대상과 가까운 최대 2명에게 각각 AD 70% 마법 피해. 거리 동률은 UID순.

사용자승인:전장내주대상거리/UID순다른적최대2,각AD70%마법.

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/units.js:174](../src/core/data/units.js#L174) · `C07:`, [src/core/combat/skills/cost1.js:50](../src/core/combat/skills/cost1.js#L50) · `C07(u, target, s)`.

### C08 · 벨모르

- 1G · 언데드 / 마법사 / 물
- 유대: 심연 / 금단
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 500 | 60 | 35 | 60 | 150 | 5 | 15 | 0.6 | 4 | 0 |

**심연의 물구슬** · 계수 AP

대상에게 AP 220% 마법 피해. 3초간 공격속도 15% 감소.



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/units.js:179](../src/core/data/units.js#L179) · `C08:`, [src/core/combat/skills/cost1.js:86](../src/core/combat/skills/cost1.js#L86) · `C08(u, target, s)`.

### C09 · 라칸

- 1G · 용족 / 전사 / 바람
- 유대: 천명 / 무극
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 800 | 100 | 50 | 30 | 150 | 5 | 32 | 0.7 | 1 | 0 |

**용의 돌진** · 계수 AD

대상에게 돌진, AD 170% 물리 피해와 1초 기절. 인접 시 이동 없이 공격. 경로 규칙 임시.

기존BFS돌진,칸당시전지연0.12초.막히면인접도달한경우만공격.

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/units.js:184](../src/core/data/units.js#L184) · `C09:`, [src/core/combat/skills/cost1.js:90](../src/core/combat/skills/cost1.js#L90) · `C09(u, target, s)`.

### C10 · 울프릭

- 1G · 수인 / 기사 / 대지
- 유대: 철혈 / 왕권
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 800 | 100 | 40 | 20 | 150 | 5 | 40 | 0.6 | 1 | 0 |

**대지의 수호** · 계수 GD

5초간 자신의 GD +30%. 인접 아군 중 HP 비율이 가장 낮은 1명에게 GD 200% 보호막.



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/units.js:189](../src/core/data/units.js#L189) · `C10:`, [src/core/combat/skills/cost1.js:108](../src/core/combat/skills/cost1.js#L108) · `C10(u, target, s)`.

### C11 · 둔가르

- 1G · 드워프 / 소환사 / 화염
- 유대: 공명 / 심연
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 600 | 80 | 40 | 50 | 150 | 5 | 25 | 0.6 | 3 | 0 |

**화염 정령 소환** · 계수 AP

8초 화염 정령 소환, 최대 1마리. AP 60% 마법 공격. 소멸 시 주변에 AP 100% 마법 피해. 소환수·범위 수치 임시.

화염정령 HP220×성급배율,AS0.7,RNG3,8초,최대1.소멸폭발반경2(임시).

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/units.js:194](../src/core/data/units.js#L194) · `C11:`, [src/core/combat/skills/cost1.js:123](../src/core/combat/skills/cost1.js#L123) · `C11(u, target, s)`.

### C12 · 엘리엘

- 1G · 천족 / 기사 / 독
- 유대: 성약 / 천명
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 760 | 100 | 45 | 30 | 150 | 5 | 38 | 0.6 | 1 | 0 |

**부식의 방패** · 계수 GD

5초간 GD 250% 보호막. 이 보호막 유지 중 자신을 기본 공격한 적에게 3초간 GD 15% 감소.



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/units.js:199](../src/core/data/units.js#L199) · `C12:`, [src/core/combat/skills/cost1.js:126](../src/core/combat/skills/cost1.js#L126) · `C12(u, target, s)`.

### C13 · 브룬

- 2G · 드워프 / 마법사 / 빙결
- 유대: 공명 / 왕권
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 665 | 70 | 52 | 84 | 150 | 5 | 23 | 0.69 | 4 | 0 |

**빙결 폭발** · 계수 AP

대상과 인접 적에게 190% AP 마법 피해, 3초간 공격속도 20% 감소



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:4](../src/core/data/higher-cost-drafts.js#L4) · `"id": "C13"`, [src/core/combat/skills/cost2.js:6](../src/core/combat/skills/cost2.js#L6) · `C13(u, target, s)`.

### C14 · 적호

- 2G · 용족 / 무도가 / 화염
- 유대: 혈광 / 무극
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 835 | 90 | 77 | 49 | 150 | 10 | 33 | 0.89 | 1 | 5 |

**화염 연타** · 계수 AD / AP

대상에게 85% AD 물리 피해 3회, 마지막 타격에 3초 화상(초당 15% AP)



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:33](../src/core/data/higher-cost-drafts.js#L33) · `"id": "C14"`, [src/core/combat/skills/cost2.js:13](../src/core/combat/skills/cost2.js#L13) · `C14(u, target, s)`.

### C15 · 베스퍼

- 2G · 드워프 / 사제 / 암흑
- 유대: 성약 / 윤회
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 715 | 70 | 52 | 79 | 150 | 5 | 26 | 0.69 | 3 | 0 |

**어둠의 봉합** · 계수 AP

체력 비율이 가장 낮은 아군을 200% AP 회복, 대상에게 4초간 GD +15%



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:62](../src/core/data/higher-cost-drafts.js#L62) · `"id": "C15"`, [src/core/combat/skills/cost2.js:17](../src/core/combat/skills/cost2.js#L17) · `C15(u, target, s)`.

### C16 · 토비

- 2G · 수인 / 소환사 / 번개
- 유대: 공명 / 운명
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 735 | 80 | 57 | 79 | 150 | 5 | 29 | 0.69 | 3 | 0 |

**전격 늑대** · 계수 AP

8초간 전격 늑대 1마리 소환, 공격마다 55% AP 마법 피해, 최대 2마리

전격늑대 HP260×성급배율,AD=AP×0.55,AS0.85,RNG2,8초,최대2. engine.summon의 인라인 테스트값.

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:91](../src/core/data/higher-cost-drafts.js#L91) · `"id": "C16"`, [src/core/combat/skills/cost2.js:32](../src/core/combat/skills/cost2.js#L32) · `C16(u, target, s)`.

### C17 · 이그니스

- 2G · 엘프 / 전사 / 혈마법
- 유대: 혈광 / 금단
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 895 | 100 | 72 | 44 | 150 | 5 | 37 | 0.73 | 1 | 0 |

**핏빛 참격** · 계수 AD

자신 현재 HP 8% 소모, 대상에게 230% AD 물리 피해, 준 피해의 20% 회복

스킬HP비용은 현재HP8%,최소1유지. HP흡수는 실제피해20%. HP비용기준: currentHP.

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:123](../src/core/data/higher-cost-drafts.js#L123) · `"id": "C17"`, [src/core/combat/skills/cost2.js:35](../src/core/combat/skills/cost2.js#L35) · `C17(u, target, s)`.

### C18 · 아우라

- 2G · 정령 / 사제 / 신성
- 유대: 생명 / 윤회
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 715 | 70 | 52 | 79 | 150 | 5 | 26 | 0.69 | 3 | 0 |

**정화의 빛** · 계수 AP

HP 비율이 가장 낮은 아군에게 180% AP 회복과 120% AP 보호막(4초)



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:153](../src/core/data/higher-cost-drafts.js#L153) · `"id": "C18"`, [src/core/combat/skills/cost2.js:40](../src/core/combat/skills/cost2.js#L40) · `C18(u, target, s)`.

### C19 · 설아

- 2G · 천족 / 주술사 / 빙결
- 유대: 생명 / 왕권
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 725 | 80 | 57 | 79 | 150 | 5 | 27 | 0.69 | 3 | 0 |

**서리 속박** · 계수 AP

대상에게 150% AP 마법 피해, 1.5초 속박(이동 불가)



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:182](../src/core/data/higher-cost-drafts.js#L182) · `"id": "C19"`, [src/core/combat/skills/cost2.js:47](../src/core/combat/skills/cost2.js#L47) · `C19(u, target, s)`.

### C20 · 진무

- 2G · 인간 / 무도가 / 혈마법
- 유대: 혈광 / 금단
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 835 | 90 | 77 | 49 | 150 | 10 | 33 | 0.89 | 1 | 5 |

**혈기 폭주** · 계수 AD

자신 현재 HP 6% 소모, 5초간 AS +30%, 기본 공격에 20% AD 추가 물리 피해

현재HP6%소모,최소1유지. 추가기본타는별도bonusBasic 출처. HP비용기준: currentHP.

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:214](../src/core/data/higher-cost-drafts.js#L214) · `"id": "C20"`, [src/core/combat/skills/cost2.js:57](../src/core/combat/skills/cost2.js#L57) · `C20(u, target, s)`.

### C21 · 오르페

- 2G · 마족 / 마법사 / 신성
- 유대: 아르카나 / 심연
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 665 | 70 | 52 | 84 | 150 | 5 | 23 | 0.69 | 4 | 0 |

**타락한 광휘** · 계수 AP

대상에게 230% AP 마법 피해, 가장 가까운 아군에게 100% AP 보호막(4초)



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:244](../src/core/data/higher-cost-drafts.js#L244) · `"id": "C21"`, [src/core/combat/skills/cost2.js:69](../src/core/combat/skills/cost2.js#L69) · `C21(u, target, s)`.

### C22 · 골룸바

- 2G · 정령 / 전사 / 대지
- 유대: 철혈 / 천명
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 895 | 100 | 72 | 44 | 150 | 5 | 37 | 0.73 | 1 | 0 |

**지각 강타** · 계수 AD

대상에게 170% AD 물리 피해, 4초간 자신 GD +20%



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:273](../src/core/data/higher-cost-drafts.js#L273) · `"id": "C22"`, [src/core/combat/skills/cost2.js:77](../src/core/combat/skills/cost2.js#L77) · `C22(u, target, s)`.

### C23 · 로제트

- 2G · 엘프 / 기사 / 화염
- 유대: 철혈 / 왕권
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 935 | 100 | 62 | 49 | 150 | 5 | 45 | 0.66 | 1 | 0 |

**불꽃 방벽** · 계수 AP

자신과 인접 아군에게 4초간 140% AP 보호막, 근접 공격자에게 50% AP 마법 피해



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:302](../src/core/data/higher-cost-drafts.js#L302) · `"id": "C23"`, [src/core/combat/skills/cost2.js:89](../src/core/combat/skills/cost2.js#L89) · `C23(u, target, s)`.

### C24 · 유키나

- 3G · 엘프 / 사제 / 빙결
- 유대: 성약 / 흑월
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 860 | 70 | 69 | 98 | 150 | 5 | 33 | 0.72 | 3 | 0 |

**겨울의 기도** · 계수 AP

체력 비율이 낮은 아군 2명 각각 210% AP 회복, 공격자에게 2초간 AS -20%

승인판정:HP비율낮은아군2명.각아군의마지막생존기본공격자를시전시1회둔화.없는경우생략.

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:334](../src/core/data/higher-cost-drafts.js#L334) · `"id": "C24"`, [src/core/combat/skills/cost3.js:6](../src/core/combat/skills/cost3.js#L6) · `C24(u, target, s)`.

### C25 · 지그

- 3G · 정령 / 마법사 / 번개
- 유대: 아르카나 / 공명
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 810 | 70 | 69 | 103 | 150 | 5 | 30 | 0.72 | 4 | 0 |

**연쇄 뇌격** · 계수 AP

최대 3명의 적에게 순차적으로 220%/150%/100% AP 마법 피해

승인판정:현재대상부터가까운서로다른적3명으로연쇄.동률UID.

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:366](../src/core/data/higher-cost-drafts.js#L366) · `"id": "C25"`, [src/core/combat/skills/cost3.js:16](../src/core/combat/skills/cost3.js#L16) · `C25(u, target, s)`.

### C26 · 흐로드

- 3G · 언데드 / 전사 / 빙결
- 유대: 흑월 / 윤회
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1040 | 100 | 89 | 63 | 150 | 5 | 44 | 0.77 | 1 | 0 |

**냉기의 처형** · 계수 AD

대상에게 220% AD 물리 피해, 대상 HP가 40% 이하이면 추가 70% AD 피해

추가70%AD조건은첫타격전대상HP40%이하.

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:395](../src/core/data/higher-cost-drafts.js#L395) · `"id": "C26"`, [src/core/combat/skills/cost3.js:29](../src/core/combat/skills/cost3.js#L29) · `C26(u, target, s)`.

### C27 · 비올라

- 3G · 엘프 / 궁수 / 독
- 유대: 월하 / 종언
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 830 | 80 | 94 | 63 | 150 | 10 | 32 | 0.92 | 4 | 5 |

**독비 화살** · 계수 AD / AP

대상에게 170% AD 물리 피해, 5초간 초당 20% AP 독 피해



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:424](../src/core/data/higher-cost-drafts.js#L424) · `"id": "C27"`, [src/core/combat/skills/cost3.js:34](../src/core/combat/skills/cost3.js#L34) · `C27(u, target, s)`.

### C28 · 시그룬

- 3G · 언데드 / 암살자 / 암흑
- 유대: 종언 / 흑월
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 850 | 80 | 99 | 63 | 150 | 15 | 34 | 0.97 | 1 | 10 |

**그림자 급습** · 계수 AD

적 후방 대상에게 돌진해 250% AD 물리 피해, 3초간 대상 AD -15%

승인판정:시전자에서가장먼생존적.기존BFS돌진;막히면공격/약화없음.

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:453](../src/core/data/higher-cost-drafts.js#L453) · `"id": "C28"`, [src/core/combat/skills/cost3.js:38](../src/core/combat/skills/cost3.js#L38) · `C28(u, target, s)`.

### C29 · 카르도

- 3G · 마족 / 궁수 / 대지
- 유대: 종언 / 천명
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 830 | 80 | 94 | 63 | 150 | 10 | 32 | 0.92 | 4 | 5 |

**파쇄 사격** · 계수 AD

대상에게 200% AD 물리 피해, 4초간 GD -20%



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:485](../src/core/data/higher-cost-drafts.js#L485) · `"id": "C29"`, [src/core/combat/skills/cost3.js:54](../src/core/combat/skills/cost3.js#L54) · `C29(u, target, s)`.

### C30 · 네레이드

- 3G · 마족 / 기사 / 물
- 유대: 성약 / 생명
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1080 | 100 | 79 | 68 | 150 | 5 | 52 | 0.69 | 1 | 0 |

**조류의 방패** · 계수 AP

자신에게 250% AP 보호막(5초), 주변 아군 2명에게 100% AP 회복

승인판정:자신제외상하좌우인접아군중HP비율낮은2명.

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:514](../src/core/data/higher-cost-drafts.js#L514) · `"id": "C30"`, [src/core/combat/skills/cost3.js:58](../src/core/combat/skills/cost3.js#L58) · `C30(u, target, s)`.

### C31 · 홍련

- 3G · 수인 / 암살자 / 화염
- 유대: 혈광 / 월하
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 850 | 80 | 99 | 63 | 150 | 15 | 34 | 0.97 | 1 | 10 |

**작열 도약** · 계수 AD / AP

대상에게 230% AD 물리 피해, 3초간 초당 20% AP 화상

이름이도약이지만별도순간이동없음.

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:543](../src/core/data/higher-cost-drafts.js#L543) · `"id": "C31"`, [src/core/combat/skills/cost3.js:66](../src/core/combat/skills/cost3.js#L66) · `C31(u, target, s)`.

### C32 · 제피로

- 3G · 인간 / 마법사 / 바람
- 유대: 아르카나 / 공명
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 810 | 70 | 69 | 103 | 150 | 5 | 30 | 0.72 | 4 | 0 |

**회오리 폭발** · 계수 AP

대상과 인접 적에게 200% AP 마법 피해, 1초간 띄우기

승인판정:대상과상하좌우인접적.띄우기는stun 키의행동/이동불가,무적없음.

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:572](../src/core/data/higher-cost-drafts.js#L572) · `"id": "C32"`, [src/core/combat/skills/cost3.js:70](../src/core/combat/skills/cost3.js#L70) · `C32(u, target, s)`.

### C33 · 아그니

- 3G · 인간 / 주술사 / 화염
- 유대: 아르카나 / 운명
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 870 | 80 | 74 | 98 | 150 | 5 | 34 | 0.72 | 3 | 0 |

**화염 저주** · 계수 AP

적 2명에게 160% AP 마법 피해, 4초간 받는 회복량 -30%

승인판정:현재대상+그대상에가까운다른적1명.치유감소는기존수치와큰값우선.

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:604](../src/core/data/higher-cost-drafts.js#L604) · `"id": "C33"`, [src/core/combat/skills/cost3.js:82](../src/core/combat/skills/cost3.js#L82) · `C33(u, target, s)`.

### C34 · 아스텔

- 4G · 인간 / 사제 / 물
- 유대: 생명 / 윤회
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1005 | 70 | 86 | 117 | 150 | 5 | 40 | 0.76 | 3 | 0 |

**생명의 샘** · 계수 AP

아군 전체 140% AP 회복, 가장 체력이 낮은 아군 추가 160% AP 회복



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:636](../src/core/data/higher-cost-drafts.js#L636) · `"id": "C34"`, [src/core/combat/skills/cost4.js:6](../src/core/combat/skills/cost4.js#L6) · `C34(u, target, s)`.

### C35 · 메두라

- 4G · 수인 / 마법사 / 독
- 유대: 심연 / 금단
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 955 | 70 | 86 | 122 | 150 | 5 | 37 | 0.76 | 4 | 0 |

**맹독 폭풍** · 계수 AP

적 최대 4명에게 210% AP 마법 피해, 4초간 초당 25% AP 독 피해



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:665](../src/core/data/higher-cost-drafts.js#L665) · `"id": "C35"`, [src/core/combat/skills/cost4.js:14](../src/core/combat/skills/cost4.js#L14) · `C35(u, target, s)`.

### C36 · 참월

- 4G · 드워프 / 암살자 / 대지
- 유대: 철혈 / 성약
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 995 | 80 | 116 | 82 | 150 | 15 | 41 | 1.01 | 1 | 10 |

**지맥 절단** · 계수 AD

대상에게 300% AD 물리 피해, 4초간 GD -25%



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:694](../src/core/data/higher-cost-drafts.js#L694) · `"id": "C36"`, [src/core/combat/skills/cost4.js:20](../src/core/combat/skills/cost4.js#L20) · `C36(u, target, s)`.

### C37 · 카르미나

- 4G · 천족 / 궁수 / 혈마법
- 유대: 월하 / 천명
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 975 | 80 | 111 | 82 | 150 | 10 | 39 | 0.95 | 4 | 5 |

**붉은 성광** · 계수 AD

자신 현재 HP 8% 소모, 적 3명에게 각각 210% AD 물리 피해

 HP비용기준: currentHP.

근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:723](../src/core/data/higher-cost-drafts.js#L723) · `"id": "C37"`, [src/core/combat/skills/cost4.js:24](../src/core/combat/skills/cost4.js#L24) · `C37(u, target, s)`.

### C38 · 오르딘

- 4G · 언데드 / 소환사 / 신성
- 유대: 윤회 / 금단
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1025 | 80 | 91 | 117 | 150 | 5 | 43 | 0.76 | 3 | 0 |

**영혼의 파수꾼** · 계수 AP

10초간 수호 망령 2기 소환, 각각 공격 시 70% AP 마법 피해, 최대 2기



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:753](../src/core/data/higher-cost-drafts.js#L753) · `"id": "C38"`, [src/core/combat/skills/cost4.js:28](../src/core/combat/skills/cost4.js#L28) · `C38(u, target, s)`.

### C39 · 글라시아

- 4G · 정령 / 기사 / 빙결
- 유대: 생명 / 왕권
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1225 | 100 | 96 | 87 | 150 | 5 | 59 | 0.72 | 1 | 0 |

**절대 방벽** · 계수 AP

자신과 인접 아군에게 5초간 220% AP 보호막, 공격자 AS -20%(3초)



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:785](../src/core/data/higher-cost-drafts.js#L785) · `"id": "C39"`, [src/core/combat/skills/cost4.js:32](../src/core/combat/skills/cost4.js#L32) · `C39(u, target, s)`.

### C40 · 월하

- 4G · 엘프 / 무도가 / 암흑
- 유대: 종언 / 흑월
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1125 | 90 | 111 | 87 | 150 | 10 | 47 | 0.95 | 1 | 5 |

**그림자 연격** · 계수 AD

대상에게 100% AD 물리 피해 4회, 마지막 타격은 치명타 확률 +30%p



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:817](../src/core/data/higher-cost-drafts.js#L817) · `"id": "C40"`, [src/core/combat/skills/cost4.js:36](../src/core/combat/skills/cost4.js#L36) · `C40(u, target, s)`.

### C41 · 뇌진

- 4G · 마족 / 전사 / 번개
- 유대: 혈광 / 무극
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1185 | 100 | 106 | 82 | 150 | 5 | 51 | 0.8 | 1 | 0 |

**폭뢰 참격** · 계수 AD

전방 최대 3명에게 240% AD 물리 피해, 1초 기절



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:846](../src/core/data/higher-cost-drafts.js#L846) · `"id": "C41"`, [src/core/combat/skills/cost4.js:44](../src/core/combat/skills/cost4.js#L44) · `C41(u, target, s)`.

### C42 · 바하무트

- 5G · 드워프 / 주술사 / 바람
- 유대: 공명 / 운명
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1160 | 80 | 108 | 136 | 150 | 5 | 48 | 0.79 | 3 | 0 |

**태풍의 문장** · 계수 AP

적 전체에게 230% AP 마법 피해, 3초간 AS -25%



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:878](../src/core/data/higher-cost-drafts.js#L878) · `"id": "C42"`, [src/core/combat/skills/cost5.js:6](../src/core/combat/skills/cost5.js#L6) · `C42(u, target, s)`.

### C43 · 라이진

- 5G · 언데드 / 무도가 / 번개
- 유대: 무극 / 금단
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1270 | 90 | 128 | 106 | 150 | 10 | 54 | 0.99 | 1 | 5 |

**천둥 백격** · 계수 AD / AP

대상에게 90% AD 물리 피해 6회, 마지막 타격은 주변 적에게 150% AP 마법 피해



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:907](../src/core/data/higher-cost-drafts.js#L907) · `"id": "C43"`, [src/core/combat/skills/cost5.js:12](../src/core/combat/skills/cost5.js#L12) · `C43(u, target, s)`.

### C44 · 백야

- 5G · 인간 / 암살자 / 빙결
- 유대: 혈광 / 흑월
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1140 | 80 | 133 | 101 | 150 | 15 | 48 | 1.04 | 1 | 10 |

**영점 처형** · 계수 AD

가장 먼 적에게 돌진해 350% AD 물리 피해, 2초 기절



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:936](../src/core/data/higher-cost-drafts.js#L936) · `"id": "C44"`, [src/core/combat/skills/cost5.js:17](../src/core/combat/skills/cost5.js#L17) · `C44(u, target, s)`.

### C45 · 아바돈

- 5G · 용족 / 궁수 / 암흑
- 유대: 종언 / 흑월
- 상태: [구현] 상점·배치·전투·합성 가능; [임시] 능력치provisional=true.

| HP | MP | AD | AP | CTH | CTC | GD | AS | RNG | DOD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1120 | 80 | 128 | 101 | 150 | 10 | 46 | 0.99 | 4 | 5 |

**멸망의 화살** · 계수 AD

일직선 적 최대 4명에게 300% AD 물리 피해, 4초간 받는 피해 +15%



근거: [src/core/data/units.js:68](../src/core/data/units.js#L68) · `const roster=`, [src/core/data/higher-cost-drafts.js:968](../src/core/data/higher-cost-drafts.js#L968) · `"id": "C45"`, [src/core/combat/skills/cost5.js:39](../src/core/combat/skills/cost5.js#L39) · `C45(u, target, s)`.

## 11. 장비40종·획득·장착

일반보관함기본12칸(2열6행),초과시행추가·스크롤,별도고정상한없음.특수2칸은예약UI/실제아이템기능없음.캐릭터당3칸. T1/T2/T3모두동일ID중복가능. 같은ID 고유효과는 장착자당 기존1회 판정,기본수치는개수만큼합산. 장착·이동·무료회수는준비단계만.합성소모/판매장비는반환.휴지통은미장착만삭제,마지막삭제1개복원가능.

보급4개서로다른ID제시→슬롯2개선택→확정. 각후보는독립티어추첨후이미뽑은ID제외. 보스승리확정아이템1개(stage1T1,2~4T2,5+T3),패배없음.

| stage | T1% | T2% | T3% |
| --- | --- | --- | --- |
| 1 | 100 | 0 | 0 |
| 2 | 70 | 30 | 0 |
| 3 | 50 | 40 | 10 |
| 4 | 30 | 50 | 20 |
| 5 | 0 | 30 | 70 |
| 6이후 | 0 | 0 | 100 |


| ID | 이름 | 티어 | 능력치 | 고유효과 |
| --- | --- | --- | --- | --- |
| I01 | 강철 장검 | 1 | AD +12 | 고유효과없음(스탯만) |
| I02 | 견고한 흉갑 | 1 | GD +12 | 고유효과없음(스탯만) |
| I03 | 마력 수정구 | 1 | AP +15 | 고유효과없음(스탯만) |
| I04 | 생명의 목걸이 | 1 | HP +150 | 고유효과없음(스탯만) |
| I05 | 신속의 장갑 | 1 | AS +12% | 고유효과없음(스탯만) |
| I06 | 정밀한 조준경 | 1 | CTC +10%p | 고유효과없음(스탯만) |
| I07 | 현자의 부적 | 1 | 최대 MP +20 | 고유효과없음(스탯만) |
| I08 | 회피의 망토 | 1 | DOD +8%p | 고유효과없음(스탯만) |
| I09 | 파괴자의 반지 | 1 | CTH +25%p (예: 150%→175%) | 고유효과없음(스탯만) |
| I10 | 장거리 사수의 깃털 | 1 | RNG +1칸 | 고유효과없음(스탯만) |
| I11 | 광전사의 도끼 | 2 | AD +18, AS +15% | 고유효과없음(스탯만) |
| I12 | 룬 각인 지팡이 | 2 | AP +25, 최대 MP +20 | 고유효과없음(스탯만) |
| I13 | 수호자의 판금갑옷 | 2 | HP +220, GD +18 | 고유효과없음(스탯만) |
| I14 | 그림자 단검 | 2 | AD +20, CTC +12%p | 고유효과없음(스탯만) |
| I15 | 폭풍의 활 | 2 | AD +15, RNG +1칸 | 고유효과없음(스탯만) |
| I16 | 비전의 로브 | 2 | AP +20, GD +15 | 고유효과없음(스탯만) |
| I17 | 불굴의 방패 | 2 | HP +300, DOD +5%p | 고유효과없음(스탯만) |
| I18 | 치유사의 성배 | 2 | AP +25, HP +150 | 고유효과없음(스탯만) |
| I19 | 질풍의 장화 | 2 | AS +18%, DOD +8%p | 고유효과없음(스탯만) |
| I20 | 처형자의 가면 | 2 | AD +20, CTH +30%p | 고유효과없음(스탯만) |
| I21 | 마나 증폭기 | 2 | AP +30, 최대 MP +30 | 고유효과없음(스탯만) |
| I22 | 용비늘 갑주 | 2 | GD +22, HP +200 | 고유효과없음(스탯만) |
| I23 | 독사의 송곳니 | 2 | AD +15, AP +20 | 고유효과없음(스탯만) |
| I24 | 전장의 휘장 | 2 | AD +15, GD +15 | 고유효과없음(스탯만) |
| I25 | 별빛의 관 | 2 | AP +20, CTC +10%p | 고유효과없음(스탯만) |
| I26 | 뇌신의 심장 | 3 | AD +25, AS +15% | 기본 공격 적중 시 25% 확률로 대상 주변의 다른 적 최대 2명에게 **장착자 AD의 60%** 마법 피해. |
| I27 | 대마법사의 왕관 | 3 | AP +40, 최대 MP +20 | 스킬 사용 시 25% 확률로 동일 스킬을 마나 소모 없이 1회 추가 발동. 추가 발동은 이 효과를 다시 발동시키지 않음. |
| I28 | 불멸자의 갑옷 | 3 | HP +350, GD +25 | 전투당 1회, 치명적 피해를 받을 때 HP 1로 생존하고 최대 HP 30%의 보호막을 4초 획득. |
| I29 | 피의 계약검 | 3 | AD +30, HP +200 | 기본 공격으로 실제 입힌 피해의 20%만큼 장착자 HP 회복. |
| I30 | 시간의 모래시계 | 3 | AP +30, 최대 MP +30 | 스킬 사용 3초 후 최대 MP의 30% 회복. 발동 재사용 대기시간 8초. |
| I31 | 망령 군주의 인장 | 3 | AP +35, HP +150 | 장착자가 소환한 유닛의 공격 피해량 +30%, 지속시간 +40%. |
| I32 | 지옥불의 검 | 3 | AD +30, AP +25 | 기본 공격 적중 시 대상에게 4초 동안 매초 장착자 AP의 25% 마법 피해를 주는 화상 부여. |
| I33 | 영원의 서리 | 3 | AP +35, GD +20 | 스킬로 피해를 입힌 적의 AS 3초간 -25%. 같은 대상에게 이 효과 3회 적용 시 1초 기절. |
| I34 | 사신의 조준경 | 3 | AD +35, CTC +15%p | 기본 공격 적중 대상의 HP가 25% 이하일 때 해당 공격 피해량 +50%. |
| I35 | 성자의 축복 | 3 | AP +35, HP +250 | 장착자의 치유 스킬 효과 +30%. 아군을 치유하면 대상에게 실제 치유량의 25%만큼 3초 보호막 부여. |
| I36 | 폭풍 군주의 망토 | 3 | AS +25%, DOD +12%p | 공격 회피 성공 시 4초간 AS +20%. 재사용 대기시간 6초. |
| I37 | 대지 수호자의 방패 | 3 | HP +400, GD +30 | 전투 시작 시 자신과 인접한 아군에게 장착자 최대 HP 15%의 보호막을 6초 부여. |
| I38 | 광란의 쌍검 | 3 | AD +25, AS +20% | 동일 적을 연속 기본 공격할 때마다 AS +5%, 최대 8중첩. 공격 대상 변경 시 중첩 초기화. |
| I39 | 공허의 구슬 | 3 | AP +45, 최대 MP +20 | 스킬로 피해를 입히면 피격 대상 주변 1칸 내 다른 적에게 해당 스킬 피해량의 35%를 추가 마법 피해로 적용. |
| I40 | 전쟁 군주의 왕관 | 3 | HP +300, AD +25, AP +25 | 장착자가 적 처치 시 전투 종료까지 AD와 AP 각각 +5%, 최대 5중첩. |


T1/T2는스탯만,T3 I26~I40 효과가실행됩니다.장비고정수치는성급배율후가산. 소환은 engine.summon → 아이템래퍼 → 증강래퍼 순으로 연결되며 아군 소환수는 증강 적용 뒤 현재HP도 최종 최대HP로 맞춥니다. 내부 한 함수만 보고 최종 소환HP를 판단하지 않습니다.

### 고유효과 구현 세부

- I26:현재피격대상주변맨해튼1칸의다른적최대2,25%각기본공격기회.실제피해0흡수타도비회피면분기로진입.
- I27:기존스킬1회추가,ITEM_PROC로재귀억제.기존마나스냅샷보존.
- I28/P04:독립전투당1회,I28먼저.아이템파생피해에서I28죽음방지를제외하는가드가있고P04는독립적으로검사.
- I29/G06/P05:실제HP피해기준흡혈,방어/보호막/초과피해제외.흡혈은I35치유스킬보호막을유발하지않음.
- I30:장착자별8초쿨다운,시전3초후MP30%회복.시전재귀로예약중복안함.
- I31:소환수AD×1.3,수명×1.4.스킬폭발AP계수에는AD증가를직접적용하지않음.
- I32:4초AP25% DOT,같은시전자갱신/타시전자중첩,ITEM_PROC표시.
- I33:직접스킬실제HP피해>0일때3초AS−25%,동일시전자/대상카운트3회면1초기절후카운트0.다단히트스킬은각피해호출을셈.
- I34:기본공격전대상HP비율25%이하이면그공격×1.5.
- I35:해당아이템장착자의정상시전프레임내heal을30%강화,실제회복량25%보호막3초.
- I36:회피성공시4초AS20%,쿨다운6초.
- I37:전투시작명단의자신/상하좌우인접아군,장착자최대HP15%,6초.
- I38:동일대상기본공격마다AS5%,최대8.대상변경초기화.회피판정전에카운트가진행되는코드동작은의도확인필요.
- I39:첫대상의**실제HP피해**35%를추가마법원시값으로사용한후2차대상의GD로다시감소.주변1칸,시전프레임별대상중복/재귀억제.
- I40:직접처치시AD/AP5%,최대5;아이템파생처치는적용제외.전투종료시초기화.

모든아이템고유효과는비소환수장착자만(has가summon제외).피해출처ITEM_PROC와itemProcDepth가다른고유효과연쇄재귀를차단합니다. 세부확정여부는원문아이템명세의가정과구분해테스트해야합니다.

[src/core/items.js:1](../src/core/items.js#L1) · `const items=`, [src/core/combat/item-effects.js:272](../src/core/combat/item-effects.js#L272) · `function install`, [src/core/progression.js:303](../src/core/progression.js#L303) · `function beginSupply`.

## 12. 증강 — 54종(1차 후보안, 임시값)

v0.17.0에서 증강을 54종 1차 후보안(실버·골드·프리즘 각 18종)으로 바꾸고 이전 36종은 지웠습니다(사용자 결정). **모든 수치는 검증 전 임시값**이며, 밸런스 테스트 결과는 패치노트 "밸런스 테스트" 탭에 기록합니다.
정해진3노드(1-3/3-3/5-3 진입 전)마다 등급을 독립균등 1/3 추첨 → 그 등급에서 아직 고르지 않은 후보 3개를 비복원 추첨 → 하나 선택. 한 판 최대3개, 같은 등급 반복 가능, 고르지 않은 후보는 다시 나올 수 있음. 54종 모두 후보로 나옴.

기본안(사용자 승인 2026-11-18):
- 능력치 %는 현재 값에 곱하기, GD +n은 고정값, 피해량 +%끼리는 더한 뒤 곱하기.
- 앞줄·뒷줄: 전투 시작 때 아군이 서 있는 가장 앞(적과 가까운) 열 / 가장 뒷열. v0.18.0부터 줄은 열이다: 아군 전열 col 3, 후열 col 0, 전방 2열 = col 2·3, 후방 2열 = col 0·1(적은 전열 col 4, 후열 col 7).
- 동률: 코스트 → 성급 → 앞쪽 칸(번호가 작은 칸, v0.18.0부터 새 칸 번호: 위 행부터 왼쪽부터). 가장 가까운 아군은 칸 거리 → 코스트 → 앞쪽 칸.
- 소환수·분신: 처치는 주인 몫, 아군 사망·생존 판정(S11·G05·G17·P05)에서 제외. 분신은 장비 없이 기본 공격만 하고 조합 인원에 들지 않으며 전투 끝까지 남는다(승패 판정에는 포함).
- 동료 지급 때 대기석이 가득 차고 합성으로도 자리가 안 나면 그 동료의 판매가만큼 골드. 무작위 동료는 3성 보유 캐릭터를 뺀 해당 코스트 목록에서.
- 플레이어 HP 소모: S18은 HP 10 이하이면 선택 불가, P11은 HP 30%(내림)를 쓰되 1 아래로 내리지 않음.
- "전투" 횟수(S12·G11)는 일반·보스 전투 정산만 센다. 늦게 고른 지연형 증강의 보정은 없음. 원정이 끝나면 남은 보상은 사라짐.
- G08 무료 새로고침은 스테이지마다 1회(쓰지 않으면 사라짐), G10 무료 새로고침은 쌓이고 남는다. 무료가 있으면 무료부터 쓴다.
- G07은 새 스테이지의 1라운드에 들어갈 때, G09는 매 라운드 준비 시작(선택한 라운드 제외), P09는 각 스테이지 5라운드 정산 때.
- P04 고정 피해는 방어·회피·치명타를 무시하고 보호막에 먼저 막힌다. P16 왕 사망 피해는 HP 1 아래로 내리지 않는다.

| ID | 등급 | 이름 | 표시효과 | 실행effect데이터 |
| --- | --- | --- | --- | --- |
| S01 | 실버 | 천상의 축복 | 모든 아군이 입힌 실제 피해의 8%만큼 HP 회복(기본 공격·스킬·지속 피해, 아이템 발동 제외) | `{"allLeech":0.08}` |
| S02 | 실버 | 전투의 열기 | 전투 시작 후 5초마다 모든 아군 AS +4%, 최대 4중첩 | `{"haste":{"interval":5,"as":0.04,"max":4}}` |
| S03 | 실버 | 마나의 샘 | 모든 아군이 전투 시작 시 최대 MP의 20%를 보유 | `{"startMana":0.2}` |
| S04 | 실버 | 최후의 저항 | 아군 HP가 처음으로 30% 이하가 되면 최대 HP의 15% 보호막을 4초간 획득 | `{"lowGuard":{"threshold":0.3,"shield":0.15,"seconds":4}}` |
| S05 | 실버 | 집중 포화 | 같은 적을 기본 공격할 때마다 그 적에게 주는 피해 +2%, 최대 10중첩 · 대상이 바뀌면 초기화 | `{"focus":{"per":0.02,"max":10}}` |
| S06 | 실버 | 승리의 여세 | 적을 처치한 아군은 5초간 AD·AP +15% · 추가 처치 시 지속시간 갱신 | `{"killRush":{"power":0.15,"seconds":5}}` |
| S07 | 실버 | 작은 행운 | 선택 즉시 8G 획득 | `{"gold":8}` |
| S08 | 실버 | 경험의 지혜 | 선택 즉시 10XP 획득 | `{"xp":10}` |
| S09 | 실버 | 절약 정신 | 상점 새로고침 비용 2G → 1G | `{"reroll":1}` |
| S10 | 실버 | 무기 거래상 | 무작위 1티어 아이템 1개와 3G 획득 | `{"items":{"tier":1,"count":1},"gold":3}` |
| S11 | 실버 | 완벽한 승리 | 아군이 한 명도 쓰러지지 않고 전투에서 이기면 추가 2G(소환수·분신 제외) | `{"flawlessGold":2}` |
| S12 | 실버 | 미래 투자 | 선택 즉시 5G 획득 · 이후 전투 4회를 마치면 추가 10G | `{"gold":5,"delayed":{"battles":4,"gold":10}}` |
| S13 | 실버 | 단결된 의지 | 활성화된 조합 하나당 모든 아군 AD·AP +3% | `{"bondPower":{"power":0.03}}` |
| S14 | 실버 | 선봉대 | 아군이 서 있는 가장 앞줄의 아군 최대 HP +20% | `{"frontRow":{"hp":0.2}}` |
| S15 | 실버 | 후방 지원 | 아군이 서 있는 가장 뒷줄의 아군 AS +15% | `{"backRow":{"as":0.15}}` |
| S16 | 실버 | 쌍둥이 수호자 | 가장 앞줄에 정확히 2명만 서 있으면 그 2명 GD +25 | `{"twinGuard":{"gd":25}}` |
| S17 | 실버 | 모범 동료 | 전투 시작 시 AD가 가장 높은 아군 1명 AS +20% | `{"ace":{"as":0.2}}` |
| S18 | 실버 | 위험한 계약 | 플레이어 HP 10 소모, 무작위 3코스트 동료 2명 획득 · HP 10 이하이면 선택 불가 | `{"hpCost":{"flat":10},"units":[{"cost":3,"count":2}]}` |
| G01 | 골드 | 초월의 시간 | 전투 시작 12초 후 모든 아군 피해량 +35% | `{"lateDamage":{"at":12,"damage":0.35}}` |
| G02 | 골드 | 불굴의 의지 | 아군 HP가 처음으로 35% 이하가 되면 최대 HP 25% 회복, 5초간 GD +20 | `{"lowRally":{"threshold":0.35,"heal":0.25,"gd":20,"seconds":5}}` |
| G03 | 골드 | 전투의 가속 | 전투 시작 후 3초마다 모든 아군 AS +8%, 최대 5중첩 | `{"haste":{"interval":3,"as":0.08,"max":5}}` |
| G04 | 골드 | 마력 폭주 | 아군이 스킬을 쓸 때마다 그 아군 AP +8%, 최대 5중첩 | `{"castPower":{"ap":0.08,"max":5}}` |
| G05 | 골드 | 복수의 맹세 | 아군이 쓰러질 때마다 생존 아군 AD·AP +8%, 최대 4중첩(소환수·분신 제외) | `{"avenge":{"power":0.08,"max":4}}` |
| G06 | 골드 | 전장의 구원 | 적을 처치할 때마다 HP 비율이 가장 낮은 아군을 최대 HP의 12% 회복 | `{"killHeal":{"ratio":0.12}}` |
| G07 | 골드 | 황금의 흐름 | 선택 즉시 5G 획득 · 이후 새 스테이지에 들어갈 때마다 2G | `{"gold":5,"stageGold":2}` |
| G08 | 골드 | 상인의 특권 | 스테이지마다 첫 상점 새로고침 무료 | `{"freeRerollPerStage":1}` |
| G09 | 골드 | 가치 투자 | 무작위 2코스트 동료 1명을 2성으로 획득 · 이후 라운드 시작마다 같은 동료 1명(1성) 추가 | `{"valueInvest":{"cost":2,"star":2}}` |
| G10 | 골드 | 역전의 자금 | 전투에서 지면 추가 3G와 무료 새로고침 1회(쌓임) | `{"lossGold":3,"lossFreeReroll":1}` |
| G11 | 골드 | 고위험 투자 | 보유 골드의 절반(내림)을 맡기고, 전투 3회를 마치면 맡긴 골드의 2배를 돌려받음 · 원정이 끝나면 돌려받지 못함 | `{"invest":{"ratio":0.5,"battles":3,"multiplier":2}}` |
| G12 | 골드 | 성장의 보상 | 레벨이 오를 때마다 무작위 2코스트 또는 3코스트 동료 1명 획득 | `{"levelUnits":{"costs":[2,3]}}` |
| G13 | 골드 | 쌍둥이 전술 | 전장에 같은 동료를 정확히 2명 배치하면 두 동료 AD·AP·GD +25% · 이 증강이 있으면 같은 동료를 전장에 2명까지 배치 가능("같은 캐릭터 전장 1명" 규칙의 예외) | `{"twins":{"power":0.25,"limit":2}}` |
| G14 | 골드 | 전장의 지휘관 | 전방 2줄 아군 1명당 후방 2줄 아군 피해량 +5%, 최대 25% | `{"command":{"per":0.05,"max":0.25}}` |
| G15 | 골드 | 조합의 대가 | 활성화된 조합 하나당 모든 아군 최대 HP +80, AD·AP +3% | `{"bondPower":{"power":0.03,"hp":80}}` |
| G16 | 골드 | 선택받은 영웅 | 전투 시작 시 코스트가 가장 높은 아군 1명 최대 HP +30%, 피해량 +20% | `{"chosen":{"hp":0.3,"damage":0.2}}` |
| G17 | 골드 | 마지막 수호자 | 마지막으로 남은 아군이 최대 HP 40% 보호막과 AS +35% 획득 · 전투당 1회(소환수·분신 제외) | `{"lastStand":{"shield":0.4,"as":0.35}}` |
| G18 | 골드 | 전술 복제 | 전투 시작 시 지정한 동료의 분신 1명 소환(최대 HP 50%, AD·AP 60%, 기본 공격만, 조합 인원 제외) · 지정이 없으면 코스트가 가장 높은 아군 | `{"clone":{"pick":"designated","hp":0.5,"power":0.6}}` |
| P01 | 프리즘 | 불멸의 군단 | 모든 아군이 전투당 1회 치명적 피해를 받으면 HP 1로 생존하고 최대 HP의 30% 보호막을 4초간 획득 | `{"immortal":{"ratio":0.3,"seconds":4}}` |
| P02 | 프리즘 | 마나의 해방 | 모든 아군이 전투 시작 시 최대 MP의 75%를 보유 · 스킬 사용 후 3초간 AP +25% | `{"startMana":0.75,"castBuff":{"ap":0.25,"seconds":3}}` |
| P03 | 프리즘 | 광전사의 축제 | 모든 아군 AS +40%, 최대 HP -20% · 적을 처치하면 잃은 HP의 10% 회복 | `{"as":0.4,"hpMult":-0.2,"killRecover":0.1}` |
| P04 | 프리즘 | 최후의 심판 | 전투 시작 15초 후 모든 적에게 최대 HP의 20% 고정 피해(보스 5%) · 방어·회피·치명타 무시, 보호막에는 막힘 | `{"judgment":{"at":15,"ratio":0.2,"boss":0.05}}` |
| P05 | 프리즘 | 영혼의 계승 | 아군이 쓰러지면 가장 가까운 생존 아군에게 쓰러진 아군의 AD·AP·GD 30%를 전투 끝까지 이전(소환수·분신 제외) | `{"inherit":{"ratio":0.3}}` |
| P06 | 프리즘 | 시간의 지배자 | 전투 시작 10초 후 8초간 모든 적 AS -30%, 모든 아군 AS +30% | `{"timeLord":{"at":10,"seconds":8,"enemy":-0.3,"ally":0.3}}` |
| P07 | 프리즘 | 황금의 제국 | 선택 즉시 25G 획득 · 이후 전투 승리마다 추가 2G | `{"gold":25,"winGold":2}` |
| P08 | 프리즘 | 전설의 영입 | 무작위 5코스트 동료 1명, 4코스트 동료 2명 획득 | `{"units":[{"cost":5,"count":1},{"cost":4,"count":2}]}` |
| P09 | 프리즘 | 무한한 성장 | 선택 즉시 20XP 획득 · 이후 스테이지를 마칠 때마다 3XP | `{"xp":20,"stageXp":3}` |
| P10 | 프리즘 | 운명의 상점 | 상점에 현재 레벨에서 등장 가능한 가장 높은 코스트의 동료가 최소 1명 나옴 | `{"shopGuarantee":true}` |
| P11 | 프리즘 | 위험한 도박 | 현재 플레이어 HP의 30%(내림) 소모, 무작위 3티어 아이템 3개 획득 · HP는 1 아래로 내려가지 않음 | `{"hpCost":{"ratio":0.3},"items":{"tier":3,"count":3}}` |
| P12 | 프리즘 | 복리의 마법 | 이자 상한 5G → 10G · 전투 승리 시 보유 골드의 10%(내림, 최대 5G) 추가 | `{"interestCap":10,"winInterest":{"ratio":0.1,"max":5}}` |
| P13 | 프리즘 | 초월의 군세 | 배치 한도 +1 · 최대 11명 | `{"capacity":1}` |
| P14 | 프리즘 | 이중 조합 | 전투 시작 시 활성 조합 중 무작위 1개의 단계를 한 단계 올림(최고 단계 제외, 인원 수는 그대로) | `{"bondBoost":1}` |
| P15 | 프리즘 | 전장의 분신 | 전투 시작 시 코스트가 가장 높은 아군의 분신 1명 소환(최대 HP·AD·AP 70%, 기본 공격만, 조합 인원 제외) | `{"clone":{"pick":"highestCost","hp":0.7,"power":0.7}}` |
| P16 | 프리즘 | 왕의 친위대 | 코스트가 가장 높은 아군 1명을 왕으로 지정: 피해량 +50%, 최대 HP +40% · 왕이 쓰러지면 다른 아군이 각자 최대 HP의 20% 피해(HP 1 아래로는 안 내려감) | `{"king":{"damage":0.5,"hp":0.4,"deathDamage":0.2}}` |
| P17 | 프리즘 | 완벽한 조화 | 활성화된 서로 다른 조합이 4개 이상이면 모든 아군 피해량 +30%, 최대 HP +30% | `{"harmony":{"bonds":4,"damage":0.3,"hp":0.3}}` |
| P18 | 프리즘 | 희생의 의식 | 전투 시작 시 코스트가 가장 낮은 아군 1명 희생(아군 2명 이상일 때) · 나머지 아군 AD·AP·최대 HP +희생자 코스트×10% | `{"sacrifice":{"perCost":0.1}}` |

G13 예외(사용자 결정 2026-11-18): G13을 고른 원정에서만 같은 캐릭터를 전장에 2명까지 둘 수 있습니다(3명은 불가, 배치와 전투 시작 모두 검사). 조합 인원은 원래대로 서로 다른 캐릭터만 세므로 같은 캐릭터 2명은 1명분입니다.

[src/core/augments.js:362](../src/core/augments.js#L362) · `function draw`, [src/core/combat/augment-effects.js:212](../src/core/combat/augment-effects.js#L212) · `function update`, [src/core/augment-run.js:134](../src/core/augment-run.js#L134) · `function settle`.

## 13. 저장·호환·UI·연출

- 게임키starlight-onecost-v1의payload.version=5(v0.18.0, 4는 v0.17.x). 버전 4 저장은 지우지 않고 전장 칸(아군·적 편성)을 한 번 회전해 이관합니다(새 행 = 예전 열, 새 열 = 7 − 예전 행). 0.17.0 이전 저장(버전 1~3)은 이관하지 않고 처음 열 때 지우며 T45로 알립니다(사용자 결정). 메타키autochess-meta-v1,폰트키autochess-ui-font. 브라우저로컬이며서버동기화확인되지않음.
- 전투 중 새로고침·종료 후 다시 열면 그 라운드의 준비 단계로 돌아갑니다(D4 결정 a). 취소된 전투에서 받은 보너스 몬스터 보상(골드 또는 아이템)은 회수하고 장부에서 지워, 다시 싸우면 다시 얻을 수 있습니다. 적 encounter 캐시는 유지되고, 전투 중간 상태는 저장하지 않습니다. 알림 T44.
- 저장 실패(저장 공간 부족·비공개 모드)는 T42로 알립니다. 불러온 저장이 손상되었거나 검증에 실패하면 원본을 `starlight-onecost-v1-backup-<시각>` 키에 백업하고 새 원정을 시작하며 T43으로 알립니다(시작 화면에도 표시).

[src/core/save.ts:177](../src/core/save.ts#L177) · `function loadSave`, [src/core/save.ts:139](../src/core/save.ts#L139) · `function revertInterruptedBattle`, [src/ui/store.ts:211](../src/ui/store.ts#L211) · `function save`.

- completedRounds,lastResult,supplyOffer,augmentState,shopLocked/shopCarry,completionChoice를저장. 종료/계속선택과보상은분리.저장실패는catch되며사용자경고가없는기존동작(확인필요).
- 도감4종/추천최대3/장착툴팁/피해막대/장비아이콘/패치노트복사·MD저장/글꼴5종. 일반/특수보관함36×36px. 상점은코스트그라데이션/추천노랑글씨·청록발광/기존보유·합성예고. 도감1~5코스트구분선/C01원본이미지. C01대기석·상점에는재전달투명PNG를CSS코스트배경위에표시하며도감상세는별도원본PNG.다른캐릭터는기존SVG유지.
- 피해숫자는실제HP피해,치명타/흡수/회피/회복/보호막을구분.소환딜은소유주에합산. 전투격자유지.
- 배경풍경/투명체스판분리. v0.18.0부터 안개 배경(1672×941, cover)과 8×7 투명 보드(1536×1024, contain)를 PixiJS 장면 레이어로 깔고, 칸 정합은 `src/ui/art/board.ts`(보정값 `docs/specs/BOARD_SIDE_8X7_CALIBRATION.json`)와 DOM 칸 중심을 같은 식으로 맞춥니다. 이전 7×8 그림은 원본만 보관.
- 중앙체력연출은 실제 HP/실제 증감 충격형 하트이며 네모/막대는 없습니다.전투마무리후3000ms/퇴장200ms/모션감소500ms,실제HP바뀌지않음.연출완료후결과모달.좌상단감소표시는1씩,기본80ms/전체최대1600ms.
- 구간내1-1→1-2는STAGE 1-2텍스트1600ms/모션감소350ms(입력차단없음).1-5→2-1상위라운드에서만전체화면ROUND N이좌→우로채워짐2200ms/모션감소600ms페이드.결과확인과증강선택후재생.전체화면만native dialog입력차단,취소시상태보존.
- 전투마무리·화면전환·리사이즈·탭숨김등의연출제거는게임진행/보상취소가아님. HP연출취소후결과확인버튼/이어하기로결과재개.
- 공통알림41개는13유지/27표시삭제/T28원인별승인수정. 재구축 4단계에서 저장 관련 T42~T44를 추가. 툴팁/결과/중앙연출은이토스트목록과별개.

[src/ui/store.ts:231](../src/ui/store.ts#L231) · `function load`, [src/core/board.js:46](../src/core/board.js#L46) · `function migrate`, [src/ui/components/ScreenCues.tsx:76](../src/ui/components/ScreenCues.tsx#L76) · `function HealthImpact`, [src/ui/notices.ts:5](../src/ui/notices.ts#L5) · `const RETAINED`.

## 14. 남은 결정과 불일치

정식밸런스와미구현판정은 [미구현 문서](UNIMPLEMENTED.md),원문/패치차이는 [변경 이력](CHANGELOG.md)의D01~D14를참조합니다. 문서화는이차이를고치기위한게임코드변경을하지않습니다.
