// Перенесено з експорту n8n-воркфлоу «Leads → Google Sheets» (2024), приведено до конвенцій.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log, redact } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

interface SheetsResponse {
  status: string;
}

const isSheetsResponse = (value: unknown): value is SheetsResponse => isRecord(value) && isString(value.status);

const sheetsAppend: Integration = {
  name: "sheets-append",
  requiredEnv: ["SHEETS_WEBHOOK_URL", "SHEETS_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const webhookUrl = readEnv("SHEETS_WEBHOOK_URL");
    if (!webhookUrl.ok) return webhookUrl;
    const token = readEnv("SHEETS_TOKEN");
    if (!token.ok) return token;

    const response = await postJson(webhookUrl.value + "?token=" + token.value, {
      values: [[lead.createdAt, lead.name, lead.email, lead.phone ?? "", lead.source]],
    });
    if (!response.ok) {
      // Помилка postJson містить URL із токеном у query string — маскуємо перед поверненням.
      const error = redact(response.error);
      log.error(`sheets-append: lead ${lead.id} not added: ${error}`);
      return { ok: false, error };
    }

    const data = parseJson(response.value, isSheetsResponse, "sheets-append");
    if (!data.ok) {
      log.error(`sheets-append: lead ${lead.id} not added: ${data.error}`);
      return data;
    }
    if (data.value.status !== "ok") {
      log.error(`sheets-append: lead ${lead.id} not added: ${data.value.status}`);
      return { ok: false, error: "sheets error: " + data.value.status };
    }

    log.info(`sheets-append: row added for lead ${lead.id}`);
    return { ok: true, value: undefined };
  },
};

export default sheetsAppend;
