// Контакт у HubSpot CRM на кожен лід. CRM — система обліку, тому сюди йдуть
// повні дані ліда. Токен передається заголовком, а не в URL: URL потрапляє в журнал.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

interface CreatedContact {
  id: string;
}

const isCreatedContact = (value: unknown): value is CreatedContact =>
  isRecord(value) && isString(value.id);

/** Приймає лише https: по http секрет із заголовка пішов би відкритим текстом. */
function readHttpsUrl(name: string): Result<string> {
  const raw = readEnv(name);
  if (!raw.ok) return raw;

  if (!URL.canParse(raw.value)) {
    return { ok: false, error: `hubspot-contact: ${name} is not a valid URL` };
  }
  if (new URL(raw.value).protocol !== "https:") {
    return { ok: false, error: `hubspot-contact: ${name} must use https` };
  }
  return raw;
}

export function toContactProperties(lead: Lead): Record<string, string> {
  const properties: Record<string, string> = {
    email: lead.email,
    firstname: lead.name,
    lead_source: lead.source,
    createdate: lead.createdAt,
  };
  if (lead.phone !== undefined) properties.phone = lead.phone;
  if (lead.budgetUsd !== undefined) properties.budget_usd = String(lead.budgetUsd);
  return properties;
}

export const hubspotContact: Integration = {
  name: "hubspot-contact",
  requiredEnv: ["HUBSPOT_API_URL", "HUBSPOT_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const apiUrl = readHttpsUrl("HUBSPOT_API_URL");
    if (!apiUrl.ok) return apiUrl;

    const token = readEnv("HUBSPOT_TOKEN");
    if (!token.ok) return token;

    // retries: 0 — створення контакту неідемпотентне, автоповтор дав би дублікат.
    const response = await postJson(
      apiUrl.value,
      { properties: toContactProperties(lead) },
      { headers: { authorization: `Bearer ${token.value}` }, retries: 0 },
    );
    if (!response.ok) {
      // 409 від HubSpot означає «контакт із таким email уже є» — для нас це успіх.
      if (response.error.includes("HTTP 409")) {
        log.info(`hubspot-contact: lead ${lead.id} already exists, nothing to create`);
        return { ok: true, value: undefined };
      }
      log.error(`hubspot-contact: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    const body = parseJson(response.value, isCreatedContact, "hubspot-contact");
    if (!body.ok) {
      log.error(`hubspot-contact: lead ${lead.id} not delivered: ${body.error}`);
      return body;
    }

    log.info(`hubspot-contact: lead ${lead.id} created as contact ${body.value.id}`);
    return { ok: true, value: undefined };
  },
};
