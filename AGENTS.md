# AGENTS.md — lead-sync

`lead-sync` — воркер, який агенція перенесла з n8n для клієнта Studio Nova: кожні
5 хвилин бере нові заявки з форми сайту й розсилає їх в інтеграції (Slack,
Google-таблиця, далі CRM і месенджери). TypeScript, Node 22+, Vitest, нуль
runtime-залежностей. Дані в репо синтетичні (`*.example.test`, ключі з префіксом `fake`).

## Команди

Усі — з теки `app/`:

| Що | Команда |
|---|---|
| Встановлення | `npm ci` |
| Тести | `npm test` |
| Типи | `npm run typecheck` |
| Правила проєкту | `npm run check:rules` |

## Карта

- `app/src/core/` — платформа: типи, HTTP, конфіг, парсинг, логер. **Захищена зона.**
- `app/src/integrations/` — по модулю на зовнішню систему + реєстр `index.ts`.
- `app/src/sync/` — запуск синхронізації й стан між запусками.
- `app/scripts/` — перевірка правил (захищено); `materials/` — архітектурна записка,
  логи (захищено); `docs/` — шаблони й звіти.

## Ключові правила

1. Не змінюй `app/src/core/**`, `app/scripts/**`, `materials/**`, `.coderabbit.yaml`, `.github/**`; якщо задача не виконується без зміни в них — зупинись і опиши, що змінити й навіщо → [do-not-touch](.claude/rules/do-not-touch.md)
2. `integrations/` і `sync/` залежать від `core/`, не навпаки; нова інтеграція = модуль + тест + запис у реєстрі → [architecture](.claude/rules/architecture.md)
3. Помилки — значення: `Result<T>`; `send()` не кидає винятків → [conventions](.claude/rules/conventions.md)
4. HTTP — `postJson`, env — `readEnv`, JSON — `parseJson` + guard, журнал — `log` → [conventions](.claude/rules/conventions.md)
5. Без `any`, без нових залежностей → [conventions](.claude/rules/conventions.md)
6. У сповіщеннях — без email і телефону ліда → [conventions](.claude/rules/conventions.md)

Джерело всіх правил — `materials/architecture-brief.md`.

## Перед комітом

З кореня репо:

```bash
git status --short -- app/src/core app/scripts materials .coderabbit.yaml .github
cd app && npm test && npm run typecheck && npm run check:rules
```

Готово, якщо: `git status` вище порожній; тести зелені; помилок типів немає;
`check:rules` — `core-untouched 0`, TOTAL не зріс і жодне порушення не вказує на твої рядки.
