---
description: Створює нову інтеграцію за архітектурою проєкту: модуль, тест поруч, рядок у реєстрі. Core не чіпає.
argument-hint: <назва сервісу, напр. hubspot або telegram>
---

# Generate integration

**Ціль:** $ARGUMENTS
(Якщо в рядку вище немає назви сервісу — вона вказана в повідомленні одразу після
назви команди. Немає й там — спитай і зупинись.)

## Кроки

1. Прочитай `app/src/integrations/slack-notify.ts` і його тест — це зразок
   правильної інтеграції. Прочитай `app/src/integrations/index.ts`.
2. Визнач ім'я в kebab-case (`<service>-<дія>`, напр. `telegram-notify`).
   Ім'я файлу, поле `name` і назва тесту мають збігатися.
3. Створи **рівно три зміни** — як у `.claude/rules/architecture.md`:
   - `app/src/integrations/<kebab-name>.ts`;
   - `app/src/integrations/<kebab-name>.test.ts`;
   - один рядок у масиві `integrations` у `app/src/integrations/index.ts`.
4. Модуль пиши за `.claude/rules/conventions.md`. Зокрема: `readEnv` для кожної
   змінної з `requiredEnv`, `postJson` для запиту, `parseJson` з guard для
   відповіді, `log` для журналу, `Result<void>` назовні.
5. **Вирішуй свідомо, які поля ліда відправляєш.** Це сповіщення чи система
   обліку? Для сповіщення — лише `name`, `source`, `budgetUsd`; `email` і `phone`
   не надсилаються. Напиши в підсумку одним рядком, до якого типу ти зарахував
   сервіс і чому.
6. Тест мінімум на три випадки: успіх (перевір URL **і** тіло запиту), відсутня
   змінна середовища, помилка від зовнішньої системи. Мережу підміняй
   `vi.stubGlobal("fetch", …)`, змінні — `vi.stubEnv(…)`.
7. Перевір: `cd app && npm test && npm run typecheck && npm run check:rules`.

## Acceptance criteria

- [ ] Створено рівно три шляхи, і `git status --short` не показує нічого зайвого.
- [ ] `npm test` зелений; нових тестів — щонайменше три.
- [ ] `npm run typecheck` зелений; `check:rules` TOTAL **не виріс**.
- [ ] Модуль не містить `fetch`, `process.env`, `JSON.parse`, `console.*`, `any`.
- [ ] Нових пакетів у `package.json` немає.
- [ ] Якщо це сповіщення — у тілі запиту немає `lead.email` і `lead.phone`;
      тест це перевіряє явним твердженням.
- [ ] `app/src/core/**` не змінено.

## Stop

Потрібна можливість, якої немає в публічному API ядра, — **не додавай її в core**
і не розширюй типи ядра. Зупинись, опиши, чого бракує, і запропонуй рішення в
межах модуля. Так само зупинись, якщо для сервісу потрібен не-JSON протокол
(multipart, gRPC) — `postJson` його не покриває.

У підсумку: три створені шляхи, тип сервісу (сповіщення / облік), які поля ліда
відправляються, вивід `npm test` і `check:rules`.
