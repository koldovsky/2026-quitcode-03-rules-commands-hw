// Аудит узгодженості: кожне перевірюване твердження у звітах — проти артефакту.
//
// Навіщо: у звіті легко написати число з пам'яті, а потім змінити код — і звіт
// тихо стає неправдою. Цей скрипт перезапускає тести, читає збережені
// транскрипти й порівнює їх із тим, що стверджують docs/verification.md,
// docs/ab-validation.md і AGENTS.md.
//
// Запуск із кореня репо:  node docs/audit-claims.mjs
// Код виходу 1, якщо хоч одне твердження розійшлося з фактом.
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const REPO = new URL("..", import.meta.url).pathname;
const ver = readFileSync(`${REPO}/docs/verification.md`, "utf8");
const ab = readFileSync(`${REPO}/docs/ab-validation.md`, "utf8");
const agents = readFileSync(`${REPO}/AGENTS.md`, "utf8");

let fails = 0;
const check = (name, ok, detail) => {
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

// 1. SHA256 запиту A/B
const task = readFileSync(`${REPO}/materials/ab-task.md`, "utf8");
const prompt = task.split("\n---\n")[1].trim();
const sha = createHash("sha256").update(prompt).digest("hex");
check("SHA256 запиту в ab-validation збігається з файлом", ab.includes(sha), sha.slice(0, 16) + "…");

// 2. Поточні числа тестів і check:rules
const testOut = execSync("npm test 2>&1 | grep -E '^ *Tests'", { cwd: `${REPO}/app`, shell: "/bin/zsh" }).toString();
const nTests = Number(testOut.match(/Tests\s+(\d+) passed/)[1]);
const rulesOut = execSync("npm run check:rules 2>&1 | grep TOTAL", { cwd: `${REPO}/app`, shell: "/bin/zsh" }).toString();
const nViol = Number(rulesOut.match(/TOTAL: (\d+)/)[1]);
check(`реальні тести = ${nTests}`, nTests === 35);
check(`реальний TOTAL = ${nViol}`, nViol === 0);
check("AGENTS.md заявляє актуальний стан", agents.includes("**35 тестів зелені**") && agents.includes("**TOTAL: 0**"));
check("ab-validation фіксує базову лінію, що була НА МОМЕНТ прогонів", ab.includes("**23 passed (7 files)**") && ab.includes("**TOTAL: 1**"));

// 3. Тести хука
const hookOut = execSync("node .claude/hooks/protect-core.test.mjs 2>&1 | tail -1", { cwd: REPO, shell: "/bin/zsh" }).toString().trim();
const nHook = Number(hookOut.match(/Усі (\d+)/)?.[1] ?? 0);
check(`тести хука проходять: ${hookOut}`, hookOut.startsWith("Усі"));
check(`кількість перевірок хука у звіті = ${nHook}`, ver.includes(`(${nHook} перевірки)`) || ver.includes(`${nHook} перевірок`));

// 4. Розмір скрипта хука
const hookLines = readFileSync(`${REPO}/.claude/hooks/protect-core.mjs`, "utf8").split("\n").length - 1;
check(`рядків у protect-core.mjs = ${hookLines}`, ver.includes(`(${hookLines} рядки)`) || ver.includes(`(${hookLines} рядків)`));

// 5. Числа прогонів A/B проти збережених транскриптів
for (const [arm, calls, reads] of [["a", 8, 7], ["b", 19, 9]]) {
  const t = readFileSync(`${REPO}/docs/ab/transcript-${arm}.md`, "utf8");
  const m = t.match(/викликів інструментів: (\d+) · з них Read: (\d+)/);
  check(`transcript-${arm}: ${m[1]} викликів, ${m[2]} Read`, Number(m[1]) === calls && Number(m[2]) === reads);
  check(`ab-validation цитує ті самі числа для ${arm.toUpperCase()}`, ab.includes(`**${calls} викликів інструментів, з них ${reads} \`Read\`**`));
}

// 6. Діфи існують і не порожні
for (const f of ["b-rules-off.diff", "b0-rename-protocol.diff", "transcript-a.md", "transcript-b.md"]) {
  const p = `${REPO}/docs/ab/${f}`;
  check(`docs/ab/${f} існує і не порожній`, existsSync(p) && readFileSync(p, "utf8").length > 100);
}
check("ab-validation не обіцяє a-rules-on.diff", !ab.includes("`docs/ab/a-rules-on.diff`") || ab.includes("не створювався"));

// 7. Прогони команд збережені
for (const f of ["analyze-error-run1.md", "analyze-error-run2.md", "analyze-error-run3.md",
                 "refactor-sheets-append.md", "generate-integration-telegram.md"]) {
  check(`docs/runs/${f} існує`, existsSync(`${REPO}/docs/runs/${f}`));
}

// 8. Захищені шляхи недоторкані
const protectedDiff = execSync(
  "git diff --name-only 2155c65 -- app/src/core app/scripts materials .coderabbit.yaml .github",
  { cwd: REPO, shell: "/bin/zsh" }).toString().trim();
check("захищені шляхи не змінені від стартового коміту", protectedDiff === "", protectedDiff || "порожньо");

// 9. Формат правил
const dnt = readFileSync(`${REPO}/.claude/rules/do-not-touch.md`, "utf8");
check("do-not-touch без frontmatter (завжди в контексті)", !dnt.startsWith("---"));
for (const r of ["architecture", "conventions"]) {
  const s = readFileSync(`${REPO}/.claude/rules/${r}.md`, "utf8");
  check(`${r}.md має paths-frontmatter`, s.startsWith("---") && /paths:/.test(s.split("---")[1]));
}
check("CLAUDE.md містить рядок-імпорт @AGENTS.md", /^@AGENTS\.md$/m.test(readFileSync(`${REPO}/CLAUDE.md`, "utf8")));

// 10. Команди мають description і stop
for (const c of ["analyze-error", "refactor", "generate-integration"]) {
  const s = readFileSync(`${REPO}/.claude/commands/${c}.md`, "utf8");
  check(`${c}: description + Acceptance + Stop`,
    /^description:/m.test(s) && /## Acceptance criteria/.test(s) && /## Stop/.test(s));
}

// 11. Другий A/B на Opus: артефакти на місці й числа збігаються з транскриптами
for (const f of ["transcript-opus-a.md", "transcript-opus-b.md", "opus-a.diff", "opus-b.diff"]) {
  check(`docs/ab/${f} існує і не порожній`,
    existsSync(`${REPO}/docs/ab/${f}`) && readFileSync(`${REPO}/docs/ab/${f}`, "utf8").length > 100);
}
for (const [arm, calls] of [["a", 9], ["b", 13]]) {
  const t = readFileSync(`${REPO}/docs/ab/transcript-opus-${arm}.md`, "utf8");
  const m = t.match(/викликів інструментів: (\d+)/);
  check(`transcript-opus-${arm}: ${m[1]} викликів у ході 1`, Number(m[1]) === calls);
  check(`ab-validation цитує це число для Opus ${arm.toUpperCase()}`, ab.includes(`| ${calls} |`));
}
check("ab-validation не заявляє різниці в захисті ядра на Opus",
  ab.includes("Різниця в захисті ядра | **є** | **немає** |"));

// 12. Контроль ізоляції існує і сам себе перевіряє
check("tools/ab-isolate.mjs існує", existsSync(`${REPO}/tools/ab-isolate.mjs`));

console.log(fails === 0 ? "\nАУДИТ ПРОЙДЕНО: розбіжностей немає." : `\nАУДИТ: ${fails} розбіжностей.`);
process.exit(fails === 0 ? 0 : 1);
