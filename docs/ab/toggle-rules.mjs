#!/usr/bin/env node
// Перемикач для A/B-валідації (Task D): ховає й повертає правила, спільну базу,
// команди і хук. Node, а не bash — щоб працювало і на Windows.
//
//   node docs/ab/toggle-rules.mjs off      прогін B: ховає ВСЕ, разом із хуком
//   node docs/ab/toggle-rules.mjs on-ab    прогін A: повертає правила, базу і
//                                          команди, але хук лишає вимкненим
//   node docs/ab/toggle-rules.mjs on       після A/B: повертає все, разом із хуком
//   node docs/ab/toggle-rules.mjs status   показує поточний стан
//
// Хук вимкнено в ОБОХ прогонах навмисно: інакше він заблокує зміну ядра, і ви
// виміряєте хук, а не правила (docs/walkthrough.md, Task D).
import { existsSync, renameSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const RULES = ["CLAUDE.md", "AGENTS.md", ".claude/rules", ".claude/commands"];
const HOOK = [".claude/settings.json"];

const MODES = {
  off: { targets: [...RULES, ...HOOK], direction: "hide" },
  "on-ab": { targets: RULES, direction: "show" },
  on: { targets: [...RULES, ...HOOK], direction: "show" },
};

const mode = process.argv[2];
if (mode !== "status" && !MODES[mode]) {
  console.error("Використання: node docs/ab/toggle-rules.mjs <off|on-ab|on|status>");
  process.exit(1);
}

if (mode === "status") {
  for (const target of [...RULES, ...HOOK]) {
    const live = join(repoRoot, target);
    const state = existsSync(live)
      ? "УВІМКНЕНО"
      : existsSync(`${live}.off`)
        ? "сховано (.off)"
        : "немає";
    console.log(`  ${target.padEnd(24)} ${state}`);
  }
  process.exit(0);
}

const { targets, direction } = MODES[mode];
let changed = 0;

for (const target of targets) {
  const live = join(repoRoot, target);
  const hidden = `${live}.off`;
  const from = direction === "hide" ? live : hidden;
  const to = direction === "hide" ? hidden : live;

  if (!existsSync(from)) continue;
  if (existsSync(to)) {
    console.error(`  ПРОПУЩЕНО ${target}: ціль «${to}» вже існує`);
    continue;
  }

  renameSync(from, to);
  console.log(`  ${direction === "hide" ? "сховано " : "повернуто"} ${target}`);
  changed++;
}

console.log(`\nГотово: ${changed} шлях(ів) перейменовано.`);

if (mode === "off") {
  console.log("Прогін B. Відкрийте НОВУ сесію і вставте запит з materials/ab-task.md без змін.");
} else if (mode === "on-ab") {
  console.log("Прогін A. Хук навмисно лишається вимкненим — так міряються саме правила.");
  console.log("Відкрийте НОВУ сесію і вставте ТОЙ САМИЙ запит.");
} else {
  console.log("Усе повернуто, разом із хуком. A/B завершено.");
}
