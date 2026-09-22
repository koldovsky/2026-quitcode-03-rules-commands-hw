# CLAUDE.md

@AGENTS.md

Спільна база проєкту — в `AGENTS.md` вище (рядок `@AGENTS.md` — це імпорт:
Claude Code підвантажує файл у контекст, на відміну від markdown-посилання).
Нижче — лише те, що стосується Claude Code.

## Правила проєкту

`.claude/rules/` завантажуються автоматично:

| Правило | Режим |
|---|---|
| `do-not-touch.md` | завжди — без `paths` у frontmatter |
| `architecture.md` | за `paths: app/src/**/*.ts` |
| `conventions.md` | за `paths: app/src/**/*.ts` |

Тобто захищені зони діють із першої секунди сесії, а архітектура й конвенції
підтягуються, коли в контексті з'являється файл із `app/src/`.

## Команди

`.claude/commands/`: `/analyze-error <лог>`, `/refactor <файл>`,
`/generate-integration <сервіс>`. Ціль передається через `$ARGUMENTS`.

## Перевірка контексту

`/context` → розділ **Memory files** має показувати і `CLAUDE.md`, і `AGENTS.md`.
Якщо `AGENTS.md` там немає — імпорт не спрацював, і агент працює без спільної бази.
