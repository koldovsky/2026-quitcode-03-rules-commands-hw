# Перевірка (Task B, C і бонус E)

Усе нижче — з реальних сесій 10.11.2026. Інструмент: **Claude Code 2.1.308**, модель
**claude-opus-5-5**, effort **high**, macOS, Node 24.15.

**Як запускались «нові сесії».** Кожна перевірка — окремий процес `claude -p` (новий
`session_id`, без `--continue`), з кореня репо. Щоб моє особисте середовище не впливало на
результат, запуск ізольовано: `--setting-sources project,local` (без особистих налаштувань,
скілів і плагінів з `~/.claude`), `--strict-mcp-config` з порожнім списком MCP-серверів,
особистий `~/.claude/CLAUDE.md` виключено через `claudeMdExcludes`. Тобто агент бачить рівно
те, що лежить у репо. Дозволи однакові для всіх прогонів: `acceptEdits` + Read/Grep/Glob +
`npm`/`npx`/`node`/`git status|diff|log`/`ls`/`grep`/`cat`/`wc` у Bash; усе інше в режимі
`-p` автоматично відхиляється (людини, що підтвердить, немає).

## Task A — швидка перевірка правил

Нова сесія, жодного інструмента (`--tools ""`), запит: «Не відкривай жодних файлів і не
запускай команд. Перелічи правила проєкту, які вже є у твоєму контексті…»
(сесія `a11e93b5`). Відповідь (скорочено):

> **Завантажено завжди:** 1. `CLAUDE.md` (імпортує `AGENTS.md` через `@AGENTS.md`) …
> 2. `AGENTS.md` — 7 головних правил … 3. `.claude/rules/do-not-touch.md` — захищені шляхи
> `app/src/core/**`, `app/scripts/**`, `materials/**`, `.coderabbit.yaml`, `.github/**`;
> заборонено `--write-lock` … «зупинись до будь-яких змін».
> **Завантажуються лише для певних шляхів (зараз їх у контексті немає):**
> `.claude/rules/architecture.md` і `conventions.md` — підтягуються, коли я читаю файли з
> `app/src/`. Я ще нічого не читав, тому їхнього вмісту в контексті немає.

Висновок: режими застосування працюють так, як задумано, — `do-not-touch` у контексті
одразу, `architecture` і `conventions` — лише після читання `app/src/**`.

## Task B — чи бачить інструмент AGENTS.md

- Інструмент і версія: Claude Code 2.1.308.
- Як перевірив: нова сесія з кореня репо, `claude -p "/context"`, розділ **Memory Files**.
- Результат:

  | Type | Path | Tokens |
  |---|---|---|
  | Project | `…/hw 3/repo/CLAUDE.md` | 215 |
  | Project | `…/hw 3/repo/AGENTS.md` | 1.2k |
  | Project | `…/hw 3/repo/.claude/rules/do-not-touch.md` | 816 |

  `AGENTS.md` з'явився саме через рядок `@AGENTS.md` у `CLAUDE.md`. До виправлення (у стартовому
  `CLAUDE.md` було посилання `[AGENTS.md](./AGENTS.md)`) `/context` показував лише `CLAUDE.md`
  на 43 токени — без `AGENTS.md`.
- Там само, у розділі **Skills**, видно три команди як Project: `analyze-error`, `refactor`,
  `generate-integration`.

## Task C — прогони команд

### `/analyze-error`

- Виклик: `claude -p "/analyze-error materials/error-log.txt"` (сесія `dc7b0697`, 9 кроків,
  82 с). Перший крок агента — `Read materials/error-log.txt`, далі `sync/state.ts`,
  `sync/run.ts`, `sync/run.test.ts`, `core/parse.ts`, `core/http.ts`, `git status`.
- Чи підставився `$ARGUMENTS`: **так** — у транскрипті сесії рядок команди розгорнуто як
  `**Ціль:** materials/error-log.txt`.
