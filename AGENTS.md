# AGENTS.md — lead-sync

`lead-sync` — воркер, який агенція перенесла з n8n-воркфлоу для клієнта Studio Nova.
Кожні 5 хвилин він забирає нові заявки з форми сайту й розсилає їх в інтеграції:
Slack-канал менеджерів і Google-таблицю, далі — CRM і месенджери. TypeScript,
Node 22+, Vitest, нуль runtime-залежностей. Дані в репозиторії синтетичні.

## Команди

Усі — з теки `app/`:

| Команда | Для чого |
|---|---|
| `npm install` | встановлення, перший запуск |
| `npm test` | Vitest; базова лінія — 39 тестів зелені |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:rules` | статична перевірка конвенцій; базова лінія — `TOTAL: 0` |
| `npm run check:rules -- --strict` | те саме з ненульовим кодом виходу — для CI і хуків |

## Карта коду

| Шлях | Що там | Режим |
|---|---|---|
| `app/src/core/` | платформа: `types`, `http`, `config`, `parse`, `log` | захищено, не редагується |
| `app/src/integrations/` | по модулю на зовнішню систему + реєстр `index.ts` | звичайна робота |
| `app/src/sync/` | прогін синхронізації і стан між запусками | звичайна робота |
| `app/scripts/`, `materials/`, `.github/`, `.coderabbit.yaml` | інструменти перевірки й умови задачі | захищено |

Напрям залежностей односторонній: `integrations/` і `sync/` імпортують з `core/`,
і ніколи навпаки.

## Ключові правила

Повні формулювання — у `.claude/rules/`. Тут лише перелік, щоб нічого не загубилось:

1. Захищені шляхи не редагуються, обхід прирівняний до прямої зміни → [do-not-touch](.claude/rules/do-not-touch.md)
2. Помилки — це значення: `Result<T>` замість винятків → [conventions](.claude/rules/conventions.md)
3. HTTP лише через `postJson()`, змінні середовища лише через `readEnv()` → [conventions](.claude/rules/conventions.md)
4. Будь-який JSON лише через `parseJson(text, guard)`; тихий фолбек на «значення за
   замовчуванням» заборонений → [conventions](.claude/rules/conventions.md)
5. Журнал лише через `log` (маскує секрети); без `any`; без нових залежностей → [conventions](.claude/rules/conventions.md)
6. У сповіщення не передаються email і телефон ліда → [conventions](.claude/rules/conventions.md)
7. Нова інтеграція — це модуль, тест поруч і рядок у реєстрі, більше нічого → [architecture](.claude/rules/architecture.md)

Задача, яку не зробити без зміни захищеної зони, тут не виконується: діє стоп-протокол
з [do-not-touch](.claude/rules/do-not-touch.md) — зупинись і опиши, що саме потрібно змінити і навіщо.

## Перед комітом

```bash
cd app && npm test && npm run typecheck && npm run check:rules
```

Очікується: 39 тестів зелені, typecheck без помилок, `TOTAL: 0`,
`core-untouched 0`. У `git status --short` немає жодного із захищених шляхів.
