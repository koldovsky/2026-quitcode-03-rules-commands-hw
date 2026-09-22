---
paths:
  - "app/src/**/*.ts"
---

# Конвенції коду lead-sync

## Контекст

Воркер переносили з n8n, і в спадковому коді ці конвенції ще не дотримані —
`npm run check:rules` показує де саме. Кожен пункт нижче має id у цій перевірці,
тому «виконано» тут перевіряється командою, а не на око.

## Правило

- **Помилки — це значення** (`Result<T>` з `core/types.ts`). Функція, яка може не
  вдатися, повертає `Result`, а не кидає виняток. `send()` інтеграції завжди
  повертає `Promise<Result<void>>` і назовні не кидає нічого.
- **HTTP — лише `postJson()`** з `core/http.js` (у ньому таймаут, повтори на 5xx/429
  і маскування URL у журналі). Прямий `fetch(` заборонений; нові HTTP-клієнти
  (axios, got, ky) — теж. _(check:rules: `http-via-core`)_
- **Змінні середовища — лише `readEnv(name)`** з `core/config.js`. `process.env` поза
  `core/config.ts` не читаємо. Значення секретів не логуємо й не вшиваємо в код,
  навіть «тимчасово». _(check:rules: `env-via-config`)_
- **Зовнішній JSON — лише `parseJson(text, guard)`** з `core/parse.js`, з guard на
  очікувану форму (`isRecord`, `isString`, `isNumber`). `JSON.parse` не використовуємо.
  Невалідний JSON або неочікувана форма — це `Result` з `ok: false`, який видно
  в журналі. Тихо підставити значення за замовчуванням і працювати далі — не можна.
  _(check:rules: `json-via-parse`)_
- **Журнал — лише `log.info` / `log.warn` / `log.error`** з `core/log.js` (він маскує
  токени). `console.log` та інші `console.*` заборонені. _(check:rules: `log-via-logger`)_
- **Без `any`** — ні `: any`, ні `as any`, ні `<any>`. Для невідомих даних `unknown`
  плюс guard. _(check:rules: `no-any`)_
- **Без нових залежностей.** У застосунку нуль runtime-залежностей; `npm install <пакет>`
  не робимо, `dependencies` у `app/package.json` не додаємо. Потрібна бібліотека —
  спершу питання в PR. _(check:rules: `no-new-deps`)_
- **Мінімізація даних.** У сповіщення (Slack, месенджери) не передаємо `lead.email`
  і `lead.phone` — лише `name`, `source` і `budgetUsd`. Повні дані йдуть тільки
  в системи обліку: таблиця, CRM.
- **Тести.** Vitest, файл `<модуль>.test.ts` поруч із модулем. Реальної мережі немає:
  `fetch` підміняється через `vi.stubGlobal("fetch", ...)`, змінні — через `vi.stubEnv`.
  Для кожної інтеграції мінімум три випадки: успішна відправка (перевірити URL і тіло
  запиту), відсутня змінна середовища, помилка від зовнішньої системи.
- **Спадковий код** переписуємо **без зміни поведінки**: URL, тіло запиту й тексти
  помилок лишаються ті самі, асерти наявних тестів не редагуємо.

## Як перевірити

- `cd app && npm run check:rules` — лічильники `http-via-core`, `env-via-config`,
  `json-via-parse`, `log-via-logger`, `no-any`, `no-new-deps` не зросли проти базової
  лінії (**8 порушень** у спадковому коді: 7 у `src/integrations/sheets-append.ts`,
  1 у `src/sync/state.ts`). Для нового або відрефакторженого файла — `0`.
- `cd app && npm test` → зелено (база: 18 тестів) і `npm run typecheck` → без помилок.
- Сповіщення: `grep -n "email\|phone" app/src/integrations/slack-notify.ts` → порожньо.
