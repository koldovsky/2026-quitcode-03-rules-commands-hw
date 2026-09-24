# Перевірка (Task A, B, C і бонус E)

> Сюди — лише те, що справді сталося у сесії: цитати, числа, імена файлів.

Інструмент: Claude Code 2.1.252 (desktop app, вкладка Code).

## Task A — чи завантажуються правила

### 1. Нова сесія, без відкриття файлів

- Запит: «Не відкривай і не читай жодних файлів і не запускай жодних команд.
  Перелічи правила проєкту, які зараз є у твоєму контексті…»
- Кроки інструментів до відповіді: окремо не фіксувались; що завантажено, підтверджує
  `/context` нижче.
- Відповідь агента (коротко): назвав лише правила з `.claude/rules/do-not-touch.md`
  (захищені теки `app/src/core/**`, `app/scripts/**`, `materials/**`, `.coderabbit.yaml`,
  `.github/**`; без винятків; «зупинись і опиши зміну в core») і `CLAUDE.md`
  (лише посилання на AGENTS.md). `architecture` і `conventions` — «немає в контексті».
- `/context` → Memory files:
  ```
  /Users/mac1/2026-quitcode-03-rules-commands-hw/CLAUDE.md
  /Users/mac1/2026-quitcode-03-rules-commands-hw/.claude/rules/do-not-touch.md
  ```
- Очікувано: лише `.claude/rules/do-not-touch.md` (без `paths` — завжди);
  `architecture` і `conventions` ще немає.

### 2. Та сама сесія, після читання файлу з `app/src/`

- Запит: «Прочитай файл `app/src/sync/run.ts`…»
- Кроки інструментів: один Read — `app/src/sync/run.ts`; файли `.claude/rules/*.md`
  агент не відкривав.
- Відповідь агента (цитата):
  > Opening this file also loaded two more project rule files into my context that
  > weren't there when you asked earlier: .claude/rules/architecture.md (…) and
  > .claude/rules/conventions.md (…)
- Висновок: правила з `paths: app/src/**` підтягуються лише після читання файлу
  з `app/src/`, `do-not-touch` — з початку сесії. Режими застосування працюють як задумано.

Поведінкову перевірку `do-not-touch` зроблено в Task D — див. `docs/ab-validation.md`.

## Task B — чи бачить інструмент AGENTS.md

- Інструмент і версія: Claude Code 2.1.252
- Було: у `CLAUDE.md` — посилання `[AGENTS.md](./AGENTS.md)`; у Memory files (Task A,
  перевірка 1) був лише `CLAUDE.md`, `AGENTS.md` не завантажувався.
- Стало: у `CLAUDE.md` — імпорт `@AGENTS.md` окремим рядком.
- Як перевірив:
  1. Нова сесія → `/context`, розділ **Memory files**.
  2. Та сама сесія, без відкриття файлів: «Не відкривай файлів і не запускай команд.
     Назви команди проєкту й захищені теки.»
- Результат:
  - Memory files:
    ```
    /Users/mac1/2026-quitcode-03-rules-commands-hw/CLAUDE.md
    /Users/mac1/2026-quitcode-03-rules-commands-hw/AGENTS.md
    /Users/mac1/2026-quitcode-03-rules-commands-hw/.claude/rules/do-not-touch.md
    ```
  - Кроки інструментів до відповіді: немає.
  - Відповідь агента (коротко): джерела — «CLAUDE.md, AGENTS.md,
    `.claude/rules/do-not-touch.md`», файлів не відкривав. Назвав усі 4 команди
    (`npm install`, `npm test`, `npm run typecheck`, `npm run check:rules` з базовою
    лінією `TOTAL: 8`) і перевірку перед комітом; усі 5 захищених зон (`app/src/core/**`,
    `app/scripts/**`, `materials/**`, `.coderabbit.yaml`, `.github/**`), заборону
    `--write-lock` і процедуру «зупинись і опиши». Імена slash-команд чесно не назвав:
    їх немає в завантаженому контексті (Task C ще не зроблено).
  - Висновок: команди й карта є лише в `AGENTS.md`, отже імпорт `@AGENTS.md` працює.

## Task C — прогони команд

### `/analyze-error`

- Виклик: `/analyze-error materials/error-log.txt`
- Чи підставився `$ARGUMENTS`: так — агент одразу працював із `materials/error-log.txt`,
  нічого не перепитуючи.
- Що агент назвав корінною причиною (файл, рядок, механізм) — дві вади, що підсилюють одна одну:
  1. `app/src/sync/state.ts:13-17` + `app/src/sync/run.ts:18` — `saveState` на початку
     запуску перезаписує файл стану; `writeFileSync` спершу обнуляє файл, на `ENOSPC`
     він лишається порожнім → `loadState` ловить виняток `JSON.parse` і **тихо** повертає
     `INITIAL_STATE` (`1970-01-01`) → усі 500+ лідів знову «нові».
  2. `app/src/sync/run.ts:36` — прогрес зберігається лише в кінці; 500+ лідів × ~0,9 с
     (плюс повтори на 429) > ліміту 4m30s → `SIGKILL` до рядка 36, а рядок 18 уже
     записав `1970` → цикл повторюється кожні 5 хвилин.
- Порушені правила: `JSON.parse` без guard і тихе значення за замовчуванням
  (`conventions.md`, зовнішній JSON); `saveState` кидає виняток замість `Result`.
