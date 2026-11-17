# AUTOCHESS

싱글플레이 PvE 오토체스 웹 게임 (v0.15.18 기준 재구축 중).

## 시작하기

Node.js 22.18 이상이 필요합니다.

```bash
npm install
```

```bash
npm run dev
```

개발 서버: http://127.0.0.1:5173 (게임 코드를 고치면 페이지가 자동으로 새로고침됩니다)

```bash
npm run build
```

```bash
npm run preview
```

빌드 결과는 `dist/`에 생기고, preview는 http://127.0.0.1:4173 에서 엽니다.

## 테스트

```bash
npm test
```

Vitest로 `tests/` 아래 검사를 실행합니다(v0.15.18의 337개 + 재구축 중 추가한 검사). 전투 결과가 v0.15.18 기준선과 같은지 확인하려면:

```bash
npm run baseline:check
```

TypeScript 검사와 코드 형식 확인:

```bash
npm run typecheck
```

```bash
npm run format:check
```

## 폴더

| 경로 | 내용 |
| --- | --- |
| `index.html` | 게임 페이지(새 UI) |
| `src/core/` | 게임 규칙·데이터·전투 엔진 (ES 모듈, DOM 사용 없음). 스킬은 `combat/skills/`, 무작위는 `rng.ts` |
| `src/worker/` | 전투 Web Worker |
| `src/ui/` | 화면 (Preact, 상태 저장소 `store.ts` 하나, 디자인 토큰 `styles/tokens.css`, 컴포넌트별 CSS Module). 전투 전장·연출은 `render/`(PixiJS 캔버스) |
| `src/content/` | 패치노트·알림 조사표(필요할 때만 불러옴) |
| `public/assets/` | 이미지와 폰트 (영문 소문자·하이픈 파일명) |
| `tests/<기능>/` | 기능별 테스트: data, skills, bonds, combat, board, shop, merge, economy, progression, items, augments, encounters, save, rng, render, ui, ui-next(화면 저장소·연출), docs |
| `tools/` | 전투 기준선 도구 |
| `docs/GAME_DESIGN.md` | 게임 규칙과 수치의 기준 문서 |
| `docs/GLOSSARY.md`, `docs/UNIMPLEMENTED.md`, `docs/CHANGELOG.md` | 용어집, 미구현·확인 필요 목록, 변경 이력 |
| `docs/REBUILD_PLAN.md` | 재구축 분석 보고서와 단계별 계획 |
| `docs/specs/` | 테스트가 대조하는 원본 기획 데이터 |
| `docs/archive/` | 기준선, 예전 테스트, 과거 보고서·지시서·스크립트 (참고용) |
| `legacy/` | v0.4 일러스트 버전 |

작업 규칙은 `CLAUDE.md`를 따릅니다.
