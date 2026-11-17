# AUTOCHESS v0.15.18 소스 분석 보고서 및 재구축 지시서

- 분석 대상: `AUTOCHESS_v0.15.18_FULL_SOURCE.zip`
- 분석일: 2026-11-17
- 용도: 이 문서를 Claude Code에 전달해 리팩터링과 재구축 작업의 기준으로 삼습니다. 프로젝트 루트에 `CLAUDE.md`로 두거나, 첫 작업 지시와 함께 넘겨 주세요.

---

## 0. 한 줄 결론

**게임 규칙·데이터·전투 엔진은 살리고, 프로젝트 구조와 화면(UI) 계층은 새로 짭니다.**
게임 로직은 테스트 337개로 보호되고 있어 그대로 옮길 가치가 있습니다. 반면 UI는 버전마다 덧칠한 CSS와 스크립트가 쌓여 있어서, 계속 고쳐 쓰는 것보다 다시 만드는 편이 비용이 적습니다.

---

## 1. 현재 상태 요약

| 항목 | 내용 |
| --- | --- |
| 장르 | 싱글플레이 PvE 오토체스 (웹, PC 브라우저) |
| 언어/도구 | 순수 JavaScript, 프레임워크·게임엔진·빌드 도구 없음 |
| 실행 | `node serve.cjs` → `http://127.0.0.1:4173` (정적 파일 서버) |
| 저장 | 브라우저 `localStorage` (`starlight-onecost-v1`, `autochess-meta-v1`, `autochess-ui-font`) |
| 콘텐츠 | 캐릭터 45명(1~5코스트 전부 플레이 가능), 아이템 40종, 증강 36종, 유대 16종, 적, 스테이지 1-1~6-5와 7+ 무한 진행, 난이도 1~10 |
| 테스트 | `node test-all.cjs` → **23개 스위트, 337개 검사 모두 통과** (분석 시점 실측) |
| 코드 규모 | `dist/` JS 41개(약 400KB), CSS 13개, HTML 2개 |
| 에셋 | `dist/assets` 28MB (그중 폰트 17MB), `legacy/` 4.1MB |
| 문서 | 루트 md 32개 + `docs/` 지시서·보고서 다수 |

### 모듈 구성 (로드 순서대로, `index.html`에 `<script defer>` 39개)

**게임 로직 (Node와 브라우저 겸용, UMD 패턴, 유지 대상)**
- `board.js` 전장 7×8 설정, 좌표·거리
- `bonds.js`, `bond-effects.js` 유대 16종 정의와 전투 효과
- `higher-cost-drafts.js`, `data.js` 캐릭터 45명 데이터, 스킬 설명, 전역 설정(`prototypeConfig`)
- `items.js`, `item-effects.js` 아이템 40종과 효과
- `augments.js`, `augment-effects.js` 증강 36종과 효과
- `progression.js` 라운드 진행, 정산, 경제, XP
- `encounters.js` 적 편성, 난이도, 보너스 몬스터, 메타 프로필
- `preparation.js` 상점 확률, 시작 로스터, 배치 규칙
- `engine.js` 전투 시뮬레이션 (`Battle` 클래스, 45명 스킬 `switch`)
- `combat-clock.js`, `combat-worker.js`, `combat-runner.js` Web Worker 기반 전투 실행
- `vfx-events.js` 전투 이벤트를 연출용으로 기록

**화면/연출 (전역 함수 공유, 재작성 대상)**
- `prototype.js` 메인 앱: 상태, 저장/불러오기, 렌더링, 영입, 합성, 전투 시작·종료가 한 파일에 섞여 있음 (함수 38개)
- `shell-ui.js`, `stage-ui.js`, `interaction-ui.js`, `battle-ui.js`, `content-ui.js`, `catalog-ui.js`, `run-flow-ui.js`, `drag-sales.js`
- `battle-view.js`, `battle-art.js`, `combat-visuals.js`, `pixel-vfx.js`, `presentation-effects.js`, `health-effects.js`, `impact-health.js`, `screen-effects.js`, `liquid-xp.js`, `character-art.js`
- `notice-policy.js`, `notice-audit.js`, `patch-notes.js`, `font-lab.js`

