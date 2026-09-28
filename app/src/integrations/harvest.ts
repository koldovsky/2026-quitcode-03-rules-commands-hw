// Синхронізація лідів у Harvest (облік клієнтів, система обліку — не месенджер,
// тож повні контактні дані передаються, як і в Google-таблицю).
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import type { Integration, Lead, Result } from "../core/types.js";

export const harvest: Integration = {
  name: "harvest",
  requiredEnv: ["HARVEST_WEBHOOK_URL", "HARVEST_API_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const webhookUrl = readEnv("HARVEST_WEBHOOK_URL");
    if (!webhookUrl.ok) return webhookUrl;
    const token = readEnv("HARVEST_API_TOKEN");
    if (!token.ok) return token;

    const response = await postJson(
      webhookUrl.value,
      {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone ?? "",
        source: lead.source,
        budgetUsd: lead.budgetUsd ?? null,
        createdAt: lead.createdAt,
      },
      { headers: { Authorization: `Bearer ${token.value}` } },
    );
    if (!response.ok) {
      log.error(`harvest: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    log.info(`harvest: lead ${lead.id} delivered`);
    return { ok: true, value: undefined };
  },
};
