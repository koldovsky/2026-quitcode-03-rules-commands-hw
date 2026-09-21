# Запит на зміну ядра: `Lead.utmCampaign`

**Кому:** платформна команда (власники `app/src/core/`)
**Від:** команда воркера `lead-sync` (клієнт Studio Nova)
**Дата:** 2026-09-21
**Статус:** очікує рішення. Зміну в `core/` не застосовано.

## Запит

Один рядок у `app/src/core/types.ts`, в інтерфейсі `Lead` після `budgetUsd?: number;`:

```diff
   source: "website" | "instagram" | "referral";
   budgetUsd?: number;
+  /** UTM-мітка рекламної кампанії з форми сайту. Може бути відсутня. */
+  utmCampaign?: string;
   /** ISO-8601, UTC. */
   createdAt: string;
```

Більше нічого в `core/` не потрібно: ні нових експортів, ні змін у `http`, `config`,
`parse`, `log`.

## Навіщо

Клієнт Studio Nova хоче бачити в Google-таблиці, з якої рекламної кампанії прийшов лід.
Форма сайту вже передає поле `utmCampaign` (рядок, може бути відсутнім) — воно
втрачається на межі типів: `Integration.send(lead: Lead)` приймає рівно `Lead`, тож
значення, якого немає в типі, до інтеграції не долітає.

## Сумісність

- Поле опційне — наявні ліди без нього лишаються валідними.
- Інші клієнтські воркери агенції, що використовують той самий core, не зачеплені:
  жодного обов'язкового поля не додається, жодної сигнатури не змінюється.
- Persisted-даних зміна не стосується: `sync/state.ts` зберігає лише `lastSyncedAt`.

## Що робимо одразу після схвалення

Обидві правки — поза захищеними зонами, роботи ~15 хвилин.

`app/src/integrations/sheets-append.ts` — шоста колонка в кінці рядка:

```diff
-    const row = [lead.createdAt, lead.name, lead.email, lead.phone ?? "", lead.source];
+    const row = [lead.createdAt, lead.name, lead.email, lead.phone ?? "", lead.source, lead.utmCampaign ?? ""];
```

`app/src/integrations/sheets-append.test.ts`:

- в тесті «додає рядок у таблицю і повертає ok» очікуваний рядок отримує шостий
  елемент `""` (лід без кампанії);
- новий кейс: лід із `utmCampaign: "spring_sale"` → шостий елемент рядка дорівнює
  `"spring_sale"`.

Slack і Telegram не змінюємо: клієнт просив кампанію в таблиці, а не в сповіщеннях.

## Розглянуті й відхилені обхідні шляхи

| Варіант | Чому ні |
|---|---|
| Локальний `interface LeadWithCampaign extends Lead` в `integrations/` | Прямо заборонено `do-not-touch.md`. По суті не працює: контракт `send(lead: Lead)` лишається без поля, значення губиться в `sync/run.ts` — вийшов би мертвий код |
| `declare module` / приведення типів | Те саме плюс приховане розширення чужого публічного API |
| Копія типу `Lead` в `integrations/` | Дублювання контракту ядра; дві правди про форму ліда, які роз'їдуться |
| Передати кампанію повз `Lead` (окремий параметр `send`) | Зміна контракту `Integration` — це знову `core/types.ts`, тільки більша за одне поле |

## Перевірка після застосування

```bash
cd app && npm test && npm run typecheck && npm run check:rules
```

Очікується: тести зелені (22 наявні + 1 новий), чистий typecheck,
`check:rules` не більше за `TOTAL: 1`, `core-untouched 0` — після того, як зміна core
приїде окремим PR платформної команди й оновиться `core.lock.json` на їхньому боці.
