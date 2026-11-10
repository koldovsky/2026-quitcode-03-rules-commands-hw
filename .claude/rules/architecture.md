---
paths:
  - "app/src/**"
---

# Архітектура lead-sync: шари, залежності, API ядра

## Контекст

Воркер перенесено з n8n; той самий `core/` працює в усіх клієнтських воркерах
агенції, а інтеграції додаються щотижня. Шари тримають ядро спільним, а кожну
інтеграцію — незалежною. Джерело: `materials/architecture-brief.md`.

## Правило

- Шари й напрям залежностей (стрілка — «імпортує з»):
  - `app/src/integrations/*` → `core/` — і ні з чого іншого: не імпортуй `sync/`
    та інші інтеграції;
  - `app/src/sync/*` → `core/` і **лише** реєстр `integrations/index.ts`, а не окремі
    модулі інтеграцій; з інтеграціями працює тільки через контракт `Integration`;
  - `app/src/core/*` не імпортує нічого з `integrations/` чи `sync/`.
- Нова зовнішня система = рівно три зміни:
  1. `app/src/integrations/<kebab-name>.ts` — експортує об'єкт типу `Integration`,
     `name` = ім'я файлу без `.ts`, `requiredEnv` — імена змінних;
  2. `app/src/integrations/<kebab-name>.test.ts` поруч;
  3. один рядок у масиві `integrations` в `app/src/integrations/index.ts`.
  Нічого більше: ні змін у `sync/`, ні нових файлів у `core/`.
- Публічний API ядра — **рівно** цей. Інших експортів не існує; не вигадуй їх і не
  додавай (див. `.claude/rules/do-not-touch.md`):

  | Модуль | Експорт |
  |---|---|
  | `core/types.ts` | `Lead`, `Result<T>`, `Integration` |
  | `core/http.ts` | `postJson(url, body, options?)` → `Promise<Result<string>>`, `PostOptions` (`headers`, `timeoutMs`, `retries`, `backoffMs`) |
  | `core/config.ts` | `readEnv(name)` → `Result<string>` |
  | `core/parse.ts` | `parseJson(text, guard, label?)` → `Result<T>`, `Guard<T>`, `isRecord`, `isString`, `isNumber` |
  | `core/log.ts` | `log.info`, `log.warn`, `log.error`, `redact(text)` |

- Потрібного в цьому API немає (новий guard, допоміжна функція) — пиши її локально
  в модулі інтеграції чи `sync/`. Немає поля в `Lead` чи в контракті `Integration` —
  це зміна core: зупинись за `.claude/rules/do-not-touch.md`.

## Як перевірити

- `grep -rnE "from \"\.\./(integrations|sync)/" app/src/core` → порожньо.
- `grep -rn "sync/" app/src/integrations` → порожньо.
- `grep -rnE "from \"\.\./integrations/[a-z-]+\.js\"" app/src/sync | grep -v "/index.js"` → порожньо.
- Нова інтеграція: є `<name>.ts`, `<name>.test.ts`, рядок в `integrations/index.ts`;
  `git status --short app/src/core` → порожньо.
