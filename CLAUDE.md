# 프로젝트 규칙

재구축 전체 계획과 근거는 `docs/REBUILD_PLAN.md`에 있다. 작업 단계(0~7단계)는 그 문서의 5장을 따른다.

## 현재 진행 상황
- 0~7단계 완료(재구축 계획 끝). 화면은 `index.html` → `src/ui/`. 기존 화면(legacy.html)은 6단계에서 지웠다. 원본은 `v0.15.18-original` (로컬 태그, GitHub에는 같은 이름의 브랜치).
- 기준선: `docs/archive/baseline-tests.txt`, `docs/archive/combat-baseline.json`(시드 전투 81건, v0.17.0부터 지운 증강 전투 36건과 v0.20.0부터 지운 예전 장비 전투 7건을 뺀 38건만 비교, 로그는 예전 캐릭터 이름으로 돌려 비교), `docs/archive/screenshots-v0.15.18/`.
- 결정: D1 캔버스(PixiJS), D2/D3 Preact + TypeScript(단계적), D4 (a) 전투 중 새로고침은 준비 단계로 되돌리고 보너스 보상 회수,
  D5 Pretendard 하나, D6 (a) 카드·도감은 45명 일러스트 + 전장은 도트 스프라이트(`src/ui/art/characters.ts`), D7 과거 파일은 docs/archive에 보관.
- 그림: 큰 그림은 WebP로 배포한다. 원본 PNG는 `assets-src/images/`, 변환은 `python3 tools/convert-images.py`(결과 목록 `docs/specs/images.json`).
  보드 그림은 칸을 잰 그림이라 무손실로만 바꾼다(테스트가 원본 해시와 WebP 크기를 검사). 새 일러스트·도트 그림도 원본은 `assets-src/`, 배포본은 `public/assets/`.

## 명령
- `npm run dev` 개발 서버(5173), `npm run build` → `dist/`, `npm run preview`(4173)
- `npm test` Vitest. `npm run baseline:check` 전투 결과가 기준선과 같은지 확인. `npm run typecheck` TypeScript 검사.
  `npm run format:check` Prettier 형식 확인. Node 22.18 이상(도구가 `.ts`를 Node로 직접 불러온다).
- 전투 엔진·스킬·효과를 고친 뒤에는 반드시 `npm run baseline:check`.

## 코드 구조 (6단계 이후)
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
- `src/ui/`: 화면. `store.ts`(상태 저장소 하나, 동작은 core 호출만), `components/`(컴포넌트 + CSS Module), `combat/runner.ts`(Worker 전투 실행기),
  `art/`(캐릭터 그림 등록표 D6: 일러스트 portrait·도트 sprite, 없으면 SVG 아바타), `notices.ts`(알림 정책), `styles/tokens.css`. `!important` 금지(테스트가 검사).
- `src/ui/render/`: 전투 연출. `plan.ts`(이벤트 → 연출 명령, 순수), `timeline.ts`(시간축 모델, 순수), `screen.ts`(화면 연출 시간·수치, 순수),
  `stage.ts`(게임 화면을 열 때 만드는 PixiJS 장면: 안개 배경 cover·보드 contain·격자 디버그 `?grid`·유닛·연출 레이어, 동적 import),
  `battlefield.ts`(장면 위에 전투 유닛·연출을 그림). 연출은 전투 상태를 읽기만 한다. 화면 연출 신호는 저장소의 `cues`
  (`ScreenCues.tsx`가 재생 후 `doneCue`), 전투 끝 장면은 `finishing`. 연출 시간은 `presentation` 환경을 줄 때만 켜진다(테스트는 끔).
- 증강: `augments.js`의 54종(`hold`면 추첨 제외, 지금은 없음). v0.15.18의 36종은 v0.17.0에서 지웠다. G13 쌍둥이 전술이 있으면 같은 캐릭터 전장 2명(`sameUnitLimit`).
  효과는 ID가 아니라 `effect` 필드로 판정한다(`combat/augment-effects.js`). 원정 중 상태(지연 보상·투자·무료 새로고침·분신 지정)는 `augment-run.js`와 `state.augmentRun`.
  밸런스 자동 시뮬레이션: `node tools/balance-sim.mjs --seeds 8 --part base|S|G|P --out x.json`(고정 규칙 봇, 브라우저 플레이와 구분해 기록).
- 전장(v0.18.0): 8열 × 7행 좌우 대치, `pos = 행 × 8 + 열`, 아군 col 0~3 / 적 col 4~7. 좌표 규칙은 `core/board.js`(`isAllyCell`, 앞뒤 판정 `depth`,
  예전 칸 회전 `rotateOldPos`), 화면 좌표 변환은 `ui/art/board.ts` 한 곳(보정값 `docs/specs/BOARD_SIDE_8X7_CALIBRATION.json`).
  보드 그림 위치는 DOM 입력 칸 컨테이너(`Board.tsx`의 `.art`) 사각형을 장면이 읽어 맞춘다. 전투 기준선 도구는 로그 칸 번호를 예전 번호로 되돌려 비교한다.
