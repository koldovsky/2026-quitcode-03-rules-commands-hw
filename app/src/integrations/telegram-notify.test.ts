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

const FAKE_TOKEN = "123456789:fakeTokenForTests_abcdefghijklmn";

function stubTelegramEnv(): void {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", FAKE_TOKEN);
  vi.stubEnv("TELEGRAM_CHAT_ID", "-1000000000001");
}

function stubFetch(body: string, status = 200) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("telegram-notify", () => {
  it("форматує повідомлення без email і телефону", () => {
    const text = formatTelegramMessage(lead);
    expect(text).toContain("Олена Тестова");
    expect(text).not.toContain(lead.email);
    expect(text).not.toContain("+380");
  });

  it("надсилає повідомлення в sendMessage бота", async () => {
    stubTelegramEnv();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchMock = stubFetch('{"ok":true,"result":{"message_id":1}}');

    const result = await telegramNotify.send(lead);

    expect(result).toEqual({ ok: true, value: undefined });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`https://api.telegram.org/bot${FAKE_TOKEN}/sendMessage`);
    expect(JSON.parse(String(init?.body))).toEqual({
      chat_id: "-1000000000001",
      text: formatTelegramMessage(lead),
    });
  });

  it("повертає помилку, якщо не задано TELEGRAM_BOT_TOKEN", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHAT_ID", "-1000000000001");
    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable TELEGRAM_BOT_TOKEN",
    });
  });

  it("повертає помилку, якщо не задано TELEGRAM_CHAT_ID", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", FAKE_TOKEN);
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable TELEGRAM_CHAT_ID",
    });
  });

  it("повертає помилку сервісу без токена в тексті", async () => {
    stubTelegramEnv();
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch('{"ok":false,"error_code":400,"description":"Bad Request: chat not found"}', 400);

    const result = await telegramNotify.send(lead);

    expect(result).toEqual({
      ok: false,
      error: "POST https://api.telegram.org/bot<REDACTED>/sendMessage failed: HTTP 400",
    });
  });

  it("повертає помилку, якщо API відповів ok: false", async () => {
    stubTelegramEnv();
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch('{"ok":false,"description":"Forbidden: bot was blocked"}');

    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "telegram-notify: API error: Forbidden: bot was blocked",
    });
  });

  it("повертає помилку на неочікувану форму відповіді", async () => {
    stubTelegramEnv();
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch('{"result":{}}');

    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "telegram-notify: unexpected shape",
    });
  });
});
