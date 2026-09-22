// Сповіщення про новий лід у Telegram-чат менеджерів через Bot API sendMessage.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

/** Telegram — месенджер, тому email і phone у текст не йдуть: лише name, source, budgetUsd. */
export function formatTelegramMessage(lead: Lead): string {
  const budget = lead.budgetUsd === undefined ? "бюджет не вказано" : `бюджет $${lead.budgetUsd}`;
  return `Новий лід: ${lead.name} · ${lead.source} · ${budget}`;
}

/** Відповідь Bot API: `ok: false` приходить разом із текстовим `description`. */
interface TelegramResponse {
  ok: boolean;
  description?: string;
}

// Локальний guard: у публічному API ядра є isRecord/isString/isNumber, булевого немає,
// а дописувати експорт у core/parse.ts не можна — тримаємо його тут.
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isTelegramResponse = (value: unknown): value is TelegramResponse =>
  isRecord(value) &&
  isBoolean(value.ok) &&
  (value.description === undefined || isString(value.description));

export const telegramNotify: Integration = {
  name: "telegram-notify",
  requiredEnv: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],

  async send(lead: Lead): Promise<Result<void>> {
    const botToken = readEnv("TELEGRAM_BOT_TOKEN");
    if (!botToken.ok) return botToken;

    const chatId = readEnv("TELEGRAM_CHAT_ID");
    if (!chatId.ok) return chatId;

    const url = `https://api.telegram.org/bot${botToken.value}/sendMessage`;
    const response = await postJson(url, {
      chat_id: chatId.value,
      text: formatTelegramMessage(lead),
    });
    if (!response.ok) {
      log.error(`telegram-notify: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    const parsed = parseJson(response.value, isTelegramResponse, "telegram-notify");
    if (!parsed.ok) {
      log.error(`telegram-notify: lead ${lead.id} not delivered: ${parsed.error}`);
      return parsed;
    }

    if (!parsed.value.ok) {
      const error = `telegram error: ${parsed.value.description ?? "unknown"}`;
      log.error(`telegram-notify: lead ${lead.id} not delivered: ${error}`);
      return { ok: false, error };
    }

    log.info(`telegram-notify: lead ${lead.id} delivered`);
    return { ok: true, value: undefined };
  },
};
