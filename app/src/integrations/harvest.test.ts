import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../core/types.js";
import { harvest } from "./harvest.js";

const lead: Lead = {
  id: "ld_0003",
  name: "Ірина Тестова",
  email: "iryna@studio-nova.example.test",
  phone: "+380 (00) 111-11-11",
  source: "referral",
  budgetUsd: 2500,
  createdAt: "2026-09-10T09:30:00.000Z",
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("harvest", () => {
  it("повертає помилку, якщо не задано HARVEST_WEBHOOK_URL", async () => {
    vi.stubEnv("HARVEST_WEBHOOK_URL", "");
    vi.stubEnv("HARVEST_API_TOKEN", "fake-harvest-token-0000");

    await expect(harvest.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable HARVEST_WEBHOOK_URL",
    });
  });

  it("повертає помилку, якщо не задано HARVEST_API_TOKEN", async () => {
    vi.stubEnv("HARVEST_WEBHOOK_URL", "https://api.harvest.example.test/leads");
    vi.stubEnv("HARVEST_API_TOKEN", "");

    await expect(harvest.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable HARVEST_API_TOKEN",
    });
  });

  it("надсилає повні дані ліда з токеном авторизації", async () => {
    vi.stubEnv("HARVEST_WEBHOOK_URL", "https://api.harvest.example.test/leads");
    vi.stubEnv("HARVEST_API_TOKEN", "fake-harvest-token-0000");
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await harvest.send(lead);

    expect(result).toEqual({ ok: true, value: undefined });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.harvest.example.test/leads");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer fake-harvest-token-0000");
    expect(JSON.parse(String(init?.body))).toEqual({
      id: "ld_0003",
      name: "Ірина Тестова",
      email: "iryna@studio-nova.example.test",
      phone: "+380 (00) 111-11-11",
      source: "referral",
      budgetUsd: 2500,
      createdAt: "2026-09-10T09:30:00.000Z",
    });
  });

  it("повертає помилку, якщо Harvest відповідає не 2xx", async () => {
    vi.stubEnv("HARVEST_WEBHOOK_URL", "https://api.harvest.example.test/leads");
    vi.stubEnv("HARVEST_API_TOKEN", "fake-harvest-token-0000");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unauthorized", { status: 401 })));

    const result = await harvest.send(lead);

    expect(result).toEqual({
      ok: false,
      error: "POST https://api.harvest.example.test/leads failed: HTTP 401",
    });
  });
});
