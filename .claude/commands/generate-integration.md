---
description: Нова інтеграція за архітектурою проєкту — модуль, тест, рядок у реєстрі; core і залежності не чіпає
argument-hint: <назва сервісу>
---

# generate-integration

**Ціль:** $ARGUMENTS
(Якщо в рядку вище немає конкретної назви сервісу — ціль вказана в
повідомленні одразу після назви команди. Немає й там — спитай і зупинись.)

## Кроки

1. Прочитай `.claude/rules/architecture.md` і одну наявну інтеграцію як
   зразок (`app/src/integrations/slack-notify.ts` + `.test.ts`).
2. Створи `app/src/integrations/<kebab-name-сервісу>.ts`, що реалізує контракт
   `Integration` з `core/types.ts`, використовуючи лише публічний API `core/`
   (`postJson`, `readEnv`, `parseJson`, `log`) — без `any`, без нових
   залежностей. Поле `name` збігається з іменем файлу.
3. Створи поруч `<kebab-name-сервісу>.test.ts` за конвенцією
   `materials/architecture-brief.md`: успішна відправка (перевірка URL і
   тіла), відсутня змінна середовища, помилка від зовнішньої системи; мережа —
   лише через `vi.stubGlobal("fetch", ...)`.
4. Додай рівно один рядок реєстрації в `app/src/integrations/index.ts`.
5. Запусти `cd app && npm test && npm run check:rules` і покажи підсумок.

## Acceptance criteria

- [ ] Змінено/створено рівно три файли: новий модуль, новий тест, один новий
      рядок у `integrations/index.ts`.
- [ ] Жодних змін у `app/src/core/**`, `app/src/sync/**`, `app/scripts/**`,
      `materials/**`.
- [ ] `package.json` без нових залежностей.
- [ ] `npm test` зелений; `npm run check:rules` — 0 нових порушень для нового
      файлу.

## Stop

Покажи підсумок: які файли створено/змінено, результат `npm test` і
`check:rules`. Якщо сервіс неможливо інтегрувати без нової залежності або
зміни `core/` (наприклад, потрібен OAuth-флоу, якого немає в `postJson`) —
зупинись і опиши, що саме потрібно, замість `npm install` чи правки `core/`.
