#!/usr/bin/env node
// PreToolUse-хук: не дає змінити app/src/core/** і app/scripts/** та перегенерувати core.lock.json.
// Claude Code передає JSON на stdin; код виходу 2 блокує дію, stderr отримує агент.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Сегменти шляху, а не префікси від кореня проєкту: так ловимо й копії репо (git worktree).
const PROTECTED = [
  ["/app/src/core/", "app/src/core/**"],
  ["/app/scripts/", "app/scripts/**"],
];
// Запуск перевірки з --write-lock у межах однієї команди, а не будь-яка згадка прапорця
// (інакше блокується, наприклад, коміт, у повідомленні якого є ця назва).
const REGENERATE_LOCK = /check[-:]rules(?:\.mjs)?\b[^|;&\n]*--write-lock/;

function block(message) {
  console.error(`protect-core: ${message} Правило do-not-touch: зупинись і опиши людині, що саме змінити в core і навіщо.`);
  process.exit(2);
}

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch (error) {
  console.error(`protect-core: не вдалося прочитати вхід хука, дію не перевірено: ${error.message}`);
  process.exit(1); // не блокує, але помилку видно
}

if (input?.tool_name === "Bash") {
  if (REGENERATE_LOCK.test(String(input.tool_input?.command ?? ""))) {
    block("заблоковано --write-lock: перегенерація core.lock.json приховує зміни в core від check:rules.");
  }
  process.exit(0);
}

const target = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
if (typeof target !== "string" || target === "") process.exit(0);

const base = input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
// resolve нормалізує й абсолютні шляхи: «…/integrations/../core/log.ts» → «…/core/log.ts».
let path = `${resolve(base, target).replaceAll("\\", "/")}/`;
if (process.platform !== "linux") path = path.toLowerCase(); // macOS і Windows нечутливі до регістру

const zone = PROTECTED.find(([segment]) => path.includes(segment));
if (zone) block(`заблоковано зміну ${target}: ${zone[1]} — захищена зона.`);
process.exit(0);
