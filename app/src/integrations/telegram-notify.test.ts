import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../core/types.js";
import { formatTelegramMessage, telegramNotify } from "./telegram-notify.js";

const lead: Lead = {
  id: "ld_0003",
  name: "Марія Тестова",
  email: "mariia@studio-nova.example.test",
  phone: "+380 (00) 000-00-00",
  source: "referral",
  budgetUsd: 7500,
  createdAt: "2026-09-10T10:15:00.000Z",
};

const BOT_TOKEN = "123456789:fake-telegram-token-000000";
const CHAT_ID = "-1001234567890";
const SEND_MESSAGE_URL = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

beforeEach(() => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", BOT_TOKEN);
  vi.stubEnv("TELEGRAM_CHAT_ID", CHAT_ID);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
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
    expect(text).toContain("referral");
    expect(text).toContain("7500");
    expect(text).not.toContain(lead.email);
    expect(text).not.toContain("+380");
  });

  it("надсилає повідомлення в чат: перевірка URL і тіла запиту", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response('{"ok":true,"result":{"message_id":42}}', { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(telegramNotify.send(lead)).resolves.toEqual({ ok: true, value: undefined });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(SEND_MESSAGE_URL);
    expect(JSON.parse(String(init?.body))).toEqual({
      chat_id: CHAT_ID,
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

  it("повертає помилку, коли Bot API відповів ok: false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"ok":false,"description":"chat not found"}', { status: 200 })),
    );

    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "telegram error: chat not found",
    });
  });

  it("не кидає виняток, а повертає Result, коли у відповіді не JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>502 Bad Gateway</html>", { status: 200 })));

    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "telegram-notify: invalid JSON",
    });
  });
});
