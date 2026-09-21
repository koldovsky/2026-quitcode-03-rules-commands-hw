---
description: Створює нову інтеграцію за архітектурою проєкту: модуль, тест поруч, рядок у реєстрі
argument-hint: <назва сервісу, напр. HubSpot>
---

# generate-integration

**Ціль:** $ARGUMENTS
(Якщо в рядку вище немає назви сервісу — ціль вказана в повідомленні одразу після
назви команди. Немає й там — спитай і зупинись.)

## Кроки

1. Прочитай `app/src/integrations/slack-notify.ts` і `slack-notify.test.ts` —
   це еталон стилю. **Не бери за зразок `sheets-append.ts`**: це спадковий код,
   який конвенціям не відповідає.
2. Визнач `<kebab-name>` із назви сервісу (`HubSpot` → `hubspot-create-contact`,
   `Telegram` → `telegram-notify`). Поле `name` = ім'я файлу без розширення.
3. Створи `app/src/integrations/<kebab-name>.ts` за `.claude/rules/architecture.md`:
   об'єкт типу `Integration`, `requiredEnv` — лише **імена** змінних,
   `send(lead): Promise<Result<void>>` через `readEnv` → `postJson` → `log`,
   з ранніми поверненнями `if (!r.ok) return r`.
4. Створи `app/src/integrations/<kebab-name>.test.ts` поруч — три випадки за
   `.claude/rules/conventions.md`: успішна відправка (перевір URL і тіло),
   відсутня змінна середовища, помилка від зовнішньої системи.
5. Додай **один рядок** імпорту і елемент масиву в `app/src/integrations/index.ts`.
6. Якщо сервіс — месенджер або чат, у тіло повідомлення йдуть лише `name`,
   `source`, `budgetUsd`. `email` і `phone` — тільки в системи обліку.
7. Перевір: `cd app && npm test && npm run typecheck && npm run check:rules`.

## Acceptance criteria

- [ ] Створено рівно два файли в `app/src/integrations/` + змінено `index.ts`. Більше нічого.
- [ ] `npm test` зелений, нових тестів — 3; `npm run typecheck` чистий.
- [ ] `npm run check:rules` → `TOTAL` не зріс (лишився 8), `core-untouched 0`.
- [ ] `git diff app/package.json` порожній — нових залежностей немає.
- [ ] У модулі немає `fetch`, `process.env`, `JSON.parse`, `console.*`, `any`.
- [ ] Показано підсумок: створені файли, рядок реєстру, потрібні змінні середовища, числа перевірок.

## Stop

- `app/src/core/**` не чіпати. Бракує експорту в ядрі — зупинись за
  `.claude/rules/do-not-touch.md` і опиши, чого бракує.
- Нових залежностей не додавати: потрібна бібліотека — спитай, не встановлюй.
- Не змінюй існуючі інтеграції й `sync/`. Не «заодно» рефактор `sheets-append.ts`.
- Після створення покажи підсумок і зупинись — не переходь до наступних сервісів
  і не розширюй задачу.
