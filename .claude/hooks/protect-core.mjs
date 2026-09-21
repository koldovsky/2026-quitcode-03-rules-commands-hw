#!/usr/bin/env node
// PreToolUse hook: hard-blocks Edit/Write under app/src/core/**.
// do-not-touch.md asks; this doesn't. See docs/walkthrough.md, Task E.
import { readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

let input;
try {
  input = JSON.parse(readStdin());
} catch {
  process.exit(0); // не наш формат — пропускаємо
}

const filePath = input?.tool_input?.file_path;
if (!filePath) process.exit(0);

const cwd = input.cwd || process.cwd();
const relPath = relative(cwd, resolve(cwd, filePath)).split(sep).join("/");

if (relPath.toLowerCase().startsWith("app/src/core/")) {
  console.error(
    `protect-core: ${relPath} — app/src/core/** захищене ядро агенції (не редагується в цьому проєкті). ` +
      `Якщо задача цього вимагає — опиши потрібну зміну текстом, це піде окремим PR через рев'ю платформної команди.`,
  );
  process.exit(2);
}

process.exit(0);
