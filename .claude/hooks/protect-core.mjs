#!/usr/bin/env node
// PreToolUse-хук: не дає ЗАПИСУВАТИ в захищені шляхи проєкту.
//
// Навіщо, якщо є правило .claude/rules/do-not-touch.md. Правило просить —
// модель може його не втримати в контексті, переконати себе винятком або
// просто не побачити (правило без frontmatter теж можна витіснити довгою
// сесією). Хук перевіряє ШЛЯХ ПРИЗНАЧЕННЯ, а не намір, і не знімається
// проханням у чаті.
//
// Чому не список заборонених команд. `Edit` — лише один зі способів дотягнутись
// до файлу: `sed -i`, `tee`, `>`, `cp`, `patch`, `git checkout -- <path>`,
// `node -e "fs.writeFileSync(...)"` ведуть до тих самих байтів. Тому Bash
// перевіряється окремо: чи згадано захищений шлях І чи є в команді дія запису.
//
// Читання НЕ блокується: `/analyze-error materials/error-log.txt` має працювати,
// а `npm run check:rules` — читати core, щоб порахувати хеші.
//
// Контракт Claude Code: JSON на stdin; exit 0 — пропустити, exit 2 — заблокувати
// (stderr повертається моделі як причина відмови). Cursor: `.cursor/hooks.json`,
// той самий скрипт, той самий код виходу.
//
// Тести: node .claude/hooks/test-protect-core.mjs — запускати після кожної зміни.
import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

/** Шляхи, у які не можна писати. Джерело: materials/architecture-brief.md. */
export const PROTECTED = [
  { path: "app/src/core", why: "спільне ядро платформної команди" },
  { path: "app/scripts", why: "перевірка правил і core.lock.json" },
  { path: "materials", why: "вхідні дані домашки" },
  { path: ".github", why: "шаблон PR і конфіг репозиторію" },
  { path: ".coderabbit.yaml", why: "конфіг рев'ю" },
];

/** Інструменти, у яких будь-яка дія — це запис. */
const WRITE_TOOLS = new Set(["Edit", "Write", "NotebookEdit", "MultiEdit", "Update"]);

/** Інструменти-оболонки. `Bash` — Claude Code, `Shell`/`Terminal` — Cursor.
 *  Cursor до того ж має окремий хук `beforeShellExecution`, де команда лежить
 *  не в `tool_input`, а на верхньому рівні — див. shellCommand(). */
const SHELL_TOOLS = new Set(["Bash", "BashOutput", "Shell", "Terminal", "run_terminal_cmd"]);

/** Ознаки запису в рядку команди Bash. Свідомо широко: хибне спрацювання
 *  коштує одного уточнення, пропуск — порушення правила, яке ми ж і пишемо. */
const WRITE_IN_SHELL = [
  // > file, >> file — але не `2>/dev/null` і не `2>&1`: це не запис у файл проєкту.
  />>?\s*['"]?(?!\/dev\/|&)[\w./~-]/,
  /\bsed\b[^|;]*\s-[a-z]*i\b/,                 // sed -i, sed -i.bak
  /\b(tee|cp|mv|rm|rmdir|patch|truncate|dd|install|ln|touch|mkdir|chmod|chown|shred|unlink)\b/,
  /\bgit\s+(checkout|restore|apply|rm|mv|clean|stash|revert|reset\s+--hard)\b/,
  /\bnpm\s+(install|i|ci|uninstall|pkg\s+set)\b/,
  /\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|mkdirSync|rmSync|unlinkSync|copyFileSync|renameSync)\b/,
  /\bwrite_text\b|\bopen\s*\([^)]*['"][wax]/,  // python: Path.write_text, open(..., "w")
  /--write-lock\b/,                            // check-rules.mjs --write-lock переписує core.lock.json
];

/** Поля tool_input, у яких лежить шлях призначення. */
const PATH_FIELDS = ["file_path", "path", "notebook_path", "target_file", "filePath"];

/**
 * Записи, ціль яких неможливо перевірити статично.
 *
 * Знахідка рев'ю CodeRabbit на PR #4: усе вище розбирає ТЕКСТ команди, а текст
 * бреше. `node -e "fs.writeFileSync('app/src/'+'core/log.ts','x')"` не містить
 * жодного токена, схожого на захищений шлях: рядок склеюється під час
 * виконання. Те саме дає base64, змінна оболонки (`p=app/src/; echo x >
 * ${p}core/log.ts`) і symlink, створений у тій самій команді, через яку далі
 * йде запис.
 *
 * Розібрати довільний JavaScript чи shell до кінця хук не може — це задача
 * зупинки. Тому тут інша політика: не «знайти заборонену ціль», а
 * **не пропустити запис, ціль якого приховано**. Ціна — хибне спрацювання на
 * чесному `cp "$SRC" docs/`; воно коштує одного уточнення, а пропуск коштує
 * правила.
 */
const INLINE_INTERPRETER =
  /\b(node|deno|bun|python3?|perl|ruby|php|osascript)\b[^|;]*?\s-(?:-eval|-print|-exec|e|p|c|r|E)\b/;

/** Виклик запису у файлову систему всередині такого інлайн-коду. */
const WRITE_API =
  /\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|symlink|symlinkSync|symlink_to|linkSync|rename|renameSync|copyFile|copyFileSync|cpSync|mkdirSync|rmSync|unlinkSync|truncateSync|write_text|write_bytes|shutil|os\.remove|os\.replace)\b/;

