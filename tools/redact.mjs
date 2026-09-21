#!/usr/bin/env node
// Прибирає з доказів локальні шляхи й ім'я користувача машини.
//
// Навіщо. Транскрипт містить `cwd`, вивід `ls -la` і абсолютні шляхи —
// тобто ім'я облікового запису на моєму ноутбуці. Докази лежать у публічному
// репозиторії, і персональні дані там не потрібні для жодного твердження
// (знахідка рев'ю CodeRabbit на PR #4, CWE-359). Замінюємо на маркери, які
// читаються так само: <repo>, <home>, <user>.
//
//   import { redact } from "./redact.mjs"   — у генераторах звітів
//   node tools/redact.mjs --file <шлях>     — відредагувати файл на місці
import { readFileSync, writeFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Довші шляхи першими: інакше <home> з'їсть початок <repo>. */
const RULES = [
  [ROOT, "<repo>"],
  [homedir(), "<home>"],
  [userInfo().username, "<user>"],
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function redact(text) {
  let out = String(text);
  for (const [from, to] of RULES) {
    if (!from || from.length < 3) continue;
    out = out.replace(new RegExp(escape(from), "g"), to);
    // URL-кодована форма трапляється у стектрейсах Node (пробіл → %20).
    const encoded = encodeURI(from);
    if (encoded !== from) out = out.replace(new RegExp(escape(encoded), "g"), to);
  }
  return out;
}

const argv = process.argv.slice(2);
if (argv[0] === "--file" && argv[1]) {
  const text = readFileSync(argv[1], "utf8");
  const clean = redact(text);
  if (clean !== text) writeFileSync(argv[1], clean);
  console.log(`redact: ${argv[1]} — ${clean === text ? "нічого прибирати" : "локальні шляхи прибрано"}`);
}
