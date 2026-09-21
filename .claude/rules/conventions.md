---
paths:
  - "app/src/**/*.ts"
---

# Конвенції коду lead-sync

## Контекст

Код переносили з n8n, і частина його конвенціям не відповідає — `npm run check:rules`
показує, де саме. Кожна конвенція нижче має відповідне правило в перевірці, тому
«майже правильно» тут видно числом. Джерело: `materials/architecture-brief.md`.

## Правило

Ліворуч — чого не робити, праворуч — що робити замість цього.

| Не використовуй | Використовуй | Правило в `check:rules` |
|---|---|---|
| `throw` назовні з інтеграції | `Result<T>` з `core/types.js`; `send()` завжди повертає `Promise<Result<void>>` | — |
| `fetch(...)` | `postJson(url, body, options?)` з `core/http.js` (таймаут, повтори на 5xx/429, маскування URL) | `http-via-core` |
| `process.env.X` | `readEnv("X")` з `core/config.js`, далі перевірка `if (!r.ok) return r` | `env-via-config` |
| `JSON.parse(text)` | `parseJson(text, guard, label?)` з `core/parse.js` — **завжди з guard** на очікувану форму | `json-via-parse` |
| `console.log/info/warn/error` | `log.info` / `log.warn` / `log.error` з `core/log.js` (маскує токени) | `log-via-logger` |
| `: any`, `as any`, `<any>` | `unknown` + guard (`isRecord`, `isString`, `isNumber`) | `no-any` |
| `npm install <пакет>`, axios/got/ky/zod | стандартна бібліотека Node і `core/` — у застосунку нуль runtime-залежностей | `no-new-deps` |

**Помилки — це значення, і вони не мовчать.** Невалідний JSON або неочікувана
форма — це `Result` з `ok: false`, який видно в журналі. Не підставляй «значення
за замовчуванням» у `catch` і не продовжуй роботу: так пошкоджені дані стають
непомітними (саме це спричинило нічний інцидент у `materials/error-log.txt`).

**Мінімізація даних.** У сповіщення (Slack, месенджери, чат-боти) передавай лише
`name`, `source`, `budgetUsd`. Не передавай `email` і `phone` — повні дані йдуть
тільки в системи обліку (таблиця, CRM).

**Секрети.** Значення змінних середовища не потрапляють у журнал, у текст
повідомлення і в код — навіть тимчасово. У `requiredEnv` — лише **імена** змінних.

**Імена.** Файли — kebab-case; поле `name` інтеграції збігається з іменем файлу
без розширення.

**Тести.** Vitest, `*.test.ts` поруч із модулем. Реальної мережі немає:
`vi.stubGlobal("fetch", ...)`, змінні — `vi.stubEnv`. Для кожної інтеграції —
три випадки: успішна відправка (перевір URL і тіло запиту), відсутня змінна
середовища, помилка від зовнішньої системи.

## Як перевірити

- `cd app && npm run check:rules` → у розділі `by rule` нулі для `http-via-core`,
  `env-via-config`, `json-via-parse`, `log-via-logger`, `no-any`, `no-new-deps`
  у файлах, яких ти торкався. Базова лінія спадкового коду — `TOTAL: 8`;
  твої зміни не мають її збільшити.
- `cd app && npm test` — зелений; `npm run typecheck` — без помилок.
- `git diff app/package.json` — порожній (нових залежностей немає).
- Для сповіщень: `grep -n "email\|phone" app/src/integrations/slack-notify.ts` — порожньо.
