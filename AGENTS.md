# AGENTS.md

## Проєкт

`lead-sync` — воркер, перенесений з n8n для клієнта Studio Nova: кожні 5 хвилин
бере нові заявки з форми сайту й розсилає їх в інтеграції (Slack, Google-таблиця,
далі — CRM і месенджери). TypeScript, Node 22+, Vitest, нуль runtime-залежностей.
Усі дані синтетичні (`*.example.test`, ключі з префіксом `fake`).

## Команди (з теки `app/`)

- `npm install` — встановлення
- `npm test` — тести (Vitest)
- `npm run typecheck` — перевірка типів
- `npm run check:rules` — статична перевірка правил; базова лінія — `TOTAL: 8`
  (спадковий код), і це число не має зростати

## Карта

- `app/src/core/` — платформа: типи, HTTP, конфіг, парсинг, логер. **Захищено.**
- `app/src/integrations/` — один модуль на зовнішню систему + реєстр `index.ts`
- `app/src/sync/` — запуск синхронізації і стан між запусками
- `materials/` — архітектурна записка (джерело істини), лог інциденту, A/B-запит. Лише читання.
- `docs/` — інструкція, шаблони, звіти

## Головні правила

Деталі — у `.claude/rules/`; тут лише суть.

1. Не змінюй `app/src/core/**`, `app/scripts/**`, `materials/**`, `.coderabbit.yaml`, `.github/**`; потрібна зміна — зупинись і опиши її → [do-not-touch](.claude/rules/do-not-touch.md)
2. Імпорти лише в один бік: `integrations/` і `sync/` → `core/` → [architecture](.claude/rules/architecture.md)
3. Нова інтеграція = модуль + тест поруч + рядок у `integrations/index.ts` → [architecture](.claude/rules/architecture.md)
4. API ядра — закритий список, нових функцій не вигадуй → [architecture](.claude/rules/architecture.md)
5. Помилки — `Result<T>`; HTTP / env / JSON / журнал — лише `postJson` / `readEnv` / `parseJson` + guard / `log` → [conventions](.claude/rules/conventions.md)
6. Без `any` і без нових залежностей → [conventions](.claude/rules/conventions.md)
7. У сповіщеннях — жодних email і телефонів ліда → [conventions](.claude/rules/conventions.md)

## Перед комітом

```bash
(cd app && npm test && npm run typecheck && npm run check:rules)
git status --short -- app/src/core app/scripts materials .coderabbit.yaml .github   # має бути порожньо
```

Тести зелені, typecheck без помилок, `check:rules` не більше за базову лінію.
