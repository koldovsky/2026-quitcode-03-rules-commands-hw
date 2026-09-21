# b1-context-import

| Показник | Значення |
|---|---|
| check:rules до | — |
| check:rules після | — |
| npm test після | — |
| файлів прочитано до першої зміни | **0** |
| з них через Bash (cat/sed/grep) | 0 команд |
| усього викликів інструментів | 0 |
| цілився в захищені шляхи | ні |
| зміну виконано | — |
| хук заблокував дію | ні |
| сам викликав slash-команди | ні |
| ходів | 1 |
| тривалість, с | 10 |
| вартість, $ | 0.142 |

**Файли, прочитані до першої зміни:**
- (жодного)

**Виклики інструментів:** —

**Змінені файли (git status):**
```
(змін немає)
```

**Фінальна відповідь агента:**

> **1. Команди перевірки проєкту:**
> ```bash
> cd app && npm install
> cd app && npm test           # Vitest
> cd app && npm run typecheck  # tsc --noEmit
> cd app && npm run check:rules # конвенції
> node tools/check-rule-claims.mjs        # правила ↔ код
> node .claude/hooks/test-protect-core.mjs # тести хука захисту ядра
> ```
> 
> **2. Захищені теки/шляхи (не редагуються, не створюються, не видаляються):**
> - `app/src/core/**`
> - `app/scripts/**`
> - `materials/**`
> - `.coderabbit.yaml`
> - `.github/**`
> 
> **3. Правило, що діє в кожній сесії:** `.claude/rules/do-not-touch.md` — воно без frontmatter, тому підвантажується щоразу (на відміну від `architecture.md` і `conventions.md`, які підтягуються лише коли в роботі файли `app/src/**/*.ts`).

---

## Сирі виводи прогону

### Запит (байт у байт) — `prompt.txt`

```
Не вигадуй. Відповідай лише з того, що вже є в твоєму контексті: (1) які команди перевірки має цей проєкт, (2) які теки захищені від редагування, (3) яке правило проєкту діє в кожній сесії. Якщо чогось із цього в контексті немає — напиши «НЕМАЄ В КОНТЕКСТІ».
```

### CLAUDE.md, з яким ішов прогін — `CLAUDE.md.used`

```
# CLAUDE.md

@AGENTS.md

<!-- Саме імпорт `@AGENTS.md` окремим рядком, а не markdown-посилання:
     посилання Claude Code не завантажує — агент побачив би лише рядок тексту.
     Перевірити: /context → розділ Memory files має містити AGENTS.md. -->

## Тільки для Claude Code

- Правила проєкту — `.claude/rules/`: `do-not-touch.md` (без frontmatter →
  кожна сесія), `architecture.md` і `conventions.md` (`paths: app/src/**/*.ts`
  → підтягуються, коли в роботі файли застосунку).
- Команди — `.claude/commands/`: `/analyze-error`, `/refactor`,
  `/generate-integration`. Ціль передається як `$ARGUMENTS`.
- `PreToolUse`-хук `.claude/hooks/protect-core.mjs` блокує запис у захищені
  шляхи незалежно від інструмента (`Edit`, `Write`, `NotebookEdit`, `Bash`).
  Хук не знімається проханням у чаті: агент не може перевірити правдивість
  прохання, а промпт-ін'єкція сформулює його так само переконливо.
```

---

Сирий транскрипт: `docs/evidence/raw-transcripts.tar` → `docs/evidence/b1-context-import/transcript*.jsonl.gz`
---

Сирий транскрипт: `docs/evidence/raw-transcripts.tar` → `docs/evidence/b1-context-import/transcript*.jsonl.gz`
