# 설치와 에이전트 연결

## 요구 환경

Node.js 22 이상, 로컬 파일·터미널 접근 가능한 코딩 에이전트, 로컬 브라우저. 별도 npm 패키지 설치나 AI API 키는 필요하지 않다. macOS/Linux/Windows에서 Node로 실행하도록 작성했으며 플랫폼별 실제 검증 여부는 VALIDATION.md에서 구분한다.

## 공통 설치

```sh
git clone https://github.com/jadeonstudio/codeatlas.git
cd codeatlas
node bin/codeatlas.mjs install --project "/absolute/path/to/your-project" --agents codex,claude,generic,grok
```

이 명령은 대상 프로젝트에 독립적인 런타임과 지침을 복사한다. 에이전트를 선택해서 설치해도 된다. `--agents codex`, `--agents claude`, `--agents generic`, `--agents grok` 또는 쉼표 조합을 사용한다. `all`이라는 별도 옵션은 없다.

처음 설치에는 다음 파일들이 만들어진다.

```text
project/
  .codeatlas/
    runtime/           # 공통 viewer·CLI·스키마·참조 문서
    INSTRUCTIONS.md    # 어떤 에이전트든 직접 읽을 수 있는 지침
    project.json       # 대상 identity
    graph.json         # 최초에는 빈 그래프
    install.json       # 소유 파일 해시
  .agents/skills/codeatlas/SKILL.md  # Codex 선택 시
  .claude/skills/codeatlas/SKILL.md  # Claude 선택 시
  AGENTS.md            # 기존 내용 보존 + CodeAtlas 관리 블록
  CLAUDE.md            # Claude 선택 시 기존 내용 보존 + 관리 블록
  .gitignore           # 기존 내용 보존 + 로컬 데이터 제외 블록
```

이후 명령은 **대상 프로젝트 root**에서 실행한다. 최초 설치 후 원본 clone 폴더를 이동해도 복사한 런타임은 유지된다.

## 가장 빠른 사용

대상 프로젝트를 에이전트에서 열고 다음과 같이 지시한다.

> `.codeatlas/INSTRUCTIONS.md`를 읽고 이 프로젝트를 CodeAtlas 관점으로 면밀하게 분석해줘. 분석·판단·수정·검증은 네가 직접 담당하고, 결과는 공통 규격으로 게시해. 이번 대화의 세션 ID는 `codex-main`으로 사용해. 공통 viewer를 기존 브라우저에 열고, 앞으로는 매 질문마다 해당 세션에서 내가 선택한 대상을 먼저 확인해.

에이전트가 실행할 viewer 명령:

```sh
node .codeatlas/runtime/bin/codeatlas.mjs serve --session codex-main
```

