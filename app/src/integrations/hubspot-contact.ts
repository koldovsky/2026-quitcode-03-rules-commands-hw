// Створення контакту в HubSpot CRM за новим лідом.
// CRM — система обліку, тому сюди йдуть повні дані ліда, включно з email і
// телефоном (на відміну від сповіщень у Slack).
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

/** Відповідь HubSpot на створення контакту: цікавить лише id створеного об'єкта. */
interface HubspotContactResponse {
  id: string;
}

const isHubspotContactResponse = (value: unknown): value is HubspotContactResponse =>
  isRecord(value) && isString(value.id);

/** Поля контакту HubSpot. Назви кастомних властивостей залежать від порталу клієнта. */
export function buildContactProperties(lead: Lead): Record<string, string | number> {
  const properties: Record<string, string | number> = {
    email: lead.email,
    firstname: lead.name,
    lead_source: lead.source,
    external_lead_id: lead.id,
  };
  if (lead.phone !== undefined) properties.phone = lead.phone;
  if (lead.budgetUsd !== undefined) properties.budget_usd = lead.budgetUsd;
  return properties;
}

export const hubspotContact: Integration = {
  name: "hubspot-contact",
  requiredEnv: ["HUBSPOT_API_URL", "HUBSPOT_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const apiUrl = readEnv("HUBSPOT_API_URL");
    if (!apiUrl.ok) return apiUrl;

    const token = readEnv("HUBSPOT_TOKEN");
    if (!token.ok) return token;

    const response = await postJson(
      apiUrl.value,
      { properties: buildContactProperties(lead) },
      { headers: { authorization: `Bearer ${token.value}` } },
    );
    if (!response.ok) {
      log.error(`hubspot-contact: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    const parsed = parseJson(response.value, isHubspotContactResponse, "hubspot-contact");
    if (!parsed.ok) {
      log.error(`hubspot-contact: lead ${lead.id} not delivered: ${parsed.error}`);
      return parsed;
    }

    log.info(`hubspot-contact: lead ${lead.id} created as contact ${parsed.value.id}`);
    return { ok: true, value: undefined };
  },
};

export default hubspotContact;
