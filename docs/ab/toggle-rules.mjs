#!/usr/bin/env node
// Перемикач для A/B-валідації (Task D): ховає й повертає правила, спільну базу,
// команди і хук. Node, а не bash — щоб працювало і на Windows.
//
//   node docs/ab/toggle-rules.mjs off     ховає (прогін B — без правил)
//   node docs/ab/toggle-rules.mjs on      повертає (прогін A — з правилами)
//   node docs/ab/toggle-rules.mjs status  показує поточний стан
//
// Хук ховається в ОБОХ прогонах вручну не потрібно: він у списку нижче, тому
// `off` знімає і його. Перед прогоном A поверніть усе, окрім хука, якщо хочете
// міряти саме правила — див. docs/walkthrough.md, Task D.
import { existsSync, renameSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const TARGETS = [
  "CLAUDE.md",
  "AGENTS.md",
  ".claude/rules",
  ".claude/commands",
  ".claude/settings.json",
];

const mode = process.argv[2];
if (!["off", "on", "status"].includes(mode)) {
  console.error("Використання: node docs/ab/toggle-rules.mjs <off|on|status>");
  process.exit(1);
}

let changed = 0;

for (const target of TARGETS) {
  const live = join(repoRoot, target);
  const hidden = `${live}.off`;

  if (mode === "status") {
    const state = existsSync(live) ? "УВІМКНЕНО" : existsSync(hidden) ? "сховано (.off)" : "немає";
    console.log(`  ${target.padEnd(24)} ${state}`);
    continue;
  }

  const from = mode === "off" ? live : hidden;
  const to = mode === "off" ? hidden : live;

  if (!existsSync(from)) continue;
  if (existsSync(to)) {
    console.error(`  ПРОПУЩЕНО ${target}: ціль «${to}» вже існує`);
    continue;
  }

  renameSync(from, to);
  console.log(`  ${mode === "off" ? "сховано " : "повернуто"} ${target}`);
  changed++;
}

if (mode !== "status") {
  console.log(`\nГотово: ${changed} шлях(ів) перейменовано.`);
  console.log(
    mode === "off"
      ? "Тепер відкрийте НОВУ сесію і вставте запит з materials/ab-task.md без змін."
      : "Правила повернуто. Для прогону A відкрийте НОВУ сесію.",
  );
}
