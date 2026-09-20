<!-- Дослівний вивід прогону. Не редаговано. -->
# /refactor — app/src/integrations/sheets-append.ts

**Виклик:** `claude -p "/refactor app/src/integrations/sheets-append.ts" --model sonnet --permission-mode bypassPermissions`
**Turns:** 21 · **Тривалість:** 116 с · **Вартість:** $0.2652

---

No `expect(...)` lines touched, and only the target file plus its two import sites changed (AGENTS.md/CLAUDE.md/.claude/docs are pre-existing uncommitted state, untouched by me).

## Підсумок

**Файл:** `app/src/integrations/sheets-append.ts`

| | До | Після |
|---|---|---|
| `npm test` | 18 passed (6 files) | 18 passed (6 files) |
| `check:rules` TOTAL | 8 | 1 |
| `check:rules` для sheets-append.ts | 7 (no-any×2, http-via-core, env-via-config, json-via-parse, log-via-logger×2) | 0 |

Залишкове порушення (`src/sync/state.ts`, `json-via-parse`, 1) — поза межами цього рефакторингу, не чіпав.

**Що змінено в коді:**
- `fetch` → `postJson()`; `process.env` → `readEnv()` (з обробкою `Result`); `JSON.parse` → `parseJson()` з guard `isSheetsResponse`; `console.log` → `log.error` / `log.info`; прибрано `any` (типізовано `lead: Lead`, відповідь через guard).
- URL, тіло запиту, заголовки та тексти помилок — ті самі, що й до рефакторингу.
- Лог помилки тепер збирається з URL запиту (а не `res.url`, якого більше немає — `postJson` повертає лише текст), але токен у ньому все одно маскується `redact()` в `log`, як і раніше мало б бути.

**Зміна виду експорту:** `export default {...}` → `export const sheetsAppend: Integration = {...}` (для узгодження зі стилем `slack-notify.ts`). Оновлено обидва місця імпорту:
- `app/src/integrations/index.ts`
- `app/src/integrations/sheets-append.test.ts` (лише рядок імпорту, асерти не чіпав)

Змінено лише ці три файли, нічого в захищених шляхах.