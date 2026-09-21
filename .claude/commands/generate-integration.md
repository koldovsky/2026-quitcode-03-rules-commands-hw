---
description: Створює нову інтеграцію за архітектурою проєкту: модуль, тест поруч, один рядок у реєстрі. Core не чіпає, залежностей не додає.
argument-hint: <назва сервісу, напр. telegram-notify>
---

# generate-integration

**Ціль:** $ARGUMENTS
(Якщо в рядку вище немає назви сервісу — ціль вказана в повідомленні одразу після
назви команди. Немає й там — спитай і зупинись.)

## Кроки

1. Прочитай `app/src/integrations/slack-notify.ts` і його тест — це еталон.
   Прочитай `app/src/core/types.ts`, щоб узяти контракт `Integration`.
2. Переведи назву сервісу в `kebab-case`; поле `name` має збігатися з іменем файлу.
3. Створи рівно три зміни (`.claude/rules/architecture.md`):
   - `app/src/integrations/<kebab-name>.ts` — модуль, що реалізує `Integration`;
   - `app/src/integrations/<kebab-name>.test.ts` — тест поруч;
   - один рядок у `app/src/integrations/index.ts`.
4. Модуль пиши за `.claude/rules/conventions.md`: `readEnv()` для змінних,
   `postJson()` для HTTP, `parseJson()` з guard для відповіді, `log` для журналу,
   `Result<void>` як результат, без `any`.
5. Якщо сервіс — месенджер або чат, у повідомлення не потрапляють email і телефон
   ліда (мінімізація даних).
6. Тест покриває три випадки: успішна відправка (перевір URL і тіло запиту),
   відсутня змінна середовища, помилка від зовнішньої системи. Мережі в тестах
   немає: `vi.stubGlobal("fetch", ...)` і `vi.stubEnv`.
7. Запусти `cd app && npm test && npm run typecheck && npm run check:rules`.

## Acceptance criteria

- [ ] Створено рівно два файли + один рядок у `index.ts`; інших змін немає.
- [ ] Модуль типізований як `Integration`; `name` збігається з іменем файлу.
- [ ] Жодного `fetch`, `process.env`, `JSON.parse`, `console.*` чи `any` у новому коді.
- [ ] Три тести проходять; `npm run check:rules` не додав порушень до `TOTAL`.
- [ ] `package.json` не змінено — нових залежностей немає.

## Stop

Не редагуй `app/src/core/**` і не додавай залежностей. Не змінюй `sync/` — реєстру
достатньо. Наприкінці покажи підсумок: створені файли, рядок реєстру, назви змінних
середовища, які треба задати, і числа `npm test` / `check:rules`.
