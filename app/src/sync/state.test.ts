import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadState, saveState } from "./state.js";

let dir: string;
let statePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lead-sync-state-"));
  statePath = join(dir, "sync-state.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("state", () => {
  it("повертає початковий стан, якщо файлу немає", () => {
    expect(loadState(statePath)).toEqual({ lastSyncedAt: "1970-01-01T00:00:00.000Z" });
  });

  it("мовчки повертається до початкового стану, якщо файл пошкоджений (не кидає)", () => {
    // Відтворює механізм інциденту (docs/verification.md, /analyze-error):
    // writeFileSync у saveState не атомарний (truncate+write), тож збій
    // посеред запису (напр. ENOSPC) лишає файл стану пошкодженим — саме
    // такий вміст тут і симулюється.
    writeFileSync(statePath, '{"lastSyncedAt": "2026-09-09T2');

    expect(loadState(statePath)).toEqual({ lastSyncedAt: "1970-01-01T00:00:00.000Z" });
  });

  it("зберігає і читає стан через повний цикл", () => {
    saveState(statePath, { lastSyncedAt: "2026-09-10T00:15:00.000Z" });
    expect(loadState(statePath)).toEqual({ lastSyncedAt: "2026-09-10T00:15:00.000Z" });
  });
});
