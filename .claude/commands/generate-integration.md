---
description: Створює нову інтеграцію (модуль + тест + рядок реєстру) за архітектурою проєкту
argument-hint: <назва сервісу, напр. Telegram, HubSpot, Monobank>
---

# generate-integration

**Ціль:** $ARGUMENTS
(Якщо в рядку вище немає конкретної назви сервісу — ціль вказана в
повідомленні одразу після назви команди. Немає й там — спитай і зупинись.)

## Кроки

1. Прочитай `.claude/rules/architecture.md` (контракт `Integration`,
   публічний API ядра, реєстр) — посилайся на нього, не копіюй сюди.
2. Візьми `app/src/integrations/slack-notify.ts` як зразок стилю (діюча,
   конвенційна інтеграція) — не `sheets-append.ts` (спадщина, ще не
   відповідає конвенціям).
3. Створи рівно три зміни:
   - `app/src/integrations/<kebab-назва-сервісу>.ts` — реалізує
     `Integration` через `postJson`/`readEnv`/`parseJson`+guard/`log`;
   - `app/src/integrations/<kebab-назва-сервісу>.test.ts` поруч — успішна
     відправка (URL і тіло запиту), відсутня змінна середовища, помилка від
     зовнішньої системи (`materials/architecture-brief.md`, розділ «Тести»);
   - один новий рядок у `app/src/integrations/index.ts`.
4. Прогони `cd app && npm test` і `npm run check:rules`.

## Acceptance criteria

- [ ] Змінено рівно ці 3 файли, більше нічого.
- [ ] `npm test` зелений; `npm run check:rules` — 0 нових порушень для
      нового файлу.
- [ ] Жодної нової залежності.
- [ ] У сповіщення не передаються email і телефон ліда (лише ім'я, джерело,
      бюджет) — `.claude/rules/conventions.md`.

## Stop

`app/src/core/**` не чіпати. Нових залежностей не додавати. Наприкінці
показати підсумок: які файли створено і що показали тести/check:rules.
