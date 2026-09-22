#!/usr/bin/env node
// PreToolUse-хук: не дає редагувати захищені зони проєкту.
//
// Правило do-not-touch тільки ПРОСИТЬ агента не чіпати core — хук НЕ ДАЄ.
// Читає JSON із stdin, бере шлях із tool_input.file_path і, якщо він потрапляє
// в захищену зону, пише причину в stderr і виходить із кодом 2 — дію заблоковано.
//
// Node, а не bash, щоб працювало і на Windows.
import { relative, resolve, sep } from "node:path";

/** Захищені зони — той самий список, що в .claude/rules/do-not-touch.md. */
const PROTECTED = [
  "app/src/core",
  "app/scripts",
  "materials",
  ".github",
  ".coderabbit.yaml",
];

const EXIT_BLOCK = 2;

function readStdin() {
  return new Promise((done) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => done(data));
  });
}

/** Шлях під захищеною зоною? Порівнюємо нормалізовані шляхи, а не рядки. */
function protectedZoneFor(filePath, projectDir) {
  const target = resolve(projectDir, filePath);
  for (const zone of PROTECTED) {
    const zoneAbs = resolve(projectDir, zone);
    const rel = relative(zoneAbs, target);
    const inside = rel === "" || (!rel.startsWith("..") && !rel.startsWith(`..${sep}`));
    if (inside) return zone;
  }
  return null;
}

const raw = await readStdin();

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  // Не змогли розібрати вхід — не блокуємо, щоб не ламати роботу через свій баг.
  process.exit(0);
}

const projectDir = payload.cwd ?? process.cwd();
const filePath = payload.tool_input?.file_path ?? payload.tool_input?.notebook_path;
if (typeof filePath !== "string" || filePath === "") process.exit(0);

const zone = protectedZoneFor(filePath, projectDir);
if (zone === null) process.exit(0);

process.stderr.write(
  `ЗАБЛОКОВАНО ХУКОМ: ${filePath} лежить у захищеній зоні ${zone}/.\n` +
    `Ця зона належить платформній команді — зміни йдуть окремим PR через її рев'ю.\n` +
    `Не обходь заборону (зокрема через --write-lock у check:rules).\n` +
    `Зупинись і опиши людині: що саме треба змінити, навіщо, і що із задачі\n` +
    `можна зробити без цієї зміни. Процедура — у .claude/rules/do-not-touch.md.\n`,
);
process.exit(EXIT_BLOCK);
