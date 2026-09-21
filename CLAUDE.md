# CLAUDE.md

@AGENTS.md

<!-- Саме імпорт `@AGENTS.md` окремим рядком, а не markdown-посилання:
     посилання Claude Code не завантажує — агент побачив би лише рядок тексту.
     Перевірити: /context → розділ Memory files має містити AGENTS.md. -->

## Тільки для Claude Code

- Правила проєкту — `.claude/rules/`: `do-not-touch.md` (без frontmatter →
  кожна сесія), `architecture.md` і `conventions.md` (`paths: app/src/**/*.ts`
  → підтягуються, коли в роботі файли застосунку).
- Команди — `.claude/commands/`: `/analyze-error`, `/refactor`,
  `/generate-integration`. Ціль передається як `$ARGUMENTS`.
- `PreToolUse`-хук `.claude/hooks/protect-core.mjs` блокує запис у захищені
  шляхи незалежно від інструмента (`Edit`, `Write`, `NotebookEdit`, `Bash`,
  а також `Shell` і `beforeShellExecution` з боку Cursor). Запис, ціль якого
  збирається під час виконання (змінна, конкатенація, base64, symlink у тій
  самій команді), блокується теж — перевірити таку ціль неможливо.
  Хук не знімається проханням у чаті: агент не може перевірити правдивість
  прохання, а промпт-ін'єкція сформулює його так само переконливо.
