import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../core/types.js";
import { formatTelegramMessage, telegramNotify } from "./telegram-notify.js";

const lead: Lead = {
  id: "ld_0001",
  name: "Олена Тестова",
  email: "olena@studio-nova.example.test",
  phone: "+380 (00) 000-00-00",
  source: "website",
  budgetUsd: 4000,
  createdAt: "2026-09-10T08:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("telegram-notify", () => {
  it("formats the message without email or phone", () => {
    const text = formatTelegramMessage(lead);
    expect(text).toContain("Олена Тестова");
    expect(text).not.toContain(lead.email);
    expect(text).not.toContain("+380");
  });

  it("returns an error if TELEGRAM_BOT_TOKEN is not set", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHAT_ID", "-100123456789");
    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable TELEGRAM_BOT_TOKEN",
    });
  });

  it("returns an error if TELEGRAM_CHAT_ID is not set", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123456:fake-token-value-000000");
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable TELEGRAM_CHAT_ID",
    });
  });

  it("returns an error from the external system", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123456:fake-token-value-000000");
    vi.stubEnv("TELEGRAM_CHAT_ID", "-100123456789");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response("not found", { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await telegramNotify.send(lead);

    expect(result.ok).toBe(false);
  });

  it("sends the text to the chat", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123456:fake-token-value-000000");
    vi.stubEnv("TELEGRAM_CHAT_ID", "-100123456789");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await telegramNotify.send(lead);

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://api.telegram.org/bot123456:fake-token-value-000000/sendMessage");
    expect(JSON.parse(String(init?.body))).toEqual({
      chat_id: "-100123456789",
      text: formatTelegramMessage(lead),
    });
  });
});
