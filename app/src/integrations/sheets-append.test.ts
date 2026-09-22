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
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sheets-append", () => {
  it("додає рядок у таблицю з порожньою кампанією, якщо її немає, і повертає ok", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"status":"ok"}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sheetsAppend.send(lead)).resolves.toEqual({ ok: true, value: undefined });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://sheets.example.test/append?token=fake-sheets-token-0000");
    expect(JSON.parse(String(init?.body))).toEqual({
      values: [["2026-09-10T09:30:00.000Z", "Андрій Тестовий", "andrii@studio-nova.example.test", "", "instagram", ""]],
    });
  });

  it("додає кампанію останньою колонкою рядка", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"status":"ok"}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    // Поля ще немає в `Lead` (core змінюється окремим PR), тож лід із кампанією збираємо тут.
    const leadWithCampaign = { ...lead, utmCampaign: "spring_sale" };

    await expect(sheetsAppend.send(leadWithCampaign)).resolves.toEqual({ ok: true, value: undefined });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      values: [
        [
          "2026-09-10T09:30:00.000Z",
          "Андрій Тестовий",
          "andrii@studio-nova.example.test",
          "",
          "instagram",
          "spring_sale",
        ],
      ],
    });
  });

  it("повертає помилку, якщо таблиця відповіла не ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"status":"quota_exceeded"}', { status: 200 })));

    await expect(sheetsAppend.send(lead)).resolves.toEqual({ ok: false, error: "sheets error: quota_exceeded" });
  });

  it("повертає помилку, якщо не задано SHEETS_WEBHOOK_URL", async () => {
    vi.stubEnv("SHEETS_WEBHOOK_URL", "");
    const fetchMock = vi.fn(async () => new Response('{"status":"ok"}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sheetsAppend.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable SHEETS_WEBHOOK_URL",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("повертає помилку, якщо не задано SHEETS_TOKEN", async () => {
    vi.stubEnv("SHEETS_TOKEN", "");
    const fetchMock = vi.fn(async () => new Response('{"status":"ok"}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sheetsAppend.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable SHEETS_TOKEN",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("повертає помилку, а не кидає виняток, якщо відповідь не та, на яку чекали", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>502 Bad Gateway</html>", { status: 200 })));

    await expect(sheetsAppend.send(lead)).resolves.toEqual({
      ok: false,
      error: "sheets-append: invalid JSON",
    });
  });
});
