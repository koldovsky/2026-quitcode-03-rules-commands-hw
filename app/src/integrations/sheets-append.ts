// Додає рядок нового ліда в Google-таблицю через вебхук таблиці.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson, type Guard } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

interface SheetsResponse {
  status: string;
}

const isSheetsResponse: Guard<SheetsResponse> = (value): value is SheetsResponse =>
  isRecord(value) && isString(value.status);

export const sheetsAppend: Integration = {
  name: "sheets-append",
  requiredEnv: ["SHEETS_WEBHOOK_URL", "SHEETS_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const webhookUrl = readEnv("SHEETS_WEBHOOK_URL");
    if (!webhookUrl.ok) return webhookUrl;
    // Токен іде в query string, тож лише HTTPS: інакше він полетить мережею відкритим текстом.
    if (!webhookUrl.value.startsWith("https://")) {
      return { ok: false, error: "sheets-append: SHEETS_WEBHOOK_URL must use https" };
    }

    const token = readEnv("SHEETS_TOKEN");
    if (!token.ok) return token;

    const url = `${webhookUrl.value}?token=${token.value}`;
    const response = await postJson(url, {
      values: [[lead.createdAt, lead.name, lead.email, lead.phone ?? "", lead.source]],
    });
    if (!response.ok) {
      log.error(`sheets-append: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    const parsed = parseJson(response.value, isSheetsResponse, "sheets-append");
    if (!parsed.ok) {
      log.error(`sheets-append: lead ${lead.id} not delivered: ${parsed.error}`);
      return parsed;
    }

    if (parsed.value.status !== "ok") {
      const error = `sheets error: ${parsed.value.status}`;
      log.error(`sheets-append: lead ${lead.id} not delivered: ${error}`);
      return { ok: false, error };
    }

    log.info(`sheets-append: row added for lead ${lead.id}`);
    return { ok: true, value: undefined };
  },
};
