# 구조와 책임 경계

```text
기존 Codex / Claude / Grok / 기타 코딩 에이전트
  ├─ 프로젝트 조사·변경 의도 해석·영향 판단
  ├─ 코드 수정·실행·테스트·성능 측정 (자체 도구)
  └─ CLI 또는 선택적 stdio MCP
          ↓                     ↑
  .codeatlas/graph.json     sessions/<id>.json
          ↓                     ↑
  고정 로컬 서버 + 한글 viewer → 사용자 선택
          ↑
  history/<revision>.json (이전 게시본)
```

## 코드 구성

- `src/contract.mjs`: 필드 유형·참조·근거 계약 검사, 데이터 diff. 코드 해석 없음.
- `src/store.mjs`: 프로젝트 identity, 원자적 JSON, revision guard, 작성 lock, 세션, 스냅샷.
- `src/server.mjs`: 고정 정적 파일·인증된 그래프/선택 HTTP. 코드 실행 API 없음.
- `src/install.mjs`: 자체 런타임 복사, 해시 기반 소유권, 기존 지침 관리 블록.
- `src/mcp.mjs`: stdin/stdout MCP 도구 어댑터. no subprocess/model/sampling.
- `src/cli.mjs`: 설치·게시·진단·로컬 서버·에이전트 데이터 조회.
- `web/`: 고정 UI. 외부 CDN/서드파티 런타임 없이 동작.
- `skills/`: 에이전트 공통 지침.

## 선택 데이터

브라우저는 클릭 후 session, projectId, graphRevision, nodeIds, viewId, intent, updatedAt을 저장한다. session은 터미널/에이전트 세션 식별 이름이며 CodeAtlas가 호스트의 내부 세션을 제어하는 권한 토큰은 아니다. 일반적인 기본값 main은 단일 에이전트 사용에 한정한다. 병렬 대화는 명시적으로 분리한다.

변경 게시와 선택 저장 모두 같은 짧은 작성 lock을 사용한다. revision이 달라진 클릭은 409로 거절한다. 그래프 게시 후 이전 세션 기록을 자동으로 최신으로 위조하지 않는다. context에서 stale과 missingIds를 반환한다.

## 게시와 갱신

사용자의 에이전트가 JSON을 만들어 CLI/MCP로 게시한다. 무결성 검사 후 기존 리비전과 예상 리비전을 비교하고 이전 graph를 history에 저장한다. 새 graph는 임시 파일 작성 후 rename으로 교체한다. viewer는 1.5초 간격 ETag 조건부 조회를 사용한다. 숨긴 탭에서는 조회를 줄이고 연결 실패 시 5초 간격으로 재시도한다. 시간 간격은 데이터 갱신 폴링이며 AI 작업 스케줄러가 아니다.

충돌 시 last-write-wins로 조용히 덮어쓰지 않는다. 중단 후 잠금이 남으면 사람이 활성 작성자를 확인하고 빈 lock 디렉터리만 지운다. 강제 lock 탈취 기능은 없다.

## 저장 전략

운영 파일은 대상 root/.codeatlas 아래에 국한한다. graph 최대 10 MiB, 개별 HTTP 선택 요청 32 KiB, 선택 최대 20개, view 최대 150개 노드다. 현재 구현은 메모리 JSON 모델이며 수십만 항목의 무제한 그래프 데이터베이스를 주장하지 않는다. 이 제한은 기술 스택을 제한하는 것이 아니라 인터페이스 데이터의 크기를 통제한다.

스냅샷은 자동 삭제하지 않는다. 사용자는 저장 공간을 확인하고 보존 정책에 따라 old history를 별도로 보관할 수 있다. 이미 존재하는 지식이나 사용자 파일을 설치/해제 과정에서 무조건 삭제하지 않는다.

## MCP 계약

로컬 stdio의 newline-delimited JSON-RPC 2.0. initialize, initialized notification, ping, tools/list, tools/call 지원. tools 기능만 광고하며 resources, prompts, sampling, arbitrary commands는 광고하지 않는다. 프로토콜 버전 협상은 알려진 revision을 허용한다. 에이전트 입력은 CLI와 같은 저장/검증 경로를 거친다. 도구 오류는 isError와 텍스트로 돌려주고 stdout에는 프로토콜 이외 로그를 쓰지 않는다.

## 확장 원칙

다른 기술 스택을 지원하기 위해 UI에 언어 파서를 추가하지 않는다. 에이전트가 기존 의미형과 metadata로 표현한다. 의미 규격을 바꿀 경우 schemaVersion과 migration을 설계한다. 로컬 HTTP viewer를 외부 공개 서비스로 쓰려면 별도 인증/권한/다중 사용자/암호화 설계가 필요하며 현재 서버는 127.0.0.1만 허용한다.
