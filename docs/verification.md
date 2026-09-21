# Перевірка (Task B, C і бонус E)

> Сюди — лише те, що справді сталося в сесії: цитати, числа, імена файлів.

**Інструмент:** Claude Code (VS Code extension), модель Opus 5 (1M context)
**Гілка:** `ws03/Zahakailo30`
**Базова лінія до робіт:** `npm test` → 18 зелених · `npm run check:rules` → `TOTAL: 8`

---

## Task B — чи бачить інструмент AGENTS.md

- Інструмент і версія: Claude Code, VS Code extension
- Як перевірив: `/context` → розділ **Memory files**
- Що змінено: у `CLAUDE.md` markdown-посилання `[AGENTS.md](./AGENTS.md)` замінено
  на окремий рядок-імпорт `@AGENTS.md`. Посилання Claude Code не імпортує — агент
  бачив лише текст рядка.
- Результат `/context` (заповнити після виклику в новій сесії):

  ```
  Memory files:
    <…вставити рядки з /context: CLAUDE.md, AGENTS.md (імпорт), .claude/rules/…>
  ```

- Непряма перевірка в новій сесії (без відкривання файлів):
  «Перелічи команди проєкту й захищені теки» → агент має назвати
  `npm test` / `npm run typecheck` / `npm run check:rules` і
  `app/src/core/**`, `app/scripts/**`, `materials/**`.

  Відповідь агента: `<…>`

---

## Task C — прогони команд

> Усі три прогони виконано в сесії Claude Code за кроками відповідних файлів
> `.claude/commands/*.md`. Числа нижче — з реальних запусків `npm test` і
> `npm run check:rules`, не з пам'яті.

### `/analyze-error`

- **Виклик:** `/analyze-error materials/error-log.txt`
- **Чи підставився `$ARGUMENTS`:** `<заповнити після власного виклику — Claude Code
  підставляє текст після назви команди>`
- **Що агент назвав тригером:**
  `ENOSPC: no space left on device` о `2026-09-10T00:05:00.402Z` у `saveState`
  (`app/src/sync/state.ts:21` за стеком продакшену) — nightly backup зайняв диск до 100%.
