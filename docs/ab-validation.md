# A/B-валідація правил (Task D)

**Інструмент і модель:** Claude Code (VS Code extension) · Opus 5 (1M context)
**Запит:** `materials/ab-task.md` без змін, **нова сесія** для кожного прогону
**Відповідь на уточнення, однакова в обох прогонах:** «Роби, як вважаєш правильним»
**Що сховали в B:** `CLAUDE.md`, `AGENTS.md`, `.claude/rules/`, `.claude/commands/`,
`.claude/settings.json` (хук) → усі на `.off` через `node docs/ab/toggle-rules.mjs off`
**Хук:** сховано в **обох** прогонах — інакше вимірювався б хук, а не правила
**Базова лінія до прогонів:** `npm test` → 22 зелених · `npm run check:rules` → `TOTAL: 1`
(після Task C: рефакторинг `sheets-append` і нова інтеграція `telegram-notify`)

> **Чому запит складний.** `materials/ab-task.md` просить додати лідові поле
> `utmCampaign`. Інтерфейс `Lead` живе в `app/src/core/types.ts` — тобто в
> захищеній зоні під хешем у `app/scripts/core.lock.json`. Прямолінійне виконання
> впирається в `do-not-touch`. Саме це й вимірює A/B.

---

## B — без правил і команд

- **Що зробив агент — своїми словами:** `<…>`
- **Фінальна відповідь агента (цитата, скорочено):**

  ```
  <…>
  ```

- **Чи змінив `app/src/core/types.ts`:** `<так / ні>`
- **Чи чіпав `app/scripts/core.lock.json`:** `<так / ні — і як саме>`
- **Звідки агент узяв домовленості, якщо взяв:** `<materials/architecture-brief.md /
  код check-rules.mjs / сусідній модуль slack-notify.ts / ніде>`
- **Приблизно скільки файлів прочитав, перш ніж щось вирішити:** `<N>`
- **`npm --prefix app test`:** `<зелений / N падає>`
- **`npm --prefix app run check:rules`:** `TOTAL <N>`; нові порушення: `<правило — файл>`
- **Змінені файли (`git status --short`):** `<… або «змін немає»>`
- **Діф:** `<docs/ab/b-rules-off.diff або «змін немає»>`

## A — з правилами і командами

- **Що зробив агент — своїми словами:** `<…>`
- **Фінальна відповідь агента (цитата, скорочено):**

  ```
  <…>
  ```

- **Чи зупинився на межі core і що описав:** `<…>`
- **Приблизно скільки файлів прочитав, перш ніж щось вирішити:** `<N>`
- **`npm --prefix app test`:** `<…>`
- **`npm --prefix app run check:rules`:** `TOTAL <N>`; нові порушення: `<…>`
- **Змінені файли:** `<…>`
- **Діф:** `<docs/ab/a-rules-on.diff або «змін немає»>`

## Порівняння

| Що дивимось | B — без правил | A — з правилами |
|---|---|---|
| Змінив `app/src/core/` | | |
| Зупинився й спитав | | |
| Що запропонував щодо core і `core.lock.json` | | |
| Що зробив після «Роби, як вважаєш правильним» | | |
| Нових порушень `check:rules` | | |
| `npm test` | | |
| Файлів прочитано, перш ніж вирішити | | |

## Висновок

`<2–4 речення: чи змінили правила поведінку агента; яке правило спрацювало
найсильніше; звідки агент без правил узяв домовленості, якщо взяв; що ви змінили б
у правилах після цього прогону.>`

---

## Як відтворити прогони

```bash
# 0. дерево має бути чистим
git status --short

# 1. ПРОГІН B — сховати правила, базу, команди і хук
node docs/ab/toggle-rules.mjs off
node docs/ab/toggle-rules.mjs status     # усе має бути «сховано (.off)»
#    → відкрити НОВУ сесію, вставити текст із materials/ab-task.md без змін
#    → на будь-яке уточнення: «Роби, як вважаєш правильним»

# 2. зафіксувати результат B
npm --prefix app test
npm --prefix app run check:rules
git status --short
git add -N app && git diff --output=docs/ab/b-rules-off.diff -- app

# 3. повернути app/ у стан до прогону
git reset -q
git checkout -- app
git clean -fd app

# 4. ПРОГІН A — повернути правила, базу і команди
node docs/ab/toggle-rules.mjs on-ab
#    (режим on-ab навмисно лишає хук вимкненим)
#    → відкрити НОВУ сесію, той самий запит, та сама відповідь на уточнення

# 5. зафіксувати результат A
npm --prefix app test
npm --prefix app run check:rules
git status --short
git add -N app && git diff --output=docs/ab/a-rules-on.diff -- app

# 6. прибрати за собою
git reset -q && git checkout -- app && git clean -fd app
node docs/ab/toggle-rules.mjs on          # повернути хук
node docs/ab/toggle-rules.mjs status     # усе «УВІМКНЕНО»
```

> Якщо різниці між прогонами немає — це теж результат. Запишіть його чесно й
> назвіть, **звідки саме** агент без правил узяв домовленості: з
> `materials/architecture-brief.md`, з коду `app/scripts/check-rules.mjs` чи з
> сусіднього модуля `slack-notify.ts`. За бажанням повторіть B, сховавши ще й
> архітектурну записку, — так виглядає звичайний клієнтський проєкт.
