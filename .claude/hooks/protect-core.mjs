#!/usr/bin/env node
// PreToolUse-хук: не дає змінити app/src/core/** і перегенерувати core.lock.json.
// Claude Code передає JSON на stdin; код виходу 2 блокує дію, stderr отримує агент.
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

// Сегмент шляху, а не префікс від кореня проєкту: так ловимо й копії репо (git worktree).
const PROTECTED_SEGMENT = "/app/src/core/";
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
let path = `${(isAbsolute(target) ? target : resolve(base, target)).replaceAll("\\", "/")}/`;
if (process.platform !== "linux") path = path.toLowerCase(); // macOS і Windows нечутливі до регістру

if (path.includes(PROTECTED_SEGMENT)) block(`заблоковано зміну ${target}: app/src/core/** — захищена зона.`);
process.exit(0);
