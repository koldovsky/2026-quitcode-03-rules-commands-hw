#!/usr/bin/env node
// Складає каталоги доказів так, щоб PR лишався рев'юабельним.
//
//   node tools/pack-evidence.mjs [--dry]
//
// Навіщо. CodeRabbit відмовився рев'ювати PR: «211 files exceed the limit of
// 100». Доказів від цього не поменшало, але рев'ю за чек-лістом домашки не
// сталося — тобто спосіб зберігання доказів зламав те, заради чого вони є.
// `.coderabbit.yaml` (де можна було б виключити шляхи) — захищений шлях.
//
// Що робить: дрібні текстові виводи кожного прогону вкладає в його summary.md,
// а сирі транскрипти JSONL збирає в один архів. Було ~9 файлів на прогін,
// лишається 2: summary.md (числа + сирі виводи) і transcript.md (читабельний).
import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, basename, relative, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE = join(ROOT, "docs/evidence");
const DRY = process.argv.includes("--dry");
const ARCHIVE = "raw-transcripts.tar";

// Порядок важливий: так їх читатиме людина.
const FOLD = [
  ["prompt.txt", "Запит (байт у байт)"],
  ["isolation.txt", "Контроль ізоляції"],
  ["CLAUDE.md.used", "CLAUDE.md, з яким ішов прогін"],
  ["probe-ro.md", "Тимчасова команда-зонд"],
  ["check-rules.before.txt", "check:rules до"],
  ["check-rules.after.txt", "check:rules після"],
  ["npm-test.before.txt", "npm test до"],
  ["npm-test.after.txt", "npm test після"],
  ["hash.before.txt", "md5 цільового файлу до"],
  ["hash.after.txt", "md5 цільового файлу після"],
  ["git-status.before.txt", "git status до"],
  ["git-status.txt", "git status після"],
  ["git-status.after.txt", "git status після"],
  ["app.diff", "Діф по app/"],
  ["probe-artifact.txt", "Артефакт, створений зондом"],
  ["stderr.txt", "stderr"],
];

const runs = readdirSync(EVIDENCE, { withFileTypes: true })
  .flatMap((e) => {
    if (!e.isDirectory()) return [];
    const dir = join(EVIDENCE, e.name);
    if (e.name === "ab") {
      return readdirSync(dir, { withFileTypes: true })
        .filter((x) => x.isDirectory()).map((x) => join(dir, x.name));
    }
    return [dir];
  });

let folded = 0, removed = 0;
const archived = [];

for (const dir of runs) {
  const rel = relative(ROOT, dir);
  const summaryPath = join(dir, "summary.md");
  let summary = existsSync(summaryPath)
    ? readFileSync(summaryPath, "utf8").trimEnd()
    : `# ${basename(dir)}\n`;

  const parts = [];
  for (const [file, title] of FOLD) {
    const p = join(dir, file);
    if (!existsSync(p)) continue;
    const body = readFileSync(p, "utf8").trim();
    if (body) {
      const fence = file.endsWith(".md") ? "```markdown" : file.endsWith(".diff") ? "```diff" : "```";
      parts.push(`### ${title} — \`${file}\`\n\n${fence}\n${body}\n\`\`\``);
      folded++;
    }
    if (!DRY) { rmSync(p); removed++; }
  }
  if (parts.length) {
    summary += `\n\n---\n\n## Сирі виводи прогону\n\n${parts.join("\n\n")}\n`;
  }
  summary += `\n---\n\nСирий транскрипт: \`docs/evidence/${ARCHIVE}\` → \`${rel}/transcript*.jsonl.gz\`\n`;
  if (!DRY) writeFileSync(summaryPath, summary);

  for (const f of readdirSync(dir)) {
    if (f.endsWith(".jsonl.gz") || f.endsWith(".jsonl")) archived.push(join(rel, f));
  }
}

if (!DRY && archived.length) {
  const archivePath = join(EVIDENCE, ARCHIVE);
  // ВАЖЛИВО: `tar -cf` перезаписує архів. При повторному пакуванні (коли старі
  // транскрипти вже прибрані з дерева) це знищило б усі попередні прогони —
  // рівно це й сталося один раз, відновлювати довелось із git. Тому для
  // наявного архіву — дозапис, а не створення заново.
  const mode = existsSync(archivePath) ? "-rf" : "-cf";
  // --uname/--gname: інакше ім'я облікового запису лишається в заголовку
  // КОЖНОГО запису архіву, навіть коли самі транскрипти вже відредаговані.
  execFileSync("tar", [mode, archivePath, "--numeric-owner", "--uname", "", "--gname", "", "-C", ROOT, ...archived]);
  for (const f of archived) rmSync(join(ROOT, f));
}

const count = (dir) => readdirSync(dir, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? count(join(dir, e.name)) : 1), 0);

console.log(`прогонів: ${runs.length}`);
console.log(`вкладено в summary.md: ${folded} виводів, видалено окремих файлів: ${removed}`);
console.log(`в архів ${ARCHIVE}: ${archived.length} транскриптів`);
console.log(`файлів у docs/evidence зараз: ${count(EVIDENCE)}`);
