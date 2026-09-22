// Рядок у Google-таблиці на кожен новий лід. Перенесено з n8n-воркфлоу
// «Leads → Google Sheets» (2024), приведено до конвенцій проєкту.
// Таблиця — система обліку, тому в рядок ідуть повні дані ліда, з email і phone:
// мінімізація стосується сповіщень, не обліку.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

/** Те, що таблиця повертає у відповідь на додавання рядка. */
interface SheetsResponse {
  status: string;
}

const isSheetsResponse = (value: unknown): value is SheetsResponse =>
  isRecord(value) && isString(value.status);

// Рекламна кампанія (utm_campaign) приходить із форми сайту, але поля немає в `Lead`:
// `core/types.ts` належить платформній команді й змінюється окремим PR. Поки що читаємо
// його з guard тут, локально; коли поле з'явиться в `Lead` — цей хелпер зникає.
function readCampaign(lead: Lead): string {
  return isRecord(lead) && isString(lead.utmCampaign) ? lead.utmCampaign : "";
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
    // Порядок колонок фіксований: нові додаються в кінець, щоб старі рядки лишались читними.
    const row = [lead.createdAt, lead.name, lead.email, lead.phone ?? "", lead.source, readCampaign(lead)];

    const response = await postJson(url, { values: [row] });
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
      log.error(`sheets-append failed: ${url} -> ${parsed.value.status}`);
      return { ok: false, error: `sheets error: ${parsed.value.status}` };
    }

    log.info(`sheets-append: row added for lead ${lead.id}`);
    return { ok: true, value: undefined };
  },
};

export default sheetsAppend;
