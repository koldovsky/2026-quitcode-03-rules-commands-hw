// Сповіщення про новий лід у Monobank-чат менеджерів через вебхук.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import type { Integration, Lead, Result } from "../core/types.js";

export function formatMonobankMessage(lead: Lead): string {
  const budget = lead.budgetUsd === undefined ? "бюджет не вказано" : `бюджет $${lead.budgetUsd}`;
  return `Новий лід: ${lead.name} · ${lead.source} · ${budget}`;
}

export const monobank: Integration = {
  name: "monobank",
  requiredEnv: ["MONOBANK_WEBHOOK_URL", "MONOBANK_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const webhookUrl = readEnv("MONOBANK_WEBHOOK_URL");
    if (!webhookUrl.ok) return webhookUrl;
    const token = readEnv("MONOBANK_TOKEN");
    if (!token.ok) return token;

    const response = await postJson(
      webhookUrl.value,
      { text: formatMonobankMessage(lead) },
      { headers: { "X-Token": token.value } },
    );
    if (!response.ok) {
      log.error(`monobank: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    log.info(`monobank: lead ${lead.id} delivered`);
    return { ok: true, value: undefined };
  },
};
