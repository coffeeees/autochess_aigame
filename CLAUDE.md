# 프로젝트 규칙

재구축 전체 계획과 근거는 `docs/REBUILD_PLAN.md`에 있다. 작업 단계(0~7단계)는 그 문서의 5장을 따른다.

## 현재 진행 상황
- 0~4단계 완료. 원본은 `v0.15.18-original` (로컬 태그, GitHub에는 같은 이름의 브랜치).
- 기준선: `docs/archive/baseline-tests.txt`, `docs/archive/combat-baseline.json`(시드 전투 81건), `docs/archive/screenshots-v0.15.18/`.
- 결정: D1 캔버스(PixiJS), D2/D3 Preact + TypeScript(단계적), D4 (a) 전투 중 새로고침은 준비 단계로 되돌리고 보너스 보상 회수, D7 과거 파일은 docs/archive에 보관.
- 다음 작업: 5단계(UI 재작성: 디자인 토큰, Preact 컴포넌트, 상태 저장소 1개, `!important` 금지). 남은 결정: D5 기본 글꼴, D6 캐릭터 그림 방향.

## 명령
- `npm run dev` 개발 서버(5173), `npm run build` → `dist/`, `npm run preview`(4173)
- `npm test` Vitest. `npm run baseline:check` 전투 결과가 기준선과 같은지 확인. `npm run typecheck` TypeScript 검사.
  `npm run format:check` Prettier 형식 확인. Node 22.18 이상(도구가 `.ts`를 Node로 직접 불러온다).
- 전투 엔진·스킬·효과를 고친 뒤에는 반드시 `npm run baseline:check`.

## 코드 구조 (3단계 이후)
- `src/core/`: 게임 로직 ES 모듈. 각 모듈의 기본 내보내기는 예전 `AutoXxx` 객체와 같은 API다.
  `data/units.js`(명단·스킬 설명·`prototypeConfig`), `data/bonds.js`, `data/higher-cost-drafts.js`, `items.js`, `augments.js`,
  `progression.js`, `encounters.js`, `preparation.js`, `rng.ts`, `types.ts`, `save.ts`(저장 키·버전·이관표·검증·백업·D4),
  `combat/battle.js`(전투 루프), `combat/hooks.ts`, `combat/skills/cost1~5.js`(스킬 본문), `combat/*-effects.js`, `combat/vfx-events.js`, `combat/clock.js`, `combat/geometry.ts`.
- 무작위: 상태가 있는 함수는 기본값으로 `runRng(state)`(→ `state.rngState`)를 쓰고, 상태가 없는 함수(`items.draw`, `augments.draw`,
  `startingRoster`)는 `rng`를 반드시 받는다. 전투는 `seed`로 시작해 `rngState`를 들고 다닌다(Worker에서도 이어짐).
- 전투 확장: `Battle.use(extension)`. around 훅(`stats/heal/summon/kill/cast/deal/log`)과 이벤트(`start/update`)는 `order` 값 순서로 실행된다.
  순서표는 `combat/hooks.ts` 머리 주석. 유대 규칙 호출(`Bonds.beforeDamage` 등)은 전투 루프 안의 정해진 지점에서 직접 호출한다.
- 스킬: `combat/skills/costN.js`의 `Cxx(u, target, s)`를 `this`=전투로 호출한다. 새 스킬은 해당 코스트 파일에 추가한다.
- `src/worker/`: 전투 Worker. `combat-worker-host.js`가 본체(환경 주입), `combat.worker.js`가 브라우저 진입점.
- `src/main.js` + `src/legacy-globals.js`: core 모듈을 예전 전역 이름(`AutoData` 등)으로 노출한다. 화면을 다시 만들면(5단계) 없앤다.
- `src/legacy/*.js`: 아직 전역을 공유하는 화면 스크립트. 로드 순서는 `index.html`의 `<script defer vite-ignore>` 순서이고,
  `tools/vite-legacy-scripts.js`가 개발 서버에서 `/<이름>.js`로 제공하고 빌드 때 `dist/`에 같은 이름으로 복사한다.

