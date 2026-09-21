---
paths:
  - "app/src/**/*.ts"
---

# Архітектура lead-sync

## Контекст

`lead-sync` перенесли з n8n-воркфлоу, і межі між шарами в коді не видно —
їх тримає домовленість (`materials/architecture-brief.md`). Ядро `core/`
спільне для всіх клієнтських воркерів агенції, тому напрям залежностей
односторонній: зміна в `integrations/` не має права дотягнутись до ядра.

## Правило

**Шари й напрям залежностей**

- `app/src/core/` — платформа: типи, HTTP, конфіг, парсинг, логер.
  `core/` **не імпортує нічого** з `integrations/` чи `sync/`.
- `app/src/integrations/` — по модулю на зовнішню систему + реєстр `index.ts`.
  Імпортує лише з `core/`. Про `sync/` **не знає** — імпорту `../sync/` тут не існує.
- `app/src/sync/` — запуск синхронізації і стан між запусками. Працює з
  інтеграціями лише через контракт `Integration` з `core/types.ts` і реєстр
  `integrations/index.ts`; конкретну інтеграцію за іменем файлу не імпортує.

**Шарів рівно три.** Новий каталог у `app/src/` — це не рішення, а зупинка:
опиши, що саме не вміщається в наявні шари, і чекай. Каталог на кшталт
`src/leads/`, `src/domain/`, `src/utils/` заводити не можна, навіть якщо він
«тимчасовий» і всі перевірки лишаються зеленими.

> Звідки цей рядок: у контрольному прогоні A/B агент без правил додав саме
> `app/src/leads/` із `LeadWithCampaign extends Lead`, щоб не чіпати `Lead` у
> ядрі. `npm test` 30 зелених, `check:rules` TOTAL 1, `core-untouched: 0` —
> машина не побачила нічого. Слід: `docs/evidence/ab/clean-off--opus/`.

**Нова зовнішня система — рівно три зміни, більше нічого:**

1. `app/src/integrations/<kebab-name>.ts` — об'єкт, що реалізує `Integration`;
2. `app/src/integrations/<kebab-name>.test.ts` — тест поруч;
3. один рядок у масиві `integrations` у `app/src/integrations/index.ts`.

Не додавай для цього ні поля в `Lead`, ні нових типів у `core/`, ні прапорців
у `sync/run.ts`. Якщо інтеграція без цього не працює — це сигнал зупинитись
(див. правило `do-not-touch`), а не обійти.

**Публічний API ядра — рівно ось це. Іншого не існує, і вигадувати його не можна:**

| Модуль | Експорт |
|---|---|
| `core/types.ts` | `Lead`, `Result<T>`, `Integration` |
| `core/http.ts` | `postJson(url, body, options?)` → `Promise<Result<string>>`, `PostOptions` |
| `core/config.ts` | `readEnv(name)` → `Result<string>` |
| `core/parse.ts` | `parseJson(text, guard, label?)` → `Result<T>`, `Guard<T>`, `isRecord`, `isString`, `isNumber` |
| `core/log.ts` | `log.info`, `log.warn`, `log.error`, `redact(text)` |

Потрібної функції в таблиці немає — вона не існує. Не імпортуй її «про всяк
випадок» і не припускай, що вона десь є: напиши потрібну логіку в своєму
модулі на тому, що є, або зупинись і опиши, чого бракує.

## Як перевірити

```bash
cd app && npm run typecheck                                  # вигаданий експорт ядра → помилка компіляції
grep -rn 'from "\.\./sync/' app/src/integrations/            # має бути порожньо (exit 1)
grep -rnE 'from "\.\./(integrations|sync)/' app/src/core/    # має бути порожньо (exit 1)
node tools/check-rule-claims.mjs                             # таблиця API ядра вище = реальні експорти
```

Нова інтеграція: `git status --short` показує рівно два нові файли
(`<name>.ts`, `<name>.test.ts`) і одну змінену — `integrations/index.ts`.
