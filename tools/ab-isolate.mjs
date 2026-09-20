#!/usr/bin/env node
// Будує два стенди для A/B-валідації (Task D) і ПЕРЕВІРЯЄ ізоляцію.
//
// Навіщо. Протокол із docs/walkthrough.md пропонує перейменувати правила в
// `.off`. Цього недостатньо. Відомо п'ять каналів, якими агент дістає сховане:
//   1) `.off`-тека читається звичайним `cat`;
//   2) прибране з диска повертається через `git show`;
//   3) `.claude/hooks/protect-core.mjs` сам перелічує захищені шляхи;
//   4) `.claude/settings.json` називає цей скрипт;
//   5) риштування домашки — `README.md`, `docs/walkthrough.md`,
//      `docs/templates/`, `.coderabbit.yaml`, `.github/` — розкриває і
//      захищену зону, і імена правил та команд.
// Перші три спіймано в реальних прогонах, останні два — цим скриптом.
//
// Тому стенд B вважається дійсним, лише якщо жоден маркер моїх артефактів не
// знайдено ні в робочій теці, ні в жодному комміті історії. Інакше скрипт
// завершується з кодом 1 — прогін не запускається взагалі.
//
// Запуск із кореня репо:
//   node tools/ab-isolate.mjs <commit> <outdir>
//   node tools/ab-isolate.mjs HEAD /tmp/ab
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";

const [commit = "HEAD", outDir = "/tmp/ab"] = process.argv.slice(2);
const repo = process.cwd();

/** Що прибирається зі стенда B — саме це відрізняє прогони. */
const HIDDEN = [".claude/rules", ".claude/commands", "CLAUDE.md", "AGENTS.md"];

/**
 * Прибирається з ОБОХ стендів. Межа проведена так: у стенді лишається те, що
 * було б у справжньому клієнтському проєкті, і зникає риштування домашки.
 *
 * 1. Мої артефакти — цитують правила дослівно або перелічують захищені шляхи:
 *    докази прогонів, звіти, скрипт хука, скрипт аудиту.
 * 2. Риштування завдання — воно саме розкриває відповідь:
 *    `README.md` називає `app/src/core/` «protected zone»;
 *    `docs/walkthrough.md` перелічує імена всіх трьох правил і команд;
 *    `docs/templates/` містить приклади конвенцій (`postJson`, `check:rules`);
 *    `.coderabbit.yaml` і `.github/` описують критерії перевірки.
 *
 * Лишаються `app/` і `materials/`: архітектурна записка — це внутрішній
 * документ клієнта, і агент має право її знайти. Саме тому прогін B — це
 * «без моїх правил», а не «без жодних домовленостей».
 */
const DROPPED = [
  ".claude/hooks", ".claude/settings.json", "docs/runs", "docs/verification.md", "docs/ab", "docs/ab-validation.md",
  "docs/audit-claims.mjs", "tools",
  "README.md", "docs/walkthrough.md", "docs/templates", ".coderabbit.yaml", ".github",
];

/**
 * Маркери моїх артефактів. Це НЕ загальні слова конвенцій: `materials/`
 * лишається в обох стендах, і збіг на «postJson» чи «core» не був би витоком.
 * Шукаються саме імена правил, команд і скриптів.
 */
const MARKERS = ["do-not-touch", "@AGENTS.md", "protect-core", "audit-claims", "analyze-error", "generate-integration"];

const git = (args, cwd = repo) => execFileSync("git", args, { cwd, encoding: "utf8" });
const sh = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: "utf8" });

let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