---

## 2. 강점 (살릴 것)

1. **게임 규칙이 화면과 분리돼 있다.** 로직 모듈은 DOM 없이 Node에서 돌아가고, 테스트가 이를 직접 검증한다. 재구축의 가장 큰 자산이다.
2. **테스트가 촘촘하다.** 경제, 합성, 상점 확률, 45명 스킬, 아이템, 증강, 저장 이관, 전투 종료까지 337개 검사가 있다.
3. **밸런스 수치가 한곳에 모여 있다.** `data.js`의 `prototypeConfig`, `augments.js`의 `config`, `encounters.js`의 `config`처럼 수치를 조정할 위치가 정해져 있다.
4. **전투 엔진의 RNG를 주입할 수 있다.** `new Battle(allies, enemies, {rng})` 구조라 전투 재현과 테스트가 가능하다.
5. **전투를 Web Worker로 돌린다.** 탭이 백그라운드로 가도 전투가 멈추지 않도록 이미 처리돼 있다.
6. **기획 문서가 잘 정리돼 있다.** `AUTOCHESS_GAME_DESIGN.md`, `AUTOCHESS_GLOSSARY.md`, `AUTOCHESS_UNIMPLEMENTED.md`가 현재 규칙과 미구현 항목을 소스 위치까지 기록하고 있다.

---

## 3. 문제점 (근거 포함)

### 3-1. 구조 문제 (심각도: 높음)

| # | 문제 | 근거 | 영향 |
| --- | --- | --- | --- |
| S1 | **코드가 압축된 형태로 작성됨** | `engine.js` 한 줄 최대 1,043자, 파일 전체가 143줄에 27KB. 공백·줄바꿈이 거의 없음 | 사람이 읽고 고치기 어렵다. diff로 변경점을 추적하기 힘들다 |
| S2 | **원본 소스와 배포본 구분이 없음** | `src/` 없이 `dist/`를 직접 수정. `dist/index.html`과 `dist/prototype.html`이 완전히 같은 파일 | 빌드·최적화 단계를 넣을 자리가 없다 |
| S3 | **전역 변수와 스크립트 순서에 의존** | 39개 스크립트가 `state`, `battle`, `render`, `$`, `D`, `P`, `W` 같은 전역 이름을 공유. 로드 순서가 바뀌면 깨짐 | 파일 하나를 고치면 어디가 깨질지 예측하기 어렵다 |
| S4 | **`Battle.prototype`을 여러 모듈이 덮어씀** | `vfx-events.js`가 `deal`/`log`를, `item-effects.js`가 `deal`/`stats`/`heal`/`summon`/`kill`/`cast`를, `augment-effects.js`도 `install(Battle)`로 감쌈 | 감싸는 순서에 따라 결과가 달라질 수 있고, 전투 흐름을 따라가기 어렵다 |
| S5 | **`prototype.js`가 모든 역할을 맡음** | 상태, 저장, 렌더링, 영입, 합성, 전투 제어, 모달이 한 파일에 있음 | 수정 범위가 매번 넓어진다 |
| S6 | **스킬 45개가 `switch` 한 덩어리** | `engine.js` 안에 `case 'C01'`~`case 'C45'` | 스킬을 추가·수정할 때 엔진 본체를 건드려야 한다 |
| S7 | **런 전체 RNG를 재현할 수 없음** | 전투는 `rng` 주입이 되지만 `progression.js`(7곳), `preparation.js`(6곳), `encounters.js`, `items.js`는 `Math.random` 직접 호출 | 상점·보급·적 편성 버그를 재현하기 어렵다 |

### 3-2. UI 문제 (심각도: 높음)

