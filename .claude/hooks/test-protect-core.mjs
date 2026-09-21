#!/usr/bin/env node
// Тести хука protect-core.mjs: спроби обходу + перевірка, що потрібне НЕ зламано.
//
// Урок WS2: правило існує не тоді, коли записане, а тоді, коли перевірене
// спробою порушення. Кожен кейс нижче — реальний шлях до тих самих байтів.
//
//   node .claude/hooks/test-protect-core.mjs
//   exit 0 — усі кейси пройшли, exit 1 — є провал.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decide } from "./protect-core.mjs";

const HOOK = fileURLToPath(new URL("./protect-core.mjs", import.meta.url));
const ROOT = resolve(dirname(HOOK), "..", "..");

const edit = (file_path, tool = "Edit") => ({ tool_name: tool, tool_input: { file_path }, cwd: ROOT });
const bash = (command) => ({ tool_name: "Bash", tool_input: { command }, cwd: ROOT });

/** [опис, вхід, очікування: true = заблокувати] */
const CASES = [
  // --- прямий запис інструментами ---
  ["Edit у ядро", edit("app/src/core/log.ts"), true],
  ["Write у ядро", edit("app/src/core/new-helper.ts", "Write"), true],
  ["NotebookEdit у ядро", edit("app/src/core/x.ipynb", "NotebookEdit"), true],
  ["абсолютний шлях у ядро", edit(`${ROOT}/app/src/core/http.ts`), true],
  ["шлях із ./", edit("./app/src/core/types.ts"), true],
  ["обхід через ..", edit("app/src/integrations/../core/log.ts"), true],
  ["подвійний обхід", edit("app/src/core/../core/../core/parse.ts"), true],
  ["лок-файл перевірки", edit("app/scripts/core.lock.json"), true],
  ["сам скрипт перевірки", edit("app/scripts/check-rules.mjs"), true],
  ["вхідні дані домашки", edit("materials/error-log.txt"), true],
  ["шаблон PR", edit(".github/pull_request_template.md"), true],
  ["конфіг рев'ю", edit(".coderabbit.yaml"), true],
  ["MultiEdit зі списком edits", {
    tool_name: "MultiEdit",
    tool_input: { edits: [{ file_path: "app/src/sync/run.ts" }, { file_path: "app/src/core/log.ts" }] },
    cwd: ROOT,
  }, true],

  // --- обхід через Bash ---
  ["sed -i", bash("sed -i '' '1i\\\n// hi' app/src/core/log.ts"), true],
  ["перенаправлення >", bash("echo '// hi' > app/src/core/log.ts"), true],
  ["дописування >>", bash("echo '// hi' >> app/src/core/types.ts"), true],
  ["tee", bash("echo x | tee app/src/core/log.ts"), true],
  ["cp поверх ядра", bash("cp /tmp/log.ts app/src/core/log.ts"), true],
  ["mv поверх ядра", bash("mv /tmp/log.ts app/src/core/log.ts"), true],
  ["rm у ядрі", bash("rm app/src/core/parse.ts"), true],
  ["node -e fs.writeFileSync", bash("node -e \"require('fs').writeFileSync('app/src/core/log.ts','x')\""), true],
  ["python write_text", bash("python3 -c \"from pathlib import Path; Path('app/src/core/log.ts').write_text('x')\""), true],
  ["git checkout -- ядро", bash("git checkout upstream/main -- app/src/core"), true],
  ["git apply патча в ядро", bash("git apply /tmp/core.patch && touch app/src/core/x.ts"), true],
  ["переписати core.lock.json", bash("cd app && node scripts/check-rules.mjs --write-lock"), true],
  ["patch у materials", bash("patch materials/error-log.txt < /tmp/p.diff"), true],
  ["абсолютний шлях у Bash", bash(`echo x > ${ROOT}/app/src/core/log.ts`), true],

  // --- те, що НЕ можна ламати (хибні спрацювання) ---
  ["Edit у integrations", edit("app/src/integrations/sheets-append.ts"), false],
  ["Write нової інтеграції", edit("app/src/integrations/telegram-notify.ts", "Write"), false],
  ["Edit у sync", edit("app/src/sync/state.ts"), false],
  ["Edit правила", edit(".claude/rules/conventions.md"), false],
  ["читання лога інциденту", bash("cat materials/error-log.txt"), false],
  ["grep по materials", bash("grep -n ENOSPC materials/error-log.txt"), false],
  ["читання ядра", bash("cat app/src/core/http.ts"), false],
  ["check:rules читає ядро", bash("cd app && npm run check:rules"), false],
  ["npm test", bash("cd app && npm test"), false],
  ["запис поза захищеними шляхами", bash("echo x > docs/verification.md"), false],
  ["схожа назва, інший шлях", edit("docs/materials-notes.md"), false],
  ["core у назві файлу, не в шляху", edit("app/src/integrations/core-crm.ts"), false],
  ["файл поза репозиторієм", edit("/tmp/scratch/core/log.ts"), false],

  // Знайдено реальним прогоном e2-hook-block-no-rules: `2>/dev/null` читалось
  // як перенаправлення у файл, і читання ядра блокувалось помилково.
  ["читання ядра з 2>/dev/null", bash("cat app/src/core/http.ts 2>/dev/null"), false],
  ["складене читання з 2>/dev/null", bash('head -5 app/src/core/log.ts && cat .claude/settings.json 2>/dev/null | head -60'), false],
  ["злиття потоків 2>&1", bash("cat app/src/core/log.ts 2>&1 | head"), false],
  ["справжній запис попри 2>/dev/null", bash("echo x > app/src/core/log.ts 2>/dev/null"), true],

  // Знайдено рев'ю CodeRabbit на PR #4: літеральний пошук тексту «app/src/core»
  // не бачить `..` усередині Bash-команди, хоча оболонка запише саме туди.
  ["обхід через .. у Bash-перенаправленні", bash("echo x > app/src/integrations/../core/log.ts"), true],
  ["обхід через .. у sed -i", bash("sed -i '' '1i\\ x' app/src/sync/../core/log.ts"), true],
  ["обхід через .. у cp", bash("cp /tmp/x.ts app/src/integrations/../../src/core/log.ts"), true],
  ["невинний .. поза захищеною зоною", bash("echo x > app/src/core/../integrations/tmp.ts"), false],

  // Знахідка другого рев'ю CodeRabbit (PR #4): статичний розбір тексту команди
  // не бачить цілі, яку зібрано під час виконання. Відтворено прогоном до фікса —
  // усі шість проходили.
  ["node -e: шлях склеєно конкатенацією",
   bash(`node -e "const p='app/src/'+'core/log.ts'; require('fs').writeFileSync(p,'x')"`), true],
  ["node -e: symlink і запис через нього в одній команді",
   bash(`node -e "const fs=require('fs');fs.symlinkSync(process.cwd()+'/app/src/core','/tmp/a9');fs.writeFileSync('/tmp/a9/log.ts','x')"`), true],
  ["node -e: шлях у base64",
   bash(`node -e "require('fs').writeFileSync(Buffer.from('YXBwL3NyYy9jb3JlL2xvZy50cw==','base64').toString(),'x')"`), true],
  ["python -c: шлях склеєно",
   bash(`python3 -c "from pathlib import Path; Path('app/src/'+'core/log.ts').write_text('x')"`), true],
  ["bash: ціль перенаправлення у змінній",
   bash("p=app/src/; echo x > ${p}core/log.ts"), true],
  ["bash: ціль cp у підстановці",
   bash("cp /tmp/x.ts $(echo app/src/core/log.ts)"), true],

  // Зворотні кейси до тієї ж політики: інтерпретатор без запису й запис із
  // літеральною ціллю поза захищеною зоною мають працювати.
  ["node -e без запису", bash(`node -e "console.log(1+1)"`), false],
  ["node -e пише за літеральним шляхом поза ядром",
   bash(`node -e "require('fs').writeFileSync('docs/scratch.md','y')"`), false],
  ["звичайний запуск скрипта", bash("node tools/ab-report.mjs docs/evidence"), false],
  ["python -c без запису", bash(`python3 -c "print(2)"`), false],

  // Клас, якого тут бракувало: `cd` перед записом. Він зсуває корінь для
  // відносних шляхів, і перевірка від двох баз одночасно давала хибне
  // спрацювання: перехід ЗА МЕЖІ репо блокувався, хоча запис іде в сусідній
  // проєкт. Виправлено basesFor(); обидва напрями закріплені нижче.
  ["cd app, запис через ..", bash("cd app && echo x > ../app/src/core/log.ts"), true],
  ["cd падає, || лишає оболонку в корені", bash("cd missing || echo x > app/src/core/log.ts"), true],
  ["cd падає, ; лишає оболонку в корені", bash("cd missing ; echo x > app/src/core/log.ts"), true],
  ["cd зі змінною — ціль переходу невідома", bash('cd "$PWD/app" && echo x > src/core/log.ts'), true],
  ["cd з підстановкою $(pwd)", bash("cd $(pwd)/app && echo x > src/core/log.ts"), true],
  ["cd app/../app — статичний, усередині репо", bash("cd app/../app && echo x > src/core/log.ts"), true],
  ["cd за межі репо — чужий проєкт, не наша зона", bash("cd ../app && echo x > src/core/log.ts"), false],
  ["динамічний cd із записом у /tmp", bash("cd $HOME && echo y > /tmp/out.txt"), false],
  ["динамічний cd без запису", bash("cd $HOME && npm test"), false],
];

