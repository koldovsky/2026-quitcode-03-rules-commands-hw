# Транскрипт прогону `b1-context-link`

**Модель:** `claude-sonnet-5` · **cwd:** `<repo>`
**Команди в сесії:** `/analyze-error`, `/generate-integration`, `/refactor`, `/deep-research`, `/design`, `/slides`, `/design-sync`, `/dataviz`, `/artifact-diagramming`, `/artifact-capabilities`, `/update-config`, `/verify`, `/debug`, `/code-review`, `/simplify`, `/batch`, `/fewer-permission-prompts`, `/doctor`, `/loop`, `/schedule`, `/claude-api`, `/workflow-authoring`, `/run`, `/run-skill-generator`, `/advisor`, `/agents`, `/auto-mode-setup`, `/autocompact`, `/clear`, `/color`, `/compact`, `/config`, `/output-style`, `/context`, `/effort`, `/fast`, `/heapdump`, `/init`, `/mcp`, `/import`, `/model`, `/__remote-workflow`, `/workflow-launch-exec`, `/reload-plugins`, `/reload-skills`, `/rename`, `/security-review`, `/usage-credits`, `/extra-usage`, `/usage`, `/insights`, `/recap`, `/skill-doctor`, `/goal`, `/design-consent`, `/design-revoke`, `/list-agents`, `/team-onboarding`

---

### 💬 агент

**1) Команди перевірки проєкту:**
- `cd app && npm run check:rules` — рядок `core-untouched` має бути 0
- `git status --short` — перевірка, що в списку немає `app/src/core/`, `app/scripts/`, `materials/`
- `git diff --stat main -- app/src/core app/scripts materials .github .coderabbit.yaml` — має бути порожньо
- `node .claude/hooks/test-protect-core.mjs` — тести обходів захисного хука

**2) Захищені від редагування теки/файли:**
| Шлях | Чому |
|---|---|
| `app/src/core/**` | спільне ядро; зміни йдуть окремим PR через платформну команду |
| `app/scripts/**` | перевірка правил і `core.lock.json` — суддя не редагується гравцем |
| `materials/**` | вхідні дані домашки: архітектурна записка, лог інциденту, A/B-запит |
| `.coderabbit.yaml`, `.github/**` | конфіг рев'ю і шаблон PR |

**3) Правило, що діє в кожній сесії:**
Правило з `.claude/rules/do-not-touch.md` (без frontmatter) — заборона редагувати, створювати чи видаляти файли у вищезгаданих захищених шляхах будь-яким способом (`Edit`, `Write`, `NotebookEdit`, `Bash`: `sed -i`, `tee`, `>`, `>>`, `cp`, `mv`, `patch`, `git checkout` тощо). Без винятків. Якщо задача вимагає зміни `core/` — треба зупинитись і описати: що змінити, навіщо, кого зачепить, який обхід можливий без core, і чекати рішення людини.


---

## Фінальна відповідь

**1) Команди перевірки проєкту:**
- `cd app && npm run check:rules` — рядок `core-untouched` має бути 0
- `git status --short` — перевірка, що в списку немає `app/src/core/`, `app/scripts/`, `materials/`
- `git diff --stat main -- app/src/core app/scripts materials .github .coderabbit.yaml` — має бути порожньо
- `node .claude/hooks/test-protect-core.mjs` — тести обходів захисного хука

**2) Захищені від редагування теки/файли:**
| Шлях | Чому |
|---|---|
| `app/src/core/**` | спільне ядро; зміни йдуть окремим PR через платформну команду |
| `app/scripts/**` | перевірка правил і `core.lock.json` — суддя не редагується гравцем |
| `materials/**` | вхідні дані домашки: архітектурна записка, лог інциденту, A/B-запит |
| `.coderabbit.yaml`, `.github/**` | конфіг рев'ю і шаблон PR |

**3) Правило, що діє в кожній сесії:**
Правило з `.claude/rules/do-not-touch.md` (без frontmatter) — заборона редагувати, створювати чи видаляти файли у вищезгаданих захищених шляхах будь-яким способом (`Edit`, `Write`, `NotebookEdit`, `Bash`: `sed -i`, `tee`, `>`, `>>`, `cp`, `mv`, `patch`, `git checkout` тощо). Без винятків. Якщо задача вимагає зміни `core/` — треба зупинитись і описати: що змінити, навіщо, кого зачепить, який обхід можливий без core, і чекати рішення людини.
