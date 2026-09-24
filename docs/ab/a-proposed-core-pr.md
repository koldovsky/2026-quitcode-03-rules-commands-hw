# core: необов'язкове поле `utmCampaign` у `Lead`

## Навіщо

Клієнт Studio Nova (воркер `lead-sync`) хоче бачити в Google-таблиці, з якої рекламної
кампанії прийшов лід. Форма сайту вже передає `utmCampaign` (рядок, може бути відсутнім),
але `Lead` не має такого поля, тож інтеграції не можуть його отримати.

## Зміна

`app/src/core/types.ts`:

```diff
   budgetUsd?: number;
+  /** Рекламна кампанія з UTM-мітки форми сайту (`utmCampaign`), якщо передана. */
+  utmCampaign?: string;
   /** ISO-8601, UTC. */
   createdAt: string;
 }
```

- Поле необов'язкове, тому наявні воркери, інтеграції й тести не ламаються.
- Якщо у вашому коді заявка з форми розбирається в `Lead`, `utmCampaign` треба
  переносити там само: якщо значення — рядок, копіювати його, а якщо його немає,
  поле не заповнювати.
- Після злиття треба оновити `app/scripts/core.lock.json` (`--write-lock`), щоб
  `core-untouched` лишився `0`. Це робить платформна команда в цьому ж PR.

## Що зміниться в lead-sync після злиття (окремий PR, не core)

`app/src/integrations/sheets-append.ts`: кампанія йде останньою колонкою.

```diff
-    const row = [lead.createdAt, lead.name, lead.email, lead.phone ?? "", lead.source];
+    const row = [lead.createdAt, lead.name, lead.email, lead.phone ?? "", lead.source, lead.utmCampaign ?? ""];
```

`app/src/integrations/sheets-append.test.ts`:
- у наявному тесті очікуваний рядок отримує `""` у кінці (ліда без кампанії);
- новий тест: лід з `utmCampaign: "autumn-sale-2026"` дає рядок, що закінчується на `"autumn-sale-2026"`.

Slack і Telegram не змінюються: клієнт просив кампанію тільки в таблиці.
