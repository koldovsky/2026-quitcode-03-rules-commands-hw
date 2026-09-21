# AGENTS.md

## Проєкт

`lead-sync` — воркер для клієнта Studio Nova, перенесений з n8n-воркфлоу.
Кожні 5 хвилин бере нові заявки з форми сайту й розсилає їх в інтеграції
(Slack, Google-таблиця, CRM, месенджери). TypeScript, Node 22+, тести на
Vitest. Проєкт і дані синтетичні (домени `*.example.test`).

## Команди

```
cd app && npm install          # встановлення
npm test                       # тести
npm run typecheck              # перевірка типів
npm run check:rules            # перевірка конвенцій
```

## Карта проєкту

- `app/src/core/**` — платформа: типи, HTTP, конфіг, парсинг, логер.
  **Захищено, не редагувати** — `.claude/rules/do-not-touch.md`.
- `app/src/integrations/**` — по одному модулю на зовнішню систему + реєстр
  `index.ts`.
- `app/src/sync/**` — запуск синхронізації і стан між запусками.

## Ключові правила

1. Напрям залежностей — лише `integrations/` і `sync/` → `core/`; нова
   інтеграція = новий файл + тест + рядок реєстрації, нічого більше —
   `.claude/rules/architecture.md`.
2. Публічний API ядра фіксований (`postJson`, `readEnv`, `parseJson`, `log`
   та типи з `core/types.ts`) — іншого не існує — `.claude/rules/architecture.md`.
3. Помилки — значення (`Result<T>`), без винятків назовні —
   `.claude/rules/conventions.md`.
4. Вихідний HTTP лише через `postJson()`, env лише через `readEnv()`, JSON
   лише через `parseJson()` з guard, журнал лише через `log` —
   `.claude/rules/conventions.md`.
5. Без `any`, без нових залежностей — `.claude/rules/conventions.md`.
6. У сповіщення (Slack, месенджери) не передавати email і телефон ліда —
   `.claude/rules/conventions.md`.
7. `app/src/core/**`, `app/scripts/**`, `materials/**`, `.coderabbit.yaml`,
   `.github/**` не редагувати; якщо задача без цього не виконується —
   зупинись і опиши, що саме треба змінити — `.claude/rules/do-not-touch.md`.

## Перед комітом

```
cd app && npm test && npm run typecheck && npm run check:rules
```

Усі три мають пройти без помилок і без нових попереджень у `check:rules`.