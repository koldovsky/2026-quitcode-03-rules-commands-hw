---
paths:
  - "app/src/**/*.ts"
---

# Архітектура lead-sync

## Контекст

`lead-sync` — три шари з одностороннім напрямом залежностей. Той самий `core/`
працює в усіх клієнтських воркерах агенції, тому шари не змішуються, а публічний
API ядра — закритий список, який не розширюють «на ходу».

## Правило

### Шари і напрям залежностей

```
app/src/
  core/          платформа: типи, HTTP, конфіг, парсинг, логер
  integrations/  по одному модулю на зовнішню систему + реєстр index.ts
  sync/          запуск синхронізації і стан між запусками
```

- `integrations/` і `sync/` імпортують з `core/`. `core/` не імпортує нічого
  ззовні себе — ні з `integrations/`, ні з `sync/`. Імпорти **всередині** ядра
  нормальні (`core/http.ts` → `core/log.ts`) і цим правилом не обмежені.
- `integrations/` не знають про `sync/`. Не додавай у модуль інтеграції імпорт
  з `../sync/` — потрібні дані приходять аргументом `send(lead)`.
- `sync/` працює з інтеграціями лише через контракт `Integration` з `core/types.ts`
  і реєстр `integrations/index.ts`. Не імпортуй конкретний модуль інтеграції в `sync/`
  і не перевіряй в `sync/` її `name`, щоб зробити «особливий випадок».
- Спільний код двох інтеграцій не виноситься новим модулем у `core/` — це зміна
  ядра (див. `do-not-touch`). Або лиши його локально в модулі, або зупинись і опиши потребу.

### Нова зовнішня система

Рівно три зміни, більше нічого:

1. `app/src/integrations/<kebab-name>.ts` — експортує об'єкт типу `Integration`:
   `name` збігається з іменем файлу, `requiredEnv` містить лише **імена** змінних,
   `send(lead)` повертає `Promise<Result<void>>`.
2. `app/src/integrations/<kebab-name>.test.ts` поруч — щонайменше три випадки:
   успішна відправка (перевір URL і тіло запиту), відсутня змінна середовища,
   помилка від зовнішньої системи. Мережі в тестах немає: `vi.stubGlobal("fetch", ...)`,
   змінні — через `vi.stubEnv`.
3. Один рядок у `app/src/integrations/index.ts`.

Нових тек, шарів, «менеджерів», «фабрик» і базових класів при цьому не з'являється.

### Публічний API ядра — рівно це, іншого не існує

| Модуль | Експорт |
|---|---|
| `core/types.ts` | `Lead`, `Result<T>`, `Integration` |
| `core/http.ts` | `postJson(url, body, options?)`, `PostOptions` |
| `core/config.ts` | `readEnv(name)` |
| `core/parse.ts` | `parseJson(text, guard, label?)`, `Guard<T>`, `isRecord`, `isString`, `isNumber` |
| `core/log.ts` | `log.info`, `log.warn`, `log.error`, `redact(text)` |

- Немає в таблиці — значить не існує. Не імпортуй «за аналогією» (`getJson`,
  `readEnvOrDefault`, `log.debug`) і не пиши локальну копію того, що мало б бути в ядрі.
- Бракує чогось для задачі — не дописуй ядро і не обходь його: зупинись і виконай
  стоп-протокол із `do-not-touch`.

## Як перевірити

- `cd app && npm run check:rules` → `core-untouched 0` і `no-new-deps 0`.
- `cd app && grep -rn "\.\./sync/" src/integrations/` → порожньо;
  `grep -rn "\.\./integrations/" src/sync/` → порожньо (`sync/` бере інтеграції аргументом).
- Після додавання інтеграції `git status --short` показує рівно два нових файли
  (`<name>.ts`, `<name>.test.ts`) і один змінений — `src/integrations/index.ts`.
- `cd app && npm test && npm run typecheck` — зелені.
