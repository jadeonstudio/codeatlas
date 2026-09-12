# Security and data handling

CodeAtlas is a local visualization and context package, not an autonomous execution agent.

## Trust boundaries

The user’s coding agent has its own permissions and tools. CodeAtlas does not reduce those permissions or make the agent’s reasoning trustworthy. Source comments, graph labels, report explanations and evidence must be treated as untrusted data. The supplied skill explicitly rejects instructions embedded in graph content.

The viewer never evaluates graph strings as JavaScript/HTML, executes shell commands, launches models, writes project source, or calls a database. JSON graph validation proves shape/reference consistency, not semantic truth.

## Local server

- Bind only to 127.0.0.1. No public bind/tunnel option.
- New random 256-bit access token for each server start. Authenticated API and asset reads.
- Token in URL fragment, removed from visible URL after the viewer reads it; retained in sessionStorage.
- Exact Host and, when present, Origin verification. No permissive CORS.
- JSON content type for state-changing requests; 32 KiB selection request limit.
- Fixed static file allowlist. No source-directory browsing.
- Registered raster assets only; name/path checks, symlink rejection and 20 MiB limit.
- CSP, no-sniff, no-referrer and no-store response headers.
- Loopback token and `.codeatlas/server.json` are capabilities. Do not share them in public screenshots/logs.

The static HTML/JS/CSS contain no project data and can be loaded without the token. Data routes require authorization. A malicious process already running as the same OS user may read local files or use the agent’s permissions: this package is not an OS sandbox. Physical/OS account compromise is out of scope.

## Data files

`.codeatlas` is Git-ignored by the installer and uses restrictive file modes where supported. Never store .env values, API keys, customer records, whole sensitive files or secrets in evidence. The package does not automatically inspect or redact the agent’s output. The existing agent/provider’s data policy applies independently of CodeAtlas.

Atomic publication and revision checks prevent routine lost updates. A crash can leave an empty lock directory; inspect active processes before removing it. Do not delete graph/history to fix a lock. Installation refuses symlink targets and unknown/modified destination files. Uninstall retains changed files and project knowledge by default.

## Reporting

Report security issues privately to the repository owner. Do not include real project tokens or user source in a public issue. Include a synthetic reproduction, package version, operating system and affected boundary.

## Not supported as security claims

No claim of perfect code understanding, no guarantee that unmapped paths are safe, no proof that supplied test evidence is genuine, no cloud multi-tenant isolation, and no promise that every agent host follows skills deterministically. Native host validation is separate from the package’s automated tests.
