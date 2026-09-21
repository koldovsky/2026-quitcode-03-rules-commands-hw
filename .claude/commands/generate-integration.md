---
description: Нова інтеграція за архітектурою проєкту: модуль + тест + рядок у реєстрі. Core не чіпає, залежностей не додає
argument-hint: <назва сервісу, напр. telegram-notify або "Telegram">
---

# Нова інтеграція

**Ціль:** $ARGUMENTS
(Якщо в рядку вище немає назви сервісу — ціль вказана в повідомленні одразу
після назви команди. Немає й там — спитай і зупинись.)

## Кроки

1. Прочитай `app/src/core/types.ts` (контракт `Integration`),
   `app/src/integrations/index.ts` (реєстр) і `app/src/integrations/slack-notify.ts`
   з тестом — це еталон форми для нової інтеграції.
2. Визнач `kebab-name` сервісу. Поле `name` в об'єкті = ім'я файлу без
   розширення (`.claude/rules/conventions.md` §9).
3. Створи **рівно два нові файли** й зміни **один рядок** у реєстрі
   (`.claude/rules/architecture.md`):
   - `app/src/integrations/<kebab-name>.ts` — об'єкт типу `Integration`;
   - `app/src/integrations/<kebab-name>.test.ts` — тест;
   - `app/src/integrations/index.ts` — сервіс у масиві `integrations`.
4. Модуль пиши за `.claude/rules/conventions.md`: `readEnv` для змінних,
   `postJson` для HTTP, `parseJson` з guard для відповіді, `log` для журналу,
   `Result<void>` як результат `send()`, без `any`, без нових залежностей.
5. **Якщо це месенджер** (Telegram, Viber, WhatsApp, Slack, SMS) — у тіло
   повідомлення йдуть лише `name`, `source`, `budgetUsd`.
   `lead.email` і `lead.phone` не передаються (`conventions.md` §8).
   Якщо сервіс — система обліку (CRM, таблиця), повні дані допустимі.
6. Тест покриває три випадки: успішна відправка (перевірити **URL і тіло**
   запиту), відсутня змінна середовища, помилка від зовнішньої системи.
   Мережі немає: `vi.stubGlobal("fetch", ...)`, `vi.stubEnv`.
7. Перевір і покажи підсумок:
   ```bash
   cd app && npm test && npm run typecheck && npm run check:rules
   git status --short
   ```

## Acceptance criteria

- [ ] Рівно 3 зміни в `git status --short`: два нові файли + `integrations/index.ts`.
- [ ] `npm test` зелений, нових тестів ≥ 3; `npm run typecheck` без помилок.
- [ ] `check:rules`: TOTAL **не виріс** відносно значення до запуску.
- [ ] `send()` повертає `Result<void>` і не кидає винятків назовні.
- [ ] Жодного `fetch(`, `process.env`, `JSON.parse(`, `console.`, `any` у новому коді.
- [ ] Для месенджера: `grep -n "email\|phone" app/src/integrations/<kebab-name>.ts`
      не знаходить їх у тілі повідомлення.
- [ ] `name` інтеграції збігається з іменем файлу.

## Stop

- `app/src/core/**` не чіпаємо. Якщо для інтеграції бракує поля в `Lead` або
  хелпера в ядрі — зупинись і оформи за `.claude/rules/do-not-touch.md`.
- Нових залежностей не додаємо: потрібна бібліотека — питання в PR.
- Перед комітом покажи підсумок: які файли створено, які числа дали перевірки,
  що саме йде в тілі запиту до сервісу.
