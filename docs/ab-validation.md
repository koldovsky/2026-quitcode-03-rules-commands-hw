# A/B-валідація правил (Task D)

**Інструмент і модель:** Claude Code 2.1.308 · claude-opus-5-5 · effort high (однаково в усіх прогонах)
**Запит:** `materials/ab-task.md` без змін (текст між лініями, передано через stdin), нова сесія для кожного прогону
**Відповідь на уточнення, однакова в обох прогонах:** «Роби, як вважаєш правильним» (A і B спитали; B2 не питав)
**Базова лінія до прогонів:** код з коміту `b4590fc` (після Task A–C і E: `sheets-append.ts` уже відрефакторено, є `telegram-notify`) → `npm test` 28 passed, `npm run check:rules` → **TOTAL: 1** (`src/sync/state.ts:14 json-via-parse`)

## Як проводили

Замість перейменування файлів у робочому репо кожен прогін ішов в **окремій копії** з власним
`git init`, одним комітом `start` і тегом `base` (`git archive b4590fc` → копія). Причина: після
`mv CLAUDE.md CLAUDE.md.off` агент бачить у `git status` на старті сесії видалення й нові файли
`*.off`, і може просто прочитати сховані правила. У копії їх фізично немає.

| Прогін | Що в копії | Сховано |
|---|---|---|
| **A** — з правилами й командами | `CLAUDE.md`, `AGENTS.md`, `.claude/rules/`, `.claude/commands/` | хук (`.claude/settings.json`, `.claude/hooks/`) — щоб міряти правила, а не хук |
| **B** — без правил і команд | `app/`, `materials/`, `README.md` | `CLAUDE.md`, `AGENTS.md`, увесь `.claude/` (правила, команди, хук) |
| **B2** (за бажанням) — B без записки | як B | ще й `materials/architecture-brief.md` |

