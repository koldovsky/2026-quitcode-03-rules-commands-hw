---
paths:
  - "app/src/**"
---

# Архітектура lead-sync

## Контекст

`lead-sync` має три шари з одностороннім напрямом залежностей, а `core/` — спільна
платформа всіх клієнтських воркерів агенції (`materials/architecture-brief.md`).
Порушений напрям залежностей або вигаданий API ядра ламає цю спільність.

## Правило

- Шари `app/src/`:
  - `core/` — платформа: типи, HTTP, конфіг, парсинг, логер (захищено, див. `do-not-touch`);
  - `integrations/` — один модуль на зовнішню систему + реєстр `integrations/index.ts`;
  - `sync/` — запуск синхронізації і стан між запусками.
- Напрям імпортів: `integrations/` → `core/`, `sync/` → `core/`.
  - `core/` не імпортує нічого з `integrations/` чи `sync/`.
  - `integrations/` не імпортує нічого з `sync/`.
  - `sync/` бачить інтеграції лише через контракт `Integration` з `core/types.ts`
    і масив `integrations` з `integrations/index.ts` — не імпортуй конкретний модуль інтеграції в `sync/`.
- Нова інтеграція — рівно три зміни, більше нічого:
  1. `app/src/integrations/<kebab-name>.ts` — експортує об'єкт типу `Integration`;
  2. `app/src/integrations/<kebab-name>.test.ts` поруч;
  3. один рядок у масиві `integrations` в `app/src/integrations/index.ts`.
  - Поле `name` інтеграції = ім'я файлу без `.ts` (`slack-notify.ts` → `name: "slack-notify"`).
  - Зразок — `app/src/integrations/slack-notify.ts`.
- Публічний API ядра — **закритий список**. Іншого не існує; не вигадуй функцій,
  типів чи опцій, яких тут немає:

  | Модуль | Експорт |
  |---|---|
  | `core/types.ts` | `Lead`, `Result<T>`, `Integration` |
  | `core/http.ts` | `postJson(url, body, options?)` → `Promise<Result<string>>`, `PostOptions` |
  | `core/config.ts` | `readEnv(name)` → `Result<string>` |
  | `core/parse.ts` | `parseJson(text, guard, label?)` → `Result<T>`, `Guard<T>`, `isRecord`, `isString`, `isNumber` |
  | `core/log.ts` | `log.info`, `log.warn`, `log.error`, `redact(text)` |

- Бракує чогось у ядрі (нове поле `Lead`, новий метод HTTP, новий guard) — не додавай
  його в `core/` і не дублюй у `integrations/`: зупинись і діяй за правилом `do-not-touch`.

## Як перевірити

- `grep -rnE "from \"\.\./(integrations|sync)/" app/src/core` → порожньо.
- `grep -rn "\.\./sync/" app/src/integrations` → порожньо.
- `grep -rnE "from \"\.\./integrations/[a-z-]+\.js\"" app/src/sync` → лише `index.js` або порожньо.
- Діф нової інтеграції — рівно три файли: `<name>.ts`, `<name>.test.ts`, `index.ts`.
- `cd app && npm run typecheck` — без помилок (немає звернень до неіснуючого API ядра).
