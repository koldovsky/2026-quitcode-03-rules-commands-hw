# AGENTS.md — lead-sync

Воркер агенції, перенесений з n8n: кожні 5 хвилин розсилає нові ліди клієнта
Studio Nova в інтеграції (Slack, Google Sheets). TypeScript, Node 22+, Vitest,
нуль runtime-залежностей. Дані в репо синтетичні.

## Команди (з теки `app/`)

- `npm install` — встановлення
- `npm test` — тести (Vitest)
- `npm run typecheck` — перевірка типів
- `npm run check:rules` — статична перевірка правил проєкту

## Карта

- `app/src/core/` — платформне ядро: типи, HTTP, конфіг, парсинг, логер. **Захищене.**
- `app/src/integrations/` — один модуль на зовнішню систему + реєстр `index.ts`
- `app/src/sync/` — запуск синхронізації (`run.ts`) і стан між запусками (`state.ts`)
- `materials/architecture-brief.md` — архітектурна записка, джерело істини

## Головне

1. Не змінювати `app/src/core/**`, `app/scripts/**`, `materials/**`, `.coderabbit.yaml`, `.github/**`. Без винятків: якщо без цього ніяк — зупинитись і спитати; дозвіл — лише явний, з назвою файлу. → [do-not-touch](.claude/rules/do-not-touch.md)
2. Нова інтеграція = модуль + тест поруч + рядок у `integrations/index.ts`. → [architecture](.claude/rules/architecture.md)
3. HTTP — `postJson`, змінні — `readEnv`, JSON — `parseJson` з guard, журнал — `log`. → [conventions](.claude/rules/conventions.md)
4. Помилки — `Result`, а не винятки. Зіпсовані дані — помилка, а не тихий дефолт. → [conventions](.claude/rules/conventions.md)
5. Без `any` і без нових залежностей. → [conventions](.claude/rules/conventions.md)
6. У сповіщеннях — без email і телефону ліда. → [conventions](.claude/rules/conventions.md)

Посилання ведуть на детальні правила Claude Code: `do-not-touch` завантажується завжди,
`architecture` і `conventions` — коли агент читає файли в `app/src/`.

## Перед комітом

`cd app && npm test && npm run typecheck && npm run check:rules` — тести й типи
зелені, нових порушень немає.
