#!/usr/bin/env node
// Hook for Claude Code (PreToolUse) and Cursor (preToolUse): blocks writes to protected zones.
// Exit code 2 = the action is blocked in both tools; the stderr text is what the agent receives.
// Written in Node rather than bash so that it also works on Windows.
import path from "node:path";

// Same zones as .claude/rules/do-not-touch.md. A single file is listed with a trailing slash
// too, because the check below compares `${relative}/`.
const PROTECTED = ["app/src/core/", "app/scripts/", "materials/", ".github/", ".coderabbit.yaml/"];
const WRITE_TOOL = /(edit|write|delete|patch|replace)/i;

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

let event;
try {
  event = JSON.parse(Buffer.concat(chunks).toString("utf8"));
} catch {
  process.exit(0); // not a tool event we understand — leave the decision to the normal flow
}

if (typeof event.tool_name === "string" && !WRITE_TOOL.test(event.tool_name)) process.exit(0);

const input = event.tool_input ?? {};
const targets = [input.file_path, input.path, input.target_file, input.notebook_path].filter(
  (value) => typeof value === "string" && value.length > 0,
);

const root = process.env.CLAUDE_PROJECT_DIR ?? event.workspace_roots?.[0] ?? event.cwd ?? process.cwd();

for (const target of targets) {
  const relative = path.relative(root, path.resolve(root, target)).split(path.sep).join("/");
  const zone = PROTECTED.find((prefix) => `${relative}/`.startsWith(prefix));
  if (zone) {
    process.stderr.write(
      `Blocked by the protect-core hook: ${relative} is in the protected zone ${zone}**. ` +
        "Do not modify it. If the task cannot be done without this change, stop and describe " +
        "exactly what needs to change there and why.\n",
    );
    process.exit(2);
  }
}

process.exit(0);
