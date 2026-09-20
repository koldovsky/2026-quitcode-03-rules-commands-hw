# Перевірка (Task A, B, C і бонус E)

Усе нижче — те, що справді сталося. Числа взяті з виводу команд, цитати
дослівні. Повні вивідки прогонів — у `docs/runs/`.

**Інструмент:** Claude Code **2.1.278**, модель `sonnet` (Claude Sonnet 5).
**Метод прогонів:** неінтерактивний `claude -p` — кожен виклик створює **нову
сесію** з чистим контекстом.

## Метод: чому не сабагенти

Спершу я міряв завантаження контексту сабагентами (`Task`-агенти всередині
сесії). Метод виявився непридатним, і це варто зафіксувати, бо помилка тиха:

> Сабагент успадковує знімок `CLAUDE.md`, зроблений на старті **батьківської**
> сесії, і не перечитує файл з диска.

Після того як я замінив `CLAUDE.md` на версію з `@AGENTS.md`, сабагент усе ще
відповідав, що бачить стару однорядкову версію з посиланням. Тобто сабагентом
неможливо виміряти ефект зміни файлів контексту — ані для Task B, ані для A/B у
Task D. Усі заміри нижче зроблені через `claude -p`, який стартує справжню нову
сесію.

---

## Task A — чи працюють режими застосування правил

Замір: нова сесія, питання без права читати файли.

### Негативний (на старті сесії)

Запит: перелічити правила з `.claude/rules/`, вміст яких видно, і назвати
публічний API `core/parse.ts`.

Відповідь агента:

> **(a)** Only one: `.claude/rules/do-not-touch.md` … `# Do not touch — захищені файли`
> **(b)** `architecture.md` — … Not loaded because it has `paths: ["app/src/**/*.ts"]`
> frontmatter and I haven't touched matching files this turn. `conventions.md` — same situation.
> **(d)** Public API of `core/parse.ts`: **NOT IN CONTEXT.**

Пункт (d) — незалежне підтвердження: перелік API описаний саме в
`architecture.md`, і агент його не має.

### Позитивний (після читання файлу під шаблон)

Запит: прочитати `app/src/integrations/slack-notify.ts`, далі відповідати лише з
контексту.

> **(a)** `do-not-touch.md` (loaded at session start, no frontmatter),
> `architecture.md`, and `conventions.md` (both auto-attached because I read
> `app/src/integrations/slack-notify.ts`, which matches their `paths` glob).
> **(b)** > **HTTP** — тільки `postJson()` з `core/http.js`. Не `fetch`, не axios / got / ky.
> **(c)** > `core/parse.ts` → `parseJson(text, guard, label?)`: `Result<T>`, `Guard<T>`, `isRecord`, `isString`, `isNumber`

**Висновок:** обидва режими працюють як задумано. `do-not-touch` без frontmatter
— у кожній сесії; два інші коштують контексту лише тоді, коли агент справді
працює з кодом застосунку.

---

## Task B — чи бачить інструмент AGENTS.md

Контрольований замір: **той самий промпт, той самий метод, змінено один фактор** —
рядок у `CLAUDE.md`. Правила з `.claude/rules/` на час обох замірів були
перейменовані в `.claude/rules.probe-off`, щоб не підказували відповідей.

Промпт (скорочено): «Не викликай жодного інструмента. Відповідай лише з
контексту. Для кожного питання постав тег `SOURCE: <файл>` або `NOT IN CONTEXT`.
1) команди npm для тестів / typecheck / перевірки правил; 2) захищені шляхи;
3) що це за застосунок; 4) базова кількість порушень.»

| | `CLAUDE.md` = `[AGENTS.md](./AGENTS.md)` | `CLAUDE.md` = `@AGENTS.md` |
|---|---|---|
| 1. команди npm | `NOT IN CONTEXT` | `npm test`, `npm run typecheck`, `npm run check:rules` — `SOURCE: AGENTS.md` |
| 2. захищені шляхи | `NOT IN CONTEXT` | усі п'ять — `SOURCE: AGENTS.md` |
| 3. що за застосунок | `NOT IN CONTEXT` | `lead-sync` … Studio Nova — `SOURCE: AGENTS.md` |
| 4. базова кількість порушень | `NOT IN CONTEXT` | **TOTAL: 8** — `SOURCE: AGENTS.md` |
| файли, вміст яких видно | лише `CLAUDE.md` | `CLAUDE.md` + `AGENTS.md` |

Цитата з прогону «до»:

> Note: CLAUDE.md references AGENTS.md for project conventions, but AGENTS.md's
> contents are not present in my context, so I cannot answer questions 1–4 from it.

