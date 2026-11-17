# AUTOCHESS

싱글플레이 PvE 오토체스 웹 게임 (v0.15.18 기준 재구축 중).

## 실행

```bash
node serve.cjs
```

브라우저에서 http://127.0.0.1:4173 을 엽니다. 별도 설치가 필요 없습니다(Node.js 18 이상).

## 테스트

```bash
node test-all.cjs
```

전투 결과가 v0.15.18 기준선과 같은지 확인:

```bash
node tools/combat-baseline.cjs --check
```

## 폴더

| 경로 | 내용 |
| --- | --- |
| `dist/` | 게임 코드와 에셋 (현재는 원본이자 배포본) |
| `test-*.cjs` | 테스트 스위트 (`test-all.cjs`가 전부 실행) |
| `tools/` | 기준선 전투·화면 촬영 도구 |
| `docs/GAME_DESIGN.md` | 게임 규칙과 수치의 기준 문서 |
| `docs/GLOSSARY.md`, `docs/UNIMPLEMENTED.md`, `docs/CHANGELOG.md` | 용어집, 미구현·확인 필요 목록, 변경 이력 |
| `docs/REBUILD_PLAN.md` | 재구축 분석 보고서와 단계별 계획 |
| `docs/specs/` | 테스트가 대조하는 원본 기획 데이터 |
| `docs/archive/` | 기준선, 과거 버전 보고서·지시서·일회성 스크립트 (참고용) |
| `legacy/` | v0.4 일러스트 버전 |

작업 규칙은 `CLAUDE.md`를 따릅니다.
