#!/usr/bin/env node
// PreToolUse-хук: блокує ЗАПИС у захищені шляхи проєкту.
//
// Правило .claude/rules/do-not-touch.md лише ПРОСИТЬ агента не чіпати core.
// Цей хук НЕ ДАЄ: читає подію з stdin, і якщо дія пише в захищену зону —
// пише причину в stderr і виходить з кодом 2 (Claude Code блокує виклик
// і повертає stderr моделі).
//
// Покриття навмисно ширше за Edit|Write: інструмент Bash дозволяє обійти
// файловий хук через `sed -i`, `tee`, `> file`. Для Bash використано евристику
// «захищений шлях + ознака запису»: повний розбір shell тут неможливий.
// Читання (`cat`, `grep`, `rg`) НЕ блокується — воно дозволене й потрібне,
// напр. команді /analyze-error для materials/error-log.txt.
// Точні межі покриття, зокрема відомі обходи, — у docs/verification.md.
import { relative, resolve, sep } from "node:path";

/** Шляхи відносно кореня репо. Джерело: materials/architecture-brief.md. */
const PROTECTED = ["app/src/core", "app/scripts", "materials", ".coderabbit.yaml", ".github"];

/** Перезаписує еталонні хеші core — ховає порушення, не торкаючись захищеного файлу. */
const WRITE_LOCK = /--write-lock/;

/** Ознаки наміру записати: перенаправлення, редагування на місці, файлові операції. */
const WRITE_INTENT =
  /(^|[\s;&|(`])(rm|mv|cp|tee|truncate|dd|touch|mkdir|ln|chmod|chown|patch|install)\s|>>?[^>]|\bsed\b[^|]*\s-i|\bperl\b[^|]*\s-[a-zA-Z]*i|\bgit\s+(apply|checkout|restore|rm|mv)\b|\b(cat|printf|echo)\b[^|]*>/;

const toPosix = (p) => p.split(sep).join("/");

/** Чи лежить шлях у захищеній зоні. Порівняння по сегментах, не по префіксу рядка. */
export function protectedHit(filePath, projectDir) {
  if (typeof filePath !== "string" || filePath.trim() === "") return null;
  const rel = toPosix(relative(projectDir, resolve(projectDir, filePath)));
  if (rel === "" || rel.startsWith("../")) return null; // поза репо — не наша зона
  return PROTECTED.find((p) => rel === p || rel.startsWith(p + "/")) ?? null;
}

/** Згадка захищеного шляху в рядку команди — незалежно від наміру. */
function mentionsProtected(command) {
  for (const p of PROTECTED) {
    const escaped = p.replace(/[.]/g, "\\.");
    if (new RegExp(`(^|[\\s"'=(\`])\\.?/?${escaped}([\\s"'/)\`]|$)`).test(command)) return p;
  }
  return null;
}

export function protectedInCommand(command) {
  if (typeof command !== "string") return null;
  if (WRITE_LOCK.test(command)) return "app/scripts (--write-lock перезаписує core.lock.json)";
  const zone = mentionsProtected(command);
  if (zone && WRITE_INTENT.test(command)) return zone;
  return null;
}

/** Інструменти, що змінюють файли. Read/Grep/Glob навмисно НЕ блокуються. */
const WRITE_TOOLS = new Set(["Edit", "Write", "NotebookEdit", "MultiEdit"]);

export function decide(event, projectDir) {
  const tool = event?.tool_name;
  const input = event?.tool_input ?? {};

  if (WRITE_TOOLS.has(tool)) {
    for (const key of ["file_path", "notebook_path"]) {
      const zone = protectedHit(input[key], projectDir);
      if (zone) return { block: true, reason: `${tool} → ${input[key]}`, zone };
    }
    return { block: false };
  }

  if (tool === "Bash") {
    const zone = protectedInCommand(input.command);
    if (zone) return { block: true, reason: `Bash → ${String(input.command).slice(0, 200)}`, zone };
    return { block: false };
  }

  return { block: false };
}

function main() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", () => {
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      // fail-closed: незрозуміла подія — не пропускаємо
      process.stderr.write("protect-core: подію hook не вдалося розібрати (stdin не JSON). Дію заблоковано.\n");
      process.exit(2);
    }
    const verdict = decide(event, projectDir);
    if (!verdict.block) process.exit(0);
    process.stderr.write(
      `ЗАБЛОКОВАНО правилом do-not-touch: ${verdict.reason}\n` +
        `Захищена зона: ${verdict.zone}\n` +
        `Ці шляхи змінює лише платформна команда окремим PR. Зупинись і опиши людині, ` +
        `що саме і навіщо треба змінити, — або зроби це поза захищеною зоною.\n`,
    );
    process.exit(2);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) main();
