---
paths:
  - "app/src/**/*.ts"
---

# Architecture — шари lead-sync

## Контекст

Воркер перенесено з n8n. Кожна зовнішня система — окремий модуль, ядро спільне для
всіх клієнтських воркерів. Повна записка: `materials/architecture-brief.md`.

## Правило

- Шари: `core/` ← `integrations/` і `sync/`. Імпорти між шарами — лише в цьому
  напрямку: `core/` не імпортує `integrations/` чи `sync/` (усередині `core/` —
  можна), `integrations/` не імпортують `sync/`.
- Нова зовнішня система — рівно три зміни:
  1. `app/src/integrations/<kebab-name>.ts` з `export const <camelName>: Integration`
     і `name: "<kebab-name>"`;
  2. `app/src/integrations/<kebab-name>.test.ts` поруч;
  3. один рядок у `app/src/integrations/index.ts`.
- API ядра — лише це. Іншого не існує, не вигадуй:
  - `core/types.ts`: `Lead`, `Result<T>`, `Integration`
  - `core/http.ts`: `postJson(url, body, options?)` → `Promise<Result<string>>`, `PostOptions`
  - `core/config.ts`: `readEnv(name)` → `Result<string>`
  - `core/parse.ts`: `parseJson(text, guard, label?)` → `Result<T>`, `Guard<T>`, `isRecord`, `isString`, `isNumber`
  - `core/log.ts`: `log.info`, `log.warn`, `log.error`, `redact(text)`
- Типи й guard-и, потрібні одній інтеграції, живуть у файлі цієї інтеграції, а не в `core/types.ts`.

## Як перевірити

- `cd app && npm run typecheck` зелений: вигаданий імпорт із core не скомпілюється.
- Для нової інтеграції `git status --short app/src` показує рівно модуль, тест і `index.ts`.
