#!/usr/bin/env node
// check-rule-claims — перевіряє, що ПРАВИЛА не розійшлися з КОДОМ.
//
// Навіщо. У звіті потоку за WS2 найбільший клас дефектів (19 із 24 major) —
// розбіжність «документація ↔ артефакт»: текст обіцяє те, чого в файлі немає.
// Правило проєкту — той самий текст: воно застаріває мовчки, і агент упевнено
// виконує вчорашню домовленість. Цей скрипт робить із правил перевірюване
// твердження.
//
//   node tools/check-rule-claims.mjs            звіт, exit 1 при розбіжності
//   node tools/check-rule-claims.mjs --quiet    лише підсумок
//
// Скрипт свідомо лежить поза app/scripts/** — той каталог захищений.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PROTECTED } from "../.claude/hooks/protect-core.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const quiet = process.argv.includes("--quiet");
const read = (p) => readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
const problems = [];
const checks = [];

const check = (name, fn) => {
  try {
    const detail = fn();
    checks.push({ name, ok: true, detail: detail ?? "" });
  } catch (error) {
    checks.push({ name, ok: false, detail: error.message });
    problems.push(`${name}: ${error.message}`);
  }
};

const frontmatter = (text) => {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  return m ? m[1] : null;
};

// 1. Таблиця публічного API ядра в architecture.md = реальні експорти core/.
check("API ядра в architecture.md = експорти app/src/core", () => {
  const rule = read(".claude/rules/architecture.md");
  const rows = [...rule.matchAll(/^\|\s*`core\/([\w.-]+\.ts)`\s*\|(.+?)\|\s*$/gm)];
  if (rows.length === 0) throw new Error("таблиця API ядра не знайдена");

  const mismatches = [];
  for (const [, file, cell] of rows) {
    // Праворуч від «→» стоїть тип результату, а не експорт: відкидаємо.
    const declarations = cell.replace(/\u2192[^,]*/g, "");
    const claimed = new Set(
      [...declarations.matchAll(/`([^`]+)`/g)]
        .map(([, token]) => token.trim())
        .map((token) => token.replace(/^([A-Za-z_$][\w$]*).*$/s, "$1")) // postJson(...) → postJson, log.info → log
        .filter(Boolean),
    );
    const source = read(`app/src/core/${file}`);
    const real = new Set(
      [...source.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm)]
        .map(([, name]) => name),
    );
    for (const name of claimed) {
      if (!real.has(name)) mismatches.push(`core/${file}: правило обіцяє «${name}», експорту немає`);
    }
    for (const name of real) {
      if (!claimed.has(name)) mismatches.push(`core/${file}: експорт «${name}» є, у правилі не описаний`);
    }
  }
  if (mismatches.length) throw new Error(mismatches.join("; "));
  return `${rows.length} модулів ядра звірено`;
});

// 2. Список захищених шляхів у правилі = список у хуці.
check("захищені шляхи: do-not-touch.md = protect-core.mjs", () => {
  const rule = read(".claude/rules/do-not-touch.md");
  const inRule = new Set(
    [...rule.matchAll(/`([\w./*-]+)`/g)]
      .map(([, token]) => token.replace(/\/\*\*$/, ""))
      .filter((token) => PROTECTED.some((p) => p.path === token)),
  );
  const missing = PROTECTED.map((p) => p.path).filter((p) => !inRule.has(p));
  if (missing.length) throw new Error(`хук захищає, а правило не згадує: ${missing.join(", ")}`);
  return `${PROTECTED.length} шляхів`;
});

// 3. Кожен захищений шлях існує в репозиторії (правило не про вигаданий каталог).
check("захищені шляхи існують на диску", () => {
  const gone = PROTECTED.map((p) => p.path).filter((p) => !existsSync(join(ROOT, p)));
  if (gone.length) throw new Error(`немає в репо: ${gone.join(", ")}`);
  return `${PROTECTED.length} шляхів`;
});

// 4. CLAUDE.md імпортує AGENTS.md окремим рядком, а не посилається на нього.
check("CLAUDE.md містить імпорт @AGENTS.md", () => {
  const text = read("CLAUDE.md");
  if (!/^@AGENTS\.md\s*$/m.test(text)) throw new Error("немає рядка рівно `@AGENTS.md`");
  if (/\[AGENTS\.md\]\(/.test(text)) throw new Error("лишилось markdown-посилання замість імпорту");
  return "імпорт на місці";
});

// 5. Режими застосування правил обрані свідомо.
check("режими застосування правил", () => {
  const expected = {
    "do-not-touch.md": { paths: false, why: "діє завжди" },
    "architecture.md": { paths: true, why: "прив'язане до app/src/**" },
    "conventions.md": { paths: true, why: "прив'язане до app/src/**" },
  };
  const dir = ".claude/rules";
  const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".md"));
  const unexpected = files.filter((f) => !(f in expected));
  if (unexpected.length) throw new Error(`невідоме правило: ${unexpected.join(", ")}`);
  const wrong = [];
  for (const [file, want] of Object.entries(expected)) {
    if (!files.includes(file)) { wrong.push(`${file}: файла немає`); continue; }
    const fm = frontmatter(read(`${dir}/${file}`));
    const hasPaths = Boolean(fm && /^paths:/m.test(fm));
    if (hasPaths !== want.paths) wrong.push(`${file}: ${want.why}, а frontmatter каже інакше`);
    if (fm && /^globs:/m.test(fm)) wrong.push(`${file}: \`globs:\` — це формат Cursor, у .claude/rules треба \`paths:\``);
  }
  if (wrong.length) throw new Error(wrong.join("; "));
  return `${files.length} правил`;
});

// 6. Кожна команда має description, argument-hint, acceptance criteria і stop.
check("команди: description, ціль, acceptance criteria, stop", () => {
  const dir = ".claude/commands";
  const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".md"));
  if (files.length < 3) throw new Error(`очікували 3 команди, знайшли ${files.length}`);
  const wrong = [];
  for (const file of files) {
    const text = read(`${dir}/${file}`);
    const fm = frontmatter(text) ?? "";
    if (!/^description:\s*\S/m.test(fm)) wrong.push(`${file}: немає description`);
    if (!/^argument-hint:\s*\S/m.test(fm)) wrong.push(`${file}: немає argument-hint`);
    if (!text.includes("$ARGUMENTS")) wrong.push(`${file}: ціль не береться з $ARGUMENTS`);
    if (!/^##\s*Acceptance criteria/m.test(text)) wrong.push(`${file}: немає розділу Acceptance criteria`);
    if (!/^##\s*Stop/m.test(text)) wrong.push(`${file}: немає розділу Stop`);
    if (!/^- \[ \]/m.test(text)) wrong.push(`${file}: критерії не оформлені як чек-лист`);
  }
  if (wrong.length) throw new Error(wrong.join("; "));
  return `${files.length} команд`;
});

// Шляхи, які правила згадують САМЕ ЯК ЗАБОРОНЕНІ: вони не повинні існувати.
// Без цього списку перевірка 7 лаялась би на приклад із architecture.md.
const KNOWN_ABSENT = new Map([
  ["app/src/leads", "приклад забороненого четвертого шару з architecture.md"],
]);

// 7. Усі шляхи репо, згадані в правилах і AGENTS.md, справді існують.
check("посилання на файли в правилах не «висять»", () => {
  const sources = [
    "AGENTS.md",
    "CLAUDE.md",
    ".claude/rules/architecture.md",
    ".claude/rules/conventions.md",
    ".claude/rules/do-not-touch.md",
    ...readdirSync(join(ROOT, ".claude/commands")).map((f) => `.claude/commands/${f}`),
  ];
  const dead = [];
  for (const source of sources) {
    const text = read(source);
    for (const [, path] of text.matchAll(/`((?:app|docs|materials|tools|\.claude|\.cursor|\.github)\/[\w./-]+)`/g)) {
      if (path.includes("*")) continue;
      const clean = path.replace(/\/$/, "");
      if (clean.includes("<") || /kebab-name|name\./.test(clean)) continue;
      if (KNOWN_ABSENT.has(clean)) continue;
      if (!existsSync(join(ROOT, clean))) dead.push(`${source} → ${path}`);
    }
  }
  if (dead.length) throw new Error(dead.join("; "));
  return `${sources.length} файлів перевірено`;
});

// 8. Заборонені шляхи справді відсутні — правило описує реальність, а не намір.
check("заборонені правилом шляхи не з'явились у репо", () => {
  const appeared = [...KNOWN_ABSENT.entries()]
    .filter(([path]) => existsSync(join(ROOT, path)))
    .map(([path, why]) => `${path} (${why})`);
  if (appeared.length) throw new Error(`правило забороняє, а воно є: ${appeared.join(", ")}`);
  return `${KNOWN_ABSENT.size} шляхів`;
});

// ─────────────────────────────────────────────────────────────────────────────
// ЧИСЛА. Усе вище перевіряє структуру; цей блок перевіряє цифри.
//
// Навіщо окремо. Двічі в цьому репозиторії текст розходився з фактом саме
// числом: «47 кейсів» після того, як їх стало 54, і «7 тверджень» після
// восьмого. Структурна перевірка такого не бачить — число треба ВИМІРЯТИ й
// звірити з тим, що заявлено в документах.
//
// Тут навмисно немає жодного очікуваного значення в коді: і вимір, і твердження
// беруться з артефактів, інакше з'явилось би третє джерело істини.
const run = (cmd, args, cwd = ROOT) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const claimed = (file, re, what) => {
  const m = read(file).match(re);
  if (!m) throw new Error(`у ${file} немає твердження про ${what}`);
  return { value: Number(m[1]), file };
};

const agree = (measured, claims, what) => {
  const wrong = claims.filter((c) => c.value !== measured);
  if (wrong.length) {
    throw new Error(
      `реально ${measured}, а заявлено: ${wrong.map((c) => `${c.value} (${c.file})`).join(", ")} — ${what}`,
    );
  }
  return `${measured} — збігається у ${claims.length} документах`;
};

// 9. Кількість тестів у документах = скільки їх насправді.
check("числа: кількість тестів", () => {
  const out = run("npm", ["test", "--silent"], join(ROOT, "app"));
  const m = out.match(/Tests\s+(\d+) passed/);
  if (!m) throw new Error("не вдалось прочитати кількість тестів із виводу vitest");
  return agree(Number(m[1]), [
    claimed("docs/verification.md", /тестів стало \*\*(\d+)\*\*/, "кількість тестів"),
    claimed("docs/ab-validation.md", /а тестів (\d+), не 26/, "кількість тестів"),
    claimed("docs/reviewer-map.md", /(\d+) тестів/, "кількість тестів"),
  ], "кількість тестів");
});

// 10. check:rules TOTAL у документах = реальний TOTAL.
check("числа: порушення check:rules", () => {
  const out = run("npm", ["run", "--silent", "check:rules"], join(ROOT, "app"));
  const m = out.match(/TOTAL: (\d+)/);
  if (!m) throw new Error("не вдалось прочитати TOTAL");
  return agree(Number(m[1]), [
    claimed("AGENTS.md", /на старті домашки TOTAL: 8, зараз — (\d+)/, "TOTAL"),
    claimed("docs/reviewer-map.md", /\*\*TOTAL: (\d+)\*\*/, "TOTAL"),
    claimed(".claude/rules/conventions.md", /\*\*TOTAL: 0\*\*[\s\S]*?зараз — \*\*(\d+)\*\*/, "TOTAL"),
  ], "порушення check:rules");
});

// 11. Кейси хука в документах = скільки їх у тестах.
check("числа: кейси обходу хука", () => {
  const out = run("node", [".claude/hooks/test-protect-core.mjs"]);
  const m = out.match(/(\d+) кейс[іыв]*, провалів: (\d+)/);
  if (!m) throw new Error("не вдалось прочитати підсумок тестів хука");
  if (Number(m[2]) !== 0) throw new Error(`тести хука падають: ${m[2]} провалів`);
  return agree(Number(m[1]), [
    claimed("docs/verification.md", /test-protect-core\.mjs` — \*\*(\d+) кейс/, "кейси хука"),
    claimed("docs/reviewer-map.md", /(\d+) кейс(?:ів)? обходу хука/, "кейси хука"),
  ], "кейси обходу хука");
});

// 12. Запит A/B справді був один і той самий — у КОЖНОМУ прогоні.
//
// «Той самий запит» — головна умова валідності абляції, і досі вона трималась
// на моєму слові. Тепер це хеш: канонічний текст із materials/ab-task.md проти
// запиту, вкладеного в кожен summary.md.
check("числа: SHA256 запиту A/B однаковий у всіх прогонах", () => {
  const task = read("materials/ab-task.md");
  const between = task.split(/^---$/m)[1] ?? "";
  const canonical = between.split("\n").filter((l) => l.trim() !== "").join("\n") + "\n";
  const sha = (text) => createHash("sha256").update(text).digest("hex");
  const expected = sha(canonical);

  const abDir = join(ROOT, "docs/evidence/ab");
  const runs = readdirSync(abDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  const wrong = [];
  for (const r of runs) {
    const summary = read(`docs/evidence/ab/${r.name}/summary.md`);
    const m = summary.match(/### Запит \(байт у байт\)[^\n]*\n\n```\n([\s\S]*?)```\n/);
    if (!m) { wrong.push(`${r.name}: немає запиту у звіті`); continue; }
    if (sha(m[1]) !== expected) wrong.push(`${r.name}: ${sha(m[1]).slice(0, 12)}`);
  }
  if (wrong.length) throw new Error(`розійшлись із ${expected.slice(0, 12)}: ${wrong.join(", ")}`);

  const inReport = read("docs/ab-validation.md").match(/SHA256 запиту[^`]*`([0-9a-f]{64})`/);
  if (!inReport) throw new Error("у docs/ab-validation.md не записано SHA256 запиту");
  if (inReport[1] !== expected) throw new Error(`у звіті ${inReport[1].slice(0, 12)}, реально ${expected.slice(0, 12)}`);

  return `${runs.length} прогонів, один хеш ${expected.slice(0, 12)}…`;
});

// 13. Кількість самих тверджень, заявлена в документах, = скільки їх тут.
check("числа: кількість тверджень цього скрипта", () => {
  const total = checks.length + 1; // +1: ця перевірка ще не дорахована
  return agree(total, [
    claimed("docs/verification.md", /check-rule-claims\.mjs` — (\d+) тверджень/, "кількість тверджень"),
    claimed("docs/reviewer-map.md", /\((\d+) тверджень\)/, "кількість тверджень"),
  ], "кількість тверджень");
});

if (!quiet) {
  console.log("check-rule-claims — чи правила ще описують той самий код\n");
  for (const c of checks) {
    console.log(`  ${c.ok ? "ok  " : "FAIL"}  ${c.name}${c.detail ? `  — ${c.detail}` : ""}`);
  }
  console.log("");
}
console.log(
  problems.length === 0
    ? `CLAIMS OK: ${checks.length} тверджень підтверджено кодом`
    : `CLAIMS FAILED: ${problems.length} із ${checks.length} тверджень розійшлись із кодом`,
);
process.exit(problems.length === 0 ? 0 : 1);
