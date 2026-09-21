# CLAUDE.md

@AGENTS.md

Нижче — те, що стосується лише Claude Code.

## Правила проєкту

Лежать у `.claude/rules/`:

| Правило | Режим | Про що |
|---|---|---|
| `do-not-touch.md` | завжди (без `paths`) | захищені зони й що робити, коли задача впирається в ядро |
| `architecture.md` | `paths: app/src/**/*.ts` | шари, напрям залежностей, публічний API ядра, як додати інтеграцію |
| `conventions.md` | `paths: app/src/**/*.ts` | `Result`, `postJson`, `readEnv`, `parseJson`, `log`, без `any`, без залежностей |

Перевірити, що база й правила завантажились: `/context` → розділ **Memory files**.

## Команди

`.claude/commands/`: `/analyze-error`, `/refactor`, `/generate-integration`.
Аргумент підставляється в `$ARGUMENTS`.

## Хук

`.claude/settings.json` → `PreToolUse` на `Edit|Write` запускає
`.claude/hooks/protect-core.mjs`: спроба записати у `app/src/core/**` блокується
з кодом виходу 2. Хук — не заміна правилу `do-not-touch`, а його примусова частина.
