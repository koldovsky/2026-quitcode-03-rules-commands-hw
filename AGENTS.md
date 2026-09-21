# AGENTS.md

`lead-sync` — воркер, перенесений з n8n-воркфлоу для клієнта Studio Nova.
Кожні 5 хвилин бере нові заявки з форми сайту й розсилає їх у Slack-канал
менеджерів і Google-таблицю. TypeScript, Node 22+, Vitest, нуль
runtime-залежностей.

## Команди

- Встановлення: `cd app && npm install`
- Тести: `npm test`
- Типи: `npm run typecheck`
- Перевірка правил проєкту: `npm run check:rules`

## Карта

- `app/src/core/` — платформне ядро, **захищена зона** (не редагується)
- `app/src/integrations/` — по одному модулю на зовнішню систему + реєстр
  `index.ts`
- `app/src/sync/` — запуск синхронізації і стан між запусками

## Найважливіші правила

- Помилки — значення (`Result<T>`), не винятки; HTTP/env/JSON/журнал —
  лише через `core` — див. `.claude/rules/conventions.md`
- Без `any` і без нових залежностей — див. `.claude/rules/conventions.md`
- У сповіщення не передавати email і телефон ліда — див.
  `.claude/rules/conventions.md`
- Нова інтеграція = новий файл + тест поруч + один рядок у
  `integrations/index.ts`, нічого більше — див. `.claude/rules/architecture.md`
- Публічний API ядра фіксований, нового не вигадувати — див.
  `.claude/rules/architecture.md`
- `app/src/core/**`, `app/scripts/**`, `materials/**` не редагуються; якщо
  задача це вимагає — зупинись і опиши, що саме треба змінити — див.
  `.claude/rules/do-not-touch.md`

## Перед комітом

`cd app && npm test && npm run typecheck && npm run check:rules` — усе
має пройти без нових падінь.
