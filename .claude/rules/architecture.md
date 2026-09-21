---
paths:
  - "app/src/**/*.ts"
---

# Архітектура: шари, залежності, публічний API ядра

## Контекст

`lead-sync` розсилає нові ліди в інтеграції (Slack, Google-таблиця, далі — CRM і
месенджери). Ядро `app/src/core/` спільне для всіх клієнтських воркерів агенції,
тому шари й напрям залежностей фіксовані (джерело — `materials/architecture-brief.md`).

## Правило

- Шари: `core/` — платформа (типи, HTTP, конфіг, парсинг, логер); `integrations/` —
  по одному модулю на зовнішню систему + реєстр `index.ts`; `sync/` — запуск і стан
  між запусками.
- `integrations/` і `sync/` імпортують з `core/`. `core/` не імпортує нічого поза
  `core/` — лише `./…`.
- `integrations/` не імпортують `sync/`. `sync/` не імпортує модулі інтеграцій напряму —
  лише контракт `Integration` з `core/types.ts` і реєстр `integrations/index.ts`.
- Нова зовнішня система — рівно три зміни: `app/src/integrations/<kebab-name>.ts`
  (об'єкт типу `Integration`, `name` = ім'я файлу без `.ts`), тест поруч
  `<kebab-name>.test.ts`, імпорт і запис у масиві `integrations/index.ts`. У `core/` і
  `sync/` — нічого.

Публічний API ядра — рівно цей. Іншого не існує: не імпортуй і не вигадуй інших імен.

| Модуль | Експорт |
|---|---|
| `core/types.ts` | `Lead`, `Result<T>`, `Integration` |
| `core/http.ts` | `postJson(url, body, options?)` → `Promise<Result<string>>`, `PostOptions` |
| `core/config.ts` | `readEnv(name)` → `Result<string>` |
| `core/parse.ts` | `parseJson(text, guard, label?)` → `Result<T>`, `Guard<T>`, `isRecord`, `isString`, `isNumber` |
| `core/log.ts` | `log.info`, `log.warn`, `log.error`, `redact(text)` |

- Чого немає: GET-запитів (`getJson`, `fetchJson`), `log.debug`, резервного значення
  для відсутньої змінної (`readEnv` повертає `{ ok: false }`), інших guard-ів. Потрібен
  guard — напиши локальний у своєму модулі з `isRecord` / `isString` / `isNumber`.
- Поля `Lead` задає лише `core/types.ts`. Нове поле чи новий експорт ядра — це зміна
  core: дій за правилом `do-not-touch`.

## Як перевірити

- `grep -rEn "from ['\"]\.\./" app/src/core` → порожньо: core нічого не імпортує ззовні.
- `grep -rEn "from ['\"]\.\./sync/" app/src/integrations` → порожньо.
- `grep -rEn "from ['\"]\.\./integrations/" app/src/sync | grep -v "/index.js"` → порожньо:
  sync бачить інтеграції лише через реєстр.
- Нова інтеграція: `git status --short app/src` → два нові файли в `integrations/` і
  змінений `integrations/index.ts`, більше нічого.
- `cd app && npm run typecheck && npm run check:rules` → без помилок типів, `core-untouched 0`.
