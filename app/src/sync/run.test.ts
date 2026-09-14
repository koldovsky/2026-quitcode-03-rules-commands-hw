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
  vi.unstubAllEnvs();
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
});

// Інцидент 10.09 (materials/error-log.txt): запис стану обірвав ENOSPC, а наступні
// запуски мовчки почали з 1970 року й кожні п'ять хвилин розсилали всю історію.
describe("runSync — пошкоджений або обірваний стан", () => {
  it("не розсилає нічого й не перезаписує файл, якщо стан пошкоджено", async () => {
    const sent: string[] = [];
    const statePath = join(dir, "sync-state.json");
    const truncated = '{"lastSyncedAt": "2026-09-09T23:5';
    writeFileSync(statePath, truncated);

    const report = await runSync(leads, [recordingIntegration(sent)], statePath);

    expect(sent).toEqual([]);
    expect(report.pending).toBe(0);
    expect(report.error).toContain("invalid JSON");
    expect(readFileSync(statePath, "utf8")).toBe(truncated);
  });

  it("після обірваного запуску продовжує з місця зупинки, а не з початку", async () => {
    const statePath = join(dir, "sync-state.json");
    const firstRun: string[] = [];
    const killedOnSecondLead: Integration = {
      name: "killed",
      requiredEnv: [],
      send: async (lead) => {
        firstRun.push(lead.id);
        if (firstRun.length === 2) throw new Error("SIGKILL (simulated run timeout)");
        return { ok: true, value: undefined };
      },
    };

    await expect(runSync(leads, [killedOnSecondLead], statePath)).rejects.toThrow("SIGKILL");

    const secondRun: string[] = [];
    await runSync(leads, [recordingIntegration(secondRun)], statePath);

    expect(secondRun).toEqual(["ld_0002", "ld_0003"]);
  });
});

describe("runSync — невдала доставка і змінні середовища", () => {
  it("зупиняється на першій невдалій доставці й не просуває чекпоінт", async () => {
    const statePath = join(dir, "sync-state.json");
    const firstRun: string[] = [];
    const failsOnSecondLead: Integration = {
      name: "flaky",
      requiredEnv: [],
      send: async (lead) => {
        firstRun.push(lead.id);
        return lead.id === "ld_0002" ? { ok: false, error: "HTTP 503" } : { ok: true, value: undefined };
      },
    };

    const report = await runSync(leads, [failsOnSecondLead], statePath);

    expect(firstRun).toEqual(["ld_0001", "ld_0002"]);
    expect(report).toMatchObject({ pending: 3, delivered: 1, failed: 1 });
    expect(report.error).toContain("ld_0002");
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({ lastSyncedAt: "2026-09-09T10:00:00.000Z" });

    const secondRun: string[] = [];
    await runSync(leads, [recordingIntegration(secondRun)], statePath);

    expect(secondRun).toEqual(["ld_0002", "ld_0003"]);
  });

  it("не починає розсилку, якщо інтеграції бракує змінної середовища", async () => {
    vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "");
    const sent: string[] = [];
    const statePath = join(dir, "sync-state.json");
    const needsToken: Integration = {
      ...recordingIntegration(sent),
      name: "needs-token",
      requiredEnv: ["HUBSPOT_ACCESS_TOKEN"],
    };

    const report = await runSync(leads, [recordingIntegration(sent), needsToken], statePath);

    expect(sent).toEqual([]);
    expect(report.error).toContain("needs-token: HUBSPOT_ACCESS_TOKEN");
    expect(existsSync(statePath)).toBe(false);
  });
});
