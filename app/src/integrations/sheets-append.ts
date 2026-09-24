// Додає рядок з лідом у Google-таблицю через вебхук (перенесено з n8n «Leads → Google Sheets»).
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log, redact } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

const isSheetsResponse = (value: unknown): value is { status: string } => isRecord(value) && isString(value.status);

const sheetsAppend: Integration = {
  name: "sheets-append",
  requiredEnv: ["SHEETS_WEBHOOK_URL", "SHEETS_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const webhookUrl = readEnv("SHEETS_WEBHOOK_URL");
    if (!webhookUrl.ok) return webhookUrl;
    const token = readEnv("SHEETS_TOKEN");
    if (!token.ok) return token;

    const url = `${webhookUrl.value}?token=${token.value}`;
    const row = [lead.createdAt, lead.name, lead.email, lead.phone ?? "", lead.source];
    const response = await postJson(url, { values: [row] });
    if (!response.ok) {
      // URL містить токен таблиці — не віддаємо його далі в тексті помилки.
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
      log.error(`sheets-append: lead ${lead.id} not added: status ${data.value.status}`);
      return { ok: false, error: `sheets error: ${data.value.status}` };
    }

    log.info(`sheets-append: row added for lead ${lead.id}`);
    return { ok: true, value: undefined };
  },
};

export default sheetsAppend;
