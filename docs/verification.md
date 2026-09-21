# Перевірка (Task B, C і бонус E)

## Task B — чи бачить інструмент AGENTS.md

- Інструмент і версія: Claude Code (десктопний застосунок, Code tab), модель Opus 5
- Як перевірив: <Claude Code — `/context`, розділ **Memory files**; заповнити з
  інтерактивного терміналу `claude`, у десктоп-сесії ця команда недоступна>
- Результат: <що саме побачили в Memory files>
- Додаткове спостереження: на старті сесії `.claude/rules/do-not-touch.md`
  підтягнувся в контекст як project instructions **без відкривання файлу** — це
  підтверджує режим «завжди» (файл без frontmatter). `architecture.md` і
  `conventions.md` у стартовому контексті не з'явились — вони прив'язані до
  `paths: app/src/**/*.ts`.

## Task C — прогони команд

> Команди виконано покроково в цій сесії (агент читав файл команди й виконував її
> кроки). Підстановку `$ARGUMENTS` через літеральний виклик `/<назва>` треба
> перевірити окремо в новій сесії — рядок нижче заповнити після цього.

### `/analyze-error`

- Виклик: `/analyze-error materials/error-log.txt`
- Чи підставився `$ARGUMENTS`: <заповнити після виклику в новій сесії>
- **Тригер:** `ENOSPC: no space left on device` о 00:05 — нічний бекап заповнив диск
  (`SYSTEM disk usage ... 100%`), `saveState` впав на `state.ts:21`. Місце звільнили
  о 00:13:48 (41%), але дублікати тривали ще ~9 годин — отже тригер причиною не є.
- **Корінна причина (два зчеплені механізми):**
  1. `app/src/sync/state.ts:14` — `loadState` розбирає файл стану через `JSON.parse`
     у `try/catch` і на будь-якій помилці **тихо повертає** `INITIAL_STATE`
     (`lastSyncedAt: "1970-01-01"`). Падіння `writeFileSync` при 100% диску лишило
     пошкоджений/порожній `sync-state.json`, і після звільнення місця воркер
     прочитав його як «синхронізацій не було» → **pending = всі ліди від ld_0001**.
     У логах це видно: о 00:15 розсилка починається саме з `ld_0001`, а не з
     останніх заявок.
  2. `app/src/sync/run.ts:36` — `saveState` викликається **лише після** повного
     циклу розсилки. Черга з тисяч лідів не встигає за 4m30s ліміту планувальника
     (`worker process killed (SIGKILL)` о 00:19:30, 00:24:30 і далі), тому курсор
     ніколи не зберігається. Кожен наступний запуск через 5 хвилин починає з нуля —
     самовідновлення неможливе, поки не втрутиться людина.
- **Чим відрізнив тригер від причини:** контрольне питання «чому симптом тривав
  після зникнення тригера?». Диск був вільний о 00:13:48, а дублікати йшли до 09:14 —
  тригер пояснює початок, але не тривалість; тривалість пояснює пара
  «тихий fallback на epoch» + «збереження стану лише в кінці».
- **Запропонований тест (не написано, як вимагає Stop):** `src/sync/run.test.ts` —
  `runSync` із трьома лідами й інтеграцією, що кидає/зависає на другому; перевірити,
  що після аварійного переривання `lastSyncedAt` містить час першого доставленого
  ліда, а не лишається `1970-01-01`. Другий тест: `state.ts` — `loadState` на
  пошкодженому JSON має повертати помилку, а не `INITIAL_STATE`.
- Чи зупинився там, де сказано в Stop: **так** — жодного файлу не змінено, тест не
  написано, фікс не застосовано. Обидва файли причини лежать у `app/src/sync/`
  (не в захищеному `core/`), але Stop вимагає підтвердження людини.
- Помічене дорогою порушення конвенцій: `state.ts:14` — це саме та одиниця, що
  лишається в `check:rules` (`json-via-parse`).

### `/refactor`

- Виклик: `/refactor app/src/integrations/sheets-append.ts`
- `npm run check:rules` для цього файлу: **7 → 0**
  (до: `no-any` ×2, `http-via-core`, `env-via-config`, `json-via-parse`,
  `log-via-logger` ×2; після: жодного). `TOTAL`: **8 → 1**
  (лишилось `src/sync/state.ts json-via-parse line 14`).
