#!/usr/bin/env node
// PreToolUse hook: hard-blocks any Edit/Write/MultiEdit/NotebookEdit whose target
// path falls under app/src/core/ — the protected zone from
// materials/architecture-brief.md and .claude/rules/do-not-touch.md.
//
// Claude Code / Cursor both treat exit code 2 from a PreToolUse hook as "deny":
// the tool call is blocked and stderr is surfaced to the agent as the reason.

import { readFileSync } from "node:fs";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function targetPath(toolInput) {
  if (!toolInput || typeof toolInput !== "object") return undefined;
  return toolInput.file_path ?? toolInput.notebook_path ?? toolInput.path;
}

const raw = readStdin();
let input;
try {
  input = JSON.parse(raw);
} catch {
  // Malformed input from the host — fail open rather than block everything.
  process.exit(0);
}

const path = targetPath(input.tool_input);
if (typeof path === "string" && path.replaceAll("\\", "/").includes("app/src/core/")) {
  process.stderr.write(
    `Blocked by the protect-core hook: ${path} is in the protected zone (app/src/core/**).\n` +
      "Changes to core need a separate PR reviewed by the platform team — " +
      "describe the needed change and ask a human instead of editing it directly.\n",
  );
  process.exit(2);
}

process.exit(0);
