# AGENTS.md

`lead-sync` is a worker migrated from n8n for client Studio Nova: every 5 minutes it
picks up new leads from the site form and sends them to Slack and Google Sheets.
TypeScript, Node 22+, Vitest, zero runtime dependencies. Details:
`materials/architecture-brief.md`.

## Commands (from `app/`)

```bash
npm install
npm test              # Vitest, no real network
npm run typecheck
npm run check:rules   # static check of the rules below
```

## Project map

- `app/src/core/` — platform core. **Protected zone**, see `do-not-touch`.
- `app/src/integrations/` — one module per external system + the `index.ts` registry.
- `app/src/sync/` — a single sync run and state between runs.

## Key rules (details and "how to verify" — in the files below)

- Do not edit `app/src/core/**`, `app/scripts/**`, `materials/**` — see `.claude/rules/do-not-touch.md`.
- Layers, dependency direction, and the core's public API — see `.claude/rules/architecture.md`.
- `Result` instead of exceptions; `postJson`/`readEnv`/`parseJson`+guard/`log`; no `any`; no new dependencies — see `.claude/rules/conventions.md`.
- Notifications (Slack) — no lead email or phone.
- File names are kebab-case; an integration's `name` field matches its file name.

## Before committing

`cd app && npm test && npm run typecheck && npm run check:rules` — everything
should be green / show no new violations.
