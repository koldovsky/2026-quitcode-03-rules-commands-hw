@AGENTS.md

## Лише для Claude Code

- Правила проєкту — `.claude/rules/`: `do-not-touch` діє завжди, `architecture` і
  `conventions` підтягуються, коли читаєш файли з `app/src/`.
- Команди — `.claude/commands/` (виклик `/назва <ціль>`).
- Хук `.claude/hooks/protect-core.mjs` блокує `Edit`/`Write` у `app/src/core/**`.
  Заблоковано — не обходь через Bash, а зупинись за `.claude/rules/do-not-touch.md`.
