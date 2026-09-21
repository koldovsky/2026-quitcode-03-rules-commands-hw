// Додавання рядка з даними ліда в Google-таблицю через вебхук.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

interface SheetsResponse {
  status: string;
}

function isSheetsResponse(value: unknown): value is SheetsResponse {
  return isRecord(value) && isString(value.status);
}

const sheetsAppend: Integration = {
  name: "sheets-append",
  requiredEnv: ["SHEETS_WEBHOOK_URL", "SHEETS_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const webhookUrl = readEnv("SHEETS_WEBHOOK_URL");
    if (!webhookUrl.ok) return webhookUrl;

    const token = readEnv("SHEETS_TOKEN");
    if (!token.ok) return token;

    const url = `${webhookUrl.value}?token=${token.value}`;
    const body = { values: [[lead.createdAt, lead.name, lead.email, lead.phone ?? "", lead.source]] };

    // Без повторів: запис неідемпотентний — повтор після 5xx чи таймауту, коли рядок уже
    // додано, дав би дублікат.
    const response = await postJson(url, body, { retries: 0 });
    if (!response.ok) {
      log.error(`sheets-append: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    const parsed = parseJson(response.value, isSheetsResponse, "sheets-response");
    if (!parsed.ok) {
      log.error(`sheets-append: lead ${lead.id} invalid response: ${parsed.error}`);
      return parsed;
    }

    if (parsed.value.status !== "ok") {
      log.error(`sheets-append: lead ${lead.id} failed: ${parsed.value.status}`);
      return { ok: false, error: `sheets error: ${parsed.value.status}` };
    }

    log.info(`sheets-append: row added for lead ${lead.id}`);
    return { ok: true, value: undefined };
  },
};

export default sheetsAppend;
