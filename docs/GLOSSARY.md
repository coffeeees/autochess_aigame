# AUTOCHESS 용어·약어·코드 대응

기준 버전: **0.15.18** (package.json / dist/patch-notes.js / 화면 표기 대조). 조사 기준 소스는 v0.15.12 커밋 4fc1087634a3743c0459438d9ebd20bb372b3b3c에서 이어진 현재 작업 트리입니다. 작성 기준일: 2026-11-15 (Asia/Seoul). 이번 0.15.18은 상점·보관함·도감의 UI/이미지 표시만 변경했습니다. 보드 이미지와 좌표는 유지합니다. 게임 규칙·밸런스는 유지합니다.

**구분:** [확정 기획] 원문에 명시되거나 이후 사용자 요청으로 승인한 구조/정책. [구현] 현재 실행 경로 존재. [임시] 실행되지만 최종 밸런스 미확정. [미구현] 데이터/계획만 존재. [확인 필요] 승인·의도 또는 현재 검증으로 확정할 수 없는 부분. 구현되었다고 모든 숫자가 최종 확정인 것은 아닙니다.

[전체 기획](GAME_DESIGN.md) · [용어집](GLOSSARY.md) · [미구현/확인 필요](UNIMPLEMENTED.md) · [변경 이력/불일치](CHANGELOG.md)

## 1. 능력치와 계산 단위

| 표기 | 명칭 | 정의 |
| --- | --- | --- |
| HP | 체력 | 플레이어원정HP와유닛HP는별도.플레이어최대100;유닛은stats.HP/hp |
| MP | 최대 마나 | stats.MP는시전필요최대값,mp는현재값 |
| AD | 물리 공격력 | 기본공격원시값·AD스킬계수 |
| AP | 마법 공격력 | AP스킬/치유/소환계수.기본공격을자동마법으로바꾸지않음 |
| CTH | 치명타 피해 | 150은150%=1.5배.CTC와혼동금지 |
| CTC | 치명타 확률 | %단위.일반최종확률min(100,CTC+critBonus) |
| GD | 방어력 | 물리/마법공통.피해공식분모100+max(GD,0) |
| AS | 공격속도 | 초당공격횟수;쿨다운1/max(.1,AS) |
| RNG | 사거리 | 전투스탯에서는칸거리.Random Number Generator와문맥구분 |
| DOD | 회피율 | %단위.기본공격회피,기본설정스킬회피없음 |
| ASPercent / ASMultiplier | 장비공격속도보너스 | ASPercent 합산후1+합계/100;기본AS에곱 |
| %p | 퍼센트포인트 | CTC/CTH/DOD의가산량.비율곱과다름 |

## 2. 게임·코드 필드

