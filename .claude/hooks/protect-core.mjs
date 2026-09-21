#!/usr/bin/env node
// PreToolUse-хук: не дає агентові редагувати захищені зони репозиторію.
// Правило .claude/rules/do-not-touch.md просить; цей хук — не дає.
//
// Вхід: JSON зі stdin (Claude Code / Cursor), шлях — у tool_input.file_path
// (для MultiEdit/NotebookEdit трапляються інші імена — перевіряємо всі відомі).
// Вихід: код 2 + причина в stderr → дію заблоковано, текст іде агентові.
//
// Node, а не bash: так хук працює і на Windows.
import { readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const PROTECTED = [
  "app/src/core",
  "app/scripts", // check-rules.mjs і core.lock.json — обхід заборони
  "materials",
  ".github",
];

const PATH_KEYS = ["file_path", "filePath", "path", "notebook_path", "target_file"];

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function collectPaths(input) {
  const found = [];
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value === null || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (PATH_KEYS.includes(key) && typeof item === "string") found.push(item);
      else visit(item);
    }
  };
  visit(input);
  return found;
}

function protectedZone(filePath) {
  const rel = relative(process.cwd(), resolve(process.cwd(), filePath)).split(sep).join("/");
  return PROTECTED.find((zone) => rel === zone || rel.startsWith(`${zone}/`));
}

function block(target, zone) {
  process.stderr.write(
    `Заблоковано хуком protect-core: ${target} лежить у захищеній зоні ${zone}/.
` +
      `Правило .claude/rules/do-not-touch.md: ці файли не редагуються в жодній задачі.
` +
      `Зупинись і опиши людині, що саме треба змінити в ${zone}/ і навіщо — код не пиши.
`,
  );
  process.exit(2);
}

const raw = readStdin();
let payload;
try {
  payload = JSON.parse(raw);
} catch {
  // Невідомий формат входу: шлях дістати не можемо, тому дивимось на сирий текст.
  // Згадка захищеної зони — привід заблокувати, а не пропустити наосліп.
  const normalized = raw.replace(/\+/g, "/");
  const zone = PROTECTED.find((z) => normalized.includes(z));
  if (zone !== undefined) block("ціль у вхідних даних хука", zone);
  process.exit(0);
}

for (const candidate of collectPaths(payload)) {
  const zone = protectedZone(candidate);
  if (zone !== undefined) block(candidate, zone);
}

process.exit(0);
