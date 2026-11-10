#!/usr/bin/env node
// PreToolUse hook (Claude Code): blocks Edit/Write/MultiEdit/NotebookEdit in protected paths.
// The rule (.claude/rules/do-not-touch.md) asks the agent; this hook enforces it.
// Exit 2 = block the tool call; the stderr text is shown to the agent.
// Node only (no bash) so it also works on Windows.
import { isAbsolute, relative, resolve, sep } from "node:path";

const PROTECTED = ["app/src/core/", "app/scripts/", "materials/", ".github/"];
const PROTECTED_FILES = [".coderabbit.yaml"];

function block(message) {
  process.stderr.write(`protect-core: ${message}\n`);
  process.exit(2);
}

let raw = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) raw += chunk;

let input;
try {
  input = JSON.parse(raw);
} catch {
  // Fail closed: a protective hook that cannot read its input must not let the edit through.
  block("could not parse hook input; edit blocked to be safe.");
}

const toolInput = input?.tool_input ?? {};
const target = toolInput.file_path ?? toolInput.notebook_path;
if (typeof target !== "string" || target === "") process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const absolute = isAbsolute(target) ? target : resolve(input.cwd || projectDir, target);
let rel = relative(projectDir, absolute).split(sep).join("/");
// macOS and Windows file systems are case-insensitive: APP/src/Core is the same folder.
if (process.platform === "darwin" || process.platform === "win32") rel = rel.toLowerCase();

const hit =
  PROTECTED.find((prefix) => rel.startsWith(prefix.toLowerCase())) ??
  PROTECTED_FILES.find((file) => rel === file.toLowerCase());

if (hit) {
  block(
    `${rel} is in a protected zone (${hit}). Do not edit it and do not work around this via Bash. ` +
      "Stop and describe to the human what must change there and why (.claude/rules/do-not-touch.md).",
  );
}
process.exit(0);
