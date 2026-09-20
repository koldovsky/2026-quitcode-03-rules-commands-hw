# AGENTS.md — lead-sync

`lead-sync` — воркер, перенесений з n8n-воркфлоу для клієнта Studio Nova. Кожні
5 хвилин бере нові заявки з форми сайту й розсилає їх у зовнішні системи: Slack
менеджерам, Google-таблицю, далі CRM і месенджери. TypeScript, Node 22+, ESM,
Vitest, **нуль runtime-залежностей**. Дані в репо синтетичні (`*.example.test`).

## Команди

Усі — з теки `app/`:

| Команда | Що робить |
|---|---|
| `npm install` | встановлення (лише devDependencies) |
| `npm test` | Vitest, один прогін |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:rules` | статична перевірка конвенцій проєкту |
| `npm run check:rules -- --strict` | те саме, але exit 1 при будь-якому порушенні (для CI) |

Стан репо після виконання WS3: **23 тести зелені**, `check:rules` → **TOTAL: 1**
(`sync/state.ts`, `json-via-parse` — спадщина з n8n, ще не переписана).
У стартовому репозиторії було 18 тестів і TOTAL: 8.

## Карта коду

```
app/src/
  core/          ⛔ захищене: типи, HTTP, конфіг, парсинг, логер
  integrations/  по модулю на зовнішню систему + реєстр index.ts
  sync/          запуск синхронізації і стан між запусками
app/scripts/     ⛔ захищене: check-rules.mjs і core.lock.json
```

Напрям залежностей — лише `core/` ← `integrations/`, `core/` ← `sync/`.

## Правила — коротко

1. `app/src/core/**`, `app/scripts/**`, `materials/**`, `.coderabbit.yaml`, `.github/**` не редагуються — без винятків.
2. Помилки — значення: `Result<T>`, а не `throw`.
3. HTTP — лише `postJson()`; env — лише `readEnv()`; JSON — лише `parseJson()` з guard; журнал — лише `log`.
4. Без `any` і без нових пакетів.
5. У сповіщення не йдуть `email` і `phone` ліда.
6. Нова інтеграція — рівно три зміни: модуль, тест поруч, рядок у `integrations/index.ts`.
7. Спадковий код переписується без зміни поведінки, яку фіксують тести.

Розгорнуті формулювання з критеріями перевірки — у `.claude/rules/`:
[`architecture.md`](.claude/rules/architecture.md),
[`conventions.md`](.claude/rules/conventions.md),
[`do-not-touch.md`](.claude/rules/do-not-touch.md).
Обґрунтування «чому» — `materials/architecture-brief.md`.

## Перед комітом

```bash
cd app && npm test && npm run typecheck && npm run check:rules
```

Тести зелені, typecheck без помилок, TOTAL у `check:rules` не виріс,
`core-untouched` дорівнює 0.