- 장비(v0.20.0): 기본 8종(IB01~)·완성 36종(IC01~) `items.js`, 조합·장착·회수기 규칙 `equipment.ts`(무료 회수 없음, 기본 장비는 캐릭터당 1개),
  완성 장비 고유 효과 `combat/item-effects.js`(effectKey, 개수만큼 합산). 수치·효과는 임시값. 회수 연출은 `ScreenCues`의 `recovery` 신호.
- 메타 레벨(v0.17.2): `meta.ts`(곡선·원정 보상·레벨업·중복 방지), 수치는 `data/meta.js`(임시값). 프로필 저장 키 `autochess-meta-v1`은 원정 저장과 별도이고,
  저장소(`store.ts`의 `settleMeta`)가 원정이 끝날 때(`run.done`) 원정 ID(`runId`)마다 한 번 지급한다.
- 메타 영구 강화(v0.19.0): `meta-upgrades.ts`(레벨 보상 P·티켓 원장, 구매, 원정 스냅샷 `state.metaRun`, 횟수 `take`), 수치 `data/meta-upgrades.js`(임시값),
  전투 `combat/meta-effects.js`(전투 옵션 `allyModifiers.meta`가 있을 때만). 강화가 없으면 원정·전투가 예전과 같아야 한다(기준선).
  화면 `components/Abilities.tsx`. 개발용 테스트 프로필은 주소 `?metadev`(저장 키 `autochess-meta-dev-v1`).
- `src/content/`: 패치노트·알림 조사표. 새 UI는 창을 열 때만 동적 import 한다.
- 원본(v0.15.18)과 기능·표시가 달라지는 수정을 하면 `src/content/rebuild-changes.js`에 행을 추가한다(패치노트의 "재구축 변경 사항" 탭).
- 수치 표기: 퍼센트는 `src/core/format.ts`의 `percent`(비율)·`percentNumber`(백분율 숫자)를 쓴다(B1).
- 글꼴: `public/assets/fonts/pretendard-subset.woff2`는 쓰인 글자만 남긴 부분 집합이다. 화면 글에 새 글자를 넣어 테스트가 실패하면
  `pip install fonttools brotli && python3 tools/subset-font.py`로 다시 만든다(원본은 `assets-src/fonts/`). 배포하지 않는 원본 에셋은 `assets-src/`.

## 테스트·문서에서 주의할 점
- 화면 테스트는 `tests/ui-next/`(저장소 동작, 드래그, 흐름, 연출, 스타일 규칙). 화면을 바꾸면 브라우저에서 직접 확인한다.
- 코드 주석·테스트 이름·커밋 메시지는 한국어로 쓴다.
- 테스트는 `tests/<기능>/<출처>.test.js`. 예전 스위트에서 옮긴 파일은 그 스위트의 준비 코드가 복사돼 있다.
  Vitest는 파일마다 별도 프로세스(`pool: 'forks'`)로 돈다. 예전 스위트에서 옮긴 일부 테스트는 core 모듈을 `AutoXxx` 이름으로 vm 컨텍스트에 넣는다.
- Worker 테스트는 `tests/support/combat-worker.js`로 vm 컨텍스트에 `onmessage`를 붙인다.
- 문서의 소스 링크(`../src/core/x.js#L<n>`)는 줄 번호 기준이다. 코드를 옮기면 링크를 갱신하고 `tests/docs/`로 확인한다.
- `docs/specs/CORE_RULES_BASELINE_v0.15.10.json`의 `coreHashes`는 일부 core 모듈의 해시다. 그 모듈을 의도적으로 고쳤을 때만 갱신한다.
- 저장 형식은 RunState JSON 그대로(`starlight-onecost-v1`, 저장 버전 6)다. 버전 4(v0.17.x, 7열 전장)는 `board.migrate`로 칸을 회전해 5로, 버전 5는 예전 장비를 지우고 회수기 2개를 줘 6으로 이관한다. 필드를 바꾸면 `save.ts`의 `SAVE_VERSION`·`MIGRATIONS`와 `types.ts`, `tests/save/save-system.test.js`를 함께 고친다.
  v0.17.0부터 이전 버전 저장(버전 1~3)은 이관하지 않고 지운다(T45, 사용자 결정). `tests/fixtures/v0.15.18-*.json`은 원본 게임에서 받은 실제 저장으로, 지워지는지 확인하는 데 쓴다. 고치지 않는다.
- 새 알림은 `src/ui/notices.ts`의 `ADDED`(T42~)에 넣고 `src/content/notice-audit.js`에 행을 추가한다. T01~T41 목록은 v0.15.7 조사 기록이라 바꾸지 않는다.
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
