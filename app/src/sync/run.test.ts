import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Integration, Lead } from "../core/types.js";
import { runSync } from "./run.js";

const makeLead = (id: string, createdAt: string): Lead => ({
  id,
  name: `Lead ${id}`,
  email: `${id}@studio-nova.example.test`,
  source: "website",
  createdAt,
});

const leads = [
  makeLead("ld_0001", "2026-09-09T10:00:00.000Z"),
  makeLead("ld_0002", "2026-09-09T11:00:00.000Z"),
  makeLead("ld_0003", "2026-09-10T08:00:00.000Z"),
];

function failingForIntegration(sent: string[], failFor: string): Integration {
  return {
    name: "flaky",
    requiredEnv: [],
    send: async (lead) => {
      sent.push(lead.id);
      return lead.id === failFor ? { ok: false, error: "boom" } : { ok: true, value: undefined };
    },
  };
}

function recordingIntegration(sent: string[]): Integration {
  return {
    name: "recording",
    requiredEnv: [],
    send: async (lead) => {
      sent.push(lead.id);
      return { ok: true, value: undefined };
    },
  };
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lead-sync-"));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("runSync", () => {
  it("при першому запуску розсилає всі ліди і зберігає найновішу дату", async () => {
    const sent: string[] = [];
    const statePath = join(dir, "sync-state.json");

    const report = await runSync(leads, [recordingIntegration(sent)], statePath);

    expect(report).toEqual({ pending: 3, delivered: 3, failed: 0 });
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({ lastSyncedAt: "2026-09-10T08:00:00.000Z" });
  });

  it("розсилає лише ліди, новіші за збережений стан", async () => {
    const sent: string[] = [];
    const statePath = join(dir, "sync-state.json");
    writeFileSync(statePath, JSON.stringify({ lastSyncedAt: "2026-09-09T10:30:00.000Z" }));

    await runSync(leads, [recordingIntegration(sent)], statePath);

    expect(sent).toEqual(["ld_0002", "ld_0003"]);
  });

  // Регресія на нічний інцидент 10.09.2026: ENOSPC обрізав файл стану, loadState
  // мовчки повертав 1970, і кожні 5 хвилин воркер розсилав усю історію лідів.
  it("на пошкодженому файлі стану зупиняється, а не розсилає все заново", async () => {
    const sent: string[] = [];
    const statePath = join(dir, "sync-state.json");
    writeFileSync(statePath, ""); // саме це лишає обірваний writeFileSync

    const report = await runSync(leads, [recordingIntegration(sent)], statePath);

    expect(sent).toEqual([]);
    expect(report).toEqual({ pending: 0, delivered: 0, failed: 0 });
    expect(console.error).toHaveBeenCalled();
  });

  it("пошкоджений стан не перезаписується справжнім — слід збою лишається", async () => {
    const statePath = join(dir, "sync-state.json");
    writeFileSync(statePath, "");

    await runSync(leads, [recordingIntegration([])], statePath);

    expect(readFileSync(statePath, "utf8")).toBe("");
  });

  it("контрольна точка просувається після кожного ліда, а не лише в кінці", async () => {
    const statePath = join(dir, "sync-state.json");
    // Що лежало б у файлі стану, якби прогін убили саме на цьому ліді.
    const stateSeenAt: Record<string, unknown> = {};
    const observingIntegration: Integration = {
      name: "observing",
      requiredEnv: [],
      send: async (lead) => {
        stateSeenAt[lead.id] = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : null;
        return { ok: true, value: undefined };
      },
    };

    await runSync(leads, [observingIntegration], statePath);

    expect(stateSeenAt).toEqual({
      ld_0001: null,
      ld_0002: { lastSyncedAt: "2026-09-09T10:00:00.000Z" },
      ld_0003: { lastSyncedAt: "2026-09-09T11:00:00.000Z" },
    });
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({ lastSyncedAt: "2026-09-10T08:00:00.000Z" });
  });

  it("невдалий лід не дає контрольній точці перестрибнути через нього", async () => {
    const sent: string[] = [];
    const statePath = join(dir, "sync-state.json");

    const report = await runSync(leads, [failingForIntegration(sent, "ld_0002")], statePath);

    expect(sent).toEqual(["ld_0001", "ld_0002", "ld_0003"]);
    expect(report).toEqual({ pending: 3, delivered: 2, failed: 1 });
    // ld_0002 не дійшов, тож наступний запуск має спробувати його знову
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({ lastSyncedAt: "2026-09-09T10:00:00.000Z" });
  });
});
