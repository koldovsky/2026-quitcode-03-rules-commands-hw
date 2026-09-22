# AGENTS.md — lead-sync

`lead-sync` — воркер, який агенція перенесла з n8n-воркфлоу для клієнта Studio Nova.
Кожні 5 хвилин бере нові заявки з форми сайту й розсилає їх в інтеграції: Slack
менеджерів, Google-таблицю, далі CRM і месенджери. TypeScript, Node 22+, Vitest,
нуль runtime-залежностей.

## Команди

Усе з теки `app/`:

| Команда | Для чого |
|---|---|
| `npm install` | встановити залежності (тільки dev) |
| `npm test` | Vitest, один прогін — зараз 22 тести |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:rules` | статична перевірка конвенцій — зараз `TOTAL: 1` |

## Карта коду

| Тека | Що це |
|---|---|
| `app/src/core/` | платформа: `types.ts`, `http.ts`, `config.ts`, `parse.ts`, `log.ts` — **захищена зона, не редагується** |
| `app/src/integrations/` | по модулю на зовнішню систему + реєстр `index.ts` |
| `app/src/sync/` | запуск синхронізації і стан між запусками |
| `app/scripts/` | `check-rules.mjs` і `core.lock.json` — **не редагуються** |
| `materials/` | архітектурна записка, лог інциденту, A/B-запит — **не редагуються** |

Напрям залежностей односторонній: `sync/` → `integrations/` → `core/`.

## Головні правила

1. `app/src/core/**`, `app/scripts/**`, `materials/**`, `.coderabbit.yaml`, `.github/**` не редагуються — якщо задача без цього не робиться, зупинись і опиши потребу.
2. Помилки — це значення: `Result<T>` з `core/types.ts`, а не `throw`.
3. HTTP — лише `postJson()` з `core/http.ts`; прямого `fetch` і нових HTTP-клієнтів немає.
4. Змінні середовища — лише `readEnv()` з `core/config.ts`; `process.env` поза ядром не читаємо.
5. Зовнішній JSON — лише `parseJson(text, guard)` з `core/parse.ts`; тихих значень за замовчуванням немає.
6. Журнал — лише `log` з `core/log.ts` (маскує токени); без `console.*`. Без `any`, без нових залежностей.
7. У сповіщення не йдуть `email` і `phone` ліда — лише `name`, `source`, `budgetUsd`.

Деталі, приклади й перевірки — у правилах проєкту, не тут:
[`.claude/rules/architecture.md`](.claude/rules/architecture.md),
[`.claude/rules/conventions.md`](.claude/rules/conventions.md),
[`.claude/rules/do-not-touch.md`](.claude/rules/do-not-touch.md).

## Перед комітом

```bash
cd app && npm test && npm run typecheck && npm run check:rules
```

Зелені тести; `check:rules` не вище поточного `TOTAL: 1`, рядок
`core-untouched` дорівнює `0`; `git status --short` не показує жодного шляху
із захищених зон.