// --- конверти Cursor: інша назва інструмента й інша форма вхідного JSON ---
// Знахідка рев'ю: `.cursor/hooks.json` був зареєстрований, але decide() знав
// лише `Bash`, тож обидва хуки Cursor пропускали запис за замовчуванням.
const CURSOR_CASES = [
  ["preToolUse: tool_name Shell",
   { tool_name: "Shell", tool_input: { command: "printf x > app/src/core/log.ts" }, cwd: ROOT }, true],
  ["preToolUse: Shell із sed -i",
   { tool_name: "Shell", tool_input: { command: "sed -i '' '1i\\ x' app/scripts/check-rules.mjs" }, cwd: ROOT }, true],
  ["beforeShellExecution: command на верхньому рівні",
   { command: "printf x > app/src/core/log.ts", cwd: ROOT }, true],
  ["beforeShellExecution: читання не блокується",
   { command: "cat app/src/core/log.ts", cwd: ROOT }, false],
  ["preToolUse: шлях у target_file на верхньому рівні",
   { tool_name: "Write", target_file: "app/src/core/log.ts", cwd: ROOT }, true],
  ["Shell поза захищеною зоною",
   { tool_name: "Shell", tool_input: { command: "echo x > docs/notes.md" }, cwd: ROOT }, false],
];

