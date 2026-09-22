# Перевірка (Task B, C і бонус E)

> Сюди — лише те, що справді сталося в сесії: цитати, числа, імена файлів.

**Інструмент:** Claude Code 2.1.268 · Opus 5
**Репо:** `ws03/kkkozlovskyi`, базова лінія — 18 тестів зелені, `check:rules` → `TOTAL: 8`

> ⚠️ Відоме на цій машині: `npm test` падає з `vitest: command not found`, бо шлях
> до репо містить двокрапку (`.../koldovsky:2026-...`), а npm додає `node_modules/.bin`
> у `PATH`, де двокрапка — роздільник. Тести запускалися як `./node_modules/.bin/vitest run`.

## Task B — чи бачить інструмент AGENTS.md

- Інструмент і версія: Claude Code 2.1.268
- Як перевірив: `/context` у **новій** сесії, розділ **Memory files**
- Результат: `<TODO: вставити рядки з Memory files — мають бути і CLAUDE.md, і AGENTS.md>`

Чому перевірка потрібна саме в новій сесії: до Task B в `CLAUDE.md` було
markdown-**посилання** `[AGENTS.md](./AGENTS.md)`, яке Claude Code не імпортує.
Зараз там окремий рядок `@AGENTS.md` (рядок 3) — це імпорт. Сесія, що стартувала
до правки, все одно тримає в контексті стару версію, тому міряти треба з нуля.

- Контрольне питання в тій самій новій сесії, без відкривання файлів:
  «назви команди проєкту і захищені теки» →
  `<TODO: відповідь агента — має назвати npm test / typecheck / check:rules і
  app/src/core, app/scripts, materials>`

## Task C — прогони команд

### `/analyze-error`

- Виклик: `/analyze-error materials/error-log.txt`
- Чи підставився `$ARGUMENTS`: `<TODO>`
- Що агент назвав корінною причиною (файл, рядок, механізм): `<TODO>`
- Чим відрізнив тригер від причини: `<TODO>`
- Чи зупинився там, де сказано в Stop: `<TODO>`

### `/refactor`

- Виклик: `/refactor app/src/integrations/sheets-append.ts`
- `check:rules` для цього файлу: до `7` → після `<TODO>`
- `TOTAL`: до `8` → після `<TODO>`
- `npm test` до / після: `18 passed` / `<TODO>`
- Що змінилось у поведінці (має бути: нічого з того, що фіксують тести): `<TODO>`

### `/generate-integration`

- Виклик: `/generate-integration <сервіс>`
- Які файли створено: `<TODO>`
- `npm test`, `npm run check:rules`: `<TODO>`

## Task E (бонус) — хук

- Файли: `<TODO>`
- Спроба змінити `app/src/core/...` → що відповів хук (цитата): `<TODO>`
