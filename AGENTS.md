# AGENTS.md — lead-sync

`lead-sync` — воркер, перенесений з n8n-воркфлоу для клієнта Studio Nova. Кожні
5 хвилин бере нові заявки з форми сайту й розсилає їх в інтеграції: Slack-канал
менеджерів і Google-таблицю, далі — CRM і месенджери. TypeScript, Node 22+,
Vitest, **нуль runtime-залежностей**.

## Команди

Усі — з теки `app/`:

| Команда | Для чого |
|---|---|
| `npm install` | встановлення (лише devDependencies) |
| `npm test` | Vitest, без реальної мережі |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:rules` | статична перевірка конвенцій проєкту |

Базова лінія: **18 тестів зелені**, `check:rules` → `TOTAL: 8` (спадковий код із n8n).
Нових порушень бути не повинно.

## Карта коду

```
app/src/
  core/          платформа: типи, HTTP, конфіг, парсинг, логер — ЗАХИЩЕНО
  integrations/  по модулю на зовнішню систему + реєстр index.ts
  sync/          запуск синхронізації і стан між запусками
```

Джерело істини для домовленостей — `materials/architecture-brief.md`.
Детальні правила — у `.claude/rules/`.

## Головні правила

1. `app/src/core/**`, `app/scripts/**`, `materials/**`, `.coderabbit.yaml`,
   `.github/**` не редагуються — винятків немає → `.claude/rules/do-not-touch.md`.
2. Задача не робиться без зміни core → зупинись і опиши потребу людині, не пиши код
   → `.claude/rules/do-not-touch.md`.
3. Напрям залежностей односторонній: `integrations/` і `sync/` → `core/`, не навпаки;
   `sync/` знає про інтеграції лише через `Integration` та `index.ts`
   → `.claude/rules/architecture.md`.
4. Публічний API ядра — рівно `postJson`, `readEnv`, `parseJson` + guards, `log`,
   `Lead` / `Result` / `Integration`; іншого не існує
   → `.claude/rules/architecture.md`.
5. Нова інтеграція — це рівно три зміни: модуль, тест поруч, один рядок у реєстрі
   → `.claude/rules/architecture.md`.
6. Помилки — значення (`Result<T>`), без `any`, без нових залежностей, журнал лише
   через `log` → `.claude/rules/conventions.md`.
7. У Slack і месенджери — лише ім'я, джерело й бюджет: без email і телефону ліда
   → `.claude/rules/conventions.md`.

## Перед комітом

```bash
cd app && npm test && npm run typecheck && npm run check:rules
```

Тести зелені, `TOTAL` не виріс, `core-untouched` дорівнює `0`, а `git status --short`
не показує файлів із захищених зон.
