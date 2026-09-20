import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../core/types.js";
import { formatTelegramMessage, telegramNotify } from "./telegram-notify.js";

const lead: Lead = {
  id: "ld_0003",
  name: "Марія Тестова",
  email: "maria@studio-nova.example.test",
  phone: "+380 (00) 000-00-01",
  source: "referral",
  budgetUsd: 2500,
  createdAt: "2026-09-10T10:00:00.000Z",
};

beforeEach(() => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "fake-bot-token-0000");
  vi.stubEnv("TELEGRAM_CHAT_ID", "-100000000");
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("telegram-notify", () => {
  it("форматує повідомлення без email і телефону", () => {
    const text = formatTelegramMessage(lead);
    expect(text).toContain("Марія Тестова");
    expect(text).not.toContain(lead.email);
    expect(text).not.toContain("+380");
  });

  it("надсилає повідомлення у Telegram-чат", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await telegramNotify.send(lead);

    expect(result).toEqual({ ok: true, value: undefined });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.telegram.org/botfake-bot-token-0000/sendMessage");
    expect(JSON.parse(String(init?.body))).toEqual({
      chat_id: "-100000000",
      text: formatTelegramMessage(lead),
    });
  });

  it("повертає помилку, якщо не задано TELEGRAM_BOT_TOKEN", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable TELEGRAM_BOT_TOKEN",
    });
  });

  it("повертає помилку, якщо не задано TELEGRAM_CHAT_ID", async () => {
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable TELEGRAM_CHAT_ID",
    });
  });

  it("повертає помилку, якщо Telegram API відхилив запит", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"ok":false,"description":"chat not found"}', { status: 200 })),
    );

    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "telegram error: chat not found",
    });
  });
});
