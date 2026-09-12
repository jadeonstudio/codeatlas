# 에이전트 분석·게시 프로토콜

## 1. 불변 원칙

CodeAtlas는 사용자의 기존 에이전트가 이해한 소프트웨어를 표현한다. 지침은 도구 선택과 추론을 대체하지 않는다. 어떤 언어/프레임워크든 같은 의미 모델에 매핑한다. 지침을 이유로 대상 프로젝트의 상위 보안·개발 규칙을 무시하지 않는다.

CLI 표기는 설치 대상 root에서 `node .codeatlas/runtime/bin/codeatlas.mjs <command>`이다. 저장소 개발 중에는 `node bin/codeatlas.mjs <command> --project /target`을 사용한다.

## 2. 세션을 고정한다

첫 턴에 session ID를 정한다. 예: `codex-build`, `claude-review`, `grok-main`. viewer와 `context`/MCP에 같은 ID를 사용한다. 다른 에이전트와의 병렬 작업에서는 ID를 재사용하지 않는다. 기본 `main`은 단일 사용자 빠른 시작용이다. 브라우저 tab이 같은 ID를 쓰면 같은 선택을 공유한다.

```sh
node .codeatlas/runtime/bin/codeatlas.mjs serve --session codex-build
node .codeatlas/runtime/bin/codeatlas.mjs context --session codex-build
```

`context`는 선택 노드·직접 연결·근거·관련 보고서를 한정해서 반환한다. 전체 graph를 매 턴 프롬프트에 붙여 토큰을 낭비하지 않는다. 최대 80개 이웃과 160개 관계/120개 근거, 최근 관련 보고서 5개를 반환하므로 더 필요한 경우 export로 범위를 확장한다. 잘렸다는 가능성을 고려하고 목록을 전체라고 단정하지 않는다.

## 3. 최초 조사 체크리스트

- [ ] 대상 root와 사용자가 의도한 repository/worktree를 확인한다.
- [ ] AGENTS.md, CLAUDE.md와 실제 프로젝트 지침을 읽는다.
- [ ] 앱·서비스·실행 진입점과 패키지 경계를 찾는다.
- [ ] 사용자에게 드러나는 화면/명령/프로세스 루트를 찾는다.
- [ ] 각 루트의 동작·전환·상태·권한 분기를 조사한다.
- [ ] 호출하는 계약/서비스/데이터/캐시/이벤트의 근거를 기록한다.
- [ ] 같은 기능·계약을 쓰는 다른 화면과 모바일 사용처를 추적한다.
- [ ] 스케줄러, worker, 재시도, 외부 부작용을 확인한다.
- [ ] 실행·테스트 환경이 있는지 실제 확인하고 미확인 범위를 기록한다.
- [ ] 확인한 근거와 추론을 구분한다. 소스 근거를 런타임 관측으로 바꾸지 않는다.
- [ ] 화면을 억지로 만들지 않고 비화면 프로젝트에는 process view를 만든다.

검토한 범위/제외 이유/미확인 항목은 analysis.coverage에 기록한다. completion %가 아니라 실제 범위다. 한 파일의 grep 결과만으로 프로젝트 전체 분석을 완료했다고 하지 않는다. 필요하면 자기 호스트의 검색·터미널·브라우저·하위 에이전트를 사용한다.

## 4. 최소 그래프

먼저 `export`로 현재 graph를 읽는다. 아래 PROJECT_ID를 임의 생성하지 말고 기존 ID를 유지한다. 실제 프로젝트는 demo=false다. 갱신될 때마다 revision은 저장소가 증가시킨다.

```json
{
  "schemaVersion": 1,
  "revision": 0,
  "project": {"id": "PROJECT_ID_FROM_INIT", "name": "프로젝트명", "demo": false},
  "analysis": {
    "status": "partial",
    "summary": "주문 진입점과 서비스의 연결을 확인했습니다.",
    "agent": "사용 중인 에이전트",
    "updatedAt": "2026-09-12T12:00:00Z",
    "coverage": {"examined": ["주문 생성 흐름"], "excluded": [], "unknown": ["운영 환경"]}
  },
  "nodes": [
    {"id": "order.entry", "kind": "surface", "label": "주문 화면", "confidence": "observed", "evidenceIds": ["order.source"]},
    {"id": "order.create", "kind": "service", "label": "주문 생성", "confidence": "observed", "evidenceIds": ["order.source"]}
  ],
  "edges": [
    {"id": "order.call", "source": "order.entry", "target": "order.create", "relation": "calls", "confidence": "observed", "evidenceIds": ["order.source"]}
  ],
  "evidence": [
    {"id": "order.source", "kind": "source", "summary": "주문 버튼의 처리기가 주문 생성 서비스를 호출합니다.", "locator": "실제로 확인한 파일 경로:행 또는 심벌"}
  ],
  "views": [{"id": "order", "label": "주문 생성 흐름", "mode": "flow", "nodeIds": ["order.entry", "order.create"]}],
  "reports": []
}
```

위 JSON의 파일 경로와 시각은 반드시 실제 조사값으로 바꾼다. 설명용 문자열을 근거로 게시하지 않는다. 알 수 없는 관계는 inferred/unconfirmed로 기록한다. 노드 ID는 화면 명칭 번역/파일 이동마다 바꾸지 않는 안정적인 의미 ID로 정한다. parentId는 표시 계층이며 호출 의존성과 다르다.

## 5. 관계·보기 작성 규칙

