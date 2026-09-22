---
paths:
  - "app/src/**/*.ts"
---

# Архітектура lead-sync

## Контекст

`lead-sync` — воркер, перенесений з n8n: шари `core/` → `integrations/` → `sync/`
з одностороннім напрямом залежностей. Ядро належить платформній команді й
однакове в усіх клієнтських воркерах агенції, тому його API фіксований
(`materials/architecture-brief.md`).

## Правило

### Шари і напрям залежностей

- `app/src/core/` — платформа: типи, HTTP, конфіг, парсинг, логер.
  `core/` не імпортує нічого з `integrations/` чи `sync/`.
- `app/src/integrations/` — по одному модулю на зовнішню систему + реєстр `index.ts`.
  Імпортує тільки з `core/`. Про `sync/` не знає нічого.
- `app/src/sync/` — запуск синхронізації і стан між запусками. Працює з
  інтеграціями лише через тип `Integration` з `core/types.ts` і масив
  `integrations` з `integrations/index.ts` — не імпортуй конкретний модуль
  інтеграції напряму.
- Імпорти всередині `app/src/**` — відносні, з розширенням `.js`
  (напр. `import { postJson } from "../core/http.js"`).

### Публічний API ядра — рівно цей список

| Модуль | Експорт |
|---|---|
| `core/types.ts` | `Lead`, `Result<T>`, `Integration` |
| `core/http.ts` | `postJson(url, body, options?): Promise<Result<string>>`, `PostOptions` |
| `core/config.ts` | `readEnv(name): Result<string>` |
| `core/parse.ts` | `parseJson(text, guard, label?): Result<T>`, `Guard<T>`, `isRecord`, `isString`, `isNumber` |
| `core/log.ts` | `log.info`, `log.warn`, `log.error`, `redact(text)` |

Іншого публічного API ядра не існує. Не вигадуй хелпер, якого немає в таблиці
(`getJson`, `requireEnv`, `log.debug`, `safeParse`) — якщо потрібної функції
немає, зупинись і опиши потребу (див. правило `do-not-touch`).

### Нова інтеграція — рівно три зміни

1. `app/src/integrations/<kebab-name>.ts` — експортує об'єкт типу `Integration`
   з полями `name` (збігається з іменем файлу), `requiredEnv` (лише імена змінних)
   і `send(lead): Promise<Result<void>>`.
2. `app/src/integrations/<kebab-name>.test.ts` поруч.
3. Один рядок у `app/src/integrations/index.ts` — імпорт і елемент масиву `integrations`.

Більше нічого. Зразок для наслідування — `app/src/integrations/slack-notify.ts`.
Новий шар, новий реєстр, зміна контракту `Integration` — це не «нова інтеграція»,
а зміна архітектури: зупинись і спитай.

## Як перевірити

- `cd app && npm test` — зелений (18+ тестів).
- `cd app && npm run check:rules` → `core-untouched 0`.
- `grep -rn "from \"\.\./\(integrations\|sync\)" app/src/core/` — порожньо
  (ядро ні від кого не залежить).
- `grep -n "integrations" app/src/sync/run.ts` — `sync` бере інтеграції з реєстру,
  а не імпортує модулі поштучно.
- Нова інтеграція: рівно 2 нових файли + 1 змінений рядок у `index.ts`
  (`git status --short` і `git diff --stat`).