- Чим відрізнив тригер від причини: тригер — нічний бекап заповнив диск, `ENOSPC` у
  `saveState` (00:05). Окремий розділ «Чому спам тривав після тригера»: о 00:13:48 диск
  звільнили, але стан уже скинуто на 1970, а цикл «з `ld_0001` → `SIGKILL` → стан не
  оновлено» самопідтримується; в коді немає виходу з нього.
- Тест-відтворення (текстом): пошкоджений / порожній файл стану → `runSync` нічого не
  розсилає й повертає помилку (зараз розсилає всіх); збереження прогресу після кожного
  ліда при обриві запуску; `saveState` не пошкоджує старий файл при невдалому записі.
- План виправлення без змін у core: `loadState` → `Result` + `parseJson` з guard;
  атомарний `saveState` (tmp + rename); прибрати `saveState` на старті, зберігати
  прогрес після кожного ліда, обмежити тривалість запуску. Окремо — операційний крок:
  вручну відновити `sync-state.json`.
- Чи зупинився там, де сказано в Stop: так — файлів не змінював (`git status --short` без
  змін), завершив словами «Чекаю вашого рішення, перш ніж починати виправлення».
- Ітерацій: одна — причину знайдено з першого запуску, покращувати команду не довелось.

### `/refactor`

- Виклик: `/refactor app/src/integrations/sheets-append.ts`
- Чи підставився `$ARGUMENTS`: так — агент одразу працював із цим файлом.
- `npm run check:rules` для цього файлу: до 7 (`no-any` ×2, `http-via-core`,
  `env-via-config`, `json-via-parse`, `log-via-logger` ×2) → після 0.
  `TOTAL`: 8 → 1 (лишилось спадкове `src/sync/state.ts:14`, поза задачею).
- `npm test` до / після: 18 passed → 18 passed; `npm run typecheck` — без помилок.
- Діф: лише `app/src/integrations/sheets-append.ts`; тест і `index.ts` не змінені
  (асерти не чіпали, default-експорт збережено). Не комітив — показав підсумок.
- Що змінилось у поведінці (має бути: нічого з того, що фіксують тести): з
  перевіреного тестами — нічого: URL `…?token=…`, тіло `{ values: [[…]] }`, текст
  помилки `sheets error: <status>`, рядок журналу `row added for lead …`. Агент сам
  назвав зміни поза тестами: повтори на 5xx/429 через `postJson`; невалідний JSON /
  без `status` → `{ ok: false }` замість винятку; відсутня змінна → помилка `readEnv`
  замість запиту на `undefined`. Плюс: у журнал більше не потрапляє URL з токеном.
- Помічена прогалина: у тесті немає кейсу «відсутня змінна середовища» (конвенція
  вимагає три кейси); агент не додав його, бо AC вимагали ту саму кількість тестів.
- Після незалежного рев'ю (окремий агент, read-only):
  - знайдено латентний витік: при помилці HTTP `sheets-append` повертав у `Result`
    текст `postJson` з URL `?token=…` без маскування (журнал маскувався, `Result` — ні).
    Виправлено вручну: `redact(response.error)` перед `log.error` і `return`, як у
    `telegram-notify`. Тести 26 → 26, `TOTAL` 1 → 1.
  - у команді `refactor.md` усунуто суперечності: Stop тепер, як і AC, дозволяє імпорти
    цільового файлу поза захищеними зонами; AC більше не вимагають «ту саму кількість
    тестів» (наявні — на місці й зелені, нові можна додавати); список API ядра замінено
    посиланням на `architecture.md`.

### `/generate-integration`

- Виклик: `/generate-integration telegram-notify`
- Чи підставився `$ARGUMENTS`: так — агент одразу взяв назву `telegram-notify`.
- Тип: сповіщення → у тексті лише `name`, `source`, `budgetUsd`.
- Які файли створено (діф — рівно 3 файли):
  - `app/src/integrations/telegram-notify.ts` — Bot API `sendMessage`, лише `readEnv`,
    `postJson`, `parseJson` + guard `isTelegramResponse`, `log`; токен у URL, тому
    текст помилки проходить через `redact()`; `name: "telegram-notify"`,
    `requiredEnv: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]`.
  - `app/src/integrations/telegram-notify.test.ts` — 8 тестів: успіх (точні URL і тіло,
    немає email / phone), відсутня кожна з двох змінних, HTTP 400 (без повтору, без
    токена в помилці), `ok: false`, невалідний JSON, `name`/`requiredEnv`, формат.
  - `app/src/integrations/index.ts` — імпорт + `telegramNotify` у масиві (2 рядки через
    named-експорт; агент сам це зазначив).
- `grep -nE "fetch|process\.env|JSON\.parse|console\.|any"` по новому модулю → порожньо.
- `npm test`: 18 → 26 passed (7 файлів); `npm run typecheck` — без помилок.
- `npm run check:rules`: `TOTAL: 1` (не зріс; лише спадкове `src/sync/state.ts`),
  для нових файлів 0, `core-untouched` 0. Core не змінено, залежностей не додано,
  не комітив — показав підсумок.

## Task E (бонус) — хук

Не виконувалось (бонусне завдання). Захист `app/src/core/**` тримається на правилі
`do-not-touch` і перевірці `check:rules` (`core-untouched`); у Task D хуків не було в
жодному з прогонів.
