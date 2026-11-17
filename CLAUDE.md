# 프로젝트 규칙

재구축 전체 계획과 근거는 `docs/REBUILD_PLAN.md`에 있다. 작업 단계(0~7단계)는 그 문서의 5장을 따른다.

## 현재 진행 상황
- 0~2단계 완료. 원본은 `v0.15.18-original` (로컬 태그, GitHub에는 같은 이름의 브랜치).
- 기준선: `docs/archive/baseline-tests.txt`, `docs/archive/combat-baseline.json`(시드 전투 81건), `docs/archive/screenshots-v0.15.18/`.
- 결정: D1 캔버스(PixiJS), D2/D3 Preact + TypeScript(단계적), D7 과거 파일은 docs/archive에 보관.
- 다음 작업: 3단계(게임 로직을 ES 모듈로 `src/core/`에 옮기기, 시드 RNG, Battle 덮어쓰기를 훅으로, 스킬 레지스트리).

## 명령
- `npm run dev` 개발 서버(5173), `npm run build` → `dist/`, `npm run preview`(4173)
- `npm test` Vitest 337개. `npm run baseline:check` 전투 결과가 기준선과 같은지 확인. `npm run format:check` Prettier 형식 확인.
- 엔진을 옮기거나 고친 뒤에는 반드시 `npm run baseline:check`. 로직 위치가 바뀌면 `AUTOCHESS_LOGIC_DIR=<경로>`로 지정한다.

## 현재 구조에서 주의할 점 (3단계 전까지)
- `src/legacy/*.js`는 전역 변수를 공유하는 일반 스크립트다. 로드 순서는 `index.html`의 `<script defer vite-ignore>` 순서이고,
  `tools/vite-legacy-scripts.js`가 개발 서버에서 `/<이름>.js`로 제공하고 빌드 때 `dist/`에 같은 이름으로 복사한다.
  전투 Worker(`combat-worker.js`)는 `importScripts`로 로직 파일을 이름으로 불러온다. 파일 이름을 바꾸면 이 세 곳을 함께 고친다.
- 테스트는 `tests/<기능>/<출처>.test.js`. 한 파일에는 예전 스위트 한 개의 테스트만 들어 있고 준비 코드가 복사돼 있다
  (몇몇 스위트가 `require`로 공유 모듈을 덮어쓰기 때문). Vitest는 파일마다 별도 프로세스(`pool: 'forks'`)로 돈다.
- 문서의 소스 링크(`../src/legacy/x.js#L<n>`)는 줄 번호 기준이다. 코드를 크게 옮기면 링크를 갱신하고 `tests/docs/`로 확인한다.
- `docs/archive/`의 스크립트와 예전 테스트는 실행하지 않는다.

## 기준 문서
- 게임 규칙과 수치의 기준은 docs/GAME_DESIGN.md다. 코드와 문서가 다르면 수정하기 전에 사용자에게 묻는다.
- 미구현·확인 필요 항목은 docs/UNIMPLEMENTED.md를 따른다. 여기에 "확인 필요"로 적힌 동작은 임의로 바꾸지 않는다.

## 구조
- src/core/는 순수 게임 로직이다. document, window, localStorage, DOM API를 쓰지 않는다.
- 무작위는 src/core/rng.ts만 사용한다. Math.random을 직접 호출하지 않는다.
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
