# 검증 기록

검증 날짜: 2026-09-12. 아래 결과는 이 문서의 최종 테스트 실행 기록으로 갱신한다.

## 구분

1. 패키지 단위·통합 검증: CLI, 저장, HTTP, 설치, MCP 프로토콜.
2. 공통 UI 검증: 실제 Chromium에 동일 viewer 코드를 렌더링하고 상호작용 확인.
3. 네이티브 호스트 검증: Codex/Claude/Grok 앱의 실제 스킬 감지·인앱 브라우저·현재 세션.

3번은 호스트 앱에 접근해 실행해야만 완료라고 기록한다. 일반 브라우저나 모의 MCP 클라이언트 테스트를 네이티브 앱 검증으로 부르지 않는다.

## 실제 실행 결과 — 0.1.0

| 항목 | 결과 | 실행 환경 / 의미 |
|---|---|---|
| `npm test` | **64/64 통과**, 실패·스킵 0 | Linux / Node.js 22.16.0. 데이터 계약, 저장·충돌, 세션, HTTP, 설치·제거, MCP |
| `npm run check` | **21개 검사 통과** | JavaScript 구문, 예제, 스키마 버전, 필수 문서 |
| JSON Schema 검증 | 스키마 자체와 예제 2개 통과 | Python jsonschema Draft 2020-12 |
| `npm pack --dry-run` | 통과 | 의존성 없는 설치 패키지 구성 확인. npm 레지스트리에는 게시하지 않음 |
| 공통 UI | **28개 확인 통과**, page error 0 | Chromium, 1536×1024 및 390×844, 아래 제약 참고 |
| 실제 Codex / Claude / Grok 앱 | **미실행** | 이 환경에 해당 호스트 앱이 없어 직접 실행하지 않음 |
| macOS / Windows 실제 실행 | **미실행** | CI 매트릭스를 제공하되 실제 실행 결과와 구분 |

## 추가 실행 기록 — 2026-10-02

0.1.0 코드에 대해 macOS에서 다시 실행한 결과다. 위 표의 "미실행" 항목 중 아래에 적은 범위만 확인했고, 나머지는 계속 미실행이다.

| 항목 | 결과 | 실행 환경 / 의미 |
|---|---|---|
| `npm test` | **64/64 통과**, 실패·스킵 0 | macOS (Darwin) / Node.js 26.5.0 |
| `npm run check` | **21개 검사 통과**, 런타임 의존성 0 | 동일 환경 |
| `install --agents claude,generic` | 통과 | 빈 Git 프로젝트에 `.claude/skills/codeatlas`, `.codeatlas/`, `CLAUDE.md`·`AGENTS.md` 관리 블록 생성 확인 |
| `doctor` | 통과 | 그래프 revision 0, 세션 상태 정상 |
| `demo` + 실제 viewer | 통과 | Claude Code 데스크톱 앱의 내장 브라우저에서 한글 UI, 그래프, 상세 패널, "예시 프로젝트" 표시 렌더링 확인 |
| 예제 그래프 게시 | 의도대로 거절 | 프로젝트 ID 불일치(`Project identity mismatch`)와 demo 플래그 변경(`Demo flag cannot silently change`)을 거절하고 기존 지도를 보존 |
| 실제 프로젝트 적용 | 통과 | 개인 TypeScript 프로젝트(self-test 파일 597개, Kafka·PostgreSQL 사용)에 설치. 읽기 전용 조사 결과로 노드 27·관계 23·근거 23·보기 5를 작성해 검증·게시 성공 |
| 선택 전달 | 일부 확인 | 흐름 보기에서 노드를 선택하면 `context --session`이 선택 노드·이웃·근거를 반환. 새로 고침 후 선택 복원 확인. 범주 목록 보기의 카드 클릭이 선택을 바꾸는지는 자동 클릭으로 재현하지 못했다(미확정) |

아직 확인하지 않은 것: Codex·Grok 앱에서의 실제 설치, Windows 실제 실행, Claude 세션이 설치된 스킬을 자동 감지해 사용하는 흐름, 실제 AI 모델의 프로젝트 분석 정확도.

### 브라우저 검증의 정확한 범위

이 환경의 Chromium은 관리자 정책으로 모든 URL 탐색이 차단된다. 해당 정책을 변경하거나 우회하지 않았다. `agent-browser`도 설치되어 있지 않다. 따라서 제공된 `scripts/browser_check.py --embedded`로 동일 HTML/CSS/JS를 빈 문서에 렌더링하고, Playwright 바인딩이 실제 localhost Node HTTP API에 요청을 전달하는 **DOM 테스트 하네스**를 사용했다. 브라우저 저장소도 해당 하네스에서는 메모리 구현으로 대체한다.

