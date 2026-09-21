import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

    const result = await runSync(leads, [recordingIntegration(sent)], statePath);

    expect(result).toEqual({ ok: true, value: { pending: 3, delivered: 3, failed: 0 } });
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({
      lastSyncedAt: "2026-09-10T08:00:00.000Z",
      lastLeadId: "ld_0003",
    });
  });

  it("розсилає лише ліди, новіші за збережений стан", async () => {
    const sent: string[] = [];
    const statePath = join(dir, "sync-state.json");
    writeFileSync(statePath, JSON.stringify({ lastSyncedAt: "2026-09-09T10:30:00.000Z" }));

    await runSync(leads, [recordingIntegration(sent)], statePath);

    expect(sent).toEqual(["ld_0002", "ld_0003"]);
  });

  // Відтворення нічного інциденту: пошкоджений файл стану більше НЕ означає
  // «розіслати все заново». Саме цей тест падав би до фікса.
  it("не розсилає нічого, якщо стан не читається", async () => {
    const sent: string[] = [];
    const statePath = join(dir, "sync-state.json");
    writeFileSync(statePath, "");

    const result = await runSync(leads, [recordingIntegration(sent)], statePath);

    expect(sent).toEqual([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("стан не прочитано");
  });

  it("не затирає пошкоджений стан «початковим» — файл лишається для розбору людиною", async () => {
    const statePath = join(dir, "sync-state.json");
    writeFileSync(statePath, "не json");

    await runSync(leads, [recordingIntegration([])], statePath);

    expect(readFileSync(statePath, "utf8")).toBe("не json");
  });

  // Запуск, убитий планувальником на 4m30s, не має втрачати прогрес:
  // раніше стан зберігався один раз у кінці й до нього справа не доходила.
  it("зберігає прогрес після кожного ліда, а не лише в кінці", async () => {
    const statePath = join(dir, "sync-state.json");
    const killed: Integration = {
      name: "killed-midway",
      requiredEnv: [],
      send: async (lead) => {
        if (lead.id === "ld_0003") throw new Error("SIGKILL");
        return { ok: true, value: undefined };
      },
    };

    await expect(runSync(leads, [killed], statePath)).rejects.toThrow("SIGKILL");

    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual({
      lastSyncedAt: "2026-09-09T11:00:00.000Z",
      lastLeadId: "ld_0002",
    });
  });

  // Знахідка рев'ю CodeRabbit (PR #4). З курсором лише за датою цей тест падав:
  // після обриву другий лід із тим самим createdAt не доставлявся НІКОЛИ.
  it("не губить лід із таким самим createdAt після обриву", async () => {
    const statePath = join(dir, "sync-state.json");
    const twins = [
      makeLead("ld_a", "2026-09-11T09:00:00.000Z"),
      makeLead("ld_b", "2026-09-11T09:00:00.000Z"),
    ];
    const firstRun: string[] = [];
    const killedOnSecond: Integration = {
      name: "killed-on-second",
      requiredEnv: [],
      send: async (lead) => {
        if (lead.id === "ld_b") throw new Error("SIGKILL");
        firstRun.push(lead.id);
        return { ok: true, value: undefined };
      },
    };

    await expect(runSync(twins, [killedOnSecond], statePath)).rejects.toThrow("SIGKILL");
    expect(firstRun).toEqual(["ld_a"]);

    const secondRun: string[] = [];
    const result = await runSync(twins, [recordingIntegration(secondRun)], statePath);

    expect(secondRun).toEqual(["ld_b"]);
    expect(result).toEqual({ ok: true, value: { pending: 1, delivered: 1, failed: 0 } });
  });

  // Друга знахідка того ж рев'ю: лід доставлено, курсор не зрушив — наступний
  // запуск доставить його вдруге. Виклик має побачити помилку, а не «звіт».
  it("повертає помилку, якщо чекпойнт не зберігся після доставки", async () => {
    const statePath = join(dir, "sync-state.json");
    writeFileSync(statePath, JSON.stringify({ lastSyncedAt: "1970-01-01T00:00:00.000Z" }));
    mkdirSync(`${statePath}.tmp`); // тимчасовий файл записати нікуди — запис стану впаде
    const sent: string[] = [];

    const result = await runSync(leads, [recordingIntegration(sent)], statePath);

    expect(sent).toEqual(["ld_0001"]); // перший лід уже пішов
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("чекпойнт не збережено після ліда ld_0001");
      expect(result.error).toContain("доставлено 1");
    }
  });
});