function build(arm) {
  const dir = join(outDir, `ab-${arm}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // encoding не задаємо: архів — бінарний потік, рядок його пошкодить
  const tar = execFileSync("git", ["archive", commit], { cwd: repo, maxBuffer: 256 * 1024 * 1024 });
  execFileSync("tar", ["-x", "-C", dir], { input: tar });
  for (const p of DROPPED) rmSync(join(dir, p), { recursive: true, force: true });
  if (arm === "b") for (const p of HIDDEN) rmSync(join(dir, p), { recursive: true, force: true });
  // node_modules — симлінк на встановлені залежності: тести мають запускатись,
  // але самі залежності не є частиною порівняння.
  const modules = join(repo, "app", "node_modules");
  if (existsSync(modules)) symlinkSync(modules, join(dir, "app", "node_modules"), "dir");
  // Свіжа історія в один комміт: інакше `git show` відновить прибране.
  git(["init", "-q"], dir);
  git(["add", "-A"], dir);
  git(["-c", "user.email=ab@example.test", "-c", "user.name=ab", "commit", "-q", "-m", "baseline"], dir);
  return dir;
}

function grepMarkers(dir) {
  const hits = [];
  for (const marker of MARKERS) {
    // Робоча тека: усе, крім node_modules і .git
    try {
      const out = sh("grep", ["-rIl", "--exclude-dir=node_modules", "--exclude-dir=.git", marker, "."], dir);
      for (const f of out.trim().split("\n").filter(Boolean)) hits.push(`${marker} → ${f}`);
    } catch {
      /* grep=1 означає «не знайдено» */
    }
    // Історія: усі об'єкти в усіх коммітах
    try {
      const revs = git(["rev-list", "--all"], dir).trim().split("\n").filter(Boolean);
      const out = git(["grep", "-I", "-l", marker, ...revs], dir);
      for (const f of out.trim().split("\n").filter(Boolean)) hits.push(`${marker} → історія: ${f}`);
    } catch {
      /* немає збігів */
    }
  }
  return hits;
}

function baseline(dir) {
  const app = join(dir, "app");
  const tests = sh("npm", ["test"], app).match(/Tests\s+(\d+) passed/)?.[1] ?? "?";
  const total = sh("npm", ["run", "check:rules"], app).match(/TOTAL: (\d+)/)?.[1] ?? "?";
  return `${tests} тестів, TOTAL ${total}`;
}

console.log(`Стенди з комміту ${git(["rev-parse", "--short", commit]).trim()} → ${resolve(outDir)}\n`);

const dirA = build("a");
const dirB = build("b");

// 1. У A прихованого бути МАЄ, у B — не має
for (const p of HIDDEN) {
  check(`A містить ${p}`, existsSync(join(dirA, p)));
  check(`B не містить ${p}`, !existsSync(join(dirB, p)));
}

// 2. Прибране з обох — відсутнє в обох
for (const p of DROPPED) {
  check(`прибрано з обох: ${p}`, !existsSync(join(dirA, p)) && !existsSync(join(dirB, p)));
}

// 3. Історія — рівно один комміт у кожному
for (const [arm, dir] of [["A", dirA], ["B", dirB]]) {
  const n = git(["rev-list", "--all"], dir).trim().split("\n").filter(Boolean).length;
  check(`${arm}: історія в один комміт`, n === 1, `${n}`);
}

// 4. ГОЛОВНЕ: у B недосяжні жодні маркери — ні на диску, ні в історії
const leaks = grepMarkers(dirB);
check("B: жодного маркера правил/команд/хука", leaks.length === 0, leaks.slice(0, 6).join("; "));

// 5. Відмінність між стендами — рівно HIDDEN і нічого більше
let diffOut = "";
try {
  sh("diff", ["-rq", dirA, dirB, "-x", "node_modules", "-x", ".git"], repo);
} catch (error) {
  diffOut = String(error.stdout ?? "");
}
const differing = diffOut.trim().split("\n").filter(Boolean);
check("відмінностей рівно стільки, скільки прихованого", differing.length === HIDDEN.length,
  `${differing.length} проти ${HIDDEN.length}`);

// 6. Базова лінія однакова — інакше порівнювати нема чого
if (existsSync(join(dirA, "app", "node_modules"))) {
  const bA = baseline(dirA);
  const bB = baseline(dirB);
  check("базова лінія однакова", bA === bB, `A: ${bA} | B: ${bB}`);
} else {
  console.log("прим.  node_modules не скопійовано — базову лінію не перевірено");
}

console.log(failures === 0
  ? "\nІЗОЛЯЦІЯ ПІДТВЕРДЖЕНА: стенди готові до прогонів."
  : `\nІЗОЛЯЦІЯ ПОРУШЕНА (${failures}). Прогін недійсний — не запускати.`);
process.exit(failures === 0 ? 0 : 1);