이는 화면 렌더링, 선택, 데이터 갱신, JavaScript 오류를 검증하지만 **실제 인앱 브라우저의 네트워크 접근·저장소·CSP 통합·스킬 감지**를 입증하지 않는다. HTTP 인증·Host/Origin 검사·CSP 응답은 별도의 실제 Node HTTP 테스트로 확인했다. 일반 개발 환경에서는 `--embedded` 없이 동일 스크립트의 실제 URL 탐색 모드를 실행할 수 있다.

### 확인한 UI 시나리오

9개 항목의 집중된 초기 지도, 한글 제목, 데모 표시, 단일/다중 선택, 공유 API 탐색, 근거 확인, 모바일 검색 및 이전 필터 해제, 영향 등급/사유, 성능 추정 구분, 미실행 테스트 표시, 스냅샷 비교, 목록 보기, 보기 저장/복원, 기존 대화창 안내, 자체 채팅 부재를 확인했다.

실제 CLI `publish` → 실제 HTTP API → viewer 갱신 경로도 실행했다. 이전 선택은 stale로 표시되고 재선택하면 해제된다. HTML처럼 보이는 노드 이름은 텍스트로만 출력된다. 390px 폭에서 페이지 수평 넘침이 없고 탐색 메뉴가 열리는 것을 확인했다. 이것은 에이전트 역할의 명령을 테스트 코드가 수행한 것으로, 실제 AI 모델의 프로젝트 분석 정확도 검증은 아니다.

### 개발자가 재현하는 방법

```sh
npm test
npm run check
npm pack --dry-run
# 별도 터미널: 테스트 전용 데모. 실제 프로젝트 대상으로 실행하지 말 것.
node bin/codeatlas.mjs demo --port 4317
# Python Playwright + Chromium 설치가 있는 개발 환경:
python scripts/browser_check.py --url '<위 명령의 전체 URL>' --project '<출력한 임시 데모 폴더>'
# 실행 파일 지정이 필요한 경우 --chromium /path/to/chromium
```

`--project`를 전달한 브라우저 검증은 격리된 데모에 두 차례 결과를 게시하고 원래 데이터를 복원한다. 현재 revision은 증가하며, 기존 이력은 지우지 않는다. 테스트 시작 시 `project.demo=true`를 확인한다.

## 실제 호스트 수용 확인표

- [ ] Codex: 설치된 스킬 감지 → 분석 지시 → URL 열기 → 선택을 다음 대화에서 읽기 → 게시 → 수정 후 갱신.
- [ ] Claude Code: 같은 절차 및 프로젝트 스킬/CLAUDE.md 적용 확인.
- [ ] Grok Build: 공통 지침/CLI 또는 stdio MCP 등록 → 같은 세션의 context 읽기.
- [ ] 서로 다른 실제 호스트 2개에서 동시에 사용하고 선택/게시 충돌 동작 확인.
- [ ] 실제 사용자 프로젝트의 분석 누락과 잘못된 관계를 사람이 검토.

구현된 경로와 실제 호스트에서 시험한 경로를 혼동하여 “모든 에이전트에서 검증 완료”라고 표현하지 않는다.

## GitHub Actions 최초 실행

구현 커밋 `04f6252f5951b42b61e10b12999610b855b8f7d4`를 main에 반영한 뒤 workflow run `34695489009`를 확인했다.

- 실행 링크: https://github.com/jadeonstudio/codeatlas/actions/runs/34695489009
- 원격 상태: failure. Windows/Node 24 job은 failure, 나머지 5개 조합은 cancelled.
- 실패 job `103558140800`의 단계 목록은 비어 있고 로그 다운로드는 BlobNotFound였다. 따라서 checkout·설치·테스트가 실행됐다는 근거가 없다.
- 실패 원인은 현재 접근 가능한 실행 정보로 확인하지 못했다. 계정/결제/실행기 문제라고 단정하거나 소스 테스트 실패로 바꾸어 표현하지 않는다.
- 로컬 Linux의 64개 테스트 통과와 원격 CI 통과는 별개다. macOS/Windows 확인은 여전히 미완료다.

이 기록만 추가한 후속 문서 커밋은 `[skip ci]`로 중복 실행을 생략한다. 실행 코드와 워크플로는 변경하지 않는다. 저장소 소유자는 위 실행 페이지의 annotation을 확인한 뒤 필요한 조치를 하고 전체 workflow를 다시 실행할 수 있다.
