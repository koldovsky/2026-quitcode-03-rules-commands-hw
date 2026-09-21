# CLAUDE.md

@AGENTS.md

## Лише для Claude Code

- Детальні правила — `.claude/rules/`: `do-not-touch.md` діє в кожній сесії;
  `architecture.md` і `conventions.md` підтягуються, коли ти читаєш `.ts`-файли в `app/src/`.
- Перед змінами в `app/src/` прочитай `app/src/integrations/slack-notify.ts` — так
  підвантажаться `architecture` і `conventions`, і це зразок; файли з порушеннями
  `check:rules` — не зразок.
- Команди — `.claude/commands/`: `/analyze-error <лог>`, `/refactor <файл>`,
  `/generate-integration <сервіс>`; дві останні запускає лише людина.
