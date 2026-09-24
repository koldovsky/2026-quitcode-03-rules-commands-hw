---
description: Нова інтеграція за архітектурою — модуль, тест поруч, рядок у реєстрі. Без змін у core і без залежностей.
argument-hint: <назва сервісу, напр. telegram-notify>
---

# Нова інтеграція

**Ціль:** $ARGUMENTS
(Якщо в рядку вище немає назви сервісу — вона вказана в повідомленні одразу після
назви команди. Немає й там — спитай і зупинись.)

## Кроки

1. Перетвори ціль на kebab-case ім'я (`telegram-notify`, `hubspot-crm`). Визнач тип:
   **сповіщення** (месенджер, канал) чи **система обліку** (CRM, таблиця) — від цього
   залежить, які поля ліда можна передавати (`.claude/rules/conventions.md`,
   мінімізація даних).
2. Прочитай зразок `app/src/integrations/slack-notify.ts` і його тест,
   `app/src/core/types.ts` (`Integration`, `Lead`) і `app/src/integrations/index.ts`.
3. Створи `app/src/integrations/<name>.ts` за `.claude/rules/architecture.md`:
   - експорт `Integration`, `name` = ім'я файлу, `requiredEnv` — усі змінні;
   - `send()` повертає `Promise<Result<void>>`: `readEnv` → `postJson`; відповідь, якщо її
     треба розібрати, — через `parseJson` + guard; журнал — через `log`.
4. Створи `app/src/integrations/<name>.test.ts` — мінімум три кейси з
   `conventions.md`: успіх (перевір URL і тіло), відсутня змінна середовища,
   помилка від сервісу.
5. Додай один рядок у масив `integrations` в `app/src/integrations/index.ts`.
6. Перевір: `cd app && npm test && npm run typecheck && npm run check:rules`.

## Acceptance criteria

- [ ] У діфі рівно 3 файли: `<name>.ts`, `<name>.test.ts`, `index.ts`.
- [ ] `name` інтеграції збігається з іменем файлу.
- [ ] У новому модулі немає `fetch`, `process.env`, `JSON.parse`, `console.*`, `any`,
      імпортів з npm.
- [ ] Для сповіщення — жодних `email` / `phone` у тілі запиту, і тест це перевіряє.
- [ ] ≥3 нові тести, усі тести зелені; `npm run typecheck` без помилок.
- [ ] `check:rules`: `TOTAL` не зріс, для нових файлів — 0.

## Stop

- `app/src/core/**` не чіпай, залежностей не додавай (`.claude/rules/do-not-touch.md`).
- Сервісу потрібне те, чого немає в API ядра (GET, інший метод, особливі заголовки
  понад `PostOptions.headers`) — зупинись і опиши, що саме треба в core.
- Наприкінці — підсумок: файли, змінні середовища, результати тестів і `check:rules`.
  Не комітить.
