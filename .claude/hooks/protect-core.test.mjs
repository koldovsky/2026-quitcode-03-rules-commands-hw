#!/usr/bin/env node
// Тести хука. Запуск: node .claude/hooks/protect-core.test.mjs
// Перевіряємо справжній контракт: JSON у stdin → код виходу. Нуль залежностей.
//
// Останній блок — ВІДОМІ ОБХОДИ. Вони позначені як ALLOW не тому, що це
// правильно, а тому, що хук їх не ловить: це задокументована межа покриття,
// а не пропущений баг. Див. docs/verification.md, Task E.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const hook = resolve(here, "protect-core.mjs");
const projectDir = resolve(here, "..", "..");
const CORE = "app/src/core/log.ts";

function run(event) {
  const r = spawnSync(process.execPath, [hook], {
    input: typeof event === "string" ? event : JSON.stringify(event),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    encoding: "utf8",
  });
  return { code: r.status, stderr: r.stderr };
}

const BLOCK = 2;
const ALLOW = 0;
const bash = (command) => ({ tool_name: "Bash", tool_input: { command } });

const cases = [
  // --- блокує: файлові інструменти ---
  ["Edit у core", BLOCK, { tool_name: "Edit", tool_input: { file_path: CORE } }],
  ["Write у core", BLOCK, { tool_name: "Write", tool_input: { file_path: "app/src/core/new.ts" } }],
  ["абсолютний шлях", BLOCK, { tool_name: "Edit", tool_input: { file_path: `${projectDir}/${CORE}` } }],
  ["обхід через ..", BLOCK, { tool_name: "Edit", tool_input: { file_path: "app/src/integrations/../core/log.ts" } }],
  ["./ на початку", BLOCK, { tool_name: "Edit", tool_input: { file_path: `./${CORE}` } }],
  ["core.lock.json", BLOCK, { tool_name: "Edit", tool_input: { file_path: "app/scripts/core.lock.json" } }],
  ["materials", BLOCK, { tool_name: "Write", tool_input: { file_path: "materials/error-log.txt" } }],
  [".coderabbit.yaml", BLOCK, { tool_name: "Edit", tool_input: { file_path: ".coderabbit.yaml" } }],
  [".github", BLOCK, { tool_name: "Edit", tool_input: { file_path: ".github/pull_request_template.md" } }],
  ["NotebookEdit", BLOCK, { tool_name: "NotebookEdit", tool_input: { notebook_path: "app/src/core/x.ipynb" } }],

  // --- блокує: обхід через Bash (ціль запису — захищений шлях) ---
  ["sed -i у core", BLOCK, bash(`sed -i '' 's/a/b/' ${CORE}`)],
  ["перенаправлення в core", BLOCK, bash(`echo x > ${CORE}`)],
  ["дозапис у core", BLOCK, bash(`echo x >> ${CORE}`)],
  ["tee в core", BLOCK, bash(`echo x | tee ${CORE}`)],
  ["rm core", BLOCK, bash(`rm ${CORE}`)],
  ["mv lock-файлу", BLOCK, bash("mv app/scripts/core.lock.json /tmp/x")],
  ["git checkout materials", BLOCK, bash("git checkout -- materials/error-log.txt")],
  ["--write-lock", BLOCK, bash("npm run check:rules -- --write-lock")],
  ["--write-lock з іншої теки", BLOCK, bash("cd /tmp && node scripts/check-rules.mjs --write-lock")],
  ["запис у core в 2-му сегменті", BLOCK, bash(`cd app && echo x > ../${CORE}`)],

  // --- пропускає: читання і робота поза захищеною зоною ---
  ["Edit в integrations", ALLOW, { tool_name: "Edit", tool_input: { file_path: "app/src/integrations/slack-notify.ts" } }],
  ["Write у docs", ALLOW, { tool_name: "Write", tool_input: { file_path: "docs/verification.md" } }],
  ["хибний префікс corex", ALLOW, { tool_name: "Edit", tool_input: { file_path: "app/src/corex/a.ts" } }],
  ["Read з core", ALLOW, { tool_name: "Read", tool_input: { file_path: CORE } }],
  ["Grep по core", ALLOW, { tool_name: "Grep", tool_input: { pattern: "postJson", path: "app/src/core" } }],
  ["cat materials", ALLOW, bash("cat materials/error-log.txt")],
  ["grep у core", ALLOW, bash("grep -rn postJson app/src/core")],
  ["npm test", ALLOW, bash("cd app && npm test")],
  ["check:rules без write-lock", ALLOW, bash("npm run check:rules")],
  ["шлях поза репо", ALLOW, { tool_name: "Write", tool_input: { file_path: "/tmp/app/src/core/x.ts" } }],

  // --- регресії: хибні спрацювання, знайдені живим прогоном ---
  ["shasum core у конвеєрі", ALLOW, bash(`shasum ${CORE} | cut -d' ' -f1`)],
  ["читання core, запис у /tmp", ALLOW, bash(`cat ${CORE} > /tmp/copy.txt`)],
  ["згадка core в тексті echo", ALLOW, bash(`echo "перевіряємо ${CORE} зараз"`)],
  ["diff двох core-файлів", ALLOW, bash(`diff ${CORE} app/src/core/http.ts`)],
  ["cp З core назовні", ALLOW, bash(`cp -R app/src/core /tmp/backup`)],
  ["cp У core — блокує", BLOCK, bash(`cp /tmp/x.ts ${CORE}`)],
  ["cd app, запис у core", BLOCK, bash("cd app && echo x > src/core/log.ts")],

  // --- регресії за рев'ю CodeRabbit ---
  ["cd падає, || — shell у корені", BLOCK, bash(`cd missing || echo x > ${CORE}`)],
  ["cd падає, ; — shell у корені", BLOCK, bash(`cd missing ; echo x > ${CORE}`)],
  ["ланцюжок cd не губить корінь", BLOCK, bash(`cd app || cd /tmp || echo x > ${CORE}`)],

  // --- регресії: динамічний cd (друге рев'ю CodeRabbit) ---
  ["cd зі змінною → fail-closed", BLOCK, bash('cd "$PWD/app" && echo x > src/core/log.ts')],
  ["cd з $(…) → fail-closed", BLOCK, bash("cd $(pwd)/app && echo x > src/core/log.ts")],
  ["cd з `pwd` → fail-closed", BLOCK, bash("cd `pwd`/app && echo x > src/core/log.ts")],
  ["cd з ~ → fail-closed", BLOCK, bash("cd ~/app && echo x > src/core/log.ts")],
  ["cd з bracket-glob → fail-closed", BLOCK, bash("cd [a]pp && echo x > src/core/log.ts")],
  ["cd з brace-expansion → fail-closed", BLOCK, bash("cd {app,x} && echo x > src/core/log.ts")],
  ["cd з ? → fail-closed", BLOCK, bash("cd ap? && echo x > src/core/log.ts")],
  ["cd з * → fail-closed", BLOCK, bash("cd a* && echo x > src/core/log.ts")],
  ["cd зі static-шляхом і .. — блокує", BLOCK, bash("cd app/../app && echo x > src/core/log.ts")],
  ["cd за межі репо — не наша зона", ALLOW, bash("cd ../app && echo x > src/core/log.ts")],
  ["cd -- app → запис у core блокується", BLOCK, bash("cd -- app && echo x > src/core/log.ts")],
  ["cd -P app → fail-closed", BLOCK, bash("cd -P app && echo x > src/core/log.ts")],
  ["cd -L app → fail-closed", BLOCK, bash("cd -L app && echo x > src/core/log.ts")],
  ["cd без аргументу → fail-closed", BLOCK, bash("cd && echo x > src/core/log.ts")],
  ["динамічний cd + абсолютний /tmp — можна", ALLOW, bash("cd $HOME && echo y > /tmp/out.txt")],
  ["динамічний cd без запису — можна", ALLOW, bash("cd $HOME && npm test")],

  // --- некоректний вхід: fail-closed ---
  ["stdin не JSON", BLOCK, "це не json"],

  // --- ВІДОМІ ОБХОДИ: хук їх не ловить (задокументована межа) ---
  ["обхід: python -c", ALLOW, bash(`python3 -c "open('${CORE}','a').write('x')"`)],
  ["обхід: node -e", ALLOW, bash(`node -e "require('fs').appendFileSync('${CORE}','x')"`)],
  ["обхід: змінна в шляху", ALLOW, bash(`D=app/src/core; echo x > $D/log.ts`)],
  ["обхід: heredoc", ALLOW, bash(`cat <<'EOF' | tee -a ${CORE.replace("app/src/core", "$CORE_DIR")}\nx\nEOF`)],
];

