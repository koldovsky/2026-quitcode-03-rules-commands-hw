import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../core/types.js";
import { formatMonobankMessage, monobank } from "./monobank.js";

const lead: Lead = {
  id: "ld_0003",
  name: "Оксана Тестова",
  email: "oksana@studio-nova.example.test",
  phone: "+380 (00) 000-00-00",
  source: "referral",
  budgetUsd: 1500,
  createdAt: "2026-09-10T10:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("monobank", () => {
  it("форматує повідомлення без email і телефону", () => {
    const text = formatMonobankMessage(lead);
    expect(text).toContain("Оксана Тестова");
    expect(text).not.toContain(lead.email);
    expect(text).not.toContain("+380");
  });

  it("повертає помилку, якщо не задано MONOBANK_WEBHOOK_URL", async () => {
    vi.stubEnv("MONOBANK_WEBHOOK_URL", "");
    vi.stubEnv("MONOBANK_TOKEN", "fake-monobank-token-0000");

    await expect(monobank.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable MONOBANK_WEBHOOK_URL",
    });
  });

  it("повертає помилку, якщо не задано MONOBANK_TOKEN", async () => {
    vi.stubEnv("MONOBANK_WEBHOOK_URL", "https://api.monobank.example.test/personal/webhook");
    vi.stubEnv("MONOBANK_TOKEN", "");

    await expect(monobank.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable MONOBANK_TOKEN",
    });
  });

  it("надсилає текст у вебхук", async () => {
    vi.stubEnv("MONOBANK_WEBHOOK_URL", "https://api.monobank.example.test/personal/webhook");
    vi.stubEnv("MONOBANK_TOKEN", "fake-monobank-token-0000");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await monobank.send(lead);

    expect(result).toEqual({ ok: true, value: undefined });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.monobank.example.test/personal/webhook");
    expect(JSON.parse(String(init?.body))).toEqual({ text: formatMonobankMessage(lead) });
    expect((init?.headers as Record<string, string>)["X-Token"]).toBe("fake-monobank-token-0000");
  });

  it("повертає помилку, якщо вебхук відповів невдало", async () => {
    vi.stubEnv("MONOBANK_WEBHOOK_URL", "https://api.monobank.example.test/personal/webhook");
    vi.stubEnv("MONOBANK_TOKEN", "fake-monobank-token-0000");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("invalid_payload", { status: 400 })));

    const result = await monobank.send(lead);

    expect(result).toEqual({
      ok: false,
      error: "POST https://api.monobank.example.test/personal/webhook failed: HTTP 400",
    });
  });
});
