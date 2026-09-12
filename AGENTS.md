# Working on CodeAtlas

Read docs/PRD.md and docs/AGENT_PROTOCOL.md before changing product behavior. CodeAtlas is instructions, a common graph representation, a fixed Korean UI and a thin context bridge. The user's existing agent performs analysis, reasoning, editing and validation. Do not add model API calls, a framework analyzer registry, runtime tracing engines, an embedded chatbot, an agent orchestrator or mandatory cloud infrastructure.

Preserve the approved UI: restrained three-column layout, graph center, detail panel on the right, Korean labels, progressive disclosure. Web, mobile and non-UI projects use the same semantic contract. Keep inferred/observed, estimated/measured, passed/failed/not-run and current/stale distinct.

Use Node.js 22+ and standard-library runtime modules. `npm test` runs package tests; `npm run check` checks sources/contracts/package files. Test actual behavior, not just generated counts. Browser validation is documented separately in docs/VALIDATION.md. Never claim Codex/Claude/Grok native host verification without actually running those hosts.

Do not overwrite target project instructions/settings or user data. Validate before publishing, retain stable IDs, guard revisions, preserve snapshots. Do not include secrets or local tokens in commits. Follow the user's requested Git workflow, including direct main uploads when authorized; no arbitrary no-main rule.
