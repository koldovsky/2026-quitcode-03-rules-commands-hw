---
paths:
  - "app/src/**"
---

# Конвенції коду lead-sync

## Контекст

Ці конвенції роблять поведінку інтеграцій передбачуваною: помилки видно, секрети
не течуть у журнал, зовнішні дані не ламають синхронізацію тихо. Більшість пунктів
ловить `npm run check:rules` (id правила — у дужках). Джерело:
`materials/architecture-brief.md`, «Конвенції коду» й «Тести».

## Правило

1. **Помилки — значення.** Функція, що може не вдатися, повертає `Result<T>` з
   `core/types.ts`. `Integration.send()` завжди повертає `Result<void>` і не кидає
   винятків назовні: не `throw` — а `return { ok: false, error: "..." }`.
2. **HTTP — лише `postJson()`** з `core/http.ts` (`http-via-core`). Не `fetch`, не
   axios/got/ky. Заголовки й таймаут — через `PostOptions`.
3. **Змінні середовища — лише `readEnv(name)`** з `core/config.ts`
   (`env-via-config`). Не `process.env` поза `core/config.ts`. Секрети не логуй і не
   вшивай у код. Токен у query string — лише через змінну з `readEnv`.
4. **Зовнішній JSON — лише `parseJson(text, guard, label)`** з `core/parse.ts`
   (`json-via-parse`): відповідь API, тіло вебхука, файл стану. Guard будуй з
   `isRecord`/`isString`/`isNumber`. `ok: false` — це помилка, яку повертаєш і
   логуєш; не підставляй мовчки значення за замовчуванням.
5. **Журнал — лише `log.info/warn/error`** з `core/log.ts` (`log-via-logger`), не
   `console.*`: `log` маскує секрети через `redact`.
6. **Без `any`** (`no-any`): для невідомих даних — `unknown` + guard.
7. **Без нових залежностей** (`no-new-deps`): не `npm install`, не імпорти пакетів,
   крім `node:*`. Потрібна бібліотека — питання людині, а не встановлення.
8. **Мінімізація даних:** у сповіщення (Slack, Telegram, інші месенджери) — лише
   `name`, `source`, `budgetUsd`. Без `email` і `phone`. Повні дані — лише в системи
   обліку (таблиця, CRM).
9. **Імена:** файли — kebab-case; `name` інтеграції = ім'я файлу.
10. **Тести** — Vitest, `<module>.test.ts` поруч із модулем, без реальної мережі:
    `vi.stubGlobal("fetch", …)`, змінні — `vi.stubEnv`. Для кожної інтеграції
    щонайменше: успішна відправка (перевір URL і тіло), відсутня змінна середовища,
    помилка зовнішньої системи. Наявні асерти поведінки не послаблюй, щоб тест
    пройшов.
11. **Спадковий код** (`sheets-append.ts`, `sync/state.ts`) приводь до конвенцій
    лише окремою задачею й без зміни поведінки, яку фіксують тести (URL, тіло
    запиту, тексти помилок).

## Як перевірити

- `cd app && npm run check:rules` → для змінених файлів жодного рядка
  `http-via-core`, `env-via-config`, `json-via-parse`, `log-via-logger`, `no-any`,
  `no-new-deps`; `TOTAL` не більший за базову лінію (8).
- `cd app && npm test && npm run typecheck` → зелені.
- `grep -nE "email|phone" app/src/integrations/<сповіщення>.ts` → лише поза текстом
  повідомлення (або порожньо).
- `git diff app/package.json` → без нових `dependencies`.
