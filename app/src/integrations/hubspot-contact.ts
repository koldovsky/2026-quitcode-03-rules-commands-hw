// Створює контакт у HubSpot CRM для кожного нового ліда.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson, type Guard } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

const HUBSPOT_CONTACTS_URL = "https://api.hubapi.com/crm/v3/objects/contacts";

interface HubspotContactResponse {
  id: string;
}

const isHubspotContactResponse: Guard<HubspotContactResponse> = (value): value is HubspotContactResponse =>
  isRecord(value) && isString(value.id);

export const hubspotContact: Integration = {
  name: "hubspot-contact",
  requiredEnv: ["HUBSPOT_ACCESS_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const accessToken = readEnv("HUBSPOT_ACCESS_TOKEN");
    if (!accessToken.ok) return accessToken;

    const response = await postJson(
      HUBSPOT_CONTACTS_URL,
      {
        properties: {
          email: lead.email,
          firstname: lead.name,
          phone: lead.phone ?? "",
          lead_source: lead.source,
        },
      },
      { headers: { authorization: `Bearer ${accessToken.value}` } },
    );
    if (!response.ok) {
      // 409 — контакт із таким email уже є: напр. повтор після втраченої відповіді або
      // повторна розсилка ліда. Мета доставки досягнута, тож це не помилка.
      if (response.error.endsWith("HTTP 409")) {
        log.info(`hubspot-contact: contact for lead ${lead.id} already exists`);
        return { ok: true, value: undefined };
      }
      log.error(`hubspot-contact: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    const parsed = parseJson(response.value, isHubspotContactResponse, "hubspot-contact");
    if (!parsed.ok) {
      log.error(`hubspot-contact: lead ${lead.id} not delivered: ${parsed.error}`);
      return parsed;
    }

    log.info(`hubspot-contact: contact ${parsed.value.id} created for lead ${lead.id}`);
    return { ok: true, value: undefined };
  },
};