Цитата з прогону «після»:

> Project instruction files whose contents I can see:
> - CLAUDE.md
> - AGENTS.md (imported into CLAUDE.md via `@AGENTS.md`)

**Висновок:** markdown-посилання не імпортує нічого — агент бачить лише текст
рядка. `@AGENTS.md` підставляє вміст. Різниця — чотири «не знаю» проти чотирьох
відповідей із правильним джерелом.

### Окремо: нативне читання AGENTS.md не рятує

Claude Code з версії 2.1.277 читає `AGENTS.md` нативно — **але лише якщо
`CLAUDE.md` відсутній**. У цьому репозиторії `CLAUDE.md` є, тому нативний шлях
не вмикається, і без явного `@AGENTS.md` база не завантажується. Замір «до» це
підтверджує на версії 2.1.278.

---

## Task C — прогони команд

### `/analyze-error materials/error-log.txt`

**Підстановка `$ARGUMENTS`:** так. Перевірено окремою тимчасовою командою
(створена, запущена, видалена):

```
/echo-args materials/error-log.txt друге-слово
→ ARGS=[materials/error-log.txt друге-слово] FIRST=[друге-слово] SECOND=[$2]

/echo-args alpha beta gamma
→ ZERO=[alpha] ONE=[beta] TWO=[gamma] ALL=[alpha beta gamma]
```

Два неочевидні факти: позиційні аргументи **нумеруються з нуля** (`$1` — це
друге слово, не перше), а плейсхолдер без відповідного аргументу лишається в
тексті **дослівно** (`SECOND=[$2]`) — тобто потрапляє в промпт як сміття.
Тому в трьох робочих командах використано лише `$ARGUMENTS`.

**Знадобилось три прогони.** Це не «модель не змогла» — щоразу вада була в
команді, і кожна зміна давала вимірюваний зсув. Повні вивідки:
`docs/runs/analyze-error-run{1,2,3}.md`.

| Прогін | Що додано в команду | Що назвав причиною | Вердикт |
|---|---|---|---|
| 1 (14 turns) | — | `run.ts:36` — чекпоінт лише в кінці пакета + `SIGKILL` | частково |
| 2 (8 turns) | крок «прив'яжи причину до доказу» + конкуруюча гіпотеза | те саме + retry/backoff як другий механізм | частково |
| 3 (11 turns) | крок «знайди найраніше відхилення» | `state.ts:11-17` — мовчазний відкат до `INITIAL_STATE`, плюс `run.ts:18` | **правильно** |

Чому прогони 1 і 2 неповні: обидва пояснюють, **чому збій не припиняється**, але
не пояснюють ключовий доказ — чому о 00:15 розсилка починається з `ld_0001`,
хоча останній штатний прогін о 23:55 обробив `ld_1284`. Формулювання «чекпоінт
не зберігся» дає повтор останнього пакета, а не всієї історії лідів.

**Тригер (прогін 3):**

> Заповнення диска нічним backup-джобом (`00:02:37`, 97% → 100%, звільнено о
> `00:13:48`) — зовнішня, разова подія, не пов'язана з кодом воркера.

**Корінна причина (прогін 3):**

> `app/src/sync/state.ts:11-17` (`loadState`) — при невдалому `JSON.parse`
> мовчки повертає `INITIAL_STATE` (epoch `1970-01-01`) без логування й без
> сигналізації помилки … Другий необхідний елемент механізму:
> `app/src/sync/run.ts:18` — `saveState(statePath, state)` викликається
> безумовно на початку **кожного** прогону … і одразу записує щойно
> завантажений (можливо, помилково-дефолтний) стан назад на диск як durable.

**Як відрізнив тригер від причини.** Розрив у часі порахований: тригер зник о
`00:13:48`, останній зафіксований прояв — `09:14:30`, тобто ≈9 годин. Плюс
прив'язка до найранішого відхилення:

> Найраніший рядок, де поведінка відрізняється від «до інциденту» — **рядок 28**,
> `2026-09-10T00:15:00.377Z INFO slack-notify: lead ld_0001 delivered`. До
> інциденту (23:55) система вже обробила `ld_1284` … Щоб `ld_0001` знову
> потрапив у `pending`, `state.lastSyncedAt` мусив стати меншим за його
> `createdAt` — тобто відкотитись до `epoch`.

І відкинута конкуруюча гіпотеза:

> «Причина — сам `ENOSPC`-крах; після звільнення диска все повертається до
> норми» … **не може пояснити рядок 28**: якби система просто «повернулась до
> норми», прогін о 00:15 обробив би лише нові ліди після `ld_1284`.