| # | 문제 | 근거 |
| --- | --- | --- |
| U1 | **CSS 13개가 서로 덮어씀** | `prototype.css` → `stages.css` → … → `recruit-redesign.css` 순서로 쌓이며, 같은 요소를 여러 파일이 다시 정의. 예: `.shop-odds`가 `interaction.css`와 `recruit-redesign.css`에 각각 존재 |
| U2 | **`!important` 114개** | `battle-ui.css` 48개, `recruit-redesign.css` 35개, `polish-ui.css` 13개 등. 기존 규칙을 고치지 않고 위에서 강제로 덮은 흔적 |
| U3 | **문자열 템플릿 + `innerHTML` 전체 다시 그리기** | `innerHTML` 32곳, `querySelector` 58곳. 상태가 바뀔 때마다 큰 영역을 통째로 다시 그림 |
| U4 | **연출 모듈이 DOM 위치를 직접 측정해 덧붙임** | `presentation-effects.js`, `battle-ui.js`의 `placeSidePeek`처럼 다른 모듈이 만든 요소의 좌표를 읽어 위치를 계산 | 레이아웃이 조금만 바뀌어도 연출 위치가 어긋난다 |
| U5 | **캐릭터 그림이 1명뿐** | `assets/characters`에 C01(녹스) 2장만 있고 나머지 44명은 SVG 간소화 아바타 |

### 3-3. 버그와 품질 문제 (심각도: 중간)

| # | 문제 | 근거 |
| --- | --- | --- |
| B1 | **소수점 표시 오류** | 윤회 유대 설명이 `AD/AP +7.000000000000001%`로 표시됨 (`0.07*100` 부동소수점 오차). 퍼센트 표시 공통 함수에서 반올림 필요 |
| B2 | **저장 실패를 무시함** | `save()`의 `catch`가 비어 있음. 저장 공간이 꽉 차거나 비공개 모드면 진행이 조용히 사라짐 (`UNIMPLEMENTED.md` U17) |
| B3 | **손상된 저장은 새 게임으로 덮어씀** | `load()` 검증에 실패하면 경고 없이 `fresh()`. 기존 저장을 백업하지 않음 |
| B4 | **전투 도중 새로고침하면 준비 단계로 되돌아감** | 전투 중 상태를 저장하지 않음. 보너스 몬스터 골드는 이미 지급돼 장부에 남음 (`UNIMPLEMENTED.md` U16). 의도인지 결정 필요 |
| B5 | **오래된 주석** | `higher-cost-drafts.js` 첫 줄 "never added to playableIds"라고 적혀 있지만 실제로는 `data.js`에서 45명 모두 `playable:true` |
| B6 | **저장 검증 로직이 한 줄에 몰려 있음** | `load()` 검증 조건이 900자 넘는 한 줄. 이관 규칙을 추가하기 어렵다 |

### 3-4. 정리 대상 (심각도: 낮음, 하지만 양이 많음)

| 대상 | 내용 |
| --- | --- |
| 일회성 수정 스크립트 | `update-*.cjs` 14개, `connect-items.cjs`, `build-items.cjs`, `import-higher-drafts.cjs`. 문자열 치환으로 소스를 고치던 도구. `export.cjs`, `update-v2.cjs`, `update-v5.cjs`, `verify.cjs`는 이미 없는 `dist/game.js`를 참조 |
| 버전별 보고서 | 루트의 `UI_0152_UPDATE.md`~`UI_01515_UPDATE.md`, `*_UPDATE.md` 등 약 25개 |
| 지시서 | `docs/`의 Codex 지시서·요청서 다수 |
| 버전명 테스트 | `test-v0159.cjs`, `test-v01510.cjs`~`test-v01518.cjs`. 기능이 아니라 버전 기준으로 묶여 있어 무엇을 검사하는지 이름으로 알 수 없음 |
| 게임에 포함된 문서용 데이터 | `patch-notes.js`(90KB), `notice-audit.js`(17KB)가 게임 실행 시 매번 로드됨 |
| 폰트 비교 기능 | `font-lab.js`와 폰트 5종(17MB). 하나로 정하면 나머지는 제거 가능 |
| 에셋 파일 이름 | `ChatGPT 이미지 2026년 11월 13일 오전 02_49_09-1.png`처럼 공백·한글이 들어간 이름 |
| `legacy/` | v0.4 일러스트 버전 4.1MB |

