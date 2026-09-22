@AGENTS.md

## Claude Code only

- Path-scoped rules live in `.claude/rules/*.md` (`architecture.md`, `conventions.md`
  apply to `app/src/**` via `paths`; `do-not-touch.md` has no `paths` and always applies).
- Commands live in `.claude/commands/*.md`: `/analyze-error`, `/refactor`, `/generate-integration`.
