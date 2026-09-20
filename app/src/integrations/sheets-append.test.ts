import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../core/types.js";
import sheetsAppend from "./sheets-append.js";

const lead: Lead = {
  id: "ld_0002",
  name: "Андрій Тестовий",
  email: "andrii@studio-nova.example.test",
  source: "instagram",
  createdAt: "2026-09-10T09:30:00.000Z",
};

beforeEach(() => {
  vi.stubEnv("SHEETS_WEBHOOK_URL", "https://sheets.example.test/append");
  vi.stubEnv("SHEETS_TOKEN", "fake-sheets-token-0000");
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sheets-append", () => {
  it("додає рядок у таблицю і повертає ok", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"status":"ok"}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sheetsAppend.send(lead)).resolves.toEqual({ ok: true, value: undefined });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://sheets.example.test/append?token=fake-sheets-token-0000");
    expect(JSON.parse(String(init?.body))).toEqual({
      values: [["2026-09-10T09:30:00.000Z", "Андрій Тестовий", "andrii@studio-nova.example.test", "", "instagram"]],
    });
  });

  // Третій випадок, якого вимагає architecture.md для кожної інтеграції. До
  // рефакторингу цей шлях був невизначеним: стара реалізація йшла в мережу на
  // URL «undefined?token=undefined» замість того, щоб повернути помилку.
  it("повертає помилку, якщо не задано SHEETS_TOKEN, і не йде в мережу", async () => {
    vi.stubEnv("SHEETS_TOKEN", "");
    const fetchMock = vi.fn(async () => new Response('{"status":"ok"}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sheetsAppend.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable SHEETS_TOKEN",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("повертає помилку, якщо таблиця відповіла не ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"status":"quota_exceeded"}', { status: 200 })));

    await expect(sheetsAppend.send(lead)).resolves.toEqual({ ok: false, error: "sheets error: quota_exceeded" });
  });
});