- Що агент назвав корінною причиною (цитати зі звіту):
  - **Тригер:** «Нічний бекап заповнив диск `/srv/lead-sync/data` (97 % → 100 % → 41 % о
    00:13:48); запис файлу стану падав з `ENOSPC`. Після 00:13:48 тригера вже не було.»
  - **Корінна причина** — три дефекти в `app/src/sync/`:
    1. `state.ts:13-17` — «пошкоджений стан тихо підміняється: `JSON.parse` викидає помилку на
       порожньому файлі, а `catch` мовчки повертає `INITIAL_STATE` (`lastSyncedAt: 1970-01-01`).
       Ні помилки, ні запису в журналі. Це порушує `conventions.md` п. 4»;
    2. `state.ts:21` — неатомарний `writeFileSync`: на `ENOSPC` файл лишився порожнім/обрізаним;
    3. `run.ts:18` — «підмінений стан зберігається як справжній: `saveState` викликається ще до
       розсилки. О 00:15 він записав `1970-01-01` як нормальний JSON — самовідновлення неможливе».
  - **Чому тривало після звільнення диска:** новий стан пишеться лише в кінці (`run.ts:36`);
    з `lastSyncedAt = 1970` у черзі ~1284 ліди × ~0,9 с + повтори на 429 → запуск не
    вкладається в 4m30s, SIGKILL до рядка 36, стан лишається 1970 — і так кожні 5 хвилин.
  - **Підсилювачі:** ліміт 4m30s + SIGKILL без проміжного збереження прогресу, розмір беклогу,
    Slack 429 з повторами `postJson`, неідемпотентний `sheets-append`, несортований `pending`.
- Чим відрізнив тригер від причини: прямо поставив питання «чому все тривало після того, як
  диск звільнився» і показав, що симптом живе в нашому коді (фолбек + збереження фолбеку), а
  диск лише запустив його. Окремо: «якщо тригер повториться, буде те саме».
- Тест-відтворення: описано три тести (`state.test.ts` з `vi.mock("node:fs")` і `ENOSPC`
  після очищення файлу; «прогрес зберігається після кожного ліда»; «порожній/некоректний файл
  стану — помилка, а не 1970»), з підготовкою, дією й асертами.
- Чи зупинився там, де сказано в Stop: **так** — жодного Edit/Write, фінальний рядок:
  «`git status --short` — порожньо, жоден файл не змінено. Чекаю рішення: писати тести й фікс
  за цим планом?»
- Ітерацій команди не знадобилось: крок 3 («відрізни тригер від причини; якщо твоя причина —
  інфраструктура, ти ще на тригері») спрацював з першого прогону. Фікс інциденту я не робив
  (за бажанням у завданні) — план лишився у звіті агента.

### `/refactor`

- Виклик: `claude -p "/refactor app/src/integrations/sheets-append.ts"` (сесія `caeda63a`,
  12 кроків, 78 с). `$ARGUMENTS` підставився (`**Ціль:** app/src/integrations/sheets-append.ts`).
- `npm run check:rules` для цього файлу: **до 7 → після 0** (`no-any` ×2, `http-via-core`,
  `env-via-config`, `json-via-parse`, `log-via-logger` ×2); `TOTAL`: **8 → 1** (лишився
  `sync/state.ts:14`, поза задачею).
- `npm test` до / після: **18 passed → 21 passed** (+3 нові: немає змінної середовища, HTTP 403
  без токена в тексті помилки, відповідь не JSON). Наявні асерти не змінені (діф тесту — лише
  додані рядки). `npm run typecheck` — зелений.
- Що змінилось у поведінці: те, що фіксують тести, — ні (URL `…?token=…`, тіло `values`, текст
  `sheets error: <status>`, `{ ok: true, value: undefined }`, default-експорт, `name`,
  `requiredEnv`). Агент сам перелічив три зміни поза тестами: не-2xx тепер `Result`-помилка
  (раніше міг кинути виняток), токен у тексті помилки маскується `redact`, відповідь без
  рядкового `status` → `sheets-append: unexpected shape` замість `sheets error: undefined`.
