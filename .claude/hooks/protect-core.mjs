#!/usr/bin/env node
// PreToolUse-хук: блокує запис у захищені зони проєкту.
//
// Правило .claude/rules/do-not-touch.md просить не редагувати ці шляхи.
// Цей хук не дає це зробити: читає JSON із stdin, дістає шлях із tool_input
// і на збігу пише причину в stderr та виходить з кодом 2 — дію заблоковано.
//
// Перелік нижче збігається з do-not-touch.md. Якщо правило змінюється — міняй і тут.
import { relative, resolve, sep } from "node:path";

const PROTECTED = [
  "app/src/core/",      // ядро платформи
  "app/scripts/",       // перевірка правил разом з core.lock.json
  "materials/",         // записка, лог інциденту, текст A/B-запиту
  ".github/",           // шаблон PR і воркфлоу
  ".coderabbit.yaml",   // конфіг рев'ю
];

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

function readStdin() {
  return new Promise((done) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (raw += chunk));
    process.stdin.on("end", () => done(raw));
  });
}

// Шлях відносно кореня проєкту, у POSIX-вигляді. null — якщо поза проєктом.
function toProjectPath(filePath) {
  const rel = relative(projectDir, resolve(projectDir, filePath));
  if (rel === "" || rel.startsWith("..")) return null;
  return rel.split(sep).join("/");
}

const raw = await readStdin();

let input;
try {
  input = JSON.parse(raw);
} catch {
  // Формат входу невідомий — не блокуємо, але лишаємо слід.
  // Захист від зміни ядра тут не слабшає: check:rules звіряє геші core окремо.
  console.error("protect-core: не вдалося розібрати вхідний JSON, дію пропущено");
  process.exit(0);
}

const toolName = typeof input?.tool_name === "string" ? input.tool_name : "";
const toolInput = input?.tool_input ?? {};

// --- Гілка Bash ---------------------------------------------------------
// Edit/Write — не єдиний спосіб записати файл: `node -e`, `sed -i`, `>` роблять
// те саме через шелл. Тут ловимо реалістичні випадки: згадка захищеного шляху
// разом із ознакою запису. Це фільтр, а не пісочниця — межі описані в
// docs/verification.md, Task E.
if (toolName === "Bash") {
  const rawCommand = typeof toolInput.command === "string" ? toolInput.command : "";

  // Тіло heredoc — це дані (повідомлення коміту, вміст файлу), а не операція над
  // шляхом. Без цього `git commit <<MSG ... <захищений шлях> ... MSG` блокує сам себе.
  // Решта рядка з `<<TAG` лишається: саме там стоїть `> файл` у `cat <<MSG > файл`.
  const command = rawCommand.replace(/(<<-?\s*'?"?(\w+)'?"?[^\n]*)\n[\s\S]*?^\2$/gm, "$1");

  // Перевіряємо по команді без тіла heredoc: прапорець, згаданий у тексті
  // документа чи повідомлення коміту, нічого не переписує.
  if (/--write-lock/.test(command)) {
    console.error(
      "protect-core: --write-lock переписує app/scripts/core.lock.json і ховає зміну ядра. " +
        "Заблоковано, див. .claude/rules/do-not-touch.md.",
    );
    process.exit(2);
  }

  // Перенаправлення розбираємо явно: `2>&1` дублює дескриптор, `> /dev/null`
  // викидає вивід — ні те, ні те не пише у файл. Регексп із lookahead тут не
  // годиться: `\s*` відкочується і пропускає ціль повз перевірку.
  const redirectsToFile = [...command.matchAll(/(^|\s)\d?>>?\s*([^\s|;&]+)/g)].some(
    ([, , target]) => target !== "/dev/null",
  );

  const WRITE_HINTS =
    /(\btee\b|\bsed\b[^|]*-i|\brm\b|\bmv\b|\bcp\b|\btruncate\b|\bdd\b|\bchmod\b|writeFileSync|appendFileSync|createWriteStream|write_text|open\([^)]*,\s*["'][wax]|\bpatch\b|git\s+(?:checkout|restore|apply|clean))/;
  const mentioned = PROTECTED.find((prefix) => command.includes(prefix.replace(/\/$/, "")));

  if (mentioned && (redirectsToFile || WRITE_HINTS.test(command))) {
    console.error(
      `protect-core: команда змінює захищену зону (${mentioned}), заблоковано.\n` +
        "Див. .claude/rules/do-not-touch.md. Читати ці файли можна — змінювати ні.",
    );
    process.exit(2);
  }

  process.exit(0);
}
// --- Гілка Edit/Write ---------------------------------------------------
const candidates = [toolInput.file_path, toolInput.path, toolInput.notebook_path].filter(
  (value) => typeof value === "string" && value.length > 0,
);

for (const candidate of candidates) {
  const path = toProjectPath(candidate);
  if (path === null) continue;
  const hit = PROTECTED.find((prefix) =>
    prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix,
  );
  if (hit) {
    console.error(
      `protect-core: ${path} — захищена зона (${hit}), запис заблоковано.\n` +
        "Див. .claude/rules/do-not-touch.md: зупинись і опиши, що саме потрібно " +
        "змінити і навіщо. Зміни в цих шляхах ідуть окремим PR платформної команди.",
    );
    process.exit(2);
  }
}

process.exit(0);