**Stop дотримано в усіх трьох прогонах.** Запуск був із
`--permission-mode acceptEdits`, тобто редагування було **дозволене** — агент
утримався сам. `git status --short` до і після кожного прогону ідентичний
(перевірено `diff`).

### `/refactor app/src/integrations/sheets-append.ts`

**Перша спроба не дала нічого** — 23 с, жодної зміни, відповідь агента:

> I'm blocked waiting on approval for these two commands (`npm test` and
> `npm run check:rules` in `app/`). Please approve them so I can capture the
> baseline before refactoring.

Причина — права, не команда: `acceptEdits` дозволяє редагування, але не `Bash`,
а команда починається з кроку «зафіксуй "до"». Показова ілюстрація тези WS2:
права сильніші за правила — у цьому випадку вони зупинили навіть корисну роботу.
Прогін повторено з `bypassPermissions` (21 turn), щоб міряти правила, а не права.

| | До | Після |
|---|---|---|
| `check:rules`, цей файл | **7** (`no-any`×2, `http-via-core`, `env-via-config`, `json-via-parse`, `log-via-logger`×2) | **0** |
| `check:rules`, TOTAL | **8** | **1** (`sync/state.ts` `json-via-parse` — поза межами цілі) |
| `npm test` | 18 passed (6 files) | 18 passed (6 files) |
| `npm run typecheck` | зелений | зелений |

**Змінено:** `sheets-append.ts`, `sheets-append.test.ts`, `integrations/index.ts`.
Останні два — через заміну `export default` на іменований `sheetsAppend`.

**Асерти не редаговані** — перевірено машинно:
`git diff -U0 -- app/src/integrations/sheets-append.test.ts | grep -E '^[+-].*expect\('`
не дає жодного рядка. Єдина зміна в тесті — рядок імпорту.

**Поведінка збережена:** складання URL (`webhookUrl + "?token=" + token`), тіло
запиту, текст помилки (`"sheets error: " + status`) і тексти рядків журналу —
дослівно ті самі.

**Побічний виграш, якого я не просив.** Оригінал друкував URL через
`console.log`, тобто разом із токеном у query string. Після рефакторингу це
`log.error`, а `redact()` з `core/log.ts` маскує `?token=`. Перевірено тим самим
патерном, що в `core/log.ts`:

```
ДО   : sheets-append failed: https://sheets.example.test/append?token=fake-sheets-token-abc123 -> bad
ПІСЛЯ: sheets-append failed: https://sheets.example.test/append?token=<REDACTED> -> bad
```

### `/generate-integration telegram`

19 turns, 67 с. Створено **рівно три шляхи**, як вимагає архітектура:

- `app/src/integrations/telegram-notify.ts`
- `app/src/integrations/telegram-notify.test.ts`
- рядок у `app/src/integrations/index.ts`

| | Значення |
|---|---|
| `npm test` | **23 passed (7 files)** — було 18 у 6 файлах, тобто +5 тестів |
| `npm run typecheck` | зелений |
| `check:rules` TOTAL | **1** — не виріс |
| Захищені шляхи | не змінені (`git status --short` по них порожній) |

**Мінімізація даних — головна перевірка цього прогону.** Telegram — це
сповіщення, тож `email` і `phone` не мають виходити за межі систем обліку:

```
grep -n 'email\|phone' app/src/integrations/telegram-notify.ts
→ (порожньо)
```

і тест фіксує це явним твердженням, а не на віру:

```ts
it("форматує повідомлення без email і телефону", () => {
  expect(text).not.toContain(lead.email);
```

**Заборонені конструкції відсутні:**
`grep -nE '\bfetch\(|process\.env|JSON\.parse|console\.|: any|as any'` по модулю —
порожньо.

**Що я перевірив додатково, бо це не було очевидним.** Рядок 36 модуля логує
`response.error`, який містить URL, а в URL Telegram зашитий токен бота.
Маскування це ловить — але лише для реального формату токена:

```
реальний формат ПІСЛЯ: .../bot<REDACTED>/sendMessage failed: HTTP 500
тестовий формат ПІСЛЯ: .../botfake-token-123/sendMessage failed: HTTP 500
```

Патерн `bot\d{6,}:[A-Za-z0-9_-]{20,}` з `core/log.ts` розрахований на справжній
формат `123456789:AA…`. Тестовий `fake-bot-token-0000` не маскується, але це
синтетичне значення, а не секрет. Ризику немає, проте це показує межу
маскування: воно працює за формою рядка, а не за знанням, що це секрет.
