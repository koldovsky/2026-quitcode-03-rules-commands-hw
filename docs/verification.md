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

- Виклик: `/analyze-error materials/error-log.txt` (нова сесія)
- Чи підставився `$ARGUMENTS`: так — звіт одразу про заданий лог, без
  уточнюючих питань.
- Тригер vs корінна причина: тригер — нічний backup заповнив диск до 100%
  (`00:02:37`–`00:13:48`) → `ENOSPC`; зникає о `00:13:48`. Не є причиною, бо
  цикл дублювання/`SIGKILL` триває ще 9+ год. після звільнення диска, і після
  відновлення розсилка починається знову з `ld_0001` (а не з пропущеного вікна) —
  ознака, що стан скинувся до нуля, а не просто відстав.
- Корінна причина (файл, рядок, механізм):
  1. [state.ts:11-18](app/src/sync/state.ts:11) `loadState` — будь-яка помилка
     `JSON.parse` (порожній/обрізаний файл) мовчки замінюється на
     `INITIAL_STATE` (`1970-01-01`), без сигналу про пошкодження.
  2. [run.ts:18](app/src/sync/run.ts:18) — `saveState` викликається
     безумовно одразу після `loadState`, на кожному тику; саме цей
     `writeFileSync` впав з `ENOSPC` о `00:05`/`00:10`, обрізавши валідний
     `sync-state.json` до пошкодженого файлу.
  3. [run.ts:32-38](app/src/sync/run.ts:32) — `lastSyncedAt` зберігається
     рівно один раз, у кінці послідовного циклу по всіх лідах × інтеграціях;
     масовий backlog + ретраї `postJson` на Slack `429` ґарантовано перевищують
     ліміт планувальника 4м30с → зовнішній `SIGKILL` до збереження стану →
     livelock, що сам себе не розриває.
  - Звірка з правилами: `state.ts` використовує сирий `JSON.parse` у
    `try/catch` замість `parseJson(text, guard)` з `core/parse.ts` — пряме
    порушення `conventions.md` (`json-via-parse`); підтверджено незалежно:
    `npm run check:rules` на цьому ж рядку (`src/sync/state.ts line 14`)
    показує саме цю помилку.
- Запропонований тест (не написаний, не запущений): новий
  `app/src/sync/state.test.ts` — записати валідний стан, потім перезаписати
  обрізаним вмістом (симуляція переривання `ENOSPC` посеред запису),
  показати, що `loadState` повертає `INITIAL_STATE` замість помилки; плюс
  тест у `run.test.ts` на переривання циклу до чекпоінта.
- Чи зупинився там, де сказано в Stop: так — фінальний рядок відповіді:
  "Файлів не змінено (`git status` — чисто). Чекаю підтвердження, перш ніж
  пропонувати виправлення." Жодних правок коду.

### `/refactor`

- Виклик: `/refactor app/src/integrations/sheets-append.ts`
- `npm run check:rules` для цього файлу: до **7** (`no-any`×2, `http-via-core`×1,
  `env-via-config`×1, `json-via-parse`×1, `log-via-logger`×2) → після **0**;
  загальний `TOTAL` по кодовій базі: до **8** → після **1** (лишився лише
  `src/sync/state.ts`, якого команда не чіпала — правильно, за Stop-правилом
  "лише вказаний файл").
- `npm test`: **18/18 зелені до → 18/18 зелені після** (тест-файл
  `sheets-append.test.ts` не редагувався — жодного асерту не змінено, коміт
  торкнувся лише `sheets-append.ts`).
- Що змінилось у поведінці: нічого з того, що фіксують тести — той самий URL
  (`SHEETS_WEBHOOK_URL?token=...`), те саме тіло запиту, той самий текст
  помилки `sheets error: <status>`. Замінено лише механізм: `fetch`→`postJson`,
  `process.env`→`readEnv`, `JSON.parse`→`parseJson` з guard, `console.log`→`log`,
  прибрано `any`.

### `/generate-integration`

- Виклик: `/generate-integration Harvest`
- Які файли створено: `app/src/integrations/harvest.ts` (новий модуль),
  `app/src/integrations/harvest.test.ts` (новий тест), один новий рядок у
  `app/src/integrations/index.ts` — рівно три файли, нічого в `core/` чи
  `sync/`, нових залежностей немає.
- `npm test`: **22/22 зелені** (18 базових + 4 нових для harvest: відсутні
  `HARVEST_WEBHOOK_URL`/`HARVEST_API_TOKEN`, успішна відправка, помилка не-2xx
  від сервісу).
- `npm run check:rules`: **TOTAL: 1**, 0 нових порушень від `harvest.ts`.
- Спостереження: агент сам застосував правило мінімізації даних коректно —
  визнав Harvest системою обліку (не месенджером) і свідомо передав повні
  контактні дані ліда, а не лише ім'я/джерело/бюджет, як для Slack.

## Task E (бонус) — хук

- Файли: <...>
- Спроба змінити `app/src/core/...` → що відповів хук (цитата): <...>
