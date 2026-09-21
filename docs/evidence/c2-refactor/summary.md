# c2-refactor

| Показник | Значення |
|---|---|
| check:rules до | 8 |
| check:rules після | 1 |
| npm test після | 19 passed (19) |
| файлів прочитано до першої зміни | **10** |
| з них через Bash (cat/sed/grep) | 7 команд |
| усього викликів інструментів | 13 |
| цілився в захищені шляхи | ні |
| зміну виконано | — |
| хук заблокував дію | ні |
| сам викликав slash-команди | ні |
| ходів | 14 |
| тривалість, с | 90 |
| вартість, $ | 0.602 |

**Файли, прочитані до першої зміни:**
- `app/src/integrations/sheets-append.ts`
- `app/src/integrations/sheets-append.test.ts`
- `app/src/integrations/slack-notify.ts`
- `app/src/core/types.ts`
- `app/src/core/http.ts`
- `app/src/core/config.ts`
- `app/src/core/parse.ts`
- `app/src/core/log.ts`
- `.claude/rules/conventions.md`
- `app/src/integrations/index.ts`

**Виклики інструментів:** Bash×13

**Змінені файли (git status):**
```
M .claude/commands/analyze-error.md
 M app/src/integrations/sheets-append.test.ts
 M app/src/integrations/sheets-append.ts
?? docs/evidence/
?? tools/ab-report.mjs
?? tools/ab-run.sh
?? tools/session-run.sh
```

**Фінальна відповідь агента:**

> ## Результат
> 
> | | до | після |
> |---|---|---|
> | `npm test` | 18 passed (6 files) | **19 passed** (додано 1 тест) |
> | `check:rules` — `sheets-append.ts` | **7** | **0** |
> | `check:rules` — TOTAL | 8 | **1** (лишився `sync/state.ts json-via-parse` — інший файл, не ціль) |
> | `npm run typecheck` | — | без помилок |
> 
> ```
>  app/src/integrations/sheets-append.test.ts | 14 ++++++++
>  app/src/integrations/sheets-append.ts      | 57 ++++++++++++++++++++++--------
> ```
> 
> (`.claude/commands/analyze-error.md` у `git status` був змінений ще до цієї сесії — я його не чіпав.)
> 
> ## Що збереглось у поведінці
> 
> URL той самий — `${SHEETS_WEBHOOK_URL}?token=${SHEETS_TOKEN}`, тепер зібраний з `readEnv()` замість `process.env`, і `postJson()` шле той самий `POST` із `content-type: application/json` і тим самим тілом `{ values: [[createdAt, name, email, phone ?? "", source]] }`. Текст помилки від таблиці не змінився: `sheets error: quota_exceeded`. Експорт лишився `export default` з тим самим `name` / `requiredEnv`, тож рядок у `integrations/index.ts` правити не треба; додатково модуль тепер типізований як `Integration`, що й дає `Promise<Result<void>>` без `any`.
> 
> Обидва наявні асерти пройшли без жодної правки — `git diff -- '*.test.ts'` містить лише доданий блок.
> 
> ## Два непокриті тестами шляхи, де поведінка стала строгішою
> 
> Це наслідок конвенцій, не мого вибору — фіксую явно:
> 
> 1. **Відсутня/порожня env** (конвенції §3). Було: URL складався у `"undefined?token=undefined"`, `fetch` ішов у мережу й падав винятком. Стало: `{ ok: false, error: "missing environment variable SHEETS_TOKEN" }` без мережевого виклику — це я й закріпив доданим тестом (конвенції вимагають три випадки на інтеграцію, випадку з env бракувало).
> 2. **Не-2xx відповідь і невалідний JSON** (§2, §4). Було: `JSON.parse` сирого тіла → або виняток, або `sheets error: undefined`. Стало: помилка від `postJson` повертається як значення, а тіло розбирається через `parseJson` з guard на `{ status: string }` → `sheets-append: invalid JSON` / `sheets-append: unexpected shape`.
> 
> Логи перейшли з `console.log` на `log.info` / `log.error` — саме через маскування токена в query string (`log.redact`), а старий рядок друкував URL із токеном як є.

---

## Сирі виводи прогону

### Запит (байт у байт) — `prompt.txt`

```
/refactor app/src/integrations/sheets-append.ts
```

### check:rules до — `check-rules.before.txt`

```
check:rules — 10 source files, 7 rules

  src/integrations/sheets-append.ts  no-any           line 6
  src/integrations/sheets-append.ts  http-via-core    line 7
  src/integrations/sheets-append.ts  env-via-config   line 7
  src/integrations/sheets-append.ts  json-via-parse   line 12
  src/integrations/sheets-append.ts  no-any           line 12
  src/integrations/sheets-append.ts  log-via-logger   line 14
  src/integrations/sheets-append.ts  log-via-logger   line 17
  src/sync/state.ts                  json-via-parse   line 14

by rule:
  http-via-core     1   HTTP only through postJson() from src/core/http.ts
  env-via-config    1   environment only through readEnv() from src/core/config.ts
  json-via-parse    2   JSON only through parseJson(text, guard) from src/core/parse.ts
  log-via-logger    2   logging only through log from src/core/log.ts (it redacts secrets)
  no-any            2   no `any`: use `unknown` plus a guard
  no-new-deps       0
  core-untouched    0

by file:
  src/integrations/sheets-append.ts    7
  src/sync/state.ts                    1

TOTAL: 8 violation(s)
```

### check:rules після — `check-rules.after.txt`

```
check:rules — 10 source files, 7 rules

  src/sync/state.ts  json-via-parse   line 14

by rule:
  http-via-core     0
  env-via-config    0
  json-via-parse    1   JSON only through parseJson(text, guard) from src/core/parse.ts
  log-via-logger    0
  no-any            0
  no-new-deps       0
  core-untouched    0

by file:
  src/sync/state.ts    1

TOTAL: 1 violation(s)
```

### npm test до — `npm-test.before.txt`

```
Test Files  6 passed (6)
      Tests  18 passed (18)
   Start at  11:18:40
   Duration  151ms (transform 70%, tests 14%, import 12%, worker 4%)
```

### npm test після — `npm-test.after.txt`

```
Test Files  6 passed (6)
      Tests  19 passed (19)
   Start at  11:20:11
   Duration  128ms (transform 64%, tests 17%, import 14%, worker 5%)
```

### git status до — `git-status.before.txt`

```
M .claude/commands/analyze-error.md
?? docs/evidence/
?? tools/ab-report.mjs
?? tools/ab-run.sh
?? tools/session-run.sh
```

### git status після — `git-status.after.txt`

```
M .claude/commands/analyze-error.md
 M app/src/integrations/sheets-append.test.ts
 M app/src/integrations/sheets-append.ts
?? docs/evidence/
?? tools/ab-report.mjs
?? tools/ab-run.sh
?? tools/session-run.sh
```

---

Сирий транскрипт: `docs/evidence/raw-transcripts.tar` → `docs/evidence/c2-refactor/transcript*.jsonl.gz`
---

Сирий транскрипт: `docs/evidence/raw-transcripts.tar` → `docs/evidence/c2-refactor/transcript*.jsonl.gz`
