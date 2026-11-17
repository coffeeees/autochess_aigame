# AUTOCHESS

싱글플레이 PvE 오토체스 웹 게임 (v0.15.18 기준 재구축 중).

## 시작하기

Node.js 18 이상이 필요합니다.

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

Vitest로 `tests/` 아래 337개 검사를 실행합니다. 전투 결과가 v0.15.18 기준선과 같은지 확인하려면:

```bash
npm run baseline:check
```

코드 형식 확인:

```bash
npm run format:check
```

## 폴더

| 경로 | 내용 |
| --- | --- |
| `index.html` | 게임 페이지 |
| `src/legacy/` | 현재 게임 코드 (아직 전역 변수를 공유하는 일반 스크립트, 3단계에서 ES 모듈로 전환) |
| `src/styles/` | 스타일시트 (index.html의 순서대로 묶임) |
| `public/assets/` | 이미지와 폰트 (영문 소문자·하이픈 파일명) |
| `tests/<기능>/` | 기능별 테스트: data, skills, bonds, combat, board, shop, merge, economy, progression, items, augments, encounters, save, render, ui, docs |
| `tools/` | Vite 플러그인, 전투 기준선·화면 촬영 도구 |
| `docs/GAME_DESIGN.md` | 게임 규칙과 수치의 기준 문서 |
| `docs/GLOSSARY.md`, `docs/UNIMPLEMENTED.md`, `docs/CHANGELOG.md` | 용어집, 미구현·확인 필요 목록, 변경 이력 |
| `docs/REBUILD_PLAN.md` | 재구축 분석 보고서와 단계별 계획 |
| `docs/specs/` | 테스트가 대조하는 원본 기획 데이터 |
| `docs/archive/` | 기준선, 예전 테스트, 과거 보고서·지시서·스크립트 (참고용) |
| `legacy/` | v0.4 일러스트 버전 |

작업 규칙은 `CLAUDE.md`를 따릅니다.
