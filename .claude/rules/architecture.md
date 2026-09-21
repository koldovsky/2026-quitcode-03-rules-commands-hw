---
paths:
  - "app/src/**/*.ts"
---

# architecture

## Контекст

`lead-sync` розділений на три шари (`core/`, `integrations/`, `sync/`) з
однонаправленими залежностями і фіксованим публічним API ядра. Порушення
напряму залежностей або вихід за межі публічного API ядра ламає інваріант,
на якому тримається спільний `core` для всіх клієнтських воркерів агенції.

## Правило

- Напрям залежностей — лише один: `integrations/` і `sync/` імпортують з
  `core/`. `core/` нічого не імпортує з `integrations/` чи `sync/`.
- `integrations/` нічого не знає про `sync/` і навпаки. `sync/` звертається
  до інтеграцій лише через контракт `Integration` (`core/types.ts`) і реєстр
  `integrations/index.ts` — не напряму до файлів у `integrations/`.
- Нова зовнішня система — це рівно: новий файл
  `app/src/integrations/<kebab-name>.ts`, тест поруч
  `app/src/integrations/<kebab-name>.test.ts` і один рядок реєстрації в
  `app/src/integrations/index.ts`. Більше нічого редагувати не потрібно.
- Публічний API ядра — рівно це, іншого не існує і вигадувати не можна:
  - `core/types.ts` → `Lead`, `Result<T>`, `Integration`
  - `core/http.ts` → `postJson(url, body, options?)`, `PostOptions`
  - `core/config.ts` → `readEnv(name)`
  - `core/parse.ts` → `parseJson(text, guard, label?)`, `Guard<T>`,
    `isRecord`, `isString`, `isNumber`
  - `core/log.ts` → `log.info`, `log.warn`, `log.error`, `redact(text)`
- Потрібен експорт з `core/`, якого немає у списку вище? Це зміна `core/` —
  дивись правило `do-not-touch`, а не додавай експорт сам.

## Як перевірити

- `grep -rnE "from ['\"].*\/(integrations|sync)" app/src/core` → порожньо
  (ядро нічого не імпортує з інших шарів).
- `grep -rln "from ['\"].*\/integrations\/[a-z-]*['\"]" app/src/sync` →
  порожньо (sync не імпортує файли інтеграцій напряму, лише через
  `integrations/index.ts`).
- Для нової інтеграції: `ls app/src/integrations/<kebab-name>.ts
  app/src/integrations/<kebab-name>.test.ts` — обидва існують, і
  `grep <kebab-name> app/src/integrations/index.ts` знаходить рядок
  реєстрації.