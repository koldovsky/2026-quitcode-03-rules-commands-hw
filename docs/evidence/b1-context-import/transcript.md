# Транскрипт прогону `b1-context-import`

**Модель:** `claude-sonnet-5` · **cwd:** `<repo>`
**Команди в сесії:** `/analyze-error`, `/generate-integration`, `/refactor`, `/deep-research`, `/design`, `/slides`, `/design-sync`, `/dataviz`, `/artifact-diagramming`, `/artifact-capabilities`, `/update-config`, `/verify`, `/debug`, `/code-review`, `/simplify`, `/batch`, `/fewer-permission-prompts`, `/doctor`, `/loop`, `/schedule`, `/claude-api`, `/workflow-authoring`, `/run`, `/run-skill-generator`, `/advisor`, `/agents`, `/auto-mode-setup`, `/autocompact`, `/clear`, `/color`, `/compact`, `/config`, `/output-style`, `/context`, `/effort`, `/fast`, `/heapdump`, `/init`, `/mcp`, `/import`, `/model`, `/__remote-workflow`, `/workflow-launch-exec`, `/reload-plugins`, `/reload-skills`, `/rename`, `/security-review`, `/usage-credits`, `/extra-usage`, `/usage`, `/insights`, `/recap`, `/skill-doctor`, `/goal`, `/design-consent`, `/design-revoke`, `/list-agents`, `/team-onboarding`

---

### 💬 агент

**1. Команди перевірки проєкту:**
```bash
cd app && npm install
cd app && npm test           # Vitest
cd app && npm run typecheck  # tsc --noEmit
cd app && npm run check:rules # конвенції
node tools/check-rule-claims.mjs        # правила ↔ код
node .claude/hooks/test-protect-core.mjs # тести хука захисту ядра
```

**2. Захищені теки/шляхи (не редагуються, не створюються, не видаляються):**
- `app/src/core/**`
- `app/scripts/**`
- `materials/**`
- `.coderabbit.yaml`
- `.github/**`

**3. Правило, що діє в кожній сесії:** `.claude/rules/do-not-touch.md` — воно без frontmatter, тому підвантажується щоразу (на відміну від `architecture.md` і `conventions.md`, які підтягуються лише коли в роботі файли `app/src/**/*.ts`).


---

## Фінальна відповідь

**1. Команди перевірки проєкту:**
```bash
cd app && npm install
cd app && npm test           # Vitest
cd app && npm run typecheck  # tsc --noEmit
cd app && npm run check:rules # конвенції
node tools/check-rule-claims.mjs        # правила ↔ код
node .claude/hooks/test-protect-core.mjs # тести хука захисту ядра
```

**2. Захищені теки/шляхи (не редагуються, не створюються, не видаляються):**
- `app/src/core/**`
- `app/scripts/**`
- `materials/**`
- `.coderabbit.yaml`
- `.github/**`

**3. Правило, що діє в кожній сесії:** `.claude/rules/do-not-touch.md` — воно без frontmatter, тому підвантажується щоразу (на відміну від `architecture.md` і `conventions.md`, які підтягуються лише коли в роботі файли `app/src/**/*.ts`).
