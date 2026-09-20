import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  // Відтворення інциденту 09–10.09.2026 (materials/error-log.txt).
  // На старому коді loadState мовчки повертав 1970 рік, і прогін заново
  // розсилав усю історію лідів, починаючи з ld_0001.
  it("пошкоджений стан не призводить до повторної розсилки всієї історії", async () => {
    const sent: string[] = [];
    const statePath = join(dir, "sync-state.json");
    const corrupted = '{"lastSyncedAt": "2026-09-09T23:5';
    writeFileSync(statePath, corrupted);

    const report = await runSync(leads, [recordingIntegration(sent)], statePath);

    expect(sent).toEqual([]);
    expect(report).toEqual({ pending: 0, delivered: 0, failed: 0 });
    // Пошкоджений файл лишається як є: перезаписати його — означає
    // зробити помилкову дату «легітимною» назавжди.
    expect(readFileSync(statePath, "utf8")).toBe(corrupted);
  });

  it("перерваний прогін не втрачає прогрес: доставлені ліди не йдуть удруге", async () => {
    const sent: string[] = [];
    const statePath = join(dir, "sync-state.json");

    const dyingIntegration: Integration = {
      name: "dying",
      requiredEnv: [],
      send: async (lead) => {
        if (lead.id === "ld_0003") throw new Error("процес вбито планувальником (SIGKILL)");
        sent.push(lead.id);
        return { ok: true, value: undefined };
      },
    };

    // Перший тик: два ліди пішли, на третьому прогін обірвано.
    await expect(runSync(leads, [dyingIntegration], statePath)).rejects.toThrow("SIGKILL");
    expect(sent).toEqual(["ld_0001", "ld_0002"]);

    // Чекпоінт мусив зберегтися після кожного доставленого ліда.
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({ lastSyncedAt: "2026-09-09T11:00:00.000Z" });

    // Наступний тик планувальника: лишився тільки ld_0003, дублікатів немає.
    const sentAgain: string[] = [];
    await runSync(leads, [recordingIntegration(sentAgain)], statePath);
    expect(sentAgain).toEqual(["ld_0003"]);
  });

  // Знайдено рев'ю CodeRabbit: курсор `lastSyncedAt` неоднозначний, коли два
  // ліди мають однаковий createdAt.
  it("не губить лід із таким самим createdAt після обриву", async () => {
    const statePath = join(dir, "sync-state.json");
    const sameTime = "2026-09-09T12:00:00.000Z";
    const twins = [makeLead("ld_a", sameTime), makeLead("ld_b", sameTime)];
    const sent: string[] = [];

    const dying: Integration = {
      name: "dying",
      requiredEnv: [],
      send: async (lead) => {
        if (lead.id === "ld_b") throw new Error("обрив між лідами тієї ж секунди");
        sent.push(lead.id);
        return { ok: true, value: undefined };
      },
    };

    await expect(runSync(twins, [dying], statePath)).rejects.toThrow();
    expect(sent).toEqual(["ld_a"]);

    // Чекпоінт не має стояти на sameTime — інакше ld_b зникне назавжди.
    const sentAgain: string[] = [];
    await runSync(twins, [recordingIntegration(sentAgain)], statePath);
    expect(sentAgain).toContain("ld_b");
  });

  it("не просуває чекпоінт повз недоставлений лід", async () => {
    const sent: string[] = [];
    const statePath = join(dir, "sync-state.json");

    const flaky: Integration = {
      name: "flaky",
      requiredEnv: [],
      send: async (lead) => {
        if (lead.id === "ld_0002") return { ok: false, error: "HTTP 429" };
        sent.push(lead.id);
        return { ok: true, value: undefined };
      },
    };

    await runSync(leads, [flaky], statePath);

    expect(sent).toEqual(["ld_0001"]);
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({ lastSyncedAt: "2026-09-09T10:00:00.000Z" });

    // Наступний тик повторює ld_0002 і лише потім іде далі — нічого не загублено.
    const sentAgain: string[] = [];
    await runSync(leads, [recordingIntegration(sentAgain)], statePath);
    expect(sentAgain).toEqual(["ld_0002", "ld_0003"]);
  });
});
