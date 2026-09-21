# Карта для рев'ювера

У репозиторії 26 каталогів доказів. Читати їх усі не треба — нижче найкоротший
шлях до кожного пункту рубрики. Автор: **Hryhorii Haponiuk**, інструмент —
Claude Code (CLI, headless-прогони).

## Якщо є 2 хвилини

```bash
cd app && npm install && cd ..
bash tools/verify-all.sh
```

Один прогін перевіряє все: 48 тестів, `tsc`, `check:rules` (**TOTAL: 0**),
звірку «правила ↔ код» (13 тверджень), 80 кейсів обходу хука і недоторканість
`app/src/core/**`, `app/scripts/**`, `materials/**`.

## Якщо є 5 хвилин: чотири файли, які показують суть

| Що подивитись | Що саме там видно |
|---|---|
| [`docs/evidence/b2-agents-quote-import/summary.md`](evidence/b2-agents-quote-import/summary.md) + [`…-link/`](evidence/b2-agents-quote-link/summary.md) | доказ, що `@AGENTS.md` завантажується, а markdown-посилання — ні. Два прогони з **вимкненим читанням файлів**, різниця — три рядки `CLAUDE.md`: цитата з `AGENTS.md` проти «НЕМАЄ В КОНТЕКСТІ» |
| [`docs/ab/clean-rules-off.diff`](ab/clean-rules-off.diff) | що робить агент **без правил** у чистій копії без `.git`: заводить четвертий шар `app/src/leads/` і `LeadWithCampaign extends Lead`. `npm test` 30 зелених, `check:rules` 1, `core-untouched: 0` — машина не бачить нічого, архітектура порушена |
| [`docs/ab-validation.md`](ab-validation.md) | 10 прогонів, дві дірки в самій процедурі завдання і чому «різниці немає» — це результат, а не невдача |
| [`docs/verification.md`](verification.md) | сліди команд, хука і розбір **власних** помилок, знайдених рев'ю та самоаудитом |

## Пункт рубрики → де доказ

| Вимір | Артефакт | Доказ роботи |
|---|---|---|
| **A. Правила** (30) | [`.claude/rules/`](../.claude/rules) — `architecture`, `conventions`, `do-not-touch` | режим `paths:` перевірено парою прогонів: [`a1-paths-rule-probe`](evidence/a1-paths-rule-probe/summary.md) (цитата §4 після читання одного файлу) і [`…-negative`](evidence/a1-paths-rule-probe-negative/summary.md) (нічого не відкрито → «НЕМАЄ В КОНТЕКСТІ») |
| **B. Спільна база** (15) | [`AGENTS.md`](../AGENTS.md), [`CLAUDE.md`](../CLAUDE.md) | пара `b2-agents-quote-import` / `…-link` вище; додатково `b1-context-*` |
| **C. Команди** (25) | [`.claude/commands/`](../.claude/commands) | [`c1-analyze-error`](evidence/c1-analyze-error/summary.md) — причина `state.ts:15`+`:21`, тригер відрізнено від причини; [`c2-refactor`](evidence/c2-refactor/summary.md) — `check:rules` файлу 7 → 0, тести 18 → 19; [`c3-generate-integration`](evidence/c3-generate-integration/summary.md) — рівно 3 зміни, `grep` на `email\|phone` порожній |
| **D. A/B** (25) | [`docs/ab-validation.md`](ab-validation.md), [`docs/ab/`](ab) | 10 прогонів скриптом [`tools/ab-run.sh`](../tools/ab-run.sh) з контролем ізоляції; контрольний стенд без `.git` — [`tools/ab-run-clean.sh`](../tools/ab-run-clean.sh) |
| **E. Хук** (5) | [`.claude/hooks/protect-core.mjs`](../.claude/hooks/protect-core.mjs) | [`e3-hook-block-edit`](evidence/e3-hook-block-edit/summary.md) — цитата відмови хука, 4 спрацювання `PreToolUse:Edit`, md5 файлу не змінився; [`e2`](evidence/e2-hook-block-no-rules/summary.md) — те саме з прихованими правилами |

## Що тут є понад завдання

- **Дві дірки в процедурі Task D.** Перейменований `.claude/rules.off` лишається
  читабельним ([`_first-attempt-leak`](evidence/ab/_first-attempt-leak/summary.md)), а після виносу за межі репо агент
  дістає правила через `git show HEAD:` ([`b-off-nobrief--sonnet`](evidence/ab/b-off-nobrief--sonnet/transcript.md), виклик Bash №2).
  Тому в репозиторії з історією «агент без правил» виміряти неможливо.
- **Три власні помилки, знайдені й закриті.** `allowed-tools` не є забороною
  ([`c1d-allowed-tools-decisive`](evidence/c1d-allowed-tools-decisive/summary.md)); `/refactor` увімкнув повтори для
  неідемпотентного запису в таблицю; фікс інциденту приніс три нові дефекти того
  самого класу ([`f2-review-fixes`](evidence/f2-review-fixes/tests-before-fix.txt) — 11 падінь на коді до фікса).
- **Машинна звірка документів із кодом.** [`tools/check-rule-claims.mjs`](../tools/check-rule-claims.mjs) —
  13 тверджень правил проти реального коду, бо двічі текст розходився з фактом.
- **Хук перевірено спробами зламати** (число кейсів — вище, воно звіряється
  автоматично): `sed -i`, `..`, symlink, `--write-lock`, шлях у base64, змінна
  оболонки, `cd` перед записом, обидва конверти Cursor.

## Відомі обмеження — названі, не приховані

1. **`.cursor/hooks.json` у самому Cursor не запускався.** Скрипт розуміє обидва
   конверти Cursor і це закрито тестами, але прогону в Cursor не було.
   Правил у форматі `.mdc` свідомо немає: друга копія розійшлася б із першою.
2. **Хук свідомо ловить зайве.** Запис, ціль якого збирається під час виконання
   (`cp "$SRC" docs/`), блокується без знання шляху: перевірити його неможливо.
   Компроміс описаний у [`protect-core.mjs`](../.claude/hooks/protect-core.mjs) і в тексті відмови.
3. **Числа A/B — стан на момент прогонів** (`check:rules` 1, тестів 26). Фікс
   інциденту зроблено **після** абляції навмисно, щоб не міряти одну кодову базу,
   а описувати іншу.
