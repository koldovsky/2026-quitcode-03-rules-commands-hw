// Додає рядок нового ліда в Google Таблицю (перенесено з n8n-воркфлоу «Leads → Google Sheets», 2024).
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
    const token = readEnv("SHEETS_TOKEN");
    if (!token.ok) return token;

    const url = webhookUrl.value + "?token=" + token.value;
    const response = await postJson(url, {
      values: [[lead.createdAt, lead.name, lead.email, lead.phone ?? "", lead.source]],
    });
    if (!response.ok) return response;

    const parsed = parseJson(response.value, isSheetsResponse, "sheets-append");
    if (!parsed.ok) return parsed;

    if (parsed.value.status !== "ok") {
      log.error("sheets-append failed: " + url + " -> " + parsed.value.status);
      return { ok: false, error: "sheets error: " + parsed.value.status };
    }

    log.info("sheets-append: row added for lead " + lead.id);
    return { ok: true, value: undefined };
  },
};