navigate는 사용자 화면 이동, calls는 호출, reads/writes는 데이터 접근, publishes/consumes는 이벤트, tests는 검증 관계다. 모바일/웹 전환이 실제로 없는 흐름을 하나의 사용자 이동 화살표로 섞지 않는다. 공유 API 연결은 시스템 보기에서 표현한다.

같은 화면이 조건별로 다르게 동작하면 node.conditions 및 edge.condition으로 기록한다. 역할, 인증, 오프라인, 앱 버전, 권한, feature flag 등 프로젝트에서 실제로 확인한 조건만 쓴다. 노드를 화면 상태마다 무한 복제하지 않는다.

view.nodeIds에는 처음 6–12개의 핵심 단계만 담고 세부 기능은 상세 패널 또는 다른 보기로 제공한다. 필요하면 150개까지 표시하지만 큰 프로젝트는 검색과 도메인별 보기를 사용한다. node와 edge 데이터는 뷰의 크기 제한보다 넓게 보유할 수 있다. 위치를 지정하지 않으면 단순 그리드 레이아웃이며, 관계 추론은 하지 않는다.

## 6. 게시·패치

```sh
node .codeatlas/runtime/bin/codeatlas.mjs validate --file .codeatlas/draft.json
node .codeatlas/runtime/bin/codeatlas.mjs publish --file .codeatlas/draft.json --expect 0
```

기존 graph.json을 직접 덮어쓰지 않는다. publish는 구조·참조·근거 계약을 검사하고 현재 revision과 expect가 같을 때만 저장한다. 이전 스냅샷은 history에 남는다. 동시 작성 중 lock/revision conflict는 재조회와 병합으로 해결한다.

증분 패치에서는 collection별로 upsert/remove를 사용한다. 노드 삭제 시 연결된 edge와 view/report 참조를 같은 패치에서 갱신해야 한다. 조용히 참조를 지우거나 관련 없는 보고서를 유실하지 않는다.

```json
{
  "nodes": {"upsert": [{"id": "order.entry", "kind": "surface", "label": "주문 작성", "confidence": "observed", "evidenceIds": ["order.source"]}], "remove": []}
}
```

```sh
node .codeatlas/runtime/bin/codeatlas.mjs patch --file .codeatlas/patch.json --expect 1
```

analysis 교체 시 전체 analysis 객체를 전달한다. collection upsert는 객체 전체 교체이며 필드별 merge가 아니다. graph의 unknown metadata는 허용되지만 __proto__/constructor/prototype 키는 거부한다.

## 7. 영향 보고서

reports에 `kind=impact`를 추가한다. targetIds, title, summary, baseRevision, status, affected가 필요하다. affected마다 nodeId, level(direct/indirect/possible), reason, evidenceIds를 쓴다. optional pathEdgeIds는 존재하는 연결 ID의 방향성 있는 연속 경로이며 마지막 도착지는 해당 nodeId여야 한다.

영향은 특정 변경 의도를 기준으로 판단한다. 단순 공통 함수 사용 관계를 오류로 확정하지 않는다. 코드 변경 전에는 proposed가 기본이고, 실패 재현 후에는 실제 실패 테스트와 조건을 기록한다. 이미 존재한 baseline 실패와 구별한다.

## 8. 검증과 성능

report.tests는 name, status(passed/failed/not-run), evidenceIds를 가진다. passed/failed에는 kind=test 근거가 있어야 한다. report.status=verified는 비어 있지 않은 tests가 전부 passed일 때만 구조상 허용한다. 이 문구는 명시된 테스트 범위에 한정되며 전체 소프트웨어의 안전 보증이 아니다. 일부 미실행이면 partial을 사용한다.

metrics는 label, unit, before, after, kind(measured/estimated), conditions, evidenceIds를 가진다. unknown 값은 null이다. measured에는 measurement 근거가 있어야 한다. 단일 실행을 안정적인 개선률로 과장하지 않는다. 수치 비교와 조건의 진실성을 판단하는 것은 에이전트다.

## 9. 캡처

호스트에서 실제로 캡처한 png/jpg/webp만 자산으로 등록한다. 타인의 미검증 화면, 생성한 이미지 또는 예시를 실제 캡처라고 표시하지 않는다.

```sh
node .codeatlas/runtime/bin/codeatlas.mjs asset --file /path/to/capture.png --name order-screen.png
```

그 후 node.preview에 `order-screen.png`를 기록한다. 자산 파일은 덮어쓰지 않는다. 갱신 캡처는 새 이름으로 등록한다. 민감정보 마스킹은 등록 전 에이전트/사용자가 수행한다. CodeAtlas는 프로젝트 전체 파일을 HTTP로 제공하지 않는다.

## 10. CLI / MCP 대응

| 목적 | CLI | MCP |
|---|---|---|
| 상태 | status | atlas_status |
| 현재 선택 | context --session ID | atlas_context (연결에 ID 고정) |
| 그래프 읽기 | export | atlas_graph |
| 게시 | publish --file FILE --expect N | atlas_publish |
| 증분 게시 | patch --file FILE --expect N | atlas_patch |
| 구조 검증 | validate --file FILE | atlas_validate |

UI와 agent가 같은 프로젝트 데이터에 접근할 수 있어야 한다. MCP가 없으면 파일/CLI 경로가 완전한 기본 경로다. 스킬을 읽고 따르는 것은 호스트의 책임이며, CodeAtlas가 기존 대화 세션을 강제로 제어하지 않는다.
