---
paths:
  - "app/src/**/*.ts"
---

# Шари й публічний API ядра

## Контекст

`lead-sync` має три шари з одностороннім напрямом залежностей (див.
`materials/architecture-brief.md`). Зовнішня система додається як окремий модуль
у реєстрі, а не вбудовується в `sync/` — інакше кожна нова інтеграція змінює ядро запуску.

## Правило

- Шари й напрям залежностей:
  - `app/src/core/` — платформа (типи, HTTP, конфіг, парсинг, логер). Не імпортує **нічого**
    з `integrations/` і `sync/`.
  - `app/src/integrations/` — по одному модулю на зовнішню систему + реєстр `index.ts`.
    Імпортує лише з `core/`. Про `sync/` не знає й не імпортує з нього.
  - `app/src/sync/` — запуск синхронізації і стан між запусками. Імпортує з `core/`,
    а з інтеграціями працює лише через контракт `Integration` і реєстр `integrations/index.ts`.
- Не звертайся до конкретної інтеграції з `sync/` за іменем — тільки через масив
  `integrations` з `app/src/integrations/index.ts`.
- **Нова зовнішня система — рівно три зміни, більше нічого:**
  1. `app/src/integrations/<kebab-name>.ts` — експортує об'єкт типу `Integration`;
  2. `app/src/integrations/<kebab-name>.test.ts` — тест поруч із модулем;
  3. один рядок у `app/src/integrations/index.ts` (імпорт + елемент масиву `integrations`).
- Публічний API ядра — **рівно цей список**. Іншого не існує, вигадувати або
  «дописувати» експорти не можна (див. [do-not-touch](do-not-touch.md)):
  | Модуль | Експорт |
  |---|---|
  | `core/types.ts` | `Lead`, `Result<T>`, `Integration` |
  | `core/http.ts` | `postJson(url, body, options?)` → `Promise<Result<string>>`, `PostOptions` |
  | `core/config.ts` | `readEnv(name)` → `Result<string>` |
  | `core/parse.ts` | `parseJson(text, guard, label?)` → `Result<T>`, `Guard<T>`, `isRecord`, `isString`, `isNumber` |
  | `core/log.ts` | `log.info`, `log.warn`, `log.error`, `redact(text)` |
- Потрібен хелпер, якого в цьому списку немає, — не додавай його в `core/`:
  тримай локально в модулі інтеграції або зупинись за процедурою з `do-not-touch`.
- Імена: файли — kebab-case; поле `name` інтеграції збігається з іменем файлу
  (`slack-notify.ts` → `name: "slack-notify"`).
- Імпорти всередині `app/src/` — відносні, з розширенням `.js`
  (`import { postJson } from "../core/http.js"`).

## Як перевірити

- `cd app && npm run typecheck` → без помилок.
- `grep -rn "\.\./sync/" app/src/integrations/` → порожньо (інтеграції не знають про `sync`).
- `grep -rn "\.\./integrations/" app/src/core/` → порожньо (ядро ні від кого не залежить).
- Нова інтеграція видно в `app/src/integrations/index.ts` одним рядком, а `npm test`
  містить її тест.
