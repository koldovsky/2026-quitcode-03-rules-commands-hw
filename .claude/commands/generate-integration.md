---
description: Створює нову інтеграцію за архітектурою проєкту: модуль, тест поруч, рядок у реєстрі. Без змін у core і без нових залежностей
argument-hint: <назва сервісу, напр. HubSpot / Telegram / Monobank>
---

# Нова інтеграція

**Ціль:** $ARGUMENTS
(Якщо в рядку вище немає назви сервісу — ціль вказана в повідомленні одразу після
назви команди. Немає й там — спитай і зупинись.)

## Кроки

1. Прочитай зразок, що відповідає конвенціям: `app/src/integrations/slack-notify.ts`
   і `app/src/integrations/slack-notify.test.ts`. Роби так само.
   `sheets-append.ts` — спадковий код, за зразок **не бери**.
2. Визнач `<kebab-name>` із назви сервісу (`HubSpot` → `hubspot-contact`,
   `Telegram` → `telegram-notify`) і які змінні середовища потрібні.
   Неочевидно — спитай, перш ніж писати.
3. Створи **рівно три зміни** ([architecture](../rules/architecture.md)):
   - `app/src/integrations/<kebab-name>.ts` — об'єкт типу `Integration`,
     `name` збігається з іменем файлу, `send()` повертає `Promise<Result<void>>`;
   - `app/src/integrations/<kebab-name>.test.ts` — поруч із модулем;
   - один рядок у `app/src/integrations/index.ts` (імпорт + елемент масиву).
4. Усередині — лише ядро: `readEnv()`, `postJson()`, `parseJson(text, guard)`, `log`
   ([conventions](../rules/conventions.md)). Без `fetch`, `process.env`, `JSON.parse`,
   `console.*`, `any` і без `npm install`.
5. Якщо сервіс — месенджер або чат, у повідомлення **не клади** `lead.email`
   і `lead.phone`: лише `name`, `source`, `budgetUsd`.
6. У тесті — мінімум три випадки: успішна відправка (перевір URL і тіло запиту),
   відсутня змінна середовища, помилка від зовнішньої системи. Мережу підміняй
   через `vi.stubGlobal("fetch", ...)`, змінні — через `vi.stubEnv`.
7. Перевір і покажи підсумок:
   ```bash
   cd app && npm test && npm run typecheck && npm run check:rules
   ```

## Acceptance criteria

- [ ] Створено рівно два нові файли + один змінений рядок у `index.ts`; більше нічого
      в `git status --short`.
- [ ] `name` інтеграції === ім'я файлу (kebab-case); `requiredEnv` перелічує **імена**
      змінних, не значення.
- [ ] `send()` не кидає винятків: усі відмови повертаються як `Result` з `ok: false`.
- [ ] `cd app && npm test` зелений, кількість тестів зросла щонайменше на 3.
- [ ] `cd app && npm run check:rules`: новий файл — **0** порушень, `TOTAL` не зріс
      понад базові 8, `core-untouched` = 0.
- [ ] У підсумку: створені файли, змінні середовища, які випадки покрито тестами.

## Stop

`app/src/core/**` не чіпати ([do-not-touch](../rules/do-not-touch.md)): потрібного
хелпера немає — тримай його локально в модулі інтеграції або зупинись і опиши, що
саме треба в core. Нових залежностей не додавати — потрібна бібліотека, це питання
в PR, а не `npm install`. Наприкінці покажи підсумок і зупинись.
