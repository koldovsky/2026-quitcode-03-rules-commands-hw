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

const FAKE_TOKEN = "123456789:fakeAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const FAKE_CHAT_ID = "-1000000000000";

function stubTelegramEnv(): void {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", FAKE_TOKEN);
  vi.stubEnv("TELEGRAM_CHAT_ID", FAKE_CHAT_ID);
}

function silenceLogs(): void {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("telegram-notify", () => {
  it("name збігається з іменем файлу і requiredEnv містить усі змінні", () => {
    expect(telegramNotify.name).toBe("telegram-notify");
    expect(telegramNotify.requiredEnv).toEqual(["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]);
  });

  it("форматує повідомлення без email і телефону", () => {
    const text = formatTelegramMessage(lead);
    expect(text).toContain("Олена Тестова");
    expect(text).toContain("$4000");
    expect(text).not.toContain(lead.email);
    expect(text).not.toContain("+380");
  });

  it("надсилає повідомлення в sendMessage: URL і тіло без email і телефону", async () => {
    stubTelegramEnv();
    silenceLogs();
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await telegramNotify.send(lead);

    expect(result).toEqual({ ok: true, value: undefined });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`https://api.telegram.org/bot${FAKE_TOKEN}/sendMessage`);
    const rawBody = String(init?.body);
    expect(JSON.parse(rawBody)).toEqual({ chat_id: FAKE_CHAT_ID, text: formatTelegramMessage(lead) });
    expect(rawBody).not.toContain(lead.email);
    expect(rawBody).not.toContain("+380");
    expect(rawBody).not.toMatch(/email|phone/);
  });

  it("повертає помилку, якщо не задано TELEGRAM_BOT_TOKEN", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHAT_ID", FAKE_CHAT_ID);
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

  it("повертає помилку HTTP від Telegram і не розкриває токен", async () => {
    stubTelegramEnv();
    silenceLogs();
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, error_code: 400, description: "Bad Request: chat not found" }), {
          status: 400,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await telegramNotify.send(lead);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("HTTP 400");
    expect(result.error).not.toContain(FAKE_TOKEN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("повертає помилку, якщо Telegram відповів ok: false", async () => {
    stubTelegramEnv();
    silenceLogs();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: false, description: "Forbidden" }), { status: 200 })),
    );

    await expect(telegramNotify.send(lead)).resolves.toEqual({ ok: false, error: "telegram error: Forbidden" });
  });

  it("повертає помилку на невалідний JSON", async () => {
    stubTelegramEnv();
    silenceLogs();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not json", { status: 200 })));

    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "telegram-notify: invalid JSON",
    });
  });

  it("повертає помилку на неочікувану форму відповіді", async () => {
    stubTelegramEnv();
    silenceLogs();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ result: {} }), { status: 200 })));

    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "telegram-notify: unexpected shape",
    });
  });
});
