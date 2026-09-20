// Рядок у Google-таблиці на кожен лід. Перенесено з експорту n8n-воркфлоу
// «Leads → Google Sheets» (2024), приведено до конвенцій без зміни поведінки:
// той самий URL, те саме тіло запиту, ті самі тексти помилок.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

const sheetsAppend: Integration = {
  name: "sheets-append",
  requiredEnv: ["SHEETS_WEBHOOK_URL", "SHEETS_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const webhookUrl = readEnv("SHEETS_WEBHOOK_URL");
    if (!webhookUrl.ok) return webhookUrl;

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

    const body = parseJson(response.value, isRecord, "sheets-append");
    if (!body.ok) {
      log.error(`sheets-append: lead ${lead.id} not delivered: ${body.error}`);
      return body;
    }

    const status = body.value.status;
    if (status !== "ok") {
      log.error(`sheets-append failed: ${url} -> ${String(status)}`);
      return { ok: false, error: `sheets error: ${String(status)}` };
    }

    log.info(`sheets-append: row added for lead ${lead.id}`);
    return { ok: true, value: undefined };
  },
};

export default sheetsAppend;
