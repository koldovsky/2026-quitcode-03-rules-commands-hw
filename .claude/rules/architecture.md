---
paths:
  - "app/src/**/*.ts"
---

# Архітектура lead-sync

## Контекст

`lead-sync` — воркер, перенесений з n8n. Три шари з одностороннім напрямом
залежностей; ядро спільне для всіх клієнтських воркерів агенції, тому його
публічний API фіксований. Джерело: `materials/architecture-brief.md`.

## Правило

**Шари й напрям залежностей**

- `app/src/core/` — платформа (типи, HTTP, конфіг, парсинг, логер).
  `core/` не імпортує нічого з `integrations/` чи `sync/`.
- `app/src/integrations/` — по одному модулю на зовнішню систему + реєстр `index.ts`.
  Інтеграція не імпортує з `sync/` і не знає про інші інтеграції.
- `app/src/sync/` — запуск синхронізації і стан між запусками. Працює з
  інтеграціями **лише** через контракт `Integration` з `core/types.ts` і масив
  `integrations` з `integrations/index.ts`. Не імпортуй конкретний модуль
  інтеграції в `sync/` — імпортуй реєстр.

**Нова інтеграція — рівно три речі, більше нічого**

1. `app/src/integrations/<kebab-name>.ts` — експортує об'єкт типу `Integration`
   з полями `name` (збігається з іменем файлу), `requiredEnv`, `send(lead)`.
2. `app/src/integrations/<kebab-name>.test.ts` — поруч із модулем.
3. Один рядок у `app/src/integrations/index.ts` (імпорт + елемент масиву).

Не створюй підтеки, базові класи, фабрики чи «спільні хелпери» для інтеграцій —
спільне живе в `core/`, а `core/` змінювати не можна (див. `do-not-touch`).

**Публічний API ядра — рівно цей список. Іншого не існує**

| Модуль | Що можна імпортувати |
|---|---|
| `core/types.ts` | `Lead`, `Result<T>`, `Integration` |
| `core/http.ts` | `postJson(url, body, options?)` → `Promise<Result<string>>`, `PostOptions` |
| `core/config.ts` | `readEnv(name)` → `Result<string>` |
| `core/parse.ts` | `parseJson(text, guard, label?)` → `Result<T>`, `Guard<T>`, `isRecord`, `isString`, `isNumber` |
| `core/log.ts` | `log.info`, `log.warn`, `log.error`, `redact(text)` |

- Не вигадуй експортів, яких немає в таблиці (`getJson`, `putJson`, `readEnvOr`,
  `log.debug`, `parseYaml` тощо). Немає потрібної функції — не дописуй її в core:
  зупинись і опиши, чого бракує (див. `do-not-touch`).
- Імпорти всередині `app/src/` — відносні, з розширенням `.js`
  (`import { postJson } from "../core/http.js"`), бо проєкт на ESM.

## Як перевірити

- `cd app && npm run check:rules` → `core-untouched  0` (ядро не чіпали).
- `cd app && npm run typecheck` — зелений: неіснуючий експорт ядра не скомпілюється.
- Нова інтеграція: `git status --short` показує рівно 2 нові файли в
  `app/src/integrations/` + зміну в `index.ts`, і нічого поза `app/src/integrations/`.
- `grep -rn "from \"\.\./sync" app/src/integrations/` і
  `grep -rn "from \"\.\./integrations/[a-z-]*\.js\"" app/src/sync/` — обидва порожні.