- **Що агент назвав корінною причиною (файл, рядок, механізм):**
  [`app/src/sync/state.ts:12-19`](../app/src/sync/state.ts#L12-L19) — `loadState()`
  ловить будь-яку помилку читання/парсингу в `catch` і **мовчки** повертає
  `INITIAL_STATE` з `lastSyncedAt: "1970-01-01T00:00:00.000Z"`. Запис стану,
  обірваний на ENOSPC, залишив пошкоджений JSON; після цього кожен запуск
  відкочував курсор на 1970 рік і вважав **усі** ліди новими.
- **Чим відрізнив тригер від причини:**
  Диск звільнили о `00:13:48` (`disk usage … 41%`), а дублікати тривали до
  `09:14` — ще ~9 годин. Симптом пережив тригер, отже тригер не є причиною.
  Причина — властивість коду, яка перетворила разовий збій на постійний стан.
- **Друга петля (чому не зупинилось само):**
  500+ лідів × 3 інтеграції не встигали за ліміт планувальника 4m30s →
  `worker process killed (SIGKILL)` **до** фінального `saveState()` у
  [`app/src/sync/run.ts:41`](../app/src/sync/run.ts#L41). Курсор ніколи не
  просувався → наступний запуск знову брав усі ліди. Самопідтримний цикл.
  Додатковий доказ у логах: `HTTP 429` від Slack — наслідок, а не причина.
- **Порушення конвенції, яке це спричинило:** мовчазний fallback у `catch`
  (`.claude/rules/conventions.md` → «Помилки — це значення, і вони не мовчать»).
  `check:rules` показує це як `json-via-parse` у `src/sync/state.ts:14`.
- **Запропонований тест (не написано — код команда не змінює):**
  `app/src/sync/state.test.ts`, тест «пошкоджений файл стану не відкочує курсор
  на епоху»: підставити файл з обірваним JSON → `loadState()` має повернути
  помилку/кинути нагору, а не `INITIAL_STATE`.
- **Чи зупинився там, де сказано в Stop:** так. Код не змінювався: після прогону
  `git status --short` не показав змін у `app/src/sync/`. Фікс і тест — окремим
  рішенням людини.

### `/refactor`

- **Виклик:** `/refactor app/src/integrations/sheets-append.ts`
- **`npm run check:rules` для цього файлу: 7 → 0**

  | Правило | До | Після |
  |---|---|---|
  | `no-any` (рядки 6, 12) | 2 | 0 |
  | `http-via-core` (рядок 7) | 1 | 0 |
  | `env-via-config` (рядок 7) | 1 | 0 |
  | `json-via-parse` (рядок 12) | 1 | 0 |
  | `log-via-logger` (рядки 14, 17) | 2 | 0 |
  | **Разом у файлі** | **7** | **0** |

  `TOTAL` по проєкту: **8 → 1**. Залишок — `json-via-parse` у `src/sync/state.ts:14`
  (той самий рядок, що спричинив нічний інцидент; його фікс міняє поведінку,
  тому в рефакторинг не входить).
- **`npm test` до / після:** 18 зелених → 18 зелених. `npm run typecheck` — чисто.
- **Асерти в тестах не редагувались:** `git diff --name-only` не містить
  `sheets-append.test.ts`. Тест пройшов на переписаному коді без жодної правки —
  це і є доказ, що поведінка не змінилась.
- **Що змінилось у коді:** `fetch` → `postJson`, `process.env.X` → `readEnv("X")`,
  `JSON.parse` → `parseJson(text, isSheetsResponse, "sheets-append")` з guard,
  `console.log` → `log.info` / `log.error`, `lead: any` і `data: any` → типи
  `Lead` і guard, доданий тип `Integration`.
- **Що змінилось у поведінці:** нічого з того, що фіксують тести — URL
  (`…/append?token=…`), форма тіла (`{values:[[createdAt, name, email, phone??"", source]]}`),
  текст помилки (`sheets error: quota_exceeded`) і значення, що повертаються,
  лишились ті самі. Поза тестами з'явились дві безпечні зміни, яких вимагають
  конвенції: мережевий збій тепер повертає `Result` замість винятку, а
  неочікувана форма відповіді — помилку замість `sheets error: undefined`.

### `/generate-integration`

- **Виклик:** `/generate-integration Telegram`
- **Створені файли:**
  - [`app/src/integrations/telegram-notify.ts`](../app/src/integrations/telegram-notify.ts)
  - [`app/src/integrations/telegram-notify.test.ts`](../app/src/integrations/telegram-notify.test.ts)
  - один рядок імпорту + елемент масиву в
    [`app/src/integrations/index.ts`](../app/src/integrations/index.ts)
- **Потрібні змінні середовища:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
  (у `requiredEnv` — лише імена, значення читаються через `readEnv`).
- **`npm test`:** 18 → **22 зелених** (4 нові тести: успішна відправка з перевіркою
  URL і тіла, мінімізація даних, відсутня змінна середовища, помилка від Telegram).
- **`npm run check:rules`:** `TOTAL: 1`, без нових порушень; `core-untouched 0`.
  `npm run typecheck` — чисто.
- **Мінімізація даних підтверджена тестом:** у текст повідомлення йдуть лише
  `name`, `source`, `budgetUsd`; тест «не передає email і телефон ліда в месенджер»
  перевіряє відсутність `lead.email` і `+380`.
- **Межі дотримано:** `git diff app/package.json` порожній, `app/src/core/**` не
  змінено, інші інтеграції не чіпано.

---

## Task E (бонус) — хук

- **Файли:** [`.claude/settings.json`](../.claude/settings.json),
  [`.claude/hooks/protect-core.mjs`](../.claude/hooks/protect-core.mjs)
- **Конфігурація:** `PreToolUse`, matcher `Edit|Write|NotebookEdit` →
  `node .claude/hooks/protect-core.mjs`. Скрипт читає JSON зі stdin, бере шлях із
  `tool_input.file_path` (а також `notebook_path` / `path`), нормалізує його
  відносно `cwd` і для захищених зон пише причину в stderr та виходить з кодом **2**.
- **Чому Node, а не bash:** працює і на Windows.
- **Автономна перевірка скрипта (stdin → код виходу):**

  | Вхідний шлях | Очікувано | Факт |
  |---|---|---|
  | `app/src/core/log.ts` | блок | `exit=2` ✅ |
  | `app/scripts/core.lock.json` | блок | `exit=2` ✅ |
  | `materials/ab-task.md` | блок | `exit=2` ✅ |
  | `app/src/integrations/telegram-notify.ts` | дозвіл | `exit=0` ✅ |
  | порожній JSON `{}` | дозвіл | `exit=0` ✅ |

- **Реальна спроба через агента** — попросити в сесії:
  «додай коментар на початок `app/src/core/log.ts`».

  Цитата відповіді хука (заповнити після спроби):

  ```
  ЗАБЛОКОВАНО хуком protect-core: запис у «app/src/core/log.ts» заборонено.
  Захищена зона: app/src/core/ — ядро платформи: зміни йдуть окремим PR через рев'ю платформної команди.
  Див. .claude/rules/do-not-touch.md. Не обходь це редагуванням app/scripts/core.lock.json.
  Якщо задача не виконується без зміни ядра — зупинись і опиши людині:
    1) що саме треба змінити (файл, рядок, правка); 2) навіщо;
    3) що можна зробити вже зараз без ядра; 4) який обхідний варіант існує.
  ```

  Що зробив агент після блокування: `<…>`

> ⚠️ Для Task D хук вимикається (`.claude/settings.json` → `.off`) в **обох**
> прогонах — інакше вимірюється хук, а не правила.
