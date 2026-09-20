---
paths:
  - "app/src/**/*.ts"
---

# Architecture — шари lead-sync

## Контекст

Воркер перенесено з n8n-воркфлоу. Кожна зовнішня система — окремий модуль; ядро
спільне для всіх клієнтських воркерів агенції. Розгорнуто:
`materials/architecture-brief.md`.

## Правило

- Шари й напрям імпортів: `core/` ← `integrations/`, `core/` ← `sync/`.
  `core/` не імпортує нічого з `integrations/` чи `sync/` (усередині `core/` — можна).
  `integrations/` не знають про `sync/`. `sync/` бачить інтеграції лише через
  контракт `Integration` і реєстр `integrations/index.ts` — ніколи не імпортує
  конкретний модуль інтеграції напряму.
- Нова зовнішня система — рівно три зміни, більше нічого:
  1. `app/src/integrations/<kebab-name>.ts` з `export const <camelName>: Integration`;
  2. `app/src/integrations/<kebab-name>.test.ts` поруч;
  3. один рядок у масиві `integrations` у `app/src/integrations/index.ts`.
- Поле `name` інтеграції дослівно збігається з іменем файлу без розширення.
  `requiredEnv` перелічує **імена** змінних, ніколи не значення.
- Публічний API ядра — рівно цей перелік. Іншого не існує, не вигадуй імпортів:
  - `core/types.ts` → `Lead`, `Result<T>`, `Integration`
  - `core/http.ts` → `postJson(url, body, options?)`: `Promise<Result<string>>`, `PostOptions`
  - `core/config.ts` → `readEnv(name)`: `Result<string>`
  - `core/parse.ts` → `parseJson(text, guard, label?)`: `Result<T>`, `Guard<T>`, `isRecord`, `isString`, `isNumber`
  - `core/log.ts` → `log.info`, `log.warn`, `log.error`, `redact(text)`
- `postJson` повертає **сирий текст** тіла, а не об'єкт: розбирай його `parseJson`
  з guard на очікувану форму.
- Типи й guard-и, потрібні одній інтеграції, живуть у файлі цієї інтеграції.
  Не додавай їх у `core/types.ts` і не розширюй типи ядра ззовні.
- Імпорти всередині `app/src/**` — відносні, з розширенням `.js`
  (`from "../core/http.js"`): проєкт — ESM з `"type": "module"`.

## Як перевірити

- `cd app && npm run typecheck` зелений — вигаданий експорт із core не скомпілюється.
- Для нової інтеграції `git status --short app/src` показує рівно три шляхи:
  модуль, тест, `index.ts`.
- `grep -rn "from \"\.\./sync" app/src/integrations app/src/core` → порожньо.