---

## 4. 재구축 방향

### 권장 기술 스택

| 항목 | 권장 | 이유 |
| --- | --- | --- |
| 빌드 도구 | **Vite** | 설정이 거의 필요 없고, 수정하면 브라우저에 바로 반영된다 |
| 언어 | **TypeScript** (단계적 도입) | 유닛·아이템·증강 데이터 구조가 복잡해서 타입이 실수를 많이 잡아 준다. 처음엔 JS 그대로 옮기고 로직부터 차례로 변환 |
| 테스트 | **Vitest** | Vite와 같은 설정을 쓰고, 기존 `node:assert` 테스트를 거의 그대로 옮길 수 있다 |
| 화면 | **Preact 또는 React + 상태 저장소 1개**, 전장과 전투 연출은 **Canvas(PixiJS)** | 메뉴·상점·패널은 컴포넌트로, 많은 유닛과 이펙트가 움직이는 전장은 캔버스로 나눈다 |
| CSS | 디자인 토큰(CSS 변수) + 컴포넌트별 CSS Module | 덮어쓰기와 `!important`가 다시 쌓이지 않게 한다 |

> 화면 도구는 결정 필요 항목 D1 참고. 전장까지 DOM으로 유지하는 선택도 가능합니다.

### 목표 폴더 구조

```
autochess/
├─ CLAUDE.md                  # 이 문서의 7장 규칙
├─ package.json               # vite, vitest, typescript
├─ index.html
├─ public/assets/             # 이미지, 폰트 (영문 파일명)
├─ src/
│  ├─ core/                   # 순수 게임 로직 (DOM 사용 금지)
│  │  ├─ data/                # units.ts, items.ts, augments.ts, bonds.ts, enemies.ts, config.ts
│  │  ├─ rng.ts               # 시드 기반 RNG
│  │  ├─ board.ts
│  │  ├─ economy.ts           # 골드, 이자, 연승, 판매가
│  │  ├─ shop.ts              # 상점 확률, 리롤, 잠금
│  │  ├─ merge.ts             # 합성
│  │  ├─ progression.ts       # 라운드, 정산, XP, 증강·보급 시점
│  │  ├─ encounters.ts
│  │  ├─ save.ts              # 저장 스키마, 버전 이관, 백업
│  │  └─ combat/
│  │     ├─ battle.ts         # 전투 루프 (prototype 덮어쓰기 없이 hook 호출)
│  │     ├─ hooks.ts          # onDeal, onCast, onKill … 이벤트 훅
│  │     ├─ skills/           # 캐릭터별 스킬 파일 또는 스킬 레지스트리
│  │     ├─ items.ts          # 아이템 효과 = hook 등록
│  │     ├─ augments.ts
│  │     └─ bonds.ts
│  ├─ worker/combat.worker.ts
│  ├─ ui/                     # 컴포넌트 (상점, 대기석, HUD, 패널, 모달, 도감)
│  ├─ render/                 # 전장 캔버스, VFX, 연출
│  ├─ styles/tokens.css
│  └─ main.ts
├─ tests/                     # 기능별 테스트 (shop.test.ts, merge.test.ts …)
└─ docs/
   ├─ GAME_DESIGN.md          # 기존 AUTOCHESS_GAME_DESIGN.md
   ├─ GLOSSARY.md
   ├─ UNIMPLEMENTED.md
   ├─ CHANGELOG.md
   └─ archive/                # 과거 지시서·보고서 (참고용, 게임 빌드에서 제외)
```

---

## 5. 단계별 작업 계획 (Claude Code 작업 단위)

각 단계는 **끝날 때 게임이 실행되고 테스트가 통과하는 상태**여야 합니다. 단계마다 git 커밋을 남깁니다.

