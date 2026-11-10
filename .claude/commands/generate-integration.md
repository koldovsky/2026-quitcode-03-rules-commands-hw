---
description: Нова інтеграція із зовнішнім сервісом за архітектурою проєкту — модуль, тест поруч і рядок у реєстрі; без змін у core і без нових залежностей.
argument-hint: <сервіс, напр. telegram, hubspot, pipedrive>
---

# Нова інтеграція

**Ціль:** $ARGUMENTS
(Якщо в рядку вище немає назви сервісу — ціль вказана в повідомленні одразу після
назви команди. Немає й там — спитай і зупинись.)

## Кроки

1. Визнач `<kebab-name>` (напр. `telegram-notify`, `hubspot-contact`). Такий модуль
   уже є в `app/src/integrations/` — Stop.
2. Прочитай: `.claude/rules/architecture.md`, `.claude/rules/conventions.md`,
   публічний API ядра (`app/src/core/*.ts`, лише читання), еталон
   `app/src/integrations/slack-notify.ts` + тест, реєстр `app/src/integrations/index.ts`.
3. Визнач тип: **сповіщення** (месенджер — без email і телефону) чи **система
   обліку** (CRM, таблиця — повні дані). Від цього залежить тіло запиту.
4. Обери ендпоінт і тіло за публічним API сервісу. Змінні середовища — `UPPER_SNAKE`
   з префіксом сервісу; секрети — лише через `readEnv`, у URL чи заголовок
   `PostOptions.headers`. Позначай, що з API — твоє припущення.
5. Напиши `app/src/integrations/<kebab-name>.ts` — об'єкт `Integration`, як в еталоні:
   `readEnv` → `postJson` → (якщо сервіс повертає JSON зі статусом) `parseJson` з
   локальним guard → `Result<void>` + `log` без персональних даних.
6. Напиши `app/src/integrations/<kebab-name>.test.ts`: успішна відправка (URL і тіло),
   відсутня змінна середовища, помилка сервісу; якщо є розбір відповіді — неочікувана
   форма.
7. Додай один рядок у масив `integrations` в `app/src/integrations/index.ts`.
8. З `app/`: `npm test`, `npm run typecheck`, `npm run check:rules`.
9. Підсумок: створені/змінені файли, змінні середовища, припущення про API, які
   людина має звірити з документацією сервісу, числа тестів і `check:rules`.

## Acceptance criteria

- [ ] Рівно три зміни: новий модуль, новий тест, один рядок в `index.ts`.
- [ ] `name` = ім'я файлу; `requiredEnv` = усі змінні, які читає модуль.
- [ ] `npm test` і `npm run typecheck` зелені; щонайменше 3 нові тести.
- [ ] `check:rules`: у новому модулі 0 порушень; `TOTAL` не зріс; `core-untouched` — 0.
- [ ] `package.json` без нових залежностей; у тілі сповіщення немає email і телефону.

## Stop

- Core не чіпай; потрібен новий тип чи поле в `Lead` — зупинись за
  `.claude/rules/do-not-touch.md`.
- Не встановлюй SDK сервісу: лише `postJson`. Без SDK не зробити — зупинись і спитай.
- Без реальних мережевих викликів і справжніх токенів (лише `fake-…` у тестах).
- Покажи підсумок і не комітить.
