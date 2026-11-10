# AGENTS.md — lead-sync

`lead-sync` — воркер агенції для клієнта Studio Nova, перенесений з n8n: кожні
5 хвилин бере нові заявки з форми сайту й розсилає їх в інтеграції (Slack, Google
Sheets, далі — CRM і месенджери). TypeScript, Node 22+, Vitest, нуль runtime-залежностей.
Дані в репо синтетичні (`*.example.test`, ключі з префіксом `fake`).

## Команди (з теки `app/`)

| Що | Команда |
|---|---|
| Встановлення | `npm install` |
| Тести | `npm test` |
| Типи | `npm run typecheck` |
| Правила проєкту | `npm run check:rules` (базова лінія — `TOTAL: 8`, спадковий код) |

## Карта

```
app/src/
  core/          ЗАХИЩЕНО — платформа: типи, HTTP, конфіг, парсинг, логер
  integrations/  один модуль на зовнішню систему + реєстр index.ts
  sync/          запуск синхронізації (run.ts) і стан між запусками (state.ts)
app/scripts/     ЗАХИЩЕНО — перевірка правил і core.lock.json
materials/       ЗАХИЩЕНО — архітектурна записка, логи, завдання
```

## Головні правила

1. `app/src/core/**`, `app/scripts/**`, `materials/**`, `.coderabbit.yaml`, `.github/**` не змінюємо; задача потребує змін у core — зупинись і опиши, що треба → `.claude/rules/do-not-touch.md`.
2. Залежності: `integrations/` і `sync/` → `core/`; нова система = модуль + тест + рядок у `integrations/index.ts` → `.claude/rules/architecture.md`.
3. Публічний API ядра — лише `Lead`, `Result`, `Integration`, `postJson`, `readEnv`, `parseJson` + guard-и, `log`/`redact` → `.claude/rules/architecture.md`.
4. Помилки — `Result<T>`, не винятки; HTTP — `postJson`, env — `readEnv`, JSON — `parseJson` з guard, журнал — `log` → `.claude/rules/conventions.md`.
5. Без `any` і без нових залежностей → `.claude/rules/conventions.md`.
6. У сповіщеннях — без email і телефону ліда → `.claude/rules/conventions.md`.
7. Тест поруч із модулем, без реальної мережі (`vi.stubGlobal("fetch")`, `vi.stubEnv`) → `.claude/rules/conventions.md`.

Детальні правила — у `.claude/rules/` (Claude Code підтягує їх сам).
Джерело істини для них — `materials/architecture-brief.md`.

## Перед комітом

```bash
cd app && npm test && npm run typecheck && npm run check:rules
git status --short -- app/src/core app/scripts materials   # має бути порожньо
```

`check:rules`: у змінених файлах — жодного нового порушення, `core-untouched` — `0`.

## Команди агента

`/analyze-error <лог>`, `/refactor <файл>`, `/generate-integration <сервіс>` —
`.claude/commands/`.
