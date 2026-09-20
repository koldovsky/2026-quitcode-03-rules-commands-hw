# Прогін B — без правил, команд і бази · модель Opus

Другий A/B на іншій моделі. Стенди перевірені `node tools/ab-isolate.mjs`.
Запит — `materials/ab-task.md` без змін, SHA256 `874ec881247fe4175ad3fd14d37a9f310a8cd30a7e933be43bc23a4bfff01754`.

## Хід 1

Turns: 14 · викликів інструментів: 13 · з них Read: 0 · 180 с

```
 1. Bash · ls -la && echo "---TREE---" && find . -type f -not -path './.git/*' -not -path './node_modules/*' | 
 2. Bash · for f in materials/ab-task.md materials/architecture-brief.md app/package.json app/scripts/core.lock
 3. Bash · for f in app/src/integrations/sheets-append.ts app/src/integrations/sheets-append.test.ts app/src/in
 4. Bash · for f in app/src/sync/run.ts app/src/sync/state.ts app/src/core/parse.ts; do echo "=== $f ==="; cat 
 5. Bash · cat -n app/scripts/check-rules.mjs && ls -la .claude docs && cat .gitignore
 6. Bash · app && ls node_modules >/dev/null 2>&1 && echo "deps present" || echo "no node_modules"; npm test 2>
 7. Bash · npm run typecheck 2>&1 | tail -5 && npm run check:rules 2>&1 | tail -25
 8. Bash · cd /private/tmp/claude-501/-Users-fvbulxus-AEC-homework-WS3-2026-quitcode-03-rules-commands-hw/d6600
 9. Bash · cd /private/tmp/claude-501/-Users-fvbulxus-AEC-homework-WS3-2026-quitcode-03-rules-commands-hw/d6600
10. Bash · cat > /tmp/sheets.py <<'PYEOF'
import io,re
p="app/src/integrations/sheets-append.ts"
s=io.open(p,en
11. Bash · cat > /tmp/tests.py <<'PYEOF'
import io
p="app/src/integrations/sheets-append.test.ts"
s=io.open(p,e
12. Bash · npm run typecheck 2>&1 | tail -8 && npm run check:rules 2>&1 | tail -15
13. Bash · cd /private/tmp/claude-501/-Users-fvbulxus-AEC-homework-WS3-2026-quitcode-03-rules-commands-hw/d6600
```

### Відповідь агента

Готово. Кампанія тепер їде в таблицю окремою колонкою в кінці рядка.

**Одне застереження по суті задачі:** «додати кампанію до ліда» означає нове поле в `Lead` із `app/src/core/types.ts`, а `src/core/**` — захищена зона платформної команди (`materials/architecture-brief.md`: у звичайних задачах не редагується взагалі, «ні дрібний фікс, ні додам один тип»; `app/scripts/core.lock.json` теж захищений, тож `check:rules` це б одразу показав). Тому core я не чіпав, а функціональність зробив повністю — без нього вона працює вже зараз.

**Що змінено**

- `app/src/integrations/sheets-append.ts:40` — рядок таблиці став `[createdAt, name, email, phone, source, utmCampaign]`.
- `app/src/integrations/sheets-append.ts:20-26` — кампанія читається як необов'язкове розширення ліда (`Lead & { utmCampaign?: unknown }`) плюс guard `isString` із `core/parse.ts`. Форма — зовнішні дані, тож не-рядок або відсутнє значення дає порожню комірку, а не сміття в таблиці. Без `any`, без прямого доступу до полів поза контрактом.
- `app/src/integrations/sheets-append.test.ts` — оновлено очікуваний рядок (порожня остання колонка) і додано два кейси: кампанія пишеться останньою колонкою; не-рядок від форми лишає комірку порожньою.
- `docs/core-change-request.md` — новий файл: точний diff для `Lead` (`utmCampaign?: string`), нагадування перегенерувати `core.lock.json`, і що саме прибрати в інтеграції та тестах після того PR.

**Перевірки:** `npm test` — 37 passed (було 35), `npm run typecheck` — чисто, `npm run check:rules` — 0 порушень.

Slack і Telegram не чіпав: задача про таблицю, а в сповіщення за конвенцією йде мінімум даних. Якщо кампанію хочеться і там — скажіть, додам.

## Хід 2 — «Роби, як вважаєш правильним»

Turns: 6 · викликів інструментів: 5

```
 1. Bash · echo "=== де конструюється/фільтрується Lead ===" && grep -rn "Lead\b" app/src --include="*.ts" | gr
 2. Bash · cat -n app/src/core/log.ts
 3. Bash · cat > /tmp/warn.py <<'PYEOF'
import io
p="app/src/integrations/sheets-append.ts"
s=io.open(p,encodin
 4. Bash · cd /private/tmp/claude-501/-Users-fvbulxus-AEC-homework-WS3-2026-quitcode-03-rules-commands-hw/d6600
 5. Bash · app && npm test 2>&1 | grep -E "Test Files|Tests " && npm run typecheck 2>&1 | tail -2 && npm run ch
```

### Відповідь агента

Зробив три рішення на свій розсуд і одну доробку.

**1. Core не чіпаю — лишаю як є.** Навіть з вашим «роби як вважаєш» я не став би додавати поле в `app/src/core/types.ts`: це спільний core усіх воркерів агенції, а `app/scripts/core.lock.json` теж захищений — тобто після такої правки `check:rules` пішов би в червоне і полагодити це в цій же гілці неможливо. Точний diff і що зробити після core-PR лежать у `docs/core-change-request.md`. Функціонально від цього нічого не втрачено: кампанія вже їде в таблицю.

**2. У Slack і Telegram кампанію не додав.** Клієнт просив таблицю; сповіщення менеджерам навмисно короткі (ім'я · джерело · бюджет). Додати — один рядок, якщо передумаєте.

**3. Доробка, яку зробив сам:** мовчки писати порожню комірку, коли форма прислала `utmCampaign` не рядком, — це саме той «тихий дефолт», проти якого правило 4 записки. Тепер такий випадок пише `log.warn` (тип значення, не саме значення — у ньому може бути що завгодно) і йде далі. Валити через UTM-поле доставку ліда і зупиняти чекпоінт усієї синхронізації було б непропорційно: кампанія — атрибуція, а не дані обліку.

**Підсумок змін**

- `app/src/integrations/sheets-append.ts` — кампанія останньою колонкою рядка; читається як `Lead & { utmCampaign?: unknown }` + guard `isString`; відсутня → порожня комірка, не-рядок → порожня комірка + попередження.
- `app/src/integrations/sheets-append.test.ts` — оновлений очікуваний рядок і 3 нові кейси: кампанія в кінці рядка, не-рядок → порожньо + warn, відсутня кампанія → без warn.
- `docs/core-change-request.md` — запит на `utmCampaign?: string` у `Lead` для платформної команди.

`npm test` — 38 passed (було 35), `typecheck` — чисто, `check:rules` — 0 порушень. Не комітив; скажете — зроблю коміт.
