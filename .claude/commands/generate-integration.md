---
description: Create a new integration (module + test + registry) following project architecture
argument-hint: <service name>
---

# generate-integration

**Target:** $ARGUMENTS
(If there's no service name above, it's in the message right after the command
name. Not there either — ask and stop.)

## Steps

1. Read `.claude/rules/architecture.md` and `.claude/rules/conventions.md`, plus one
   existing module (`app/src/integrations/slack-notify.ts` — a clean example, not
   `sheets-append.ts`) as a reference for shape.
2. Create `app/src/integrations/<kebab-name>.ts` implementing the `Integration`
   contract from `app/src/core/types.ts` (`name`, `requiredEnv`,
   `send(lead): Promise<Result<void>>`), using only the core's public API
   (`postJson`, `readEnv`, `parseJson`+guard, `log`) — no direct `fetch`/
   `process.env`/`JSON.parse`/`console.*`, no new package. Do not put a lead's
   email or phone in the message/payload.
3. Create `app/src/integrations/<kebab-name>.test.ts` next to it: a successful send
   (checking URL and request body), a missing environment variable, an error from
   the external system — no real network (`vi.stubGlobal("fetch", ...)`,
   `vi.stubEnv`).
4. Add exactly one line to `app/src/integrations/index.ts` (import + adding to the
   `integrations` array). Change nothing else in that file.
5. Verify: `cd app && npm test && npm run check:rules`.

## Acceptance criteria

- [ ] Exactly 3 changes: the new module, the new test, one line in `index.ts`.
- [ ] `npm test` is green (the new test too).
- [ ] `npm run check:rules` shows no new violations for the new file.
- [ ] `app/src/core/**` is unchanged; no new dependencies in `package.json`.

## Stop

Do not touch `app/src/core/**` and do not add new packages — if the service seems
to need either, stop and describe exactly what. After finishing, show a short
summary (which files were created/changed) and wait.
