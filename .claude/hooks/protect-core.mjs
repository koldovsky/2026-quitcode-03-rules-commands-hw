#!/usr/bin/env node
// PreToolUse-хук: блокує ЗАПИС у захищені шляхи проєкту.
//
// Правило .claude/rules/do-not-touch.md лише ПРОСИТЬ агента не чіпати core.
// Цей хук НЕ ДАЄ: читає подію з stdin, і якщо дія пише в захищену зону —
// пише причину в stderr і виходить з кодом 2 (Claude Code блокує виклик
// і повертає stderr моделі).
//
// Покриття ширше за Edit|Write, бо Bash дозволяє обійти файловий хук
// (`sed -i`, `tee`, `> file`). Повний розбір shell тут неможливий, тому для
// Bash застосовано принцип «перевіряй ціль запису, а не згадку шляху»:
// команда ріжеться на сегменти по ; && || |, і в кожному перевіряються саме
// аргументи операцій запису. Читання (cat, grep, shasum) не блокується.
// Відомі межі покриття — у docs/verification.md, розділ Task E.
import { relative, resolve, sep } from "node:path";

/** Шляхи відносно кореня репо. Джерело: materials/architecture-brief.md. */
const PROTECTED = ["app/src/core", "app/scripts", "materials", ".coderabbit.yaml", ".github"];

/** Перезаписує еталонні хеші core — ховає порушення, не торкаючись захищеного файлу. */
const WRITE_LOCK = /--write-lock/;

/** Команди, що змінюють будь-який зі своїх файлових аргументів. */
const MUTATING_ALL = new Set([
  "rm", "mv", "tee", "truncate", "dd", "touch", "mkdir", "rmdir",
  "chmod", "chown", "patch", "shred", "unlink",
]);

/** Команди, що пишуть лише в останній аргумент; решта — джерела, їх читати можна. */
const MUTATING_DEST = new Set(["cp", "ln", "install", "rsync"]);

const toPosix = (p) => p.split(sep).join("/");
const unquote = (s) => s.replace(/^['"]|['"]$/g, "");

/**
 * Чи лежить шлях у захищеній зоні. Порівняння по сегментах, не по префіксу рядка.
 * `base` — від чого рахувати відносний шлях (для Bash це поточна тека команди,
 * яка може відрізнятись від кореня репо через `cd`).
 */
export function protectedHit(filePath, projectDir, base = projectDir) {
  if (typeof filePath !== "string" || filePath.trim() === "") return null;
  const clean = unquote(filePath.trim());
  if (clean === "" || clean.startsWith("-")) return null;
  let rel;
  try {
    rel = toPosix(relative(projectDir, resolve(base, clean)));
  } catch {
    return null;
  }
  if (rel === "" || rel.startsWith("../")) return null; // поза репо — не наша зона
  return PROTECTED.find((p) => rel === p || rel.startsWith(p + "/")) ?? null;
}

/** Ріже команду на сегменти по роздільниках shell. */
function segments(command) {
  return command.split(/\n|;|&&|\|\||\||&/).map((s) => s.trim()).filter(Boolean);
}

/** Розбиває сегмент на токени, зберігаючи лапки як одне ціле. */
function tokenize(segment) {
  return segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
}

/**
 * Шукає в команді операції ЗАПИСУ, ціль яких — захищений шлях.
 * Повертає зону або null. Згадка шляху сама по собі не блокує.
 */
export function protectedInCommand(command, projectDir, cwd = projectDir) {
  if (typeof command !== "string") return null;
  if (WRITE_LOCK.test(command)) return "app/scripts (--write-lock перезаписує core.lock.json)";

  // Поточна тека може змінюватись усередині команди: `cd app && echo x > ...`
  let base = cwd;

  for (const segment of segments(command)) {
    const tokens = tokenize(segment);
    if (tokens.length === 0) continue;

    const name = unquote(tokens[0]).split("/").pop();
    const rest = tokens.slice(1);

    // 0. Відстежуємо cd, щоб відносні шляхи далі рахувались правильно
    if (name === "cd" && rest.length > 0) {
      base = resolve(base, unquote(rest[0]));
      continue;
    }

    // 1. Цілі перенаправлення: > файл, >> файл (і злитно: >файл)
    for (const m of segment.matchAll(/>>?\s*("[^"]*"|'[^']*'|[^\s;&|<>]+)/g)) {
      const zone = protectedHit(m[1], projectDir, base);
      if (zone) return zone;
    }

    // 2. sed -i / perl -i: редагування на місці — усі файлові аргументи є цілями
    if ((name === "sed" || name === "perl") && rest.some((t) => /^-[a-zA-Z]*i/.test(t))) {
      for (const t of rest) {
        const zone = protectedHit(t, projectDir, base);
        if (zone) return zone;
      }
      continue;
    }

    // 3. git-підкоманди, що переписують робочу теку
    if (name === "git" && ["apply", "checkout", "restore", "rm", "mv", "clean"].includes(unquote(rest[0] ?? ""))) {
      for (const t of rest.slice(1)) {
        const zone = protectedHit(t, projectDir, base);
        if (zone) return zone;
      }
      continue;
    }

    // 4. Команди, що змінюють будь-який зі своїх аргументів
    if (MUTATING_ALL.has(name)) {
      for (const t of rest) {
        const zone = protectedHit(t, projectDir, base);
        if (zone) return zone;
      }
      continue;
    }

    // 5. Команди, що пишуть лише в останній аргумент (cp source dest)
    if (MUTATING_DEST.has(name)) {
      const args = rest.filter((t) => !t.startsWith("-"));
      const dest = args[args.length - 1];
      const zone = protectedHit(dest, projectDir, base);
      if (zone) return zone;
    }
  }
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
    // cwd із події: команда могла бути запущена не з кореня репо
    const cwd = typeof event?.cwd === "string" && event.cwd ? event.cwd : projectDir;
    const zone = protectedInCommand(input.command, projectDir, cwd);
    if (zone) return { block: true, reason: `Bash → ${String(input.command).slice(0, 160)}`, zone };
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
