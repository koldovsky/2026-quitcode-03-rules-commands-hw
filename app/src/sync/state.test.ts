import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { INITIAL_STATE, loadState, saveState } from "./state.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lead-sync-state-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("loadState", () => {
  it("повертає початковий стан, якщо файлу ще немає", () => {
    expect(loadState(join(dir, "missing.json"))).toEqual({ ok: true, value: INITIAL_STATE });
  });

  it("читає валідний стан", () => {
    const path = join(dir, "sync-state.json");
    writeFileSync(path, JSON.stringify({ lastSyncedAt: "2026-09-09T23:55:00.000Z" }));
    expect(loadState(path)).toEqual({ ok: true, value: { lastSyncedAt: "2026-09-09T23:55:00.000Z" } });
  });

  it("повертає помилку для порожнього файлу, а не початковий стан", () => {
    const path = join(dir, "sync-state.json");
    writeFileSync(path, "");
    expect(loadState(path).ok).toBe(false);
  });

  it("повертає помилку для JSON неочікуваної форми", () => {
    const path = join(dir, "sync-state.json");
    writeFileSync(path, "{}");
    expect(loadState(path).ok).toBe(false);
  });

  it("повертає помилку для неканонічної дати, яка все одно парситься", () => {
    const path = join(dir, "sync-state.json");
    writeFileSync(path, JSON.stringify({ lastSyncedAt: "2026-9-9" }));
    expect(loadState(path).ok).toBe(false);
  });

  it("повертає помилку, а не кидає виняток, якщо файл не читається", () => {
    const path = join(dir, "sync-state.json");
    mkdirSync(path); // на місці файлу — тека: readFileSync кине EISDIR
    expect(loadState(path).ok).toBe(false);
  });
});

describe("saveState", () => {
  it("записує стан, який потім читається", () => {
    const path = join(dir, "sync-state.json");
    saveState(path, { lastSyncedAt: "2026-09-10T08:00:00.000Z" });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ lastSyncedAt: "2026-09-10T08:00:00.000Z" });
  });
});
