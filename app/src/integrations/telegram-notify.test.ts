import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../core/types.js";
import { formatTelegramMessage, telegramNotify } from "./telegram-notify.js";

const lead: Lead = {
  id: "ld_0002",
  name: "Олена Тестова",
  email: "olena@studio-nova.example.test",
  phone: "+380 (00) 000-00-00",
  source: "website",
  budgetUsd: 4000,
  createdAt: "2026-09-10T08:00:00.000Z",
};

// Вигаданий токен потрібної форми: перевіряємо, що він не тече в текст помилки.
const BOT_TOKEN = "123456789:AAFakeTokenForTestsOnly_0000000000";

function stubEnv(): void {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", BOT_TOKEN);
  vi.stubEnv("TELEGRAM_CHAT_ID", "-1001234567890");
}

function stubFetch(status: number, body: string) {
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
  it("формує повідомлення без email і телефону", () => {
    const text = formatTelegramMessage(lead);
    expect(text).toContain("Олена Тестова");
    expect(text).toContain("website");
    expect(text).toContain("4000");
    expect(text).not.toContain(lead.email);
    expect(text).not.toContain("+380");
  });

  it("надсилає повідомлення у sendMessage: перевірка URL і тіла", async () => {
    stubEnv();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchMock = stubFetch(200, JSON.stringify({ ok: true, result: { message_id: 1 } }));

    const result = await telegramNotify.send(lead);

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`);
    const body: unknown = JSON.parse(String(init?.body));
    expect(body).toEqual({
      chat_id: "-1001234567890",
      text: formatTelegramMessage(lead),
    });
    // Мінімізація даних: контакти ліда не йдуть у месенджер (conventions.md §8).
    expect(String(init?.body)).not.toContain(lead.email);
    expect(String(init?.body)).not.toContain("380");
  });

  it("повертає помилку, якщо не задано TELEGRAM_BOT_TOKEN", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHAT_ID", "-1001234567890");
    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable TELEGRAM_BOT_TOKEN",
    });
  });

  it("повертає помилку, якщо не задано TELEGRAM_CHAT_ID", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", BOT_TOKEN);
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable TELEGRAM_CHAT_ID",
    });
  });

  it("повертає помилку на HTTP 400 і не показує токен", async () => {
    stubEnv();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(400, JSON.stringify({ ok: false, description: "chat not found" }));

    const result = await telegramNotify.send(lead);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("HTTP 400");
    expect(result.error).not.toContain(BOT_TOKEN);
  });

  it("повертає помилку, коли Bot API відповідає ok: false", async () => {
    stubEnv();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(200, JSON.stringify({ ok: false, description: "bot was blocked by the user" }));

    const result = await telegramNotify.send(lead);

    expect(result).toEqual({
      ok: false,
      error: "telegram-notify: Bot API rejected lead: bot was blocked by the user",
    });
  });

  it("повертає помилку на невалідну відповідь замість тихого fallback", async () => {
    stubEnv();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubFetch(200, "<html>502 Bad Gateway</html>");

    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "telegram-notify: invalid JSON",
    });
  });
});

describe("telegram-notify: guard відповіді", () => {
  // Знахідка рев'ю CodeRabbit (PR #4): без stubEnv тест закінчувався на
  // відсутній змінній середовища й «проходив», нічого не довівши про guard.
  // Тепер перевіряється саме результат розбору відповіді, і повністю.
  it("відхиляє description нерядкового типу, а не пише [object Object]", async () => {
    stubEnv();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"ok":false,"description":{}}', { status: 200 })));

    const result = await telegramNotify.send(lead);

    expect(result).toEqual({ ok: false, error: "telegram-notify: unexpected shape" });
  });
});