### 0단계: 기준선 확보
1. 원본 압축을 풀어 git 저장소로 만들고 `v0.15.18-original` 태그를 단다.
2. `node test-all.cjs` 결과(23 스위트 / 337 검사)를 `docs/archive/baseline-tests.txt`로 저장한다.
3. 현재 게임을 실행해 주요 화면(시작, 난이도, 준비, 상점, 전투, 결과, 보급, 증강, 도감) 스크린샷을 남긴다.
4. 고정 시드로 몇 가지 전투를 돌려 결과(승패, 남은 HP, 피해 합계)를 JSON으로 저장한다. 이후 엔진을 옮길 때 같은 결과가 나오는지 비교하는 기준이 된다.

**완료 기준:** 원본 태그, 테스트 기준선, 전투 결과 기준선 파일이 있다.

### 1단계: 정리와 포맷
1. `update-*.cjs`, `connect-items.cjs`, `build-items.cjs`, `import-higher-drafts.cjs`, `export*.cjs`, `verify.cjs`, `generate-project-docs.cjs`, `crop-faces.py`, `slice-portraits.py`를 `docs/archive/scripts/`로 옮긴다 (삭제 전 사용자 확인).
2. 루트의 버전별 `*_UPDATE.md`, `docs/`의 지시서를 `docs/archive/`로 옮긴다. `AUTOCHESS_GAME_DESIGN.md`, `GLOSSARY`, `UNIMPLEMENTED`, `CHANGELOG`만 `docs/`에 남긴다.
3. `dist/prototype.html`(중복)을 제거한다.
4. Prettier로 모든 JS/CSS를 펼친다. **동작 변경 없이 포맷만** 바꾸는 커밋으로 분리한다.
5. 테스트 실행.

**완료 기준:** 337개 검사 통과, 게임 정상 실행, 루트가 깔끔하다.

### 2단계: 빌드 환경 도입
1. Vite + Vitest 설치, `src/`, `public/` 구조 생성.
2. 에셋을 `public/assets/`로 옮기고 영문 파일명으로 바꾼다 (`battlefield-bg.png`, `board-7x8.png` 등). 참조 경로를 모두 갱신한다.
3. 기존 `test-*.cjs`를 Vitest로 옮기고, **버전명이 아니라 기능 단위**로 파일을 다시 나눈다 (`shop.test`, `merge.test`, `economy.test`, `skills.test`, `items.test`, `augments.test`, `bonds.test`, `save.test`, `combat-worker.test` …).
4. `npm run dev`, `npm run build`, `npm test` 스크립트를 정리한다.

**완료 기준:** 검사 수가 337개 이상 유지되고, `npm run dev`로 게임이 뜬다.

### 3단계: 게임 로직(core) 모듈화
1. 로직 파일을 ES 모듈(`import`/`export`)로 바꿔 `src/core/`로 옮긴다. UMD 래퍼와 전역 `root.AutoXxx`를 제거한다.
2. **시드 RNG(`rng.ts`)를 만들어** `progression`, `preparation`, `encounters`, `items`의 `Math.random`을 모두 대체한다. 런 상태에 시드를 저장한다.
3. **`Battle.prototype` 덮어쓰기를 훅 방식으로 바꾼다.** `battle.ts`가 `deal`, `heal`, `cast`, `kill`, `summon`, `stats` 지점에서 등록된 훅을 순서대로 호출하고, 아이템·증강·유대·VFX 기록은 훅으로 등록한다. 훅 실행 순서를 명시적으로 정한다.
4. 스킬 45개 `switch`를 `skills/` 레지스트리(ID → 함수)로 분리한다.
5. 0단계의 전투 결과 기준선과 **완전히 같은 결과**가 나오는지 확인한다.
6. TypeScript로 변환한다 (데이터 타입부터: `Unit`, `Item`, `Augment`, `Bond`, `RunState`).

**완료 기준:** 모든 테스트 통과, 시드 전투 결과가 기준선과 같다, `src/core/`에 `document`/`window` 참조가 하나도 없다.

