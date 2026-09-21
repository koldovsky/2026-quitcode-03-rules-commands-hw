---
paths:
  - "app/src/**/*.ts"
---

# Шари, напрям залежностей і публічний API ядра

## Контекст

`lead-sync` має три шари: `core/` (платформа), `integrations/` (по модулю на
зовнішню систему) і `sync/` (запуск і стан). Напрям залежностей односторонній —
це дозволяє тримати один і той самий `core` в усіх воркерах агенції
(`materials/architecture-brief.md`).

## Правило

- Напрям залежностей — лише такий:

  - `integrations/` → `core/`, `sync/` → `core/`;
  - `core/` не імпортує нічого з `integrations/` чи `sync/`;
  - `integrations/` не імпортує нічого з `sync/` і нічого не знає про нього;
  - `sync/` працює з інтеграціями лише через контракт `Integration` з
    `core/types.ts` і реєстр `integrations/index.ts` — не імпортуй конкретний
    модуль інтеграції в `sync/`.

- Публічний API `core` — рівно цей. Іншого не існує; не вигадуй експортів і не
  імпортуй внутрішні файли `core/` в обхід нього:

  | Модуль | Експорт |
  |---|---|
  | `core/types.ts` | `Lead`, `Result<T>`, `Integration` |
  | `core/http.ts` | `postJson(url, body, options?)` → `Promise<Result<string>>`, `PostOptions` |
  | `core/config.ts` | `readEnv(name)` → `Result<string>` |
  | `core/parse.ts` | `parseJson(text, guard, label?)` → `Result<T>`, `Guard<T>`, `isRecord`, `isString`, `isNumber` |
  | `core/log.ts` | `log.info`, `log.warn`, `log.error`, `redact(text)` |

- Потрібного експорту немає в таблиці — це не привід додати його в `core/`:
  діє правило `do-not-touch` (зупинись і опиши потребу).
- Нова зовнішня система — рівно три зміни, більше нічого:

  1. `app/src/integrations/<kebab-name>.ts` — модуль, що реалізує `Integration`;
  2. `app/src/integrations/<kebab-name>.test.ts` — тест поруч;
  3. один рядок у `app/src/integrations/index.ts`.

- Не додавай нових шарів, «сервісів», фабрик, базових класів чи власних реєстрів
  і не змінюй `sync/` заради нової інтеграції — контракт `Integration` цього не
  вимагає.
- Не дублюй логіку сусідньої інтеграції копіюванням: спільне вже є в `core/`.
- Конвенції всередині модуля (`Result`, `postJson`, `readEnv`, `parseJson`, `log`,
  без `any`, без залежностей) — у правилі `conventions`.

## Як перевірити

- `cd app && npm run check:rules` → `0` у рядках `http-via-core`, `env-via-config`,
  `json-via-parse`, `log-via-logger`, `core-untouched`.
- Напрям залежностей — три `grep` із теки `app`, усі мають дати порожній вивід:
  `grep -rnE 'from "[^"]*(integrations|sync)/' src/core`,
  `grep -rnE 'from "[^"]*sync/' src/integrations`,
  `grep -rnE 'from "[^"]*integrations/' src/sync` (реєстр підключає `worker.ts`, не `sync/`).
- Нова інтеграція: `git status --short` показує рівно два нові файли в
  `app/src/integrations/` і змінений `index.ts`.
