// Рядок у Google-таблицю обліку лідів. Таблиця — система обліку,
// тому сюди йдуть повні дані ліда (на відміну від месенджерів, конвенції §8).
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
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

    const row = [lead.createdAt, lead.name, lead.email, lead.phone ?? "", lead.source];
    // retries: 0 — свідомо. Додати рядок у таблицю НЕ ідемпотентно: якщо запит
    // дійшов, а відповідь загубилась, повтор допише той самий лід удруге.
    // Саме дублікати в таблиці були скаргою клієнта в інциденті 10.09
    // (materials/error-log.txt). До рефакторингу цей модуль ходив одним
    // fetch без повторів — поведінку збережено навмисно.
    const response = await postJson(`${webhookUrl.value}?token=${token.value}`, { values: [row] }, { retries: 0 });
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
      log.error(`sheets-append failed: ${webhookUrl.value} -> ${parsed.value.status}`);
      return { ok: false, error: `sheets error: ${parsed.value.status}` };
    }

    log.info(`sheets-append: row added for lead ${lead.id}`);
    return { ok: true, value: undefined };
  },
};

export default sheetsAppend;
