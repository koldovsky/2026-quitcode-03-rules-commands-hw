# CLAUDE.md

@AGENTS.md

Рядок вище — саме імпорт, а не посилання: Claude Code підставляє вміст
`AGENTS.md` у контекст. Markdown-посилання `[AGENTS.md](./AGENTS.md)` цього не
робить — агент бачить лише текст посилання (перевірено, docs/verification.md).

## Лише для Claude Code

- Правила проєкту — `.claude/rules/`. `do-not-touch.md` без frontmatter, тому
  завантажується в кожну сесію; `architecture.md` і `conventions.md` мають
  `paths: ["app/src/**/*.ts"]` і підтягуються під час роботи з кодом застосунку.
- Команди — `.claude/commands/`: `/analyze-error`, `/refactor`, `/generate-integration`.
- `PreToolUse`-хук `.claude/hooks/protect-core.mjs` блокує запис у захищені шляхи.
  Він не замінює правило, а страхує його.