- `npm test` до / після: **18 passed / 18 passed** (6 файлів), `typecheck` чистий.
- Що змінилось у поведінці: нічого з того, що фіксують тести. URL лишився
  `https://sheets.example.test/append?token=fake-sheets-token-0000`, тіло —
  `{"values":[[createdAt, name, email, phone ?? "", source]]}`, текст помилки —
  `sheets error: quota_exceeded`. Асерти тесту не редаговано (файл
  `sheets-append.test.ts` не змінювався).
- Що саме зроблено: `fetch` → `postJson()`, `process.env` → `readEnv()` ×2,
  `JSON.parse` → `parseJson()` з guard `isSheetsResponse`, `console.log` → `log`,
  `lead: any` / `data: any` → `Lead` і типізований guard, модуль тепер типізований
  як `Integration` і повертає `Result<void>`.
- Побічний ефект рефакторингу (за межами тестів): запит тепер має таймаут і повтори
  на 5xx/429, а помилковий JSON повертається як `Result`, а не кидає виняток.

### `/generate-integration`

- Виклик: `/generate-integration telegram-notify`
- Які файли створено:
  - `app/src/integrations/telegram-notify.ts` — модуль, що реалізує `Integration`;
  - `app/src/integrations/telegram-notify.test.ts` — 4 тести поруч;
  - один рядок у `app/src/integrations/index.ts` (+ імпорт).
- Змінні середовища: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
- Мінімізація даних: у повідомлення йдуть лише ім'я, джерело й бюджет; тест
  перевіряє, що email і телефон у текст не потрапляють.
- `npm test`: **22 passed (7 файлів)**; `npm run check:rules`: **TOTAL 1** — нових
  порушень немає; `npm run typecheck` чистий.
- Ітерація: перший прогін `typecheck` упав (`TS2493` — `vi.fn(async () => …)` без
  типів параметрів дає `mock.calls` типу `[]`). Виправлено сигнатурою
  `(_url: string, _init?: RequestInit)`, як у сусідньому тесті. `npm test` при цьому
  був зелений — помилку впіймав саме `typecheck` із кроку команди.

## Task E (бонус) — хук

- Файли: `.claude/settings.json` (`PreToolUse`, matcher `Edit|Write|MultiEdit|NotebookEdit`)
  і `.claude/hooks/protect-core.mjs` (Node, щоб працювало на Windows).
- Що блокує: `app/src/core/**`, `app/scripts/**` (щоб не можна було переписати
  `core.lock.json`), `materials/**`, `.github/**`. Шлях беремо з `tool_input.file_path`
  і з інших відомих ключів (`filePath`, `path`, `notebook_path`, `target_file`),
  зокрема у вкладених структурах на кшталт `edits[]`.
- Перевірка скрипта напряму (payload у stdin, вивід — код виходу):

  | Випадок | Результат |
  |---|---|
  | `app/src/core/log.ts` (відносний шлях) | заблоковано, exit 2 |
  | `C:\Course\...\app\src\core\http.ts` (абсолютний Windows-шлях) | заблоковано, exit 2 |
  | `app/scripts/core.lock.json` | заблоковано, exit 2 |
  | `./materials/error-log.txt` | заблоковано, exit 2 |
  | `MultiEdit` із `edits[0].file_path = app/src/core/parse.ts` | заблоковано, exit 2 |
  | `app/src/integrations/hubspot.ts` | дозволено, exit 0 |
  | `app/src/integrations/core-utils.ts` (схожа назва, інша тека) | дозволено, exit 0 |
  | `docs/verification.md` | дозволено, exit 0 |

- Цитата відповіді хука (stderr):

  ```
  Заблоковано хуком protect-core: app/src/core/log.ts лежить у захищеній зоні app/src/core/.
  Правило .claude/rules/do-not-touch.md: ці файли не редагуються в жодній задачі.
  Зупинись і опиши людині, що саме треба змінити в app/src/core/ і навіщо — код не пиши.
  ```

- Спроба змінити `app/src/core/...` руками агента (нова сесія, запит «додай коментар
  на початок `app/src/core/log.ts`») → <заповнити: хуки читаються на старті сесії,
  тому перевіряти треба в сесії, відкритій після створення `.claude/settings.json`>
- Ітерації під час написання: (1) перша версія використовувала `require()` у файлі
  `.mjs` — ESM його не має, виправлено на `import { readFileSync }`; (2) перша версія
  на невалідному JSON виходила з кодом 0 (fail-open) — тепер, якщо вхід не розбирається,
  скрипт шукає назву захищеної зони в сирому тексті й блокує.

> **Task D:** `.claude/settings.json` треба перейменувати на `.off` в **обох**
> прогонах A і B — інакше в прогоні A вимірюється хук, а не правила.
