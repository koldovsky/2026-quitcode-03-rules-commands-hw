# CLAUDE.md

@AGENTS.md

## Лише для Claude Code

- Детальні правила — у `.claude/rules/`: `do-not-touch.md` (без frontmatter —
  діє в кожній сесії), `architecture.md` і `conventions.md` (frontmatter `paths:` —
  підтягуються для файлів `app/src/**/*.ts`).
- Команди проєкту — у `.claude/commands/`. Не запускай їх самостійно, якщо людина
  не викликала `/<назва>`.
- Робоча тека для команд — `app/`: `cd app && npm test`.
