# Перевірка (Task B, C і бонус E)

## Task B — чи бачить інструмент AGENTS.md

- Інструмент і версія: Claude Sonnet 5
- Як перевірив:
  1. Нова сесія, `/context` → Memory files, без відкриття файлів.
  2. Читання app/src/integrations/slack-notify.ts (підпадає під
     paths: app/src/**/*.ts у architecture.md/conventions.md).
  3. Повторний `/context` після кроку 2.
  4. Прямий тест без інструментів: попросив агента, не викликаючи Read/Grep/Glob, назвати функцію для вихідного HTTP лише з того, що вже в контексті.
- Результат: 
- Кроки 1 і 3 — `/context` → Memory files показує тільки AGENTS.md
    (930), .claude/rules/do-not-touch.md (499), CLAUDE.md (163) —
    і до, і після читання .ts-файлу; architecture.md і conventions.md
    у списку не з'являються ніколи.
  - Перша спроба перевірити знання правила дала хибний позитив: агент
    відповів правильно, але зробив це через Grep "fetch|postJson" в
    app/scripts + Read app/scripts/check-rules.mjs, тобто дістав
    відповідь з коду, а не з пам'яті.
  - Строгий тест (заборона Read/Grep/Glob) дав чистий результат:
    агент відповів "Вихідний HTTP... лише через функцію postJson()
    з app/src/core/**" без жодного виклику інструментів (дрібна
    неточність — назвав core/** замість http.ts конкретно, суть
    правила відтворена вірно).
  - Висновок: paths-правила (architecture.md, conventions.md)
    реально підвантажуються в контекст Claude Code при читанні
    файлу під app/src/**, але розділ Memory files команди /context
    їх у списку не показує — це обмеження виводу /context, а не
    ознака того, що правило не завантажилось.


## Task C — прогони команд

### `/analyze-error`

- Виклик без аргументу: /analyze-error (без шляху) → агент правильно зупинився і перепитав ціль ("Ціль не вказана — ані в команді, ані в повідомленні після неї... що аналізувати?"), не почав вигадувати файл. Це підтверджує, що інструкція "немає й там — спитай і зупинись" реально спрацьовує.
- Виклик: /analyze-error materials/error-log.txt
- Чи підставився $ARGUMENTS: так — агент одразу прочитав указаний файл без додаткових уточнень.
- Що агент назвав корінною причиною (файл, рядок, механізм): app/src/sync/run.ts:36 — saveState() викликається рівно один раз, у самому кінці циклу runSync, після проходження всього pending-масиву через усі інтеграції; прогрес не зберігається інкрементально. Механізм переривання: повтори postJson() (core/http.ts:38-39) на 429 від Slack (slack-notify, рядок логу 33) розтягують прогін настільки, що він не встигає в межах таймауту зовнішнього планувальника (4×30с) і гине від SIGKILL до виклику run.ts:36 — тому вже реально доставлені ліди лишаються "недоставленими" з точки зору стану, і наступний прогін шле їх повторно.
- Чим відрізнив тригер від причини: тригер — нестача місця на диску (ENOSPC) о 00:05–00:10, усунута ops о 00:13:48 (одноразова зовнішня подія, сама по собі дублів не пояснює). Причина — механізм saveState() в кінці циклу, який ніяк не пов'язаний із диском і тому дублі тривали ще 9 годин після усунення тригера (з 00:13 до 09:12). Явно назвав це "самопідсилюваним циклом": більший бэклог → довший прогін → більше 429 → вища ймовірність не вкластись у таймаут → стан знову не зберігається → бэклог не зменшується.
- Чи зупинився там, де сказано в Stop: так. Запропонував тест (Vitest, за патерном run.test.ts), що відтворює саме причину (переривання до кінця циклу), але не створив файл із ним. Дав план виправлення (інкрементальний saveState, файл run.ts у sync/, core/ не чіпати), явно написав "Код не змінював. Підтвердь план — і я внесу зміну в run.ts" — код не редагував без підтвердження.

### `/refactor`

- Виклик: `/refactor app/src/integrations/sheets-append.ts`
- `npm run check:rules` для цього файлу: до 7 порушень у sheets-append.ts (no-any×2, http-via-core, env-via-config, json-via-parse, log-via-logger×2) → після 0 (у виводі лишилось 1 попередження — src/sync/state.ts:14, json-via-parse — це окрема задача, файл навмисно не чіпався).
- `npm test` до 18/18 зелені / після 18/18 зелені. ті самі 2 тести sheets-append.test.ts пройшли без зміни асертів.
- Що змінилось у поведінці (має бути: нічого з того, що фіксують тести): URL, тіло запиту (values: [[...]]) і тексти помилок ("sheets error: " + status) не змінені — підтверджено проходженням тих самих тестів без правок асертів.
- Що саме зроблено у файлі:
fetch напряму → postJson() з core/http.ts
process.env.* напряму → readEnv() з core/config.ts
JSON.parse без guard → parseJson(text, isSheetsResponse, "sheets-append") з guard на { status: string }
console.log → log.info / log.error з core/log.ts — у виводі тесту видно, що redact() реально маскує токен у URL (sheets-append failed: https://sheets.example.test/append?token=<REDACTED>)
прибрано обидва any (lead: any, data: any) — типізація через Integration/Result і guard
export default лишено без змін (як і очікують index.ts та тест)
- Scope: git diff --name-only підтверджує зміну лише в app/src/integrations/sheets-append.ts. run.ts і state.ts не чіпали — обидва окремі задачі за межами цього прогону.
- Комітити не давав — Stop дотримано, коміт лишається на розсуд людини.

### `/generate-integration`

- Виклик: `/generate-integration Monobank`
- Які файли створено:
  - app/src/integrations/monobank.ts — сповіщення про лід у Monobank-чат менеджерів через вебхук (MONOBANK_WEBHOOK_URL + MONOBANK_TOKEN у заголовку X-Token), без email/телефону в тілі.
  - app/src/integrations/monobank.test.ts — 5 тестів: форматування без PII, відсутність кожної з двох env-змінних окремо, успішна відправка (перевірка URL/тіла/заголовка), помилка від вебхука.
  - Реєстрація — один рядок у app/src/integrations/index.ts (import { monobank } from "./monobank.js" + export const integrations: readonly Integration[] = [slackNotify, sheetsAppend, monobank]).
- `npm test`, `npm run check:rules`: 
   - npm test — 23/23 зелені (7 файлів, +5 нових).
   - npm run typecheck — чисто.
   - npm run check:rules — 0 нових попереджень; лишається 1 стара (state.ts, json-via-parse) — поза межами цієї задачі.
- app/src/core/** не чіпали, нових залежностей не додавали (окрема зміна sheets-append.ts у git status — з попереднього кроку /refactor, ще не закомічена, не стосується цього прогону).
- Коміт не зроблено — Stop дотримано, чекає підтвердження людини.

## Task E (бонус) — хук

- Файли: .claude/settings.json (реєстрація PreToolUse, matcher Edit|Write, команда node .claude/hooks/protect-core.mjs), .claude/hooks/protect-core.mjs (Node-скрипт: читає JSON зі stdin, бере шлях з tool_input.file_path, і якщо він містить app/src/core/ — пише причину в stderr і виходить з кодом 2).
- Спроба змінити `app/src/core/...` → 
Перша спроба (некоректна ізоляція)

Прибрали лише .claude/rules/do-not-touch.md → .off. Запит «додай коментар на початок app/src/core/log.ts» — агент відмовився ще до Edit, зіславшись на AGENTS.md, правило 7 (те саме, повторене одним рядком і завантажене завжди через @AGENTS.md, незалежно від стану детального файлу правила). Хук у цьому прогоні не спрацював, бо Edit жодного разу не викликався — перевірка вийшла некоректною.

Друга спроба (правильна ізоляція)

Прибрали всі джерела правил одночасно: CLAUDE.md.off, AGENTS.md.off, .claude/rules.off, .claude/commands.off. Хуки (.claude/settings.json, .claude/hooks/) лишили увімкненими. Нова сесія, той самий запит.

Спроба змінити app/src/core/... → що відповів хук (цитата): app/src/core/** захищено (.claude/rules/do-not-touch.md): зміни йдуть окремим PR через рев'ю платформної команди. Заблоковано спробу редагувати "...app\src\core\log.ts". Якщо задача без цього не виконується — зупинись і опиши, що саме треба змінити в core і навіщо.
Агент прямо підтвердив результат: «Edit failed. The edit was blocked. The PreToolUse hook fired and rejected it... This confirms protect-core.mjs + settings.json work as intended: unlike the rule (which only asks), the hook actually prevents the edit (exit code 2).»
Висновок: навіть без жодного текстового джерела заборони (правила, AGENTS.md, CLAUDE.md вимкнені) спроба реального Edit у app/src/core/log.ts була заблокована на рівні інструменту, з кодом виходу 2 — файл не змінився. Це підтверджує, що хук працює незалежно від того, чи "погоджується" агент з обмеженням: правило просить, хук не дає.