- Коміт: `4fc0129`.
- Спостереження: агент двічі хотів запустити `git status` командою `cd … && git …` / `git -C …`
  — Claude Code відхилив їх (захист «cd перед git» і шаблон дозволу `git status*`). Агент
  чесно написав, що `git status` не запускав, і попросив перевірити захищені шляхи людину.

### `/generate-integration`

- Виклик: `claude -p "/generate-integration telegram"` (сесія `d985c6ec`, 12 кроків, 55 с).
- Створено/змінено: `app/src/integrations/telegram-notify.ts` (новий),
  `app/src/integrations/telegram-notify.test.ts` (новий, 7 тестів),
  `app/src/integrations/index.ts` (імпорт + `telegramNotify` у масиві). Core, `scripts/`,
  `materials/`, `package.json` — без змін.
- Що в модулі: `readEnv("TELEGRAM_BOT_TOKEN")`, `readEnv("TELEGRAM_CHAT_ID")` →
  `postJson("https://api.telegram.org/bot<token>/sendMessage", { chat_id, text })` →
  `parseJson` з локальним guard `isTelegramResponse` → `Result<void>`. Текст —
  `Новий лід: <name> · <source> · бюджет $N`, **без email і телефону** (є тест на це).
  Припущення про Bot API агент виніс окремим списком «звір із документацією».
- `npm test`: **21 → 28 passed**; `npm run typecheck` — зелений; `check:rules`: у новому модулі
  0, `TOTAL` 1 → 1, `core-untouched` 0.
- Коміт: `b4590fc`.

## Task E (бонус) — хук

- Файли: `.claude/settings.json` (`PreToolUse`, matcher `Edit|Write|MultiEdit|NotebookEdit`,
  команда `node "$CLAUDE_PROJECT_DIR/.claude/hooks/protect-core.mjs"`),
  `.claude/hooks/protect-core.mjs` (Node, без bash; захищає `app/src/core/`, `app/scripts/`,
  `materials/`, `.github/`, `.coderabbit.yaml`; шлях нормалізується — відносні шляхи, `..`,
  регістр на macOS/Windows; невалідний вхід → блок, а не пропуск).
- Перевірка скрипта напряму (9 випадків): core абсолютним шляхом, відносним із `app/`,
  `APP/src/Core/…`, `integrations/../core/…`, `core.lock.json`, `.coderabbit.yaml`, невалідний
  JSON → exit 2; `integrations/telegram-notify.ts`, `src/coredump.ts` → exit 0.
- **Спроба 1** — звичайне прохання (сесія `c885ed87`): «Додай коментар на початок
  `app/src/core/log.ts` …». Агент **не дійшов до хука**: його зупинило правило
  `do-not-touch` ще до виклику інструмента — «Цю зміну я не вношу. `app/src/core/log.ts` лежить
  у захищеній зоні … Що потрібно змінити: файл, зміна, навіщо … окремим PR у платформну команду».
- **Спроба 2** — пряма перевірка хука (сесія `ac87960a`): «Спробуй інструментом Edit додати
  перший рядок `// hook test` у `app/src/core/log.ts` … процитуй відповідь». Відповідь хука:

  ```
  PreToolUse:Edit hook error: [node "$CLAUDE_PROJECT_DIR/.claude/hooks/protect-core.mjs"]:
  protect-core: app/src/core/log.ts is in a protected zone (app/src/core/). Do not edit it and
  do not work around this via Bash. Stop and describe to the human what must change there and
  why (.claude/rules/do-not-touch.md).
  ```

  Після обох спроб: `git status --short` — порожньо, `check:rules` → `core-untouched 0`.
- Межа хука: він ловить інструменти редагування, а не Bash (`sed -i`, `cat >`). Від цього —
  рядок у `CLAUDE.md` «не обходь через Bash» і `core-untouched` у `check:rules`, який бачить
  результат незалежно від інструмента.
