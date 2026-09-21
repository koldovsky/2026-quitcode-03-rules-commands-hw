// Перенесено з експорту n8n-воркфлоу «Leads → Google Sheets» (2024).
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

const isSheetsResponse = (value: unknown): value is { status: string } =>
  isRecord(value) && isString(value.status);

export default {
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
} satisfies Integration;
