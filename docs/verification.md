# Перевірка (Task B, C і бонус E)

> Скопіювали з `docs/templates/verification.md`. Сюди — лише те, що справді
> сталося у сесії: цитати, числа, імена файлів.

## Task B — чи бачить інструмент AGENTS.md

- Інструмент і версія: Claude Code (сесія в Claude Desktop, модель Sonnet 5)
- Як перевірив: у **новій** сесії, не відкриваючи файлів, попросив перелічити
  правила проєкту, які вже є в контексті ("List the project rules you already
  have in your context, verbatim.")
- Результат **до** виправлення `CLAUDE.md` (Task A): агент показав вміст
  `CLAUDE.md` (`See [AGENTS.md](./AGENTS.md) for project conventions.`) і
  `.claude/rules/do-not-touch.md`, і сам зазначив: *"Note: CLAUDE.md references
  AGENTS.md, but its contents weren't included in my system context above —
  I'd need to read it directly if you want its content."* — тобто markdown-лінк
  дійсно не підвантажує файл.
- Результат **після** заміни на `@AGENTS.md`: <TODO — повторити той самий
  запит у новій сесії й вставити, що саме агент тепер показує з `AGENTS.md`;
  очікується повний текст `AGENTS.md` серед "verbatim" вмісту, без потреби
  окремо його читати>

## Task C — прогони команд

### `/analyze-error`

- Виклик: `/analyze-error materials/error-log.txt`
- Чи підставився `$ARGUMENTS`: <так / ні>
- Що агент назвав корінною причиною (файл, рядок, механізм): <...>
- Чим відрізнив тригер від причини: <...>
- Чи зупинився там, де сказано в Stop: <...>

### `/refactor`

- Виклик: `/refactor <файл>`
- `npm run check:rules` для цього файлу: до <N> → після <N>
- `npm test` до / після: <...>
- Що змінилось у поведінці (має бути: нічого з того, що фіксують тести): <...>

### `/generate-integration`

- Виклик: `/generate-integration <сервіс>`
- Які файли створено: <...>
- `npm test`, `npm run check:rules`: <...>

## Task E (бонус) — хук

- Файли: <...>
- Спроба змінити `app/src/core/...` → що відповів хук (цитата): <...>
