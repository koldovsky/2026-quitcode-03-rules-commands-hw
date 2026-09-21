#!/usr/bin/env node
// JSONL-транскрипт → читабельний markdown, який людина справді прочитає.
//   node tools/transcript-md.mjs docs/evidence/<run>   → <run>/transcript.md
// Сирий JSONL лишається поруч (стиснутий) — це повний слід прогону.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { redact } from "./redact.mjs";

const dir = process.argv[2];
if (!dir) { console.error("usage: node tools/transcript-md.mjs <dir>"); process.exit(1); }
const src = join(dir, "transcript.jsonl");
if (!existsSync(src)) { console.error(`немає ${src}`); process.exit(1); }

const cut = (s, n) => (s.length > n ? s.slice(0, n) + `\n… [обрізано, ще ${s.length - n} символів]` : s);
const out = [`# Транскрипт прогону \`${basename(dir)}\``, ""];
let step = 0;

for (const line of readFileSync(src, "utf8").split("\n").filter(Boolean)) {
  let d; try { d = JSON.parse(line); } catch { continue; }

  if (d.type === "system" && d.subtype === "init") {
    out.push(`**Модель:** \`${d.model ?? "?"}\` · **cwd:** \`${d.cwd ?? "?"}\``);
    out.push(`**Команди в сесії:** ${(d.slash_commands ?? []).map((c) => `\`/${c}\``).join(", ") || "—"}`);
    out.push("", "---", "");
    continue;
  }
  const content = d?.message?.content;
  if (!Array.isArray(content)) {
    if (d.type === "result") {
      out.push("", "---", "", "## Фінальна відповідь", "", (d.result ?? "").trim() || "_(порожньо)_");
    }
    continue;
  }
  for (const b of content) {
    if (b.type === "text" && b.text?.trim()) {
      out.push(`### 💬 агент`, "", cut(b.text.trim(), 2500), "");
    }
    if (b.type === "thinking" && b.thinking?.trim()) {
      out.push(`<details><summary>міркування (${b.thinking.length} симв.)</summary>`, "", cut(b.thinking.trim(), 1500), "", "</details>", "");
    }
    if (b.type === "tool_use") {
      step++;
      const arg = b.input?.command ?? b.input?.file_path ?? b.input?.pattern ?? JSON.stringify(b.input ?? {});
      out.push(`### 🔧 ${step}. \`${b.name}\``, "", "```", cut(String(arg), 900), "```", "");
    }
    if (b.type === "tool_result") {
      const t = typeof b.content === "string" ? b.content : JSON.stringify(b.content ?? "", null, 1);
      out.push("<details><summary>результат</summary>", "", "```", cut(t.trim(), 1200), "```", "", "</details>", "");
    }
  }
}
writeFileSync(join(dir, "transcript.md"), redact(out.join("\n") + "\n"));
console.log(`${join(dir, "transcript.md")} — ${out.length} рядків`);
