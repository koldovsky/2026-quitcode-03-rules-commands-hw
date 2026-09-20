#!/usr/bin/env node
// Перевірка хука protect-core.mjs: node .claude/hooks/protect-core.test.mjs
// Виходить з кодом 1, якщо хоч один випадок поводиться не так, як заявлено.
//
// Останній блок — ВІДОМІ МЕЖІ: випадки, які хук свідомо не ловить.
// Вони перевіряються так само, щоб документація не розійшлась із поведінкою.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const hook = resolve(dirname(fileURLToPath(import.meta.url)), "protect-core.mjs");
const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const edit = (file_path, tool_name = "Edit") => JSON.stringify({ tool_name, tool_input: { file_path } });
const bash = (command) => JSON.stringify({ tool_name: "Bash", tool_input: { command } });

const CASES = [
  ["Edit: ядро, відносний шлях", edit("app/src/core/log.ts"), 2],
  ["Edit: ядро, абсолютний шлях", edit(`${projectDir}/app/src/core/types.ts`), 2],
  ["Edit: обхід через ../", edit("app/src/integrations/../core/http.ts"), 2],
  ["Write: лок-файл перевірки", edit("app/scripts/core.lock.json", "Write"), 2],
  ["Edit: materials", edit("materials/ab-task.md"), 2],
  ["Edit: .coderabbit.yaml", edit(".coderabbit.yaml"), 2],
  ["Write: .github", edit(".github/pull_request_template.md", "Write"), 2],
  ["Edit: дозволена інтеграція", edit("app/src/integrations/slack-notify.ts"), 0],
  ["Write: дозволені docs", edit("docs/verification.md", "Write"), 0],
  ["Edit: файл поза проєктом", edit("/tmp/scratch.txt"), 0],

  ["Bash: node -e writeFileSync у ядро", bash(`node -e "require('fs').writeFileSync('app/src/core/log.ts','x')"`), 2],
  ["Bash: python open(...,'w') у ядро", bash(`python3 -c "open('app/src/core/log.ts','w').write('x')"`), 2],
  ["Bash: sed -i по ядру", bash(`sed -i "" s/a/b/ app/src/core/http.ts`), 2],
  ["Bash: перенаправлення > у ядро", bash("echo x > app/src/core/types.ts"), 2],
  ["Bash: cd у теку ядра і запис", bash("cd app/src/core && echo x > log.ts"), 2],
  ["Bash: rm у materials", bash("rm materials/ab-task.md"), 2],
  ["Bash: git checkout по .github", bash("git checkout -- .github/pull_request_template.md"), 2],
  ["Bash: --write-lock", bash("npm run check:rules -- --write-lock"), 2],
  ["Bash: читання ядра через cat", bash("cat app/src/core/log.ts"), 0],
  ["Bash: читання ядра через python", bash(`python3 -c "open('app/src/core/log.ts').read()"`), 0],
  ["Bash: grep по ядру", bash("grep -rn postJson app/src/core/"), 0],
  ["Bash: звичайні тести", bash("cd app && npm test"), 0],
  ["Bash: запис у дозволений шлях", bash("echo x > docs/verification.md"), 0],

  ["ВІДОМА МЕЖА: шлях зібрано зі змінної", bash("P=app/src; echo x > $P/core/log.ts"), 0],
  ["ВІДОМА МЕЖА: шлях у base64", bash(`echo YXBwL3NyYy9jb3JlL2xvZy50cw== | base64 -d | xargs -I{} sh -c "echo x > {}"`), 0],
  ["ВІДОМА МЕЖА: биті вхідні дані", "не json", 0],
];

let failed = 0;
for (const [name, stdin, expected] of CASES) {
  const run = spawnSync("node", [hook], { input: stdin, env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir } });
  const ok = run.status === expected;
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  exit ${run.status} (очікувано ${expected})  ${name}`);
}

console.log(`\n${CASES.length - failed}/${CASES.length} випадків поводяться як заявлено`);
process.exit(failed > 0 ? 1 : 0);
