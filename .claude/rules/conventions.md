---
paths:
  - "app/src/**/*.ts"
---

# lead-sync coding conventions

## Context

These conventions keep behavior consistent across every integration and surface
errors immediately instead of silently. Source: `materials/architecture-brief.md`.

## Rule

- Errors are values: functions that can fail return `Result<T>` from
  `core/types.ts`. An integration's `send()` always returns `Result<void>` and
  never throws outward.
- Outbound HTTP — only through `postJson(url, body, options?)` from `core/http.ts`.
  Do not call `fetch` directly, do not add `axios`/`got`/`ky`: `postJson` already
  has a timeout, retries on 5xx/429, and URL masking in the log.
- Environment variables — only through `readEnv(name)` from `core/config.ts`. Do
  not read `process.env` outside `core/config.ts`. Never write secret values to the
  log or hardcode them in code, even "temporarily".
- External JSON (an API response, a webhook, a state file) — only through
  `parseJson(text, guard, label?)` from `core/parse.ts`, with a guard for the
  expected shape. Invalid JSON or an unexpected shape is an error (`Result` with
  `ok: false`), not a silent default.
- Logging — only through `log` from `core/log.ts` (`log.info/warn/error`). Do not
  use `console.*` outside `core/log.ts`: `log` redacts tokens, `console.log` prints
  them as-is.
- No `any`: for unknown data, use `unknown` plus a guard (`isRecord`/`isString`/
  `isNumber` or your own).
- No new dependencies: the app has zero runtime dependencies. Need a library — ask
  in the PR, not `npm install`.
- Data minimization: notifications (Slack, messengers) must not include a lead's
  email or phone — only name, source, and budget. Full data only goes to
  record-keeping systems (the sheet, the CRM).
- File names are kebab-case; an integration's `name` field matches its file name.

## How to verify

- `cd app && npm run check:rules` — the counts for rule ids `http-via-core`,
  `env-via-config`, `json-via-parse`, `log-via-logger`, `no-any`, `no-new-deps` are
  `0` for new/changed code (legacy violations are a separate refactoring task, not
  "make it 0 right away").
- `npm test` is green; each integration's test stubs the network via
  `vi.stubGlobal("fetch", ...)` and env via `vi.stubEnv`, with no real requests.