## 테스트·문서에서 주의할 점
- 테스트는 `tests/<기능>/<출처>.test.js`. 예전 스위트에서 옮긴 파일은 그 스위트의 준비 코드가 복사돼 있다.
  Vitest는 파일마다 별도 프로세스(`pool: 'forks'`)로 돌고, `tests/setup/legacy-globals.js`가 전역 이름을 채운다.
- Worker 테스트는 `tests/support/combat-worker.js`로 vm 컨텍스트에 `onmessage`를 붙인다.
- 문서의 소스 링크(`../src/core/x.js#L<n>`)는 줄 번호 기준이다. 코드를 옮기면 링크를 갱신하고 `tests/docs/`로 확인한다.
- `docs/specs/CORE_RULES_BASELINE_v0.15.10.json`의 `coreHashes`는 일부 core 모듈의 해시다. 그 모듈을 의도적으로 고쳤을 때만 갱신한다.
- 저장 형식은 RunState JSON 그대로(`starlight-onecost-v1`)다. 필드를 바꾸면 `save.ts`의 `SAVE_VERSION`·`MIGRATIONS`와 `types.ts`, `tests/save/save-system.test.js`를 함께 고친다.
  `tests/fixtures/v0.15.18-*.json`은 원본 게임에서 받은 실제 저장이므로 고치지 않는다.
- 새 알림은 `notice-policy.js`의 `added`(T42~)에 넣고 `notice-audit.js`에 행을 추가한다. T01~T41 목록은 v0.15.7 조사 기록이라 바꾸지 않는다.
- `docs/archive/`의 스크립트와 예전 테스트는 실행하지 않는다.

## 기준 문서
- 게임 규칙과 수치의 기준은 docs/GAME_DESIGN.md다. 코드와 문서가 다르면 수정하기 전에 사용자에게 묻는다.
- 미구현·확인 필요 항목은 docs/UNIMPLEMENTED.md를 따른다. 여기에 "확인 필요"로 적힌 동작은 임의로 바꾸지 않는다.

## 구조
- src/core/는 순수 게임 로직이다. document, window, localStorage, DOM API를 쓰지 않는다.
- 무작위는 src/core/rng.ts만 사용한다. Math.random을 직접 호출하지 않는다(테스트가 검사한다).
- 전투 확장(아이템, 증강, 유대, VFX 기록)은 훅으로 등록한다. Battle의 메서드를 덮어쓰지 않는다.
- 화면 코드는 core 함수를 호출하고 상태를 읽기만 한다. 게임 규칙을 화면 코드에 다시 구현하지 않는다.
- 밸런스 수치는 src/core/data/에만 둔다.

## 스타일
- 코드는 Prettier 포맷을 유지한다. 한 줄에 여러 문장을 몰아 쓰지 않는다.
- CSS에서 !important를 쓰지 않는다. 기존 규칙을 덮어쓰는 새 파일을 만들지 말고 해당 컴포넌트 CSS를 고친다.
- 새 버전마다 UPDATE 문서나 일회성 수정 스크립트를 만들지 않는다. 변경 내용은 docs/CHANGELOG.md와 git 커밋 메시지에 남긴다.
- 에셋 파일명은 영문 소문자와 하이픈만 쓴다.

## 작업 방식
- 요청 범위 밖의 동작은 바꾸지 않는다. 바꿔야 할 이유를 발견하면 먼저 알린다.
- 동작 변경과 리팩터링(포맷, 파일 이동, 이름 변경)은 커밋을 분리한다.
- 작업이 끝나면 npm test를 실행하고, 게임 규칙을 건드렸다면 관련 테스트를 추가한다.
- 화면을 바꿨다면 브라우저에서 직접 확인한다.
