---
description: Bring one file in line with project conventions without changing behavior
argument-hint: <path to file>
---

# refactor

**Target:** $ARGUMENTS
(If there's no file path above, the target is in the message right after the
command name. Not there either — ask and stop.)

## Steps

1. Baseline: `cd app && npm test && npm run check:rules` — record the result (test
   count, violation count for this specific file).
2. Read `.claude/rules/architecture.md` and `.claude/rules/conventions.md`.
3. Rewrite the given file to follow these rules: `Result` instead of exceptions,
   `postJson`/`readEnv`/`parseJson`+guard/`log`, no `any`, no new dependencies —
   **preserving the behavior** that the existing tests pin down (URL, request
   body, error messages, field values). This is a change of form, not a rewrite of
   logic.
4. Check again: `npm test && npm run check:rules` — the same tests, still green,
   fewer violations for this file (target: 0 new-kind violations).

## Acceptance criteria

- [ ] `npm test` is green before and after, and no existing `assert`/`expect` was changed.
- [ ] `npm run check:rules` shows 0 violations for this file afterward (or a justification for why one remains).
- [ ] Only the given file and, if necessary, its direct imports were changed — not sibling modules.

## Stop

Touch only the given file and its direct imports. If full convention compliance
would need a change outside this file (other than `app/src/core/**` — that's
covered by `do-not-touch`), don't do it silently — list "what else is worth doing"
separately and stop.
