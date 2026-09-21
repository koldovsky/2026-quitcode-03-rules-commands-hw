# AGENTS.md — lead-sync

`lead-sync` — воркер, який агенція перенесла з n8n-воркфлоу для клієнта Studio Nova.
Кожні 5 хвилин бере нові заявки з форми сайту й розсилає їх в інтеграції: Slack-канал
менеджерів, Google-таблицю, далі — CRM і месенджери. TypeScript, Node 22+, Vitest,
нуль runtime-залежностей.

## Команди

Усі — з теки `app/`:

| Команда | Навіщо |
|---|---|
| `npm install` | встановлення (лише devDependencies) |
| `npm test` | Vitest, без мережі. Базова лінія — 18 тестів зелені |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:rules` | статична перевірка конвенцій. Базова лінія спадкового коду — `TOTAL: 8` |

## Карта проєкту

| Шлях | Що це |
|---|---|
| `app/src/core/` | платформа: `types`, `http`, `config`, `parse`, `log`. **Захищено — не редагувати** |
| `app/src/integrations/` | по модулю на зовнішню систему + реєстр `index.ts` |
| `app/src/sync/` | запуск синхронізації (`run.ts`) і стан між запусками (`state.ts`) |
| `app/scripts/` | перевірка правил. **Захищено** |
| `materials/` | архітектурна записка, лог інциденту, A/B-запит. **Захищено** |

Напрям залежностей: `sync/` → `integrations/` → `core/`. Назад — ніколи.

## Головні правила

1. `app/src/core/**`, `app/scripts/**`, `materials/**`, `.coderabbit.yaml`, `.github/**`
   не редагуються. Задача цього потребує — зупинись і опиши, що саме треба в core.
2. Помилки — це значення: `Result<T>`, а не `throw`. Мовчазний fallback у `catch` заборонено.
3. HTTP — лише `postJson()`; змінні середовища — лише `readEnv()`; JSON — лише
   `parseJson(text, guard)`; журнал — лише `log`. Усе з `core/`.
4. Без `any` (бери `unknown` + guard) і без нових залежностей.
5. Публічний API ядра фіксований — вигадувати неіснуючі експорти не можна.
6. Нова інтеграція = модуль + тест поруч + один рядок у `integrations/index.ts`.
7. У сповіщення не потрапляють `email` і `phone` ліда — лише ім'я, джерело, бюджет.

Деталі, приклади й «як перевірити» — у `.claude/rules/`:
[`architecture.md`](.claude/rules/architecture.md),
[`conventions.md`](.claude/rules/conventions.md),
[`do-not-touch.md`](.claude/rules/do-not-touch.md).
Тут — лише короткий список; правила не дублюються дослівно.

## Перед комітом

```bash
cd app && npm test && npm run typecheck && npm run check:rules
```

Зелені тести, чистий typecheck, `check:rules` не більше за базову лінію (`TOTAL: 8`)
і `core-untouched 0`. Далі `git status --short` — у списку немає захищених шляхів.
