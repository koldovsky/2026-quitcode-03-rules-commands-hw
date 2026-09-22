# AGENTS.md — lead-sync

Воркер `lead-sync` (тека `app/`) розсилає нові заявки з форми сайту клієнта
Studio Nova в зовнішні системи: Slack-канал менеджерів, Google-таблицю, далі CRM
і месенджери. Перенесений з n8n-воркфлоу: TypeScript, Node 22+, Vitest, **нуль
runtime-залежностей**. Частина коду ще спадкова й конвенціям не відповідає —
базова лінія `check:rules` — **8 порушень**.

## Команди

```bash
cd app
npm install
npm test            # Vitest, база: 18 тестів зелені
npm run typecheck   # tsc --noEmit
npm run check:rules # статична перевірка конвенцій, база: TOTAL: 8 violation(s)
```

## Карта коду

| Тека | Що це |
|---|---|
| `app/src/core/` | Платформа: `types.ts`, `http.ts`, `config.ts`, `parse.ts`, `log.ts`. **Захищена зона — не редагувати** |
| `app/src/integrations/` | По модулю на зовнішню систему + реєстр `index.ts` |
| `app/src/sync/` | Запуск синхронізації (`run.ts`) і стан між запусками (`state.ts`) |
| `app/scripts/` | Перевірка правил. Захищена зона |
| `materials/` | Архітектурна записка, логи, завдання. Захищена зона |

## Головне

- `app/src/core/**`, `app/scripts/**`, `materials/**`, `.coderabbit.yaml`, `.github/**`
  не редагуються. Не робиться без цього — зупинись і опиши, що потрібно → [do-not-touch](.claude/rules/do-not-touch.md).
- Напрям залежностей: `integrations/` і `sync/` → `core/`; назад і між собою — ні → [architecture](.claude/rules/architecture.md).
- Нова інтеграція — рівно три зміни: модуль, тест поруч, один рядок у `integrations/index.ts`.
- Публічний API ядра — рівно `postJson`, `readEnv`, `parseJson` (+ guards), `log`,
  `redact`, типи `Lead` / `Result` / `Integration`. Іншого не існує.
- Помилки — значення: `Result<T>`, не винятки; `send()` повертає `Promise<Result<void>>`.
- Тільки через ядро: HTTP — `postJson()`, env — `readEnv()`, JSON — `parseJson(text, guard)`,
  журнал — `log`. Без `any`, без нових залежностей → [conventions](.claude/rules/conventions.md).
- У сповіщення (Slack, месенджери) не передаємо `email` і `phone` ліда.
- Спадковий код переписуємо без зміни поведінки, яку фіксують тести.

Деталі, приклади й «як перевірити» — у правилах за посиланнями вище; тут їх не дублюємо.

## Перед комітом

```bash
cd app && npm test && npm run typecheck && npm run check:rules
```

Зелені тести; `check:rules` — не більше базових 8 порушень і `core-untouched: 0`;
`git status --short` без змін у захищених теках.