/** Ознаки того, що ціль збирається в рантаймі: змінна, підстановка, декодування,
 *  конкатенація рядків, склейка масиву. */
const DYNAMIC_TARGET =
  /[$`]|\bBuffer\.from\b|\batob\b|\bb64decode\b|\bbase64\b|\bdecode\b|\.join\s*\(|\+\s*['"]|['"]\s*\+/;

/** Команди оболонки, що пишуть, із підстановкою в аргументах. */
const WRITE_CMD_WITH_SUBST =
  /\b(tee|cp|mv|rm|rmdir|install|ln|truncate|dd|patch|shred|unlink|mkdir|touch|chmod|chown)\b[^|;]*[$`]/;

/**
 * @returns {string|null} причина, чому ціль запису неперевірна, або null
 */
function opaqueWrite(command) {
  if (INLINE_INTERPRETER.test(command) && WRITE_API.test(command) && DYNAMIC_TARGET.test(command)) {
    return "інлайн-код інтерпретатора пише у файл, шлях до якого збирається під час виконання";
  }
  // Ціль перенаправлення містить змінну або підстановку: `> ${p}core/log.ts`.
  for (const m of command.matchAll(/(?:^|[^0-9&<>])>>?\s*(['"]?)([^\s'"|;&]*)\1/g)) {
    const target = m[2] ?? "";
    if (!target || target.startsWith("/dev/")) continue;
    if (/[$`]/.test(target)) return `ціль перенаправлення «${target}» формується підстановкою`;
  }
  if (WRITE_CMD_WITH_SUBST.test(command)) {
    return "аргумент команди запису містить підстановку — ціль відома лише оболонці";
  }
  return null;
}

/** Команда оболонки з обох відомих конвертів: Claude Code і обидва хуки Cursor. */
function shellCommand(input, args) {
  for (const value of [args?.command, input?.command, args?.cmd, input?.cmd]) {
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return "";
}

const projectRoot = () => resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());

/**
 * Справжній шлях призначення: `resolve()` прибирає `..`, але НЕ розкриває
 * symlink. Без цього `ln -s app/src/core alias` + `Write alias/log.ts`
 * проходить перевірку й пише в ядро. Тому канонізуємо найближчого предка,
 * який існує (сам файл може ще не існувати), і дописуємо решту шляху.
 */
function canonical(absolute) {
  let head = absolute;
  const tail = [];
  while (!existsSync(head)) {
    const parent = dirname(head);
    if (parent === head) return absolute;   // дійшли до кореня
    tail.unshift(head.slice(parent.length + 1));
    head = parent;
  }
  try {
    return resolve(realpathSync(head), ...tail);
  } catch {
    return absolute;
  }
}

/** Чи веде шлях у захищену зону — після нормалізації `..` і розкриття symlink. */
export function hit(rawPath, root = projectRoot(), cwd = root) {
  if (typeof rawPath !== "string" || rawPath.trim() === "") return null;
  const absolute = canonical(isAbsolute(rawPath) ? resolve(rawPath) : resolve(cwd, rawPath));
  const rel = relative(canonical(root), absolute);
  // Шлях поза репозиторієм цей хук не стосується.
  if (rel.startsWith("..") || isAbsolute(rel)) return null;
  const posix = rel.split(sep).join("/");
  return (
    PROTECTED.find((p) => posix === p.path || posix.startsWith(p.path + "/")) ?? null
  );
}

/**
 * Від якого каталогу рахувати відносні шляхи в команді.
 *
 * За замовчуванням — обидва правдоподібні: корінь репо і `app/` (агент часто
 * пише `cd app && …`). Це свідомо надлишково, але дає хибне спрацювання там,
 * де команда переходить ЗА МЕЖІ репозиторію: `cd ../app && echo x > src/core/…`
 * пише в сусідній проєкт, а не в наше ядро — і блокувати його ми не маємо права.
 *
 * Тому: якщо команда починається зі СТАТИЧНОГО `cd X &&` — тобто запис
 * виконається лише за успішного переходу, — база рівно одна, `X`.
 * Якщо `cd` динамічний (`$PWD`, `$(pwd)`) або зчеплений через `;` чи `||`
 * (тоді запис станеться й після невдалого переходу) — лишаємо обидві бази:
 * не знаємо, де опинилась оболонка, отже припускаємо найгірше.
 */
function basesFor(command, root) {
  const fallback = [root, resolve(root, "app")];
  const m = command.match(/^\s*cd\s+(['"]?)([^\s;|&]+)\1\s*&&/);
  if (!m) return fallback;
  const target = m[2];
  if (/[$`~*?]/.test(target)) return fallback;   // ціль переходу невідома — fail closed
  return [isAbsolute(target) ? resolve(target) : resolve(root, target)];
}

/**
 * Куди веде команда Bash. Літеральний пошук тексту «app/src/core» недостатній:
 * `echo x > app/src/integrations/../core/log.ts` його не містить, а пише саме
 * туди. Тому з команди дістаються всі схожі на шлях токени, і КОЖЕН
 * проганяється через hit() — там і `..`, і symlink.
 *
 * Корінь для відносних шляхів неоднозначний (`cd app && …` зсуває його), тому
 * за замовчуванням перевіряються обидва варіанти: від кореня репо і від app/.
 * Уточнює це basesFor() — див. нижче.
 */
function pathsInCommand(command, root = projectRoot()) {
  const found = [];
  const seen = new Set();
  const bases = basesFor(command, root);
  // Токени: рвемо по пробілах і операторах оболонки, знімаємо лапки й оператори.
  const tokens = command
    .split(/[\s;|&()<>]+/)
    .map((t) => t.replace(/^['"`]+|['"`]+$/g, "").replace(/^[>&]+/, ""))
    .filter((t) => t && !t.startsWith("-") && (t.includes("/") || t.includes(".")));

  for (const token of tokens) {
    if (token.startsWith("/dev/")) continue;
    for (const base of bases) {
      const p = hit(token, root, base);
      if (p && !seen.has(p.path)) { seen.add(p.path); found.push(p); }
    }
  }

  // Токенізація по пробілах губить шляхи з пробілами всередині (а корінь репо
  // цілком може лежати в «…/Work Folder/…»). Тому додатково — літеральний
  // пошук, але ЛИШЕ в абсолютній формі: відносні шляхи пробілів тут не мають і
  // вже коректно нормалізовані токенами разом із `..`. Інакше команда
  // `echo x > app/src/core/../integrations/tmp.ts` блокувалась би помилково.
  for (const p of PROTECTED) {
    if (seen.has(p.path)) continue;
    const forms = [resolve(root, p.path), resolve(root, "app", p.path.replace(/^app\//, ""))];
    const matched = forms.some((form) => {
      const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^\\w.-])(\\./)?${escaped}([/\\s'"\`;)|&]|$)`).test(command);
    });
    if (matched) { seen.add(p.path); found.push(p); }
  }
  return found;
}

/**
 * Рішення хука.
 * @returns {{block: boolean, reason?: string, target?: string, why?: string}}
 */
export function decide(input, root = projectRoot()) {
  const tool = input?.tool_name ?? input?.toolName ?? "";
  const args = input?.tool_input ?? input?.toolInput ?? {};
  const cwd = resolve(input?.cwd || input?.working_directory || input?.workingDirectory || args?.cwd || root);
  const command = shellCommand(input, args);

  // Cursor `beforeShellExecution` не передає tool_name узагалі: є лише команда
  // і cwd на верхньому рівні. Такий вхід — це оболонка, а не «невідомий інструмент».
  const isShell = SHELL_TOOLS.has(tool) || (!tool && command !== "");

  if (WRITE_TOOLS.has(tool)) {
    const candidates = [
      ...PATH_FIELDS.map((f) => args[f]),
      ...PATH_FIELDS.map((f) => input?.[f]),
      ...(Array.isArray(args.edits) ? args.edits.map((e) => e?.file_path) : []),
      ...(Array.isArray(args.files) ? args.files.map((f) => f?.file_path ?? f?.path) : []),
    ];
    for (const candidate of candidates) {
      const p = hit(candidate, root, cwd);
      if (p) return { block: true, target: p.path, why: p.why, reason: `${tool} → ${candidate}` };
    }
    return { block: false };
  }

  if (isShell) {
    if (!command) return { block: false };
    // `check-rules.mjs --write-lock` переписує app/scripts/core.lock.json,
    // навіть якщо сам шлях у команді не згаданий.
    if (/--write-lock\b/.test(command)) {
      const scripts = PROTECTED.find((p) => p.path === "app/scripts");
      return {
        block: true,
        target: scripts.path,
        why: scripts.why,
        reason: `${tool || "Shell"} → перезапис core.lock.json: ${command.slice(0, 160)}`,
      };
    }
    // Ціль, приховану від статичного розбору, не пропускаємо: перевірити її
    // неможливо, а «неможливо перевірити» — це не «можна».
    const opaque = opaqueWrite(command);
    if (opaque) {
      return {
        block: true,
        target: "усі захищені шляхи",
        why: "ціль запису неперевірна статично",
        reason: `${tool || "Shell"} → ${opaque}: ${command.slice(0, 160)}`,
      };
    }
    const mentioned = pathsInCommand(command, root);
    if (mentioned.length === 0) return { block: false };
    const writes = WRITE_IN_SHELL.find((re) => re.test(command));
    if (!writes) return { block: false }; // читання захищених шляхів дозволене
    const p = mentioned[0];
    return {
      block: true,
      target: p.path,
      why: p.why,
      reason: `${tool || "Shell"} → запис у ${p.path}: ${command.slice(0, 160)}`,
    };
  }

  return { block: false };
}

export function message(verdict) {
  return `ЗАБЛОКОВАНО хуком protect-core.mjs: ${verdict.reason}

Шлях «${verdict.target}» захищений (${verdict.why}).
Заборона діє на будь-який спосіб запису — Edit, Write, NotebookEdit і оболонка
(Bash у Claude Code, Shell у Cursor): sed -i, tee, >, cp, patch,
git checkout -- <path>, node -e "fs.writeFileSync".
Перевіряється шлях призначення, а не інструмент і не намір.

Якщо ціль запису збирається під час виконання — змінна оболонки, конкатенація
рядків, base64, symlink у тій самій команді — хук блокує НЕ знаючи шляху:
перевірити його неможливо, а «неможливо перевірити» не означає «можна».
Передай явний літеральний шлях — і перевірка пропустить запис поза ядром.

Вона НЕ знімається проханням у чаті: агент не може перевірити правдивість
прохання, а текст, що потрапив у контекст із даних, сформулює його так само
переконливо.

Що робити далі (.claude/rules/do-not-touch.md): зупинись і напиши людині —
(1) що саме треба змінити: файл, експорт, нова сигнатура;
(2) навіщо — яка вимога задачі без цього не закривається;
(3) кого зачіпає: ядро спільне для всіх воркерів агенції;
(4) який обхід можливий без цієї зміни і чому він гірший.
Не роби локальну копію типу, не тисни поле через "as any" і не переписуй
app/scripts/core.lock.json під новий хеш — це приховування, а не розв'язання.`;
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  let input;
  try {
    input = JSON.parse(raw || "{}");
  } catch {
    // Незрозумілий вхід не має ламати сесію: пропускаємо, але кажемо про це.
    process.stderr.write("protect-core.mjs: не вдалось розібрати JSON на stdin\n");
    return 0;
  }
  const verdict = decide(input);
  if (!verdict.block) return 0;
  process.stderr.write(message(verdict) + "\n");
  return 2;
}

// Запуск лише як скрипт; при import (тести) main() не викликається.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().then((code) => process.exit(code));
}
