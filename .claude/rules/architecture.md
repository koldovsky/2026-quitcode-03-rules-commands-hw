---
paths:
  - "app/src/**/*.ts"
---

# lead-sync architecture

## Context

`lead-sync` is a worker migrated from n8n. Layers have a fixed dependency direction,
and the core has a fixed public API: that's how one core can run across every
client worker at the agency. Source: `materials/architecture-brief.md`.

## Rule

- Dependency direction: `app/src/integrations/**` and `app/src/sync/**` import from
  `app/src/core/**`. `core/` imports nothing from the rest of the project.
- `integrations/` know nothing about `sync/`. `sync/` talks to integrations only
  through the `Integration` contract (`core/types.ts`) and the registry
  `integrations/index.ts` — never directly.
- A new external system = exactly three changes: a new file
  `app/src/integrations/<kebab-name>.ts`, a test next to it (`<kebab-name>.test.ts`),
  and one line in `app/src/integrations/index.ts`. Nothing else changes.
- The core's public API is exactly this list; nothing else exists, and inventing
  new functions or fields in it is not allowed:
  - `core/types.ts` → `Lead`, `Result<T>`, `Integration`
  - `core/http.ts` → `postJson(url, body, options?)`, `PostOptions`
  - `core/config.ts` → `readEnv(name)`
  - `core/parse.ts` → `parseJson(text, guard, label?)`, `Guard<T>`, `isRecord`, `isString`, `isNumber`
  - `core/log.ts` → `log.info/warn/error`, `redact(text)`
- If a task appears to need a new function or a change in `core/` — `do-not-touch`
  applies: stop and describe exactly what's needed.

## How to verify

- `cd app && npm run check:rules` — the "by rule" section shows no new violations
  beyond the ones already present in legacy code.
- `npm run typecheck` fails with `error TS2305` (no such export) if the code calls a
  core function that isn't in the list above.