| 코드/용어 | 화면/뜻 | 정의 |
| --- | --- | --- |
| state.health/maxHealth | 원정대체력 | 유닛hp/stats.HP와별개 |
| hp / stats.HP | 현재/최대유닛HP | 실수형피해,화면은반올림 |
| mp / stats.MP | 현재/최대마나 | 최대는시전문턱 |
| uid / persistentUid | 인스턴스식별자/원정동료UID | 캐릭터종류ID Cxx와별개,장비귀속에사용 |
| id / skillId | 표시유닛종류/재사용스킬종류 | 적Exx가Cxx스킬사용 |
| pos | 행우선칸인덱스0~55 | col=pos%7,row=floor(pos/7) |
| stage / round / wave | 상위구간/내부노드/누적순번 | ROUND N은stage,1-2는label |
| prepare / combat / supply / augment | 준비/전투/보급선택/증강선택 | roundPhase값 |
| result / gameover / complete | 정산결과/HP0종료/6-5자발적완료 | complete는HP가남아도done=true |
| completedRounds / lastResult | 정산장부/현재영수증 | 장부키별재지급방지 |
| bonusLootLedger | 보너스처치장부 | 즉시지급,정산은보고만추가 |
| supplyOffer / pendingPick | 보급후보선택/증강선택대기 | 저장되며새로고침으로재추첨하지않음 |
| shopLocked / shopCarry | 1회잠금/전환후보스냅샷 | 다음노드진입시한번소비 |
| completionChoice | 6-5끝선택 | null,pending,continue,end,legacy |
| star / mult / scale | 성급/성급배율/적추가배율 | HP/AD/AP만성급·scale곱 |
| skillPower/healingPower | 스킬·DOT/치유배율 | 기본1,실험유대로증가가능 |
| manaGain/statusDuration | 마나획득/일부해로운효과시간배율 | 모든DOT/기절에일률적용되지는않음 |
| healingReduction | 받는치유감소 | 고정값과유효시간상태중최대,heal최대90%감소 |
| lifesteal/regen/castHpCost | 기본공격흡혈/초당최대HP재생비율/시전HP소모 | 실험유대용변수.고유장비흡혈과별도 |
| cooldown/moveCooldown/castUntil | 공격대기/이동대기/시전종료시각 | 전투시뮬레이션초기준 |
| damageDone/healingDone/statsTotal | 누적실제피해/치유/팀총계 | 보호막/초과피해/소환합산규칙참조 |
| basic/skill/dot/counter/bonusBasic/item | 피해호출종류 | 스킬/장비트리거가공격종류별구분 |
| ITEM_PROC/itemProcDepth | 아이템파생피해/재귀가드 | 중첩트리거무한연쇄방지 |
| raw/damage/actual/beforeShield | 원시값/방어후값/실제HP피해/보호막전피해 | damage변수는보호막흡수후갱신됨 |
| before/base/interest/bonusGold | 정산전잔고/기본골드/이자/추가골드 | bonusGold는보급또는보스추가 |
| streakBonus/augmentGold/monsterGold | 연승/증강/즉시보너스골드 | totalEarned에이미지급분을보고만추가 |
| total/totalEarned | 이번정산입금/보고상획득합계 | 정산다시입금에totalEarned사용금지 |
| loss/healing/healthBefore | 원정HP손실/실제회복/정산전HP | 중앙체력UI의읽기전용입력 |
| threshold/tier/possible | 유대달성인원/단계번호/현재풀인원 | 단계번호1~3은인원2/4/6자체가아님 |
| confirmedEffect/provisional/draft/implemented | 효과확정/수치제안/초안/실행메타데이터 | 실제분기와최종병합데이터를함께확인 |
| BFS/Manhattan/UID | 너비우선탐색/상하좌우거리/인스턴스ID | 자유이동/유클리드거리가아님 |
| RNG function/rng() | 난수공급함수 | 능력치RNG(사거리)와다름 |
| tick/dt/epoch | 시간진행/시간간격/연출세대 | epoch는취소된연출콜백무효화 |

## 3. 테마 유대16종 정확 명칭

아래16종은 실제 적용되는 임시 밸런스 v1입니다. 종족·직업·속성은 캐릭터 메타데이터로 유지하며 새 유대와 구분합니다.

| 계열 | 정확한명칭 | 표시콘셉트 | 발동인원 |
| --- | --- | --- | --- |
| 테마 유대 | 혈광 | AD +20% · HP 60% 이하 AS +40% · 가한 피해 10% 흡혈 | 2/4/6 |
| 테마 유대 | 월하 | AS +15% · 동일 대상 연속 기본 공격 +5%p · 최대 4중첩 | 2/4 |
| 테마 유대 | 종언 | AD +20% · 대상 HP 40% 이하 피해 +35% · 처치 MP +20 | 2/4/6 |
| 테마 유대 | 흑월 | 치명타 +20%p · 치명타 추가 물리 피해 AD 50% · 치명타 처치 후 다음 기본 공격 확정 치명타 | 2/4/6 |
| 테마 유대 | 무극 | AS +20% · 기본 공격마다 AS +4%p · 최대 8중첩 · 최대 중첩 기본 공격 피해 +20% | 2/4/6 |
| 테마 유대 | 철혈 | GD +15 · 시작 시 최대 HP 15% 보호막 · 8초 | 2/4 |
| 테마 유대 | 성약 | HP +15% · 인접 아군 피해 15% 분담 · 1회 전달 | 2/4 |
| 테마 유대 | 생명 | 제공 회복·보호막 +35% · 유대 전체 5초마다 최저 HP 비율 아군 최대 HP 8% 회복 · 같은 대상 최대 HP 8% 보호막 · 5초 | 2/4/6 |
| 테마 유대 | 윤회 | HP +20% · 아군 사망 시 AD/AP +7.000000000000001% · 최대 5중첩 · 각 유닛 첫 사망 시 HP 30% 즉시 부활 · 전투당 1회 | 2/4/6 |
| 테마 유대 | 천명 | GD +15 · 시작 인접 아군 GD +10 · 중복 미중첩 | 2/4 |
| 테마 유대 | 왕권 | HP +15% · 자신의 군중제어 대상 받는 피해 +10% · 3초 | 2/4 |
| 테마 유대 | 아르카나 | AP +15% · 시전 후 MP +15 | 2/4 |
| 테마 유대 | 공명 | AP +20% · 직접 스킬 명중 대상당 시전당 1회 AP 50% 추가 마법 피해 · 인접 적 1명에 추가 피해의 50% | 2/4/6 |
| 테마 유대 | 심연 | AP +15% · 스킬 명중 대상 받는 회복 -30% · 4초 | 2/4 |
| 테마 유대 | 운명 | AD +12% · AP +12% · 시작 시 유대 공통 무작위: AD/AP +10% / GD +15 / 시작 MP +20 | 2/4 |
| 테마 유대 | 금단 | 스킬 피해 +30% · 시전 시 현재 HP 5% 소모 · 최소 HP 1 · 다음 스킬 피해 +25% · 중복 미중첩 · 실제 스킬 피해 10% 회복 | 2/4/6 |