### 4단계: 저장 시스템 정비
1. `save.ts`에 저장 스키마 버전, 이관 함수 목록, 검증 함수를 분리한다 (기존 `load()` 한 줄 검증을 풀어서).
2. 저장 실패 시 사용자에게 알린다 (B2).
3. 검증 실패 시 기존 저장을 `...-backup-<시각>` 키로 백업한 뒤 새로 시작하고, 알림을 띄운다 (B3).
4. 기존 `starlight-onecost-v1` 저장을 읽어 새 형식으로 옮기는 테스트를 만든다.

**완료 기준:** 기존 v0.15.18 저장 파일을 불러와 그대로 이어할 수 있다.

### 5단계: UI 재작성
1. 디자인 토큰(`tokens.css`)을 만든다. 색, 코스트 색, 특성 색, 간격, 글꼴, 패널 테두리를 기존 CSS에서 추출한다.
2. 화면을 컴포넌트로 다시 만든다. 순서: HUD → 대기석 → 상점(영입창) → 전장(준비 배치·드래그) → 우측/좌측 패널(유대, 보관함, 아이템) → 모달(보급, 증강, 결과, 6-5 완료) → 시작/난이도 → 도감 → 설정·패치노트.
3. 상태는 저장소 하나에서 관리하고, 화면은 상태를 읽기만 한다. 게임 규칙 호출은 `core`의 함수로만 한다.
4. 알림 정책(`notice-policy.js`의 유지 12종 + T28)은 그대로 옮긴다.
5. `!important` 사용 금지. 컴포넌트 CSS는 해당 컴포넌트에만 적용한다.
6. 각 화면을 0단계 스크린샷과 나란히 비교한다.

**완료 기준:** 기존 기능 목록(6장 체크리스트)을 모두 수행할 수 있고, CSS에 `!important`가 없다.

### 6단계: 전장과 전투 연출
1. 전장 배경, 7×8 격자, 유닛, 체력바, 피해 숫자, 투사체, 스킬 VFX를 캔버스 렌더러로 옮긴다 (D1에서 DOM 유지로 정하면 생략).
2. 전투 연출은 Worker가 보낸 이벤트 목록만 보고 그린다. 연출이 게임 상태를 바꾸지 않는다.
3. 기존 연출 사양(노란 체인 라이트닝, 합성 900/680ms, 레벨업, 하트 HP 연출, 액체 XP 버튼, ROUND 전환)을 하나씩 옮긴다.
4. 배속 1/2/4배와 일시정지, 백그라운드 탭 처리를 유지한다.

**완료 기준:** 4배속에서도 프레임이 안정적이고, 전투 결과가 연출 유무와 상관없이 같다.

### 7단계: 마무리
1. 퍼센트 표시 공통 함수로 B1 수정.
2. `patch-notes`, `notice-audit` 데이터를 필요할 때만 불러오도록 분리한다.
3. 폰트를 하나로 확정하고 나머지를 제거한다. 폰트를 woff2로 변환하고 한글 서브셋을 적용한다.
4. `npm run build` 결과물 용량을 확인한다.

---

## 6. 기능 보존 체크리스트

재구축 후 아래 항목이 모두 기존과 같게 동작해야 합니다. 수치는 `docs/GAME_DESIGN.md`가 기준입니다.

