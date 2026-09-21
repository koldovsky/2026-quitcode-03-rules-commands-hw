---
description: Додати інтеграцію з новим зовнішнім сервісом за архітектурою проєкту — модуль, тест поруч, запис у реєстрі.
argument-hint: <сервіс, напр. HubSpot, Pipedrive, Telegram>
disable-model-invocation: true
---

# generate-integration

**Ціль:** $ARGUMENTS
(Якщо в рядку вище немає назви сервісу — ціль вказана в повідомленні одразу після
назви команди. Немає й там — спитай і зупинись.)

## Кроки

1. Визнач із цілі:
   - `<kebab-name>` за зразком `slack-notify`, `sheets-append` — `<сервіс>-<дія>`;
   - тип системи: **сповіщення** (месенджер, чат) чи **система обліку** (CRM,
     таблиця) — від цього залежить, які поля ліда можна передавати (правило
     `conventions`, мінімізація даних).
2. Запиши базовий стан: `git status --short -- app` і TOTAL з
   `npm --prefix app run check:rules`. Наявні зміни не твої — не чіпай і не відкочуй їх.
3. Прочитай `app/src/integrations/slack-notify.ts` і його тест (зразок),
   `app/src/integrations/index.ts`, `app/src/core/types.ts` і сигнатури в
   `app/src/core/http.ts`, `config.ts`, `parse.ts`, `log.ts` — підтягнуться правила
   `architecture` і `conventions`.
4. Визнач виклик API сервісу: метод, URL, заголовки (секрети — лише в них, правило
   `conventions`), тіло, ознаку успіху у відповіді. Бери з документації сервісу; не
   впевнений у деталі — винеси її в змінну середовища й познач у підсумку. Сервісу
   потрібне те, чого немає в API ядра (не-POST запит, OAuth-обмін, нове поле `Lead`), —
   зупинись за правилом `do-not-touch`.
5. Створи `app/src/integrations/<kebab-name>.ts` — об'єкт типу `Integration` за
   правилами `architecture` і `conventions`.
6. Створи `app/src/integrations/<kebab-name>.test.ts` — кейси з правила `conventions`
   (успіх з перевіркою URL і тіла, відсутня змінна середовища, помилка сервісу); для
   сповіщень — ще перевірка, що в тілі немає email і телефону (фікстура має обидва).
7. Додай імпорт і запис у масив `app/src/integrations/index.ts`.
8. Перевір: `npm --prefix app test`, `npm --prefix app run typecheck`,
   `npm --prefix app run check:rules`, потім `git status --short -- app`.
9. Підсумок: файли; змінні середовища (лише імена); які поля ліда йдуть у сервіс і
   чому; припущення про API, які треба звірити з документацією.

## Acceptance criteria

- [ ] `git status --short -- app` порівняно з базовим: додались рівно `<kebab-name>.ts`
      і `<kebab-name>.test.ts` в `app/src/integrations/`, змінився `index.ts` — більше
      нічого.
- [ ] `name` = ім'я файлу без `.ts`; модуль типізований як `Integration`; `send()`
      повертає `Result` і не кидає винятків.
- [ ] Секрети — у заголовках, не в URL (правило `conventions`).
- [ ] Є тести з кроку 6; `npm test` зелений; `npm run typecheck` без помилок.
- [ ] `check:rules`: 0 порушень у нових файлах, TOTAL не більший за базовий,
      `core-untouched 0`; `package.json` не змінено.
- [ ] Підсумок показано людині.

## Stop

Змінюй лише три файли з критеріїв — не `app/src/core/**` і не інші файли; не додавай
залежностей. Потрібне те, чого немає в API ядра, — зупинись і опиши за правилом
`do-not-touch`. Не роби коміт: покажи підсумок і чекай.
