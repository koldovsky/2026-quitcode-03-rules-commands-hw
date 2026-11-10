// Сповіщення про новий лід у Telegram-чат менеджерів через Bot API (sendMessage).
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log, redact } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

interface TelegramResponse {
  ok: boolean;
  description?: string;
}

const isTelegramResponse = (value: unknown): value is TelegramResponse =>
  isRecord(value) &&
  typeof value.ok === "boolean" &&
  (value.description === undefined || isString(value.description));

export function formatTelegramMessage(lead: Lead): string {
  const budget = lead.budgetUsd === undefined ? "бюджет не вказано" : `бюджет $${lead.budgetUsd}`;
  return `Новий лід: ${lead.name} · ${lead.source} · ${budget}`;
}

export const telegramNotify: Integration = {
  name: "telegram-notify",
  requiredEnv: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],

  async send(lead: Lead): Promise<Result<void>> {
    const token = readEnv("TELEGRAM_BOT_TOKEN");
    if (!token.ok) return token;
    const chatId = readEnv("TELEGRAM_CHAT_ID");
    if (!chatId.ok) return chatId;

    const url = `https://api.telegram.org/bot${token.value}/sendMessage`;
    const response = await postJson(url, { chat_id: chatId.value, text: formatTelegramMessage(lead) });
    if (!response.ok) {
      // Помилка postJson містить URL з токеном бота — маскуємо й у значенні, яке повертаємо.
      const error = redact(response.error);
      log.error(`telegram-notify: lead ${lead.id} not delivered: ${error}`);
      return { ok: false, error };
    }

    const parsed = parseJson(response.value, isTelegramResponse, "telegram-notify");
    if (!parsed.ok) {
      log.error(`telegram-notify: lead ${lead.id} not delivered: ${parsed.error}`);
      return parsed;
    }
    if (!parsed.value.ok) {
      const error = `telegram-notify: API error: ${parsed.value.description ?? "no description"}`;
      log.error(`telegram-notify: lead ${lead.id} not delivered: ${error}`);
      return { ok: false, error };
    }

    log.info(`telegram-notify: lead ${lead.id} delivered`);
    return { ok: true, value: undefined };
  },
};