- [ ] 시작 화면, 이어하기, 난이도 1~10 (시작 HP 100~50, 적 피해 배율 0.6~1.5)
- [ ] 새 원정: 7G, Lv3/0XP, 1코스트 2명 + 2코스트 1명 무작위, 첫 상점 고정 후보(C02/C04/C09/C10/C11)
- [ ] 스테이지 구조: 1구간 SUPPLY-SUPPLY-BATTLE-BATTLE-BOSS, 2구간 이후 BATTLE-BATTLE-SUPPLY-BATTLE-BOSS
- [ ] 증강 선택 1-3 / 3-3 / 5-3 진입 직전, 3지선다, 실버/골드/프리즘
- [ ] 보급 4개 중 2개 선택, 50% 확률 추가 골드
- [ ] 6-5 이후 종료/계속 선택, 7+ 무한 진행
- [ ] 경제: 구매 1~5G, 리롤 2G(S11 1G), 일반 승/패 3/1G, 보스 5/3G, 연승 최대 5G, 이자 10G당 1G 최대 5G, 보스 추가 골드, 보너스 몬스터
- [ ] 레벨 구매 4G → 4XP, 레벨별 코스트 확률표, 보유 3성 제외, 재정규화
- [ ] 합성: 같은 ID·같은 성급 3명 → 다음 성급, 최대 3성, 전장 우선 기준, 장비 반환/보존
- [ ] 판매가 cost × 3^(star−1), 드래그 시 양쪽 판매 영역
- [ ] 상점 1회성 잠금, 추천 최대 3개, 보유·합성 예고 표시
- [ ] 배치 한도 = 레벨(최대 10, P12 증강 시 11), 대기석 10칸, 같은 ID 전장 1명, 0명 전투 차단, 정원 미달 확인창
- [ ] 아이템: 캐릭터당 3칸, T1/T2 중복 허용, T3 규칙, 보관함, 보스 확정 장비
- [ ] 유대 16종 단계 효과, 45명 스킬
- [ ] 승리 시 HP +2, 패배 시 10 + ordinal×2 손실
- [ ] 전투 Worker, 배속 1/2/4배, 전투 딜 그래프
- [ ] 도감 4종, 패치노트, 설정
- [ ] 기존 v0.15.18 저장 불러오기

---

## 7. Claude Code 작업 규칙 (CLAUDE.md에 넣을 내용)

```markdown
# 프로젝트 규칙

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
```

---

## 8. 사용자 결정이 필요한 항목

재구축 전에 정해 두면 작업이 흔들리지 않습니다.

| # | 결정할 것 | 선택지 | 권장 |
| --- | --- | --- | --- |
| D1 | 전장 렌더링 방식 | (a) 캔버스(PixiJS) (b) 지금처럼 DOM | (a) 유닛·이펙트가 늘어날수록 유리 |
| D2 | 메뉴·패널 UI 도구 | (a) Preact/React (b) 프레임워크 없이 정리 | (a) |
| D3 | TypeScript 도입 | (a) 단계적 도입 (b) JS 유지 | (a) |
| D4 | 전투 중 새로고침 처리 (B4) | (a) 지금처럼 준비 단계로 되돌림 + 보너스 골드 회수 (b) 전투 결과를 즉시 확정 (c) 현재 유지 | 기획 판단 필요 |
| D5 | 기본 글꼴 | Pretendard / SUIT / Noto Sans KR / 나눔고딕 / Gothic A1 | 하나 확정 후 나머지 제거 |
| D6 | 캐릭터 그림 | (a) 45명 일러스트 추가 예정 (b) 64×64 도트 (c) 현재 SVG 아바타 유지 | 방향만 먼저 정하면 데이터 구조를 맞춰 둘 수 있음 |
| D7 | 과거 문서·스크립트 | (a) docs/archive로 보관 (b) 삭제 | (a) git 이력이 있으면 나중에 삭제 |
| D8 | 메타 성장·뽑기 (현재 버튼만 있음) | 이번 재구축에 포함 / 이후 | 재구축 완료 후 |

---

## 9. 참고: 분석 중 확인한 수치

- `dist/*.js` 41개, 총 약 400KB. 최대 파일: `patch-notes.js` 90KB, `prototype.js` 38KB, `engine.js` 28KB, `higher-cost-drafts.js` 25KB
- `dist/*.css` 13개, `!important` 114개 (battle-ui 48, recruit-redesign 35, polish-ui 13, ui-refinement 6, 나머지 12)
- `index.html` 스크립트 태그 39개, 스타일시트 13개
- `Math.random` 직접 호출: progression 7, preparation 6, encounters 2, items 2, combat-worker 2, engine 1, augments 1
- `Battle.prototype` 덮어쓰기: vfx-events.js, item-effects.js, augment-effects.js
- 에셋: 폰트 17MB, 배경·보드 PNG 약 8MB, 캐릭터 3MB(C01만)
- 테스트: 23 스위트 / 337 검사 전부 통과 (2026-11-17 실행)
