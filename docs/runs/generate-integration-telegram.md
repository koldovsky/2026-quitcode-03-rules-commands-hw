<!-- Дослівний вивід прогону. Не редаговано. -->
# /generate-integration — telegram

**Виклик:** `claude -p "/generate-integration telegram" --model sonnet --permission-mode bypassPermissions`
**Turns:** 19 · **Тривалість:** 67 с · **Вартість:** $0.2543

---

My changes touch exactly the three expected paths (module, test, `index.ts` line); the other modified files were already dirty before this task from earlier work and are untouched by me. `app/src/core/**` is untouched.

## Summary

- **Три створені/змінені шляхи:** `app/src/integrations/telegram-notify.ts`, `app/src/integrations/telegram-notify.test.ts`, один рядок у `app/src/integrations/index.ts`.
- **Тип сервісу:** сповіщення — Telegram-чат менеджерів, аналог `slack-notify`. Тому в тіло запиту (`chat_id`, `text`) йдуть лише `name`, `source`, `budgetUsd`; `email` і `phone` не потрапляють, тест це перевіряє явним `expect(...).not.toContain(...)`.
- **`npm test`:** 23/23 зелені (було 18, +5 нових тестів: форматування, успіх, відсутній `TELEGRAM_BOT_TOKEN`, відсутній `TELEGRAM_CHAT_ID`, помилка від Telegram API).
- **`npm run typecheck`:** без помилок.
- **`npm run check:rules`:** TOTAL 1 (порушення в `src/sync/state.ts`, не пов'язане з цією зміною і вже було до неї) — TOTAL не виріс, `core-untouched` = 0, модуль telegram-notify не дав жодного нового порушення.