let failed = 0;
let section = "";
for (const [name, expected, event] of cases) {
  const { code } = run(event);
  const ok = code === expected;
  if (!ok) failed++;
  const tag = name.startsWith("обхід:") ? "знано" : ok ? "ok   " : "FAIL ";
  console.log(`${tag} ${name.padEnd(32)} очікували ${expected}, отримали ${code}`);
}

// Регресія: шлях із пробілом не повинен вимикати хук (pathToFileURL).
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
const spaceDir = mkdtempSync(resolve(tmpdir(), "hook test ")) + " dir";
import { mkdirSync } from "node:fs";
mkdirSync(spaceDir, { recursive: true });
const spacedHook = resolve(spaceDir, "protect-core.mjs");
copyFileSync(hook, spacedHook);
{
  const r = spawnSync(process.execPath, [spacedHook], {
    input: JSON.stringify({ tool_name: "Edit", tool_input: { file_path: CORE } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    encoding: "utf8",
  });
  const ok = r.status === BLOCK;
  if (!ok) failed++;
  console.log(`${ok ? "ok   " : "FAIL "} ${"шлях із пробілом не вимикає хук".padEnd(32)} очікували ${BLOCK}, отримали ${r.status}`);
}

const sample = run({ tool_name: "Edit", tool_input: { file_path: CORE } });
console.log(`\nstderr при блокуванні:\n${sample.stderr}`);
console.log(failed === 0 ? `Усі ${cases.length + 1} перевірок пройдено.` : `${failed} з ${cases.length} НЕ пройдено.`);
process.exit(failed === 0 ? 0 : 1);