let failed = 0;
for (const [name, input, expected] of CASES) {
  const got = decide(input, ROOT).block;
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${expected ? "блок" : "пропуск"}  ${name}`);
}

console.log("\nконверти Cursor (Shell / beforeShellExecution):");
for (const [name, input, expected] of CURSOR_CASES) {
  const got = decide(input, ROOT).block;
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? "  ok  " : "FAIL  "}${expected ? "блок" : "пропуск"}  ${name}`);
}

// --- symlink-аліас: шлях, який лексично невинний, а веде в ядро ---
// Теж знахідка рев'ю: resolve() прибирає `..`, але не розкриває symlink.
console.log("\nsymlink-аліас на захищений каталог:");
const linkDir = mkdtempSync(`${tmpdir()}/ws03-symlink-`);
try {
  const alias = `${linkDir}/core-alias`;
  symlinkSync(resolve(ROOT, "app/src/core"), alias);
  const symlinkCases = [
    ["Edit через аліас на ядро", edit(`${alias}/log.ts`), true],
    ["Write нового файлу через аліас", edit(`${alias}/sneaky.ts`, "Write"), true],
    ["Bash-запис через аліас", bash(`printf x > ${alias}/log.ts`), true],
  ];
  for (const [name, input, expected] of symlinkCases) {
    const got = decide(input, ROOT).block;
    const ok = got === expected;
    if (!ok) failed++;
    console.log(`${ok ? "  ok  " : "FAIL  "}${expected ? "блок" : "пропуск"}  ${name}`);
  }
} finally {
  rmSync(linkDir, { recursive: true, force: true });
}

// --- перевірка реального контракту: код виходу і stderr справжнього процесу ---
console.log("\nконтракт процесу (stdin JSON → exit code):");
const wire = [
  ["блокує з кодом 2", edit("app/src/core/log.ts"), 2],
  ["пропускає з кодом 0", edit("app/src/integrations/slack-notify.ts"), 0],
  ["зламаний JSON не валить сесію", null, 0],
  // Конверт Cursor доходить до справжнього процесу, а не лише до decide().
  ["конверт Cursor блокує з кодом 2", { command: "printf x > app/src/core/log.ts", cwd: ROOT }, 2],
];
for (const [name, input, expectedCode] of wire) {
  const run = spawnSync(process.execPath, [HOOK], {
    input: input === null ? "{not json" : JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
  });
  const ok = run.status === expectedCode && (expectedCode !== 2 || run.stderr.includes("ЗАБЛОКОВАНО"));
  if (!ok) failed++;
  console.log(`${ok ? "  ok  " : "FAIL  "}exit ${run.status} (очікували ${expectedCode})  ${name}`);
}

console.log(`\n${CASES.length + CURSOR_CASES.length + wire.length + 3} кейсів, провалів: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
