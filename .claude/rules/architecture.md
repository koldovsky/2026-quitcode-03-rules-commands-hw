---
paths:
  - "app/src/**/*.ts"
---

# Architecture

## Контекст

`lead-sync` — платформний воркер: `core/` спільний для всіх клієнтських
воркерів агенції, тому напрям залежностей і публічний API `core/` фіксовані
(джерело — `materials/architecture-brief.md`).

## Правило

- Напрям залежностей: `app/src/integrations/**` і `app/src/sync/**` імпортують
  з `app/src/core/**`; `app/src/core/**` не імпортує нічого з решти проєкту.
- `integrations/**` нічого не знають про `sync/**`. `sync/**` звертається до
  інтеграцій лише через контракт `Integration` (`core/types.ts`) і реєстр
  `integrations/index.ts` — ніколи напряму до конкретного модуля інтеграції.
- Нова зовнішня система — рівно три файли: `app/src/integrations/<kebab-name>.ts`,
  тест поруч `app/src/integrations/<kebab-name>.test.ts`, і один новий рядок у
  `app/src/integrations/index.ts`. Жодних інших файлів не редагується і не
  створюється для цього.
- Публічний API `app/src/core/` — закритий список, іншого не існує й вигадувати
  його не можна:
  - `core/types.ts` → `Lead`, `Result<T>`, `Integration`
  - `core/http.ts` → `postJson(url, body, options?)`, `PostOptions`
  - `core/config.ts` → `readEnv(name)`
  - `core/parse.ts` → `parseJson(text, guard, label?)`, `Guard<T>`, `isRecord`, `isString`, `isNumber`
  - `core/log.ts` → `log.info`, `log.warn`, `log.error`, `redact(text)`
- Якщо задача вимагає експорту з `core/`, якого немає в цьому списку — це зміна
  `core/`: дій за правилом `do-not-touch` (зупинись і опиши, що саме потрібно
  додати і навіщо), а не додавай експорт сам.

## Як перевірити

- `grep -rn "from \"\.\./core\|from \"\./core\|from \"\.\./\.\./core" app/src/integrations app/src/sync` —
  усі імпорти з `core/` використовують лише перелічені вище імена.
- `grep -rnE "from ['\"]\.\./sync" app/src/integrations` — порожній вивід:
  `integrations/**` не імпортує з `sync/**` (шукаємо сам імпорт — підрядок
  `sync` є в кожному `async`).
- `grep -rnE "from ['\"]\.\./integrations/" app/src/sync | grep -v "integrations/index\.js"` —
  порожній вивід: `sync/**` не звертається до модулів інтеграцій повз реєстр.
- Для нової інтеграції: `git status --short app/src` показує рівно новий
  `<kebab-name>.ts`, новий `<kebab-name>.test.ts` і модифікований
  `integrations/index.ts` — нічого в `sync/**`.
