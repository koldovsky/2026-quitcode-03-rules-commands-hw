# Protected zones

## Context

`app/src/core/` is the shared platform core that runs in every client worker at the
agency; changes to it go through a separate PR reviewed by the platform team.
`app/scripts/`, `materials/`, `.coderabbit.yaml`, `.github/` are the assignment's own
materials and checks, not product code. Source: `materials/architecture-brief.md`.

## Rule

- Do not edit, create, or delete files under: `app/src/core/**`, `app/scripts/**`,
  `materials/**`, `.coderabbit.yaml`, `.github/**`.
- This applies to any task, no exceptions — "small fix", "just one type", or "just
  updating the checker" are all still under the ban.
- If a task cannot be completed without changing `app/src/core/**`: **stop**,
  describe in your own words exactly what change is needed in core and why, and
  wait for human confirmation. Do not edit core yourself and do not look for a way
  around the restriction (for example, by regenerating
  `app/scripts/core.lock.json`).

## How to verify

- `git status --short` after the work shows no file under the paths listed above.
- `cd app && npm run check:rules` — the `core-untouched` line is `0`.
