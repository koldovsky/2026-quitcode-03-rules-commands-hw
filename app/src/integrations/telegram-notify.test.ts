import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../core/types.js";
import { formatTelegramMessage, telegramNotify } from "./telegram-notify.js";

const lead: Lead = {
  id: "ld_0003",
  name: "Марія Тестова",
  email: "mariia@studio-nova.example.test",
  phone: "+380 (00) 000-00-00",
  source: "referral",
  budgetUsd: 2500,
  createdAt: "2026-09-10T10:15:00.000Z",
};

beforeEach(() => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "bot000000:fake-telegram-token-0000");
  vi.stubEnv("TELEGRAM_CHAT_ID", "-1000000000000");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("telegram-notify", () => {
  it("надсилає повідомлення в чат і повертає ok", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response('{"ok":true}', { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(telegramNotify.send(lead)).resolves.toEqual({ ok: true, value: undefined });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.telegram.org/botbot000000:fake-telegram-token-0000/sendMessage");
    expect(JSON.parse(String(init?.body))).toEqual({
      chat_id: "-1000000000000",
      text: formatTelegramMessage(lead),
    });
  });

  it("не передає email і телефон ліда в месенджер", () => {
    const text = formatTelegramMessage(lead);

    expect(text).toContain("Марія Тестова");
    expect(text).not.toContain(lead.email);
    expect(text).not.toContain("+380");
  });

  it("повертає помилку, якщо не задано TELEGRAM_CHAT_ID", async () => {
    vi.stubEnv("TELEGRAM_CHAT_ID", "");

    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable TELEGRAM_CHAT_ID",
    });
  });

  it("повертає помилку, якщо Telegram відповів помилкою", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"ok":false}', { status: 400 })),
    );

    const result = await telegramNotify.send(lead);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("HTTP 400");
  });
});
