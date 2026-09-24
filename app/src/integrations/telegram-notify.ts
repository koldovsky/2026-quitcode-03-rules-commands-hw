// Сповіщення про новий лід у Telegram-чат менеджерів через Bot API (sendMessage).
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log, redact } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

const TELEGRAM_API_URL = "https://api.telegram.org";

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

    const url = `${TELEGRAM_API_URL}/bot${token.value}/sendMessage`;
    const response = await postJson(url, { chat_id: chatId.value, text: formatTelegramMessage(lead) });
    if (!response.ok) {
      // URL містить токен бота — не віддаємо його далі в тексті помилки.
      const error = redact(response.error);
      log.error(`telegram-notify: lead ${lead.id} not delivered: ${error}`);
      return { ok: false, error };
    }

    const data = parseJson(response.value, isTelegramResponse, "telegram-notify");
    if (!data.ok) {
      log.error(`telegram-notify: lead ${lead.id} not delivered: ${data.error}`);
      return data;
    }
    if (!data.value.ok) {
      const description = data.value.description ?? "unknown error";
      log.error(`telegram-notify: lead ${lead.id} not delivered: ${description}`);
      return { ok: false, error: `telegram error: ${description}` };
    }

    log.info(`telegram-notify: lead ${lead.id} delivered`);
    return { ok: true, value: undefined };
  },
};