출력된 **전체 URL(#token 포함)**을 사용한다. 브라우저에 이미지를 직접 그리거나 화면 코드를 재생성할 필요가 없다. viewer는 계속 실행되는 로컬 프로세스이므로 에이전트의 persistent terminal 또는 사용자의 터미널에서 유지한다. 종료는 그 터미널에서 Ctrl+C다. 서버가 재시작되면 새 접근 키가 생성되어 새 URL이 필요하다.

## Codex

Codex는 repository의 `.agents/skills`에서 로컬 스킬을 발견한다. 현재 호스트의 스킬 선택 UI에서 CodeAtlas를 선택하거나 Codex CLI/IDE에서 `$codeatlas`를 명시한다. 설치 후 나타나지 않으면 해당 호스트를 다시 열고 직접 지침 경로를 읽게 한다. 기본 경로는 CLI/파일이며 MCP는 선택 사항이다. 공식 근거 [1].

선택적 MCP 설정 출력:

```sh
node .codeatlas/runtime/bin/codeatlas.mjs mcp-config --agent codex --session codex-main
```

출력 TOML을 기존 Codex 설정의 다른 섹션을 보존하여 추가한다. 또는 호스트의 MCP 추가 명령/UI를 사용한다. 설정에 들어가는 경로는 출력된 대상 프로젝트의 절대 경로다. 기존 서버와 이름이 충돌하면 서버 이름을 다르게 지정한다. 전역 설정은 installer가 덮어쓰지 않는다.

## Claude Code

프로젝트 `.claude/skills/codeatlas/SKILL.md`를 사용한다. Claude Code에서 `/codeatlas`를 명시하거나 지침 파일을 직접 읽게 한다. 일반 Claude 클라우드 채팅과 로컬 프로젝트에 접근하는 Claude Code는 다르다. 공식 근거 [2].

```sh
node .codeatlas/runtime/bin/codeatlas.mjs mcp-config --agent claude --session claude-main
```

출력의 `mcpServers.codeatlas` 항목을 호스트 MCP 설정에 병합한다. 지원되는 CLI에서는 다음과 같이 별도 프로젝트 경로와 세션으로 추가할 수 있다. 공식 MCP 설정 형식은 [3]을 확인한다.

```sh
claude mcp add --transport stdio codeatlas -- node "/absolute/project/.codeatlas/runtime/bin/codeatlas.mjs" mcp --project "/absolute/project" --session claude-main
```

## Grok 및 Grok 기반 코딩 에이전트

파일·터미널을 사용할 수 있는 Grok 기반 호스트에서는 `.codeatlas/INSTRUCTIONS.md`를 읽는 공통 경로가 가능하다. CodeAtlas는 모델 종류를 검사하지 않는다.

Grok Build 공식 문서는 로컬 stdio MCP 추가를 지원한다 [4]. 그 호스트를 사용하는 경우:

```sh
grok mcp add codeatlas -- node "/absolute/project/.codeatlas/runtime/bin/codeatlas.mjs" mcp --project "/absolute/project" --session grok-main
grok mcp doctor codeatlas
```

또는 다음 명령의 TOML을 기존 Grok 설정에 병합한다.

```sh
node .codeatlas/runtime/bin/codeatlas.mjs mcp-config --agent grok --session grok-main
```

**grok.com의 웹 커넥터와 Grok Build의 로컬 stdio MCP는 다르다.** 웹 커넥터는 공개 접근 가능한 MCP 주소를 요구한다 [5]. CodeAtlas는 로컬 데이터를 노출하는 tunnel이나 공개 HTTP MCP를 자동으로 만들지 않는다. 일반 웹 채팅에서 localhost가 그대로 작동한다고 주장하지 않는다.

## 그 밖의 에이전트

모델 이름보다 필요한 능력을 확인한다. 프로젝트 파일 읽기, 터미널 실행, JSON 작성이 있으면 `generic` 설치와 동일한 CLI 프로토콜을 쓸 수 있다. 호스트가 AGENTS.md를 자동으로 읽지 않으면 `.codeatlas/INSTRUCTIONS.md`를 첫 프롬프트에서 직접 지정한다. MCP stdio를 지원하면 일반 설정 JSON 출력도 사용할 수 있다.

```sh
node .codeatlas/runtime/bin/codeatlas.mjs mcp-config --agent generic --session agent-main
```

스킬 파일만 가져오는 타사 설치 도구가 전체 런타임을 자동으로 가져온다고 보장하지 않는다. 이 저장소는 **위 공통 설치 명령**을 완전한 설치 경로로 제공한다. 공개 마켓플레이스 등록 여부와는 별개다.

## 진단·업데이트·제거

```sh
node .codeatlas/runtime/bin/codeatlas.mjs doctor --session codex-main
node .codeatlas/runtime/bin/codeatlas.mjs status
node .codeatlas/runtime/bin/codeatlas.mjs context --session codex-main
```

업데이트는 원본 clone을 갱신하고 설치 명령을 다시 실행한다. installer는 기존에 자신이 쓴 파일이 수정되었으면 덮어쓰지 않고 경로를 표시한다. 수정 파일을 검토·백업한 후 처리한다. 기존 코드 변경을 강제로 되돌리지 않는다.

```sh
node .codeatlas/runtime/bin/codeatlas.mjs uninstall
```

제거는 해시가 일치하는 설치 소유 파일과 관리 블록만 제거한다. 프로젝트 그래프/이력/세션/자산은 보존하며 전체 `.codeatlas` 삭제는 사용자가 별도로 판단한다. 재설치 중 중단된 경우 manifest와 파일을 확인하고 임의 force 삭제하지 않는다.

## 출처와 검증 범위

2026-09-12에 확인한 공식 문서의 설치 경로/설정 구조를 기준으로 작성했다. 이 문서를 읽었다는 사실은 해당 앱에서 실제 설치를 실행한 것과 다르다. 호스트 실증 결과는 VALIDATION.md를 본다.

1. Codex skills: https://developers.openai.com/codex/skills/
2. Claude Code skills: https://code.claude.com/docs/en/skills
3. Claude Code MCP: https://code.claude.com/docs/en/mcp
4. Grok Build MCP: https://docs.x.ai/build/features/mcp-servers
5. Grok web custom connectors: https://docs.x.ai/grok/connectors/custom-mcp-tunneling
6. Agent Skills specification: https://agentskills.io/specification
7. MCP stdio specification: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
