#!/usr/bin/env node
// PreToolUse-хук: блокує будь-який запис у захищені зони проєкту.
// Правило .claude/rules/do-not-touch.md просить не чіпати core — цей хук не дає.
//
// Вхід: JSON у stdin від Claude Code (tool_name, tool_input.file_path, cwd, ...).
// Вихід: код 0 — дію дозволено; код 2 — дію заблоковано, stderr іде агентові.
// Node, а не bash: так хук працює і на Windows.
import { readFileSync } from "node:fs";

const PROTECTED_DIRS = [
  { prefix: "app/src/core/", why: "ядро платформи: зміни йдуть окремим PR через рев'ю платформної команди" },
  { prefix: "app/scripts/", why: "інфраструктура перевірки правил" },
  { prefix: "materials/", why: "матеріали завдання" },
  { prefix: ".github/", why: "конфігурація репозиторію" },
];
const PROTECTED_FILES = [{ name: ".coderabbit.yaml", why: "конфігурація рев'ю CodeRabbit" }];

const toPosix = (value) => value.split("\\").join("/");

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  process.exit(0); // stdin недоступний — не блокуємо роботу
}

let payload = {};
try {
  payload = JSON.parse(raw || "{}");
} catch {
  process.exit(0); // не розпарсили вхід — не блокуємо роботу
}

const input = payload.tool_input ?? {};
const candidates = [input.file_path, input.notebook_path, input.path].filter(
  (value) => typeof value === "string" && value.length > 0,
);
if (candidates.length === 0) process.exit(0);

const cwd = toPosix(payload.cwd ?? process.cwd()).replace(/\/+$/, "");

for (const candidate of candidates) {
  const normalized = toPosix(candidate);
  const relative = normalized.toLowerCase().startsWith(cwd.toLowerCase() + "/")
    ? normalized.slice(cwd.length + 1)
    : normalized;
  const cleaned = relative.replace(/^\.\//, "");

  const dir = PROTECTED_DIRS.find((z) => cleaned.startsWith(z.prefix) || cleaned.includes("/" + z.prefix));
  const file = PROTECTED_FILES.find((f) => cleaned === f.name || cleaned.endsWith("/" + f.name));
  const hit = dir ?? file;

  if (hit) {
    process.stderr.write(
      `ЗАБЛОКОВАНО хуком protect-core: запис у «${cleaned}» заборонено.\n` +
        `Захищена зона: ${dir ? dir.prefix : file.name} — ${hit.why}.\n` +
        `Див. .claude/rules/do-not-touch.md. Не обходь це редагуванням app/scripts/core.lock.json.\n` +
        `Якщо задача не виконується без зміни ядра — зупинись і опиши людині:\n` +
        `  1) що саме треба змінити (файл, рядок, правка); 2) навіщо;\n` +
        `  3) що можна зробити вже зараз без ядра; 4) який обхідний варіант існує.\n`,
    );
    process.exit(2);
  }
}

process.exit(0);
