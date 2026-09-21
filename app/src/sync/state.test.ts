import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadState, saveState } from "./state.js";

let dir: string;
let statePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lead-sync-state-"));
  statePath = join(dir, "sync-state.json");
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("loadState", () => {
  it("повертає початковий стан, якщо файлу ще немає (перший запуск)", () => {
    expect(loadState(statePath)).toEqual({ ok: true, value: { lastSyncedAt: "1970-01-01T00:00:00.000Z" } });
  });

  it("повертає помилку, а не початковий стан, якщо файл обрізаний", () => {
    writeFileSync(statePath, '{"lastSyncedAt": "2026-09-');
    expect(loadState(statePath)).toEqual({ ok: false, error: "sync state: invalid JSON" });
  });

  it.each(["", "3", "2026-9-9", "Tue Sep 10 2026", "2026-02-30T00:00:00.000Z", "2026-09-10T08:00:00"])(
    "повертає помилку, якщо дата в стані не ISO-8601 UTC: %j",
    (lastSyncedAt) => {
      writeFileSync(statePath, JSON.stringify({ lastSyncedAt }));
      expect(loadState(statePath)).toEqual({ ok: false, error: "sync state: unexpected shape" });
    },
  );

  it("приймає ISO-8601 UTC і без мілісекунд", () => {
    writeFileSync(statePath, JSON.stringify({ lastSyncedAt: "2026-09-10T08:00:00Z" }));
    expect(loadState(statePath)).toEqual({ ok: true, value: { lastSyncedAt: "2026-09-10T08:00:00Z" } });
  });
});

describe("saveState", () => {
  it("записує стан і не лишає тимчасового файлу", () => {
    expect(saveState(statePath, { lastSyncedAt: "2026-09-10T08:00:00.000Z" })).toEqual({ ok: true, value: undefined });
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({ lastSyncedAt: "2026-09-10T08:00:00.000Z" });
    expect(existsSync(`${statePath}.tmp`)).toBe(false);
  });

  it("не псує попередній стан, якщо запис не вдався", () => {
    writeFileSync(statePath, JSON.stringify({ lastSyncedAt: "2026-09-09T23:55:00.000Z" }));
    mkdirSync(`${statePath}.tmp`); // запис у тимчасовий файл впаде, як на повному диску

    expect(saveState(statePath, { lastSyncedAt: "2026-09-10T08:00:00.000Z" }).ok).toBe(false);
    expect(loadState(statePath)).toEqual({ ok: true, value: { lastSyncedAt: "2026-09-09T23:55:00.000Z" } });
  });
});