## 4. 상태이상과 전투효과

| 내부키 | 표시/의미 | 정의·출처 |
| --- | --- | --- |
| burn/redFlame/scorchLeap | 화상 | C01/C14/C31,지정초당피해 |
| poison/poisonRain | 중독/독 | C02소환공격/C27,DOT |
| shadow/shadowRush | AD−15% | C03/C28 |
| wind | AS+20% | C06자기강화 |
| waterSlow | AS−15% | C08 |
| earthGuard | GD+30% | C10 |
| corrosion | GD−15% | C12부식보호막유지중기본공격자반격 |
| frostBurst | AS−20% | C13 |
| darkMend | GD+15% | C15치유대상 |
| root | 속박 | 이동/BFS차단,사거리내기본공격/스킬은가능 |
| bloodFrenzy | AS+30%/추가기본타 | C20 |
| tectonicGuard | GD+20% | C22 |
| winterPrayer | AS−20% | C24치유대상의마지막생존기본공격자 |
| shatterShot | GD−20% | C29 |
| stun | 기절/띄우기/서리기절 | 행동/이동불가,C09/C32/I33;무적없음 |
| flameCurse | 받는회복−30% | C33,4초×statusDuration |
| itemHellfire | 지옥불화상 | I32,ITEM_PROC DOT |
| itemFrost | AS−25% | I33 |
| itemEvade | AS+20% | I36회피후강화 |
| normal/firewall/corrosion shield kinds | 일반/화염반격/부식보호막 | shields배열,stat상태와別 |
| harmful/cleanse | 해로운상태/정화 | C05가첫harmful상태하나제거 |
| evade/absorbed | 회피/완전흡수 | 회피는피해반환,흡수는유효타의HP피해0 |
| death/expired | 처치/소환수지속시간종료 | 둘다dead,만료는처치보상에서제외 |
| immortal/preventDeath | 죽음방지 | I28/P04의HP1생존,종족천족부활기획과다름 |


같은키/시전자효과는갱신,다른시전자상태는중첩가능합니다.기절같은공유키는시전자가같으면원래라벨이남고만료만늘어날수있습니다.모든DOT/기절에statusDuration를일률적용한다고가정하면안됩니다.

## 5. 콘텐츠 식별자·화면 대응

| 내부식별자 | 화면의미 | 현재수량/상태 |
| --- | --- | --- |
| C01~C45 | 동료캐릭터ID | 45명전체활성 |
| E01~E08/E99 | 적군/보물슬라임 | 9종,아군구매불가 |
| I01~I40 | 장비종류 | 40종 |
| I1,I2,…(inventory.uid) | 획득장비인스턴스 | 아이템종류I01과다름 |
| S01~S12/G01~G12/P01~P12 | 실버/골드/프리즘증강 | 36종 |
| T01~T41 | 공통알림감사ID | 아이템티어T1/T2/T3와다름 |
| SUPPLY/BATTLE/BOSS | 보급/일반전투/보스전 | 노드종류 |
| metaLevel/metaXp | 전체/메타레벨·XP | 인게임level/xp와별개,성장지급비활성 |
| 1/2/4 speed / 화살표1/2/3개 | 전투배속 | ROUND/중앙HP는짧은고정실시간표시 |
| prefers-reduced-motion | 운영체제모션감소 | 큰이동제거/짧은페이드 |
| popover/top layer/dialog | 툴팁/최상위레이어/모달 | z-index만으로모달보다앞서지못하는문제대응 |


