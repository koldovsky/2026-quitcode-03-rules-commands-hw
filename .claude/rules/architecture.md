---
paths:
  - "app/src/**/*.ts"
---

# architecture

## Контекст

`lead-sync` має три шари з напрямом залежностей в одну сторону, а ядро —
фіксований публічний API (`materials/architecture-brief.md`, розділи «Шари і
напрям залежностей» та «Ядро»). Агент, що вгадує ці межі щоразу заново,
або тягне зайве через шари, або вигадує функції ядра, яких немає.

## Правило

- Напрям залежностей: `integrations/` і `sync/` імпортують з `core/`; `core/`
  не імпортує нічого з решти проєкту. `integrations/` нічого не знають про
  `sync/`. `sync/` працює з інтеграціями лише через контракт `Integration` з
  `core/types.ts` і реєстр `integrations/index.ts`.
- Нова зовнішня система — рівно три додавання й нічого більше: файл
  `src/integrations/<kebab-name>.ts`, тест поруч
  `src/integrations/<kebab-name>.test.ts`, один новий рядок у
  `integrations/index.ts`.
- Публічний API ядра — рівно це, іншого не існує, не вигадуй нових експортів:
  `core/types.ts` → `Lead`, `Result<T>`, `Integration`;
  `core/http.ts` → `postJson(url, body, options?)`, `PostOptions`;
  `core/config.ts` → `readEnv(name)`;
  `core/parse.ts` → `parseJson(text, guard, label?)`, `Guard<T>`, `isRecord`,
  `isString`, `isNumber`;
  `core/log.ts` → `log.info`, `log.warn`, `log.error`, `redact(text)`.

## Як перевірити

- `cd app && npm run check:rules` — `0` порушень.
- Нова інтеграція — це рівно файл + тест поруч + один рядок у
  `integrations/index.ts`; жодних інших файлів не змінено (`git status --short`).
