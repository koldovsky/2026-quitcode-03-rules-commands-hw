import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadState, saveState } from "./state.js";

const INITIAL = "1970-01-01T00:00:00.000Z";

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
  it("відсутній файл — це легітимний перший запуск", () => {
    expect(loadState(statePath)).toEqual({ ok: true, value: { lastSyncedAt: INITIAL } });
  });

  it("читає валідний стан", () => {
    writeFileSync(statePath, JSON.stringify({ lastSyncedAt: "2026-09-09T10:30:00.000Z" }));

    expect(loadState(statePath)).toEqual({ ok: true, value: { lastSyncedAt: "2026-09-09T10:30:00.000Z" } });
  });

  // Ядро інциденту 10.09.2026: ENOSPC обрізав файл до нуля ще до запису.
  it("порожній файл після обірваного запису — помилка, а не старт із 1970", () => {
    writeFileSync(statePath, "");

    const result = loadState(statePath);

    expect(result.ok).toBe(false);
    expect(result).not.toEqual({ ok: true, value: { lastSyncedAt: INITIAL } });
  });

  it("обрізаний JSON — помилка, а не старт із 1970", () => {
    writeFileSync(statePath, '{"lastSyncedAt":"2026-09-');

    const result = loadState(statePath);

    expect(result).toEqual({ ok: false, error: "sync-state: invalid JSON" });
  });

  it("валідний JSON неочікуваної форми — помилка", () => {
    writeFileSync(statePath, JSON.stringify({ lastSyncedAt: 1757404800000 }));

    expect(loadState(statePath)).toEqual({ ok: false, error: "sync-state: unexpected shape" });
  });

  // Date.parse ковтає і "2026-09-09T10:30:00Z", і "2026-09-09"; saveState таких
  // не пише, тож у файлі стану вони означають, що його правили руками або збоєм.
  it("дата, що розбирається, але не канонічна — помилка", () => {
    writeFileSync(statePath, JSON.stringify({ lastSyncedAt: "2026-09-09T10:30:00Z" }));

    expect(loadState(statePath)).toEqual({ ok: false, error: "sync-state: unexpected shape" });
  });

  it("нечитабельний шлях — помилка як значення, без винятку", () => {
    const asDirectory = join(dir, "sync-state-dir");
    mkdirSync(asDirectory); // тека на місці файлу: readFileSync кине EISDIR

    const result = loadState(asDirectory);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("sync-state: cannot read");
  });
});

describe("saveState", () => {
  it("зберігає стан, який loadState читає назад", () => {
    saveState(statePath, { lastSyncedAt: "2026-09-10T08:00:00.000Z" });

    expect(loadState(statePath)).toEqual({ ok: true, value: { lastSyncedAt: "2026-09-10T08:00:00.000Z" } });
  });

  it("пише атомарно: тимчасового файлу після запису не лишається", () => {
    saveState(statePath, { lastSyncedAt: "2026-09-10T08:00:00.000Z" });

    expect(existsSync(`${statePath}.tmp`)).toBe(false);
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({ lastSyncedAt: "2026-09-10T08:00:00.000Z" });
  });
});