## 6. 원본 초안 이름과 현재 표시 이름

원본의 과거 이름은 현재 내부 식별자가 아닙니다. 로직/저장은 Cxx ID를 사용하고 실행 시 data.js가 현재 이름으로 통일합니다. 과거 결과 딜량도 ID로 새 이름을 조회합니다.

| ID | 원본 초안 이름 | 현재 표시 이름 | 현재 해금 |
| --- | --- | --- | --- |
| C01 | 잿불 사수 모르칸 | 녹스 | 활성 |
| C02 | 역병술사 제르크 | 아즈칼 | 활성 |
| C03 | 흑검병 카이른 | 태건 | 활성 |
| C04 | 뇌광의 세리아 | 리엔 | 활성 |
| C05 | 물결술사 리엔 | 루아 | 활성 |
| C06 | 질풍의 라제크 | 카인 | 활성 |
| C07 | 섬광 사수 에단 | 유하 | 활성 |
| C08 | 침수술사 네크리스 | 벨모르 | 활성 |
| C09 | 비늘 전사 드라칸 | 라칸 | 활성 |
| C10 | 바위방패 브로크 | 울프릭 | 활성 |
| C11 | 화로장인 토르딘 | 둔가르 | 활성 |
| C12 | 성역 기사 아엘 | 엘리엘 | 활성 |
| C13 | 서리룬 바르딘 | 브룬 | 활성 |
| C14 | 홍린권 카르곤 | 적호 | 활성 |
| C15 | 그늘사제 모르딘 | 베스퍼 | 활성 |
| C16 | 뇌수 조련사 라크 | 토비 | 활성 |
| C17 | 혈검사 엘리온 | 이그니스 | 활성 |
| C18 | 광휘정령 루미아 | 아우라 | 활성 |
| C19 | 설익의 세라핀 | 설아 | 활성 |
| C20 | 적권의 하란 | 진무 | 활성 |
| C21 | 역광술사 벨라크 | 오르페 | 활성 |
| C22 | 암석정령 그란 | 골룸바 | 활성 |
| C23 | 적엽기사 피오라 | 로제트 | 활성 |
| C24 | 설화사제 이셀 | 유키나 | 활성 |
| C25 | 폭뢰정령 볼테아 | 지그 | 활성 |
| C26 | 동토기사 모르그 | 흐로드 | 활성 |
| C27 | 독시위 나엘 | 비올라 | 활성 |
| C28 | 야영자 베르스 | 시그룬 | 활성 |
| C29 | 암석궁수 드레온 | 카르도 | 활성 |
| C30 | 심해기사 발로스 | 네레이드 | 활성 |
| C31 | 화조의 키라 | 홍련 | 활성 |
| C32 | 풍술사 아르덴 | 제피로 | 활성 |
| C33 | 잿불주술사 로한 | 아그니 | 활성 |
| C34 | 성수사제 미레나 | 아스텔 | 활성 |
| C35 | 독안개술사 샤르 | 메두라 | 활성 |
| C36 | 균열칼날 브락 | 참월 | 활성 |
| C37 | 혈익궁수 아리엘 | 카르미나 | 활성 |
| C38 | 망령지휘관 세른 | 오르딘 | 활성 |
| C39 | 빙벽정령 크리스 | 글라시아 | 활성 |
| C40 | 월영권사 시엘 | 월하 | 활성 |
| C41 | 뇌검장 라그나 | 뇌진 | 활성 |
| C42 | 폭풍현자 토르간 | 바하무트 | 활성 |
| C43 | 뇌혼권왕 제르반 | 라이진 | 활성 |
| C44 | 빙영검 아스란 | 백야 | 활성 |
| C45 | 흑룡궁주 네르칸 | 아바돈 | 활성 |


## 7. 저장 및 소스 위치

[src/core/data/units.js:67](../src/core/data/units.js#L67) · `const statKeys=`; [src/core/combat/battle.js:70](../src/core/combat/battle.js#L70) · `makeUnit(entry,team)`; [src/core/progression.js:452](../src/core/progression.js#L452) · `const receipt=`; [src/ui/notices.ts:5](../src/ui/notices.ts#L5) · `const RETAINED`.

문서의정의에없는프로젝트고유약어를새로추측해추가하지않았습니다. 임시숫자/상태차이는 [미구현](UNIMPLEMENTED.md) 및 [불일치](CHANGELOG.md) 참조.
