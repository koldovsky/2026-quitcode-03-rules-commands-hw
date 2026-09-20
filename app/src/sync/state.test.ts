import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

describe("loadState", () => {
  it("відсутній файл — це штатний перший запуск", () => {
    expect(loadState(statePath)).toEqual({ ok: true, value: { lastSyncedAt: "1970-01-01T00:00:00.000Z" } });
  });

  it("читає збережений стан", () => {
    writeFileSync(statePath, JSON.stringify({ lastSyncedAt: "2026-09-09T23:55:00.000Z" }));
    expect(loadState(statePath)).toEqual({ ok: true, value: { lastSyncedAt: "2026-09-09T23:55:00.000Z" } });
  });

  // Ядро інциденту: обірваний ENOSPC-запис лишив файл обрізаним.
  it("обрізаний файл — помилка, а не мовчазний відкат до 1970", () => {
    writeFileSync(statePath, '{"lastSyncedAt": "2026-09-09T23:5');
    const result = loadState(statePath);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("invalid JSON");
  });

  it("порожній файл — помилка", () => {
    writeFileSync(statePath, "");
    expect(loadState(statePath).ok).toBe(false);
  });

  it("неочікувана форма — помилка", () => {
    writeFileSync(statePath, JSON.stringify({ lastSynced: "2026-09-09T23:55:00.000Z" }));
    const result = loadState(statePath);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("unexpected shape");
  });

  it("неканонічна дата — помилка: дати порівнюються як рядки", () => {
    writeFileSync(statePath, JSON.stringify({ lastSyncedAt: "2026-09-09T23:55:00Z" }));
    expect(loadState(statePath).ok).toBe(false);
  });
});

describe("saveState", () => {
  it("записує стан і не лишає тимчасових файлів", () => {
    const result = saveState(statePath, { lastSyncedAt: "2026-09-10T08:00:00.000Z" });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({ lastSyncedAt: "2026-09-10T08:00:00.000Z" });
    expect(readdirSync(dir).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("повертає помилку, а не кидає виняток, коли записати неможливо", () => {
    const unwritable = join(dir, "no-such-dir", "sync-state.json");
    const result = saveState(unwritable, { lastSyncedAt: "2026-09-10T08:00:00.000Z" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("cannot write");
    expect(existsSync(unwritable)).toBe(false);
  });

  it("зберігає й читає той самий стан", () => {
    saveState(statePath, { lastSyncedAt: "2026-09-10T08:00:00.000Z" });
    expect(loadState(statePath)).toEqual({ ok: true, value: { lastSyncedAt: "2026-09-10T08:00:00.000Z" } });
  });
});
