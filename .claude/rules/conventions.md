---
paths:
  - "app/src/**"
---

# Конвенції коду

## Контекст

Ядро дає таймаути, повтори, валідацію й маскування секретів лише тоді, коли код
ходить через нього. Обхід ядра (`fetch`, `process.env`, `JSON.parse`, `console`)
тихо вимикає ці гарантії — саме це ловить `npm run check:rules`
(`materials/architecture-brief.md`, «Конвенції коду»).

## Правило

- **Помилки — значення.** Функція, що може не вдатися, повертає `Result<T>` з
  `core/types.ts`. Не кидай винятків назовні: `Integration.send()` завжди повертає
  `Promise<Result<void>>`; помилку `postJson`/`readEnv`/`parseJson` повертай далі як є.
- **HTTP — лише `postJson(url, body, options?)`** з `core/http.ts`. Не використовуй
  `fetch` і не додавай axios / got / ky.
- **Env — лише `readEnv(name)`** з `core/config.ts`. Не читай `process.env` деінде.
  Секрети не пиши в журнал і не вшивай у код — навіть «тимчасово» чи в тестах поза `vi.stubEnv`.
- **Зовнішній JSON — лише `parseJson(text, guard)`** з `core/parse.ts` з guard на
  очікувану форму (`isRecord`, `isString`, `isNumber` або власний `Guard<T>`).
  Не використовуй `JSON.parse`. Невалідний JSON або неочікувана форма → `{ ok: false, error }`
  + `log.error`/`log.warn`. Не підставляй тихо значення за замовчуванням і не працюй далі.
- **Журнал — лише `log.info/warn/error`** з `core/log.ts`. Не використовуй `console.*`.
- **Без `any`.** Для невідомих даних — `unknown` + guard. Не пиши `: any`, `as any`, `<any>`.
- **Без нових залежностей.** Не запускай `npm install <pkg>` і не додавай
  `dependencies` у `app/package.json`. Імпорти — лише відносні або `node:*`.
  Потрібна бібліотека — зупинись і запропонуй її в описі PR.
- **Мінімізація даних.** У сповіщення (Slack, Telegram, інші месенджери) передавай
  лише `name`, `source`, `budgetUsd` ліда. `email` і `phone` — тільки в системи обліку
  (таблиця, CRM).
- **Імена.** Файли — kebab-case; `name` інтеграції = ім'я файлу.
- **Тести** — Vitest, `<module>.test.ts` поруч із модулем, без реальної мережі:
  `fetch` через `vi.stubGlobal("fetch", ...)`, env через `vi.stubEnv`. Для кожної
  інтеграції мінімум три кейси: успіх (перевірити URL і тіло запиту), відсутня змінна
  середовища, помилка від зовнішньої системи.
- **Спадковий код** переписуй лише окремою задачею і без зміни поведінки: URL, тіло
  запиту й тексти помилок, зафіксовані тестами, не змінюються.

## Як перевірити

- `cd app && npm run check:rules` — для змінених/нових файлів 0 у рядках
  `http-via-core`, `env-via-config`, `json-via-parse`, `log-via-logger`, `no-any`,
  `no-new-deps`; `TOTAL` не більший за базову лінію (8).
- `grep -rnE "email|phone" app/src/integrations/slack-notify.ts` (і інші модулі сповіщень) → порожньо.
- `grep -rn "throw " app/src/integrations --include="*.ts" --exclude="*.test.ts"` → порожньо.
- `cd app && npm test && npm run typecheck` — зелено.
