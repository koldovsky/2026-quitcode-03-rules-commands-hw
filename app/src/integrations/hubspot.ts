// Синхронізація ліда з контактом у HubSpot CRM.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

// batch/upsert, а не plain create: postJson повторює 5xx/429/мережеві збої,
// а create-запит із тим самим email при повторі повертає конфлікт, а не
// оновлення — upsert з idProperty=email ідемпотентний і робить повтори безпечними.
const HUBSPOT_CONTACTS_UPSERT_URL = "https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert";

export function toHubspotProperties(lead: Lead): Record<string, string> {
  const properties: Record<string, string> = {
    email: lead.email,
    firstname: lead.name,
    lifecyclestage: "lead",
  };
  if (lead.phone !== undefined) properties.phone = lead.phone;
  return properties;
}

interface HubspotUpsertResult {
  id: string;
}

const isHubspotUpsertResult = (value: unknown): value is HubspotUpsertResult => isRecord(value) && isString(value.id);

const isHubspotUpsertResponse = (value: unknown): value is { results: readonly HubspotUpsertResult[] } =>
  isRecord(value) && Array.isArray(value.results) && value.results.length > 0 && value.results.every(isHubspotUpsertResult);

export const hubspot: Integration = {
  name: "hubspot",
  requiredEnv: ["HUBSPOT_ACCESS_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const token = readEnv("HUBSPOT_ACCESS_TOKEN");
    if (!token.ok) return token;

    const response = await postJson(
      HUBSPOT_CONTACTS_UPSERT_URL,
      { inputs: [{ idProperty: "email", id: lead.email, properties: toHubspotProperties(lead) }] },
      { headers: { authorization: `Bearer ${token.value}` } },
    );
    if (!response.ok) {
      log.error(`hubspot: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    const parsed = parseJson(response.value, isHubspotUpsertResponse, "hubspot");
    if (!parsed.ok) {
      log.error(`hubspot: lead ${lead.id} not delivered: ${parsed.error}`);
      return parsed;
    }

    log.info(`hubspot: contact ${parsed.value.results[0].id} upserted for lead ${lead.id}`);
    return { ok: true, value: undefined };
  },
};