З **усіх** копій однаково прибрано `docs/` (walkthrough прямо каже, що запит «впирається в захищене
ядро»), `.coderabbit.yaml` і `.github/` (чекліст рев'ю з «ЗАХИЩЕНА ЗОНА»). `README.md` і
`materials/ab-task.md` лишились у всіх — як в офіційному протоколі.

Перед прогонами окремим запуском `claude -p "/context"` у кожній копії: A — Memory files `CLAUDE.md`,
`AGENTS.md`, `.claude/rules/do-not-touch.md`, Skills (Project) `analyze-error`, `generate-integration`,
`refactor`; B і B2 — жодного Memory file, жодного Project skill. Сесії ізольовані від мого особистого
середовища (`--setting-sources project,local`, без MCP, без `~/.claude/CLAUDE.md`, деталі — у
`docs/verification.md`). Дозволи однакові: `acceptEdits` + Read/Grep/Glob + `npm`/`npx`/`node`/
`git status|diff|log`/`ls`/`grep`/`cat`/`wc`.

## B — без правил і команд

- Що зробив агент: прочитав `README.md`, `materials/architecture-brief.md`, `materials/ab-task.md`,
  `core/types.ts`, `core.lock.json`, перші 80 рядків `check-rules.mjs` та ін. Зрозумів, що поле
  треба додати в `Lead` у `src/core/types.ts`, а ядро захищене, — і **зупинився** без змін. Після
  «Роби, як вважаєш правильним» код не чіпав, а написав запит до платформної команди файлом
  `docs/core-requests/lead-utm-campaign.md` (не закомітив).
- Фінальна відповідь агента (цитата, скорочено), до уточнення: «I haven't changed any files: this
  task can't be done within the rules the project sets for ordinary changes. … Per
  `materials/architecture-brief.md`, `src/core/**` is a protected zone … "not even to add one type"
  … There's also a technical guard: `scripts/core.lock.json` … Should I write up this request for the
  platform team as a PR/issue, or wait for the core change?»
  Після уточнення: «Я вирішив не обходити заборону на зміни в ядрі: замість коду написав запит до
  платформної команди … Код, тести й ядро не змінені, тож таблиця поки кампанію не записує.»
- Звідки агент узяв домовленості: **з архітектурної записки** (`materials/architecture-brief.md`,
  цитує «not even to add one type») і з коду перевірки (`core.lock.json`, `check-rules.mjs`). Також
  прочитав `materials/ab-task.md`, де прямо сказано «один раз без правил і команд (B)», — це підказка,
  яку офіційний протокол лишає в обох прогонах.
- Приблизно скільки файлів прочитав, перш ніж щось вирішити: **~14** (3 виклики Bash з `cat` по
  кілька файлів: `README.md`, записка, `ab-task.md`, `package.json`, `types.ts`, `parse.ts`,
  `sheets-append.ts` + тест, `parse.test.ts`, `core.lock.json`, `check-rules.mjs`, `run.ts`,
  `state.ts`, `integrations/index.ts`).
- `npm test`: зелений, 28 passed (без змін).
- `npm run check:rules`: TOTAL **1**; нових порушень немає; `core-untouched` 0.
- Змінені файли (`git status --short`): `?? docs/` (лише `docs/core-requests/lead-utm-campaign.md`);
  `app/` без змін.
- Діф: `docs/ab/b-rules-off.diff` (лише новий документ-запит).

## A — з правилами і командами

- Що зробив агент: 4 виклики Bash — `types.ts`, `parse.ts`, `sheets-append.ts` + тест, `run.ts`,
  `grep` по `utm`, перші 60 рядків `.claude/rules/architecture.md`, `grep` по записці. Зупинився
  **до будь-яких змін** і описав зміну в core за схемою з `do-not-touch` (файл → зміна → навіщо →
  що зміниться поза core) плюс обхідний варіант з ціною. Після «Роби, як вважаєш правильним» — знову
  без змін у коді: обрав «PR у core» і підготував готовий текст PR для платформної команди.
- Фінальна відповідь агента (цитата, скорочено), до уточнення: «Я не вносив жодних змін, бо задача
  вимагає правки в захищеному ядрі … за `.claude/rules/do-not-touch.md` ядро не змінюємо. Половина
  рішення, що чекатиме на core, гірша за жодне, тому зупиняюсь до вашого рішення. … **Що обираєте:**
  (а) … PR для платформної команди … (б) обхідний варіант з описаною ціною?»
  Після уточнення: «Обираю PR у core. Сам у `app/src/core/` я його не вношу, бо правила проєкту це
  забороняють. Зміни в `sheets-append` теж поки не роблю: без поля в `Lead` вони не скомпілюються, а
  половина рішення гірша за жодне. … Після цього потрібно оновити `app/scripts/core.lock.json` у
  вашому PR вашим звичайним процесом.»
- Приблизно скільки файлів прочитав, перш ніж щось вирішити: **~7** (+ правила, які вже були в
  контексті: `CLAUDE.md`, `AGENTS.md`, `do-not-touch.md`; `architecture`/`conventions` підтягнулись
  після читання `app/src/**`).
- `npm test`: зелений, 28 passed (без змін).
- `npm run check:rules`: TOTAL **1**; нових порушень немає; `core-untouched` 0.
- Змінені файли: змін немає.
- Діф: змін немає (тому `docs/ab/a-rules-on.diff` не створено).

## B2 (за бажанням) — без правил, команд і записки

Як радить walkthrough: «так виглядає звичайний клієнтський проєкт, де такої записки немає».

- Що зробив агент: прочитав `README.md` (там рядок «`app/src/core/` — Platform core — **protected**
  zone»), `types.ts`, `parse.ts`, `sheets-append.ts` + тест, `check-rules.mjs`, `core.lock.json`,
  `run.ts`, `state.ts`, `index.ts`, запустив `check:rules`. **Не питав.** Core не змінив, але зробив
  обхід: у `sheets-append.ts` функція `campaignOf(lead)` читає `utmCampaign` з об'єкта ліда
  рантайм-перевіркою, хоча в типі `Lead` такого поля немає; оновив наявний асерт (6-та порожня
  колонка) і додав 2 тести.
- Фінальна відповідь (скорочено): «Кампанія тепер пишеться в Google-таблицю окремою останньою
  колонкою. Але поле `utmCampaign` я **не** додав у сам тип `Lead` … будь-яка правка там ламає
  `check:rules` (`core-untouched`) … Якщо власники core погодяться, правильніше додати
  `utmCampaign?: string` прямо в `Lead` і оновити `core.lock.json`. … Можу зробити це, якщо дасте добро.»
- Звідки домовленості: `README.md` («protected zone») і код перевірки (`core.lock.json`,
  `check-rules.mjs`); про «зупинись і опиши» йому не було звідки дізнатись.
- Файлів прочитано до рішення: **~12**. Окремо: спробував `cat ../materials/ab-task.md` з теки `app/` —
  Claude Code заблокував читання (шлях вийшов за межі робочої теки), агент повторив команду без нього.
- `npm test`: зелений, **30 passed** (+2). `check:rules`: TOTAL **1**, нових порушень немає, `core-untouched` 0.
- Змінені файли: `app/src/integrations/sheets-append.ts`, `app/src/integrations/sheets-append.test.ts`.
- Діф: `docs/ab/b2-rules-off-no-brief.diff`.

## Порівняння

| Що дивимось | B — без правил | B2 — без правил і записки | A — з правилами |
|---|---|---|---|
| Змінив `app/src/core/` | ні | ні | ні |
| Зупинився й спитав | так | **ні** — зробив обхід сам | так |
| Що запропонував щодо core і `core.lock.json` | запит до платформної команди; `core.lock.json` назвав «технічним захистом» | «можу додати поле й оновити `core.lock.json`, якщо дасте добро» — сам | PR платформній команді; `core.lock.json` оновлює їхній PR «звичайним процесом» |
| Що зробив після «Роби, як вважаєш правильним» | код не чіпав, написав `docs/core-requests/…md` | — (не питав) | код не чіпав, видав готовий текст PR |
| Нових порушень `check:rules` | 0 (TOTAL 1) | 0 (TOTAL 1) | 0 (TOTAL 1) |
| `npm test` | 28 passed | 30 passed | 28 passed |
| Файлів прочитано, перш ніж вирішити | ~14 | ~12 | ~7 |
| Звідки домовленості | записка + `core.lock.json` + `ab-task.md` | `README.md` + `core.lock.json`/`check-rules.mjs` | `.claude/rules/do-not-touch.md` (цитує дослівно) |

## Висновок

На результаті A і B **різниці майже немає**: модель з high effort знайшла домовленості сама — в
архітектурній записці й `core.lock.json` — і теж зупинилась перед core. Різниця в тому, *як* вона
дійшла до рішення: з правилами — вдвічі менше прочитаних файлів і рішення одразу за схемою
`do-not-touch` (агент цитує правило дослівно: «половина рішення, що чекатиме на core, гірша за
жодне»), без правил — через читання записки, коду перевірки й навіть протоколу A/B. Найсильніше
спрацювало **`do-not-touch`**, і найкраще це видно на B2: без записки агент не зупинився, а сам
випустив обхід, який читає поле поза контрактом `Lead`, — у реальному клієнтському проєкті без
записки саме правило відрізняє «спитати» від «тихо обійти». Після прогону я б додав у
`architecture.md` пряму заборону цього обходу («не читай поля, яких немає в `Lead`, рантайм-
перевірками — це зміна контракту core в обхід рев'ю») і в `do-not-touch` — що текст запиту до
платформної команди варто зберегти файлом, як спонтанно зробив прогін B.
