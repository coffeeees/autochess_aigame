# v0.15.18 기준선 (0단계)

기록일: 2026-11-17 · 원본 태그: `v0.15.18-original`

## 테스트
- `baseline-tests.txt`: `node test-all.cjs` 전체 출력. 23 스위트 / 337 검사 통과, 약 6.8초.

## 전투 결과 기준선
- `combat-baseline.json`: 시드 고정 전투 81건 (`node tools/combat-baseline.cjs --write`로 생성).
  - roster 9건: 45명 전원을 5명씩 2성으로 고정 적 편성과 대결
  - mirror 5건: 플레이어 유닛끼리 대결 (quickMana)
  - items 7건: 아이템 40종을 모두 한 번 이상 장착
  - augment 36건: 증강 36종을 하나씩 적용
  - encounter 24건: 실제 적 편성 생성기(`encounters.js`)로 8개 스테이지 × 난이도 1/5/10
- 45명 스킬이 모두 한 번 이상 발동한다.
- 각 전투마다 승자, 시간, 피해·회복·보호막 합계, 남은 HP, 스킬 사용 횟수, 이벤트·로그 수, 유닛/이벤트/로그 해시를 기록한다.
- 전투 RNG는 mulberry32 시드로 주입하고, 모듈 안의 `Math.random`도 같은 방식으로 고정한다.
- 확인: `node tools/combat-baseline.cjs --check` (모두 같으면 종료 코드 0).

## 화면
`screenshots-v0.15.18/` (1600×900, 난이도 1, `tools/capture-screens.cjs`로 촬영)

| 파일 | 화면 |
| --- | --- |
| 01-home | 시작 화면 |
| 02-difficulty | 난이도 선택 |
| 03-prepare | 1-1 준비 단계 |
| 04-shop | 동료 영입(상점) |
| 05-supply | 보급 선택 |
| 06-augment | 증강 선택 (1-3 진입 전) |
| 07-deployed | 배치 후 준비 단계 |
| 08-battle | 전투 중 (1-3) |
| 09-result-supply / 09-result-battle | 보급 결과 / 전투 결과 |
| 10-codex | 도감 |
| 11-settings | 설정 |
| 12-more | 더보기 메뉴 |
| 13-patch-notes | 패치노트 |

재촬영: `node serve.cjs` 실행 후 `SHOT_DIR=<폴더> node tools/capture-screens.cjs`.

## 기준선 작성 중 발견한 사항
- 도감 화면에 "캐릭터 도감 45명 · 해금 33명", "유대 도감 28종"으로 표시된다. `dist/catalog-ui.js`에 문자열로 고정돼 있다. 데이터는 45명 전원 플레이 가능, 유대 16종이다(`test-prototype.cjs`가 16종을 검사).
- `package.json` 설명도 "33 playable units"로 남아 있다.
- `.gitignore`에 `update-*.cjs` 등 일부 스크립트가 들어 있어(일부 줄은 CRLF), 일반 `git add`로는 빠진다. 원본 커밋은 `git add -f`로 전부 넣었다.
