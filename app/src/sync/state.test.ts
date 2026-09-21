import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { INITIAL_STATE, loadState, saveState } from "./state.js";

let dir: string;
let statePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lead-sync-state-"));
  statePath = join(dir, "sync-state.json");
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("loadState", () => {
  it("відсутній файл — це перший запуск, а не помилка", () => {
    expect(loadState(statePath)).toEqual({ ok: true, value: INITIAL_STATE });
  });

  it("читає збережений стан", () => {
    writeFileSync(statePath, JSON.stringify({ lastSyncedAt: "2026-09-09T10:30:00.000Z" }));
    expect(loadState(statePath)).toEqual({ ok: true, value: { lastSyncedAt: "2026-09-09T10:30:00.000Z" } });
  });

  // Відтворення нічного інциденту 10.09.2026: ENOSPC обірвав writeFileSync і
  // лишив на диску порожній файл. Старий код ковтав помилку розбору й повертав
  // 1970 — тобто «всі ліди нові».
  it("порожній файл після обриву запису — це помилка, а не дата 1970", () => {
    writeFileSync(statePath, "");
    const result = loadState(statePath);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("sync-state");
    expect(result).not.toEqual({ ok: true, value: INITIAL_STATE });
  });

  it("обрізаний JSON — теж помилка", () => {
    writeFileSync(statePath, '{"lastSyncedAt": "2026-09-');
    expect(loadState(statePath).ok).toBe(false);
  });

  it("валідний JSON неочікуваної форми не приймається мовчки", () => {
    writeFileSync(statePath, JSON.stringify({ lastSynced: 1757500000 }));
    expect(loadState(statePath).ok).toBe(false);
  });

  // Знахідка рев'ю CodeRabbit (PR #4): guard перевіряв лише тип рядка.
  // `""` пропускає всі ліди повторно, `"z"` більший за будь-яку ISO-дату й
  // зупиняє синхронізацію назавжди — обидва проходили як «валідний стан».
  it.each([
    ['порожній рядок', '{"lastSyncedAt":""}'],
    ['не дата', '{"lastSyncedAt":"z"}'],
    ['без часу', '{"lastSyncedAt":"2026-09-10"}'],
    ['без мілісекунд', '{"lastSyncedAt":"2026-09-10T08:00:00Z"}'],
    ['неіснуюча дата', '{"lastSyncedAt":"2026-13-45T00:00:00.000Z"}'],
    ['інший тип lastLeadId', '{"lastSyncedAt":"2026-09-10T08:00:00.000Z","lastLeadId":7}'],
  ])("відхиляє стан: %s", (_name, content) => {
    writeFileSync(statePath, content);
    expect(loadState(statePath).ok).toBe(false);
  });

  it("читає стан, збережений до появи lastLeadId", () => {
    writeFileSync(statePath, '{"lastSyncedAt":"2026-09-10T08:00:00.000Z"}');
    expect(loadState(statePath)).toEqual({
      ok: true,
      value: { lastSyncedAt: "2026-09-10T08:00:00.000Z" },
    });
  });
});

describe("saveState", () => {
  it("зберігає стан і не лишає тимчасового файлу", () => {
    expect(saveState(statePath, { lastSyncedAt: "2026-09-10T08:00:00.000Z" })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({ lastSyncedAt: "2026-09-10T08:00:00.000Z" });
    expect(() => readFileSync(`${statePath}.tmp`, "utf8")).toThrow();
  });

  it("невдалий запис повертає помилку, а не кидає виняток", () => {
    const result = saveState(join(dir, "немає-такої-теки", "state.json"), INITIAL_STATE);
    expect(result.ok).toBe(false);
  });

  it("невдалий запис лишає попередній стан цілим", () => {
    saveState(statePath, { lastSyncedAt: "2026-09-09T10:30:00.000Z" });
    // Тека замість файлу: rename не вдасться, старий стан має вціліти.
    const result = saveState(dir, { lastSyncedAt: "2026-09-10T08:00:00.000Z" });

    expect(result.ok).toBe(false);
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({ lastSyncedAt: "2026-09-09T10:30:00.000Z" });
  });
});
