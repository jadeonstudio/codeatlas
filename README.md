# CodeAtlas

**프로젝트를 이해하는 에이전트와, 그 이해를 함께 보는 지도.**

CodeAtlas는 **에이전트 지침 + 공통 그래프 규격 + 한글 시각화 UI + 선택 전달 기능**을 제공합니다. 기존 Codex·Claude·Grok 등의 코딩 에이전트가 프로젝트를 분석하고 수정합니다. CodeAtlas는 자체 AI나 분석기를 실행하지 않습니다.

```text
지도에서 화면·기능 선택 → 기존 에이전트 대화창에서 질문
→ 에이전트가 분석 결과 게시 → 지도에 영향·근거 표시
→ 기존 대화에서 수정 지시 → 에이전트가 수정·검증 → 지도 갱신
```

웹, 모바일, 서버, CLI, 이벤트 파이프라인을 특정 기술 스택 제한 없이 같은 의미 규격으로 표현합니다. 실제 분석·실행 가능 범위는 사용하는 에이전트의 도구와 프로젝트 접근 권한에 따릅니다.

## 설치

Node.js **22 이상**. 별도 npm 의존성 설치·API 키·회원가입은 필요 없습니다. 비공개 저장소 접근 권한은 별도로 필요합니다.

```sh
git clone https://github.com/jadeonstudio/codeatlas.git
cd codeatlas
node bin/codeatlas.mjs install --project "/absolute/path/to/your-project" --agents codex,claude,generic,grok
```

대상 프로젝트에서 에이전트에게 다음과 같이 말하세요.

> `.codeatlas/INSTRUCTIONS.md`를 읽고 현재 프로젝트의 CodeAtlas 지도를 만들어줘. 이번 세션 ID는 `codex-main`으로 사용해. 분석은 네가 직접 하고 공통 UI를 기존 브라우저에 열어줘. 앞으로 지도 관련 질문에서는 이 세션에서 내가 선택한 대상을 먼저 읽어줘.

에이전트가 실행하는 공통 화면:

```sh
# 대상 프로젝트 root에서
node .codeatlas/runtime/bin/codeatlas.mjs serve --session codex-main
```

출력한 **전체 URL**을 기존 인앱 브라우저 또는 로컬 브라우저에서 엽니다. 스킬 설치만으로 자동 분석이 실행되지는 않습니다. 최초 분석과 그 이후의 작업은 기존 에이전트가 담당합니다.

## 에이전트별 사용

| 호스트 | 연결 경로 |
|---|---|
| Codex | `.agents/skills/codeatlas` + AGENTS.md 관리 블록, 선택적 stdio MCP |
| Claude Code | `.claude/skills/codeatlas` + CLAUDE.md 관리 블록, 선택적 stdio MCP |
| Grok Build | 공통 지침/CLI 또는 공식 로컬 stdio MCP 설정 |
| 기타 코딩 에이전트 | `.codeatlas/INSTRUCTIONS.md`를 직접 읽고 CLI/파일 규격 사용 |

선택 정보는 세션별로 분리됩니다. 같은 프로젝트의 다른 대화에는 `claude-review`, `grok-main`처럼 다른 ID를 쓰세요. 모델 브랜드와 호스트의 실행 권한은 다릅니다. 로컬 파일에 접근할 수 없는 일반 웹 채팅은 이 설치만으로 사용자 PC를 제어할 수 없습니다.

상세 설치·MCP 설정·공식 출처: [INSTALL.md](docs/INSTALL.md).

## 포함된 화면과 기능

좌측 탐색, 중앙 그래프, 우측 상세 패널로 구성된 한글 UI입니다. 흐름/구조/데이터 보기, 전체 검색, 단일·다중 선택, 연결 근거, 확대/이동/미니맵, 목록 보기와 저장한 보기를 제공합니다. 에이전트가 게시한 영향 보고서, 추정/실측 성능 비교, 검증 결과, 지도 변경 이력을 표시합니다.

UI의 질문·영향 분석 버튼은 **선택과 의도만 저장**합니다. 별도 채팅·모델 호출·자동 코드 실행은 없습니다. 사용자는 기존 대화창에서 질문하고 수정합니다.

## 데모

```sh
node bin/codeatlas.mjs demo
```

별도 임시 폴더에 웹·모바일 예시 지도를 엽니다. 실제 프로젝트를 덮어쓰지 않습니다. 모든 예시 수치와 테스트 기록은 설명용으로 명확히 표시합니다. `examples/process.json`은 화면 없는 프로그램의 별도 표현 예시입니다.

## 에이전트가 사용하는 명령

```sh
node .codeatlas/runtime/bin/codeatlas.mjs context --session codex-main
node .codeatlas/runtime/bin/codeatlas.mjs status
node .codeatlas/runtime/bin/codeatlas.mjs export --out .codeatlas/draft.json
node .codeatlas/runtime/bin/codeatlas.mjs validate --file .codeatlas/draft.json
node .codeatlas/runtime/bin/codeatlas.mjs publish --file .codeatlas/draft.json --expect 0
node .codeatlas/runtime/bin/codeatlas.mjs patch --file .codeatlas/patch.json --expect 1
node .codeatlas/runtime/bin/codeatlas.mjs doctor --session codex-main
```

`--expect`는 실제 현재 revision으로 바꾸세요. 잘못된 JSON·없는 노드 참조·동시 변경 충돌은 게시를 거절하며 기존 지도를 보존합니다. 그래프가 갱신된 후 오래된 선택은 stale로 표시합니다. `--help` 대신 `help` 명령으로 전체 사용법을 확인할 수도 있습니다.

## 문서

- [상세 서비스 기획서](docs/PRD.md)
- [에이전트 작업·데이터 프로토콜](docs/AGENT_PROTOCOL.md)
- [설치 및 에이전트별 연결](docs/INSTALL.md)
- [화면·상호작용 명세](docs/UI_SPEC.md)
- [구조·책임 경계](docs/ARCHITECTURE.md)
- [검증 결과와 실제 호스트 확인 범위](docs/VALIDATION.md)
- [보안과 로컬 데이터](SECURITY.md)
- [JSON Schema](schemas/graph.schema.json)

## 검증과 개발

```sh
npm test
npm run check
npm pack --dry-run
```

런타임은 Node 표준 라이브러리만 사용합니다. Python Playwright 브라우저 테스트는 별도 개발용이며 일반 사용에 필요하지 않습니다. CI와 실제 로컬 실행 결과는 VALIDATION.md에 기록합니다. **패키지 자동 테스트 통과와 각 에이전트 데스크톱 앱에서의 실제 설치 테스트는 구분합니다.**

## 업데이트·제거

원본 저장소를 갱신한 후 install 명령을 다시 실행합니다. 수정된 설치 파일은 보존하고 충돌을 알립니다. 제거는 대상 프로젝트에서 아래와 같이 실행합니다.

```sh
node .codeatlas/runtime/bin/codeatlas.mjs uninstall
```

그래프·이력·사용자 캡처는 제거하지 않습니다. CodeAtlas는 로컬 전용 패키지이며 마켓플레이스 등록·공개 호스팅·원격 tunnel을 포함하지 않습니다.

현재 라이선스는 `UNLICENSED`입니다. 저장소 소유자가 공개 배포 정책을 결정하기 전 임의로 오픈소스 라이선스를 부여하지 않습니다.
