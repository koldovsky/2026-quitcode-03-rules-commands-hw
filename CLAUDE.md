# CLAUDE.md

@AGENTS.md

Базу проєкту імпортовано рядком вище (саме імпорт `@AGENTS.md`, а не markdown-посилання:
посилання Claude Code не завантажує). Нижче — лише те, що стосується Claude Code.

## Правила проєкту

Лежать у `.claude/rules/` і підтягуються автоматично:

| Правило | Режим |
|---|---|
| [do-not-touch](.claude/rules/do-not-touch.md) | без `paths` → у кожній сесії |
| [architecture](.claude/rules/architecture.md) | `paths: app/src/**/*.ts` |
| [conventions](.claude/rules/conventions.md) | `paths: app/src/**/*.ts` |

## Команди

`.claude/commands/`: `/analyze-error`, `/refactor`, `/generate-integration`.
Ціль передається аргументом (`$ARGUMENTS`).

## Перевірити, що базу завантажено

`/context` → розділ **Memory files** має містити `CLAUDE.md` і `AGENTS.md`.
