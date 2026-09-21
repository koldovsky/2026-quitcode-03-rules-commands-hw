// Створення персони (контакту) в Pipedrive CRM із даними ліда.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

interface PipedrivePersonPayload {
  name: string;
  email: string[];
  phone?: string[];
}

export function buildPersonPayload(lead: Lead): PipedrivePersonPayload {
  const payload: PipedrivePersonPayload = {
    name: lead.name,
    email: [lead.email],
  };
  if (lead.phone) {
    payload.phone = [lead.phone];
  }
  return payload;
}

function isPipedriveSuccess(value: unknown): value is { success: boolean } {
  return isRecord(value) && typeof value.success === "boolean";
}

export const pipedriveCreate: Integration = {
  name: "pipedrive-create",
  requiredEnv: ["PIPEDRIVE_API_TOKEN", "PIPEDRIVE_DOMAIN"],

  async send(lead: Lead): Promise<Result<void>> {
    const tokenResult = readEnv("PIPEDRIVE_API_TOKEN");
    if (!tokenResult.ok) return tokenResult;

    const domainResult = readEnv("PIPEDRIVE_DOMAIN");
    if (!domainResult.ok) return domainResult;

    const url = `https://${domainResult.value}.pipedrive.com/api/v1/persons`;
    const payload = buildPersonPayload(lead);

    const response = await postJson(url, payload, {
      headers: { "x-api-token": tokenResult.value },
    });

    if (!response.ok) {
      log.error(`pipedrive-create: lead ${lead.id} not created: ${response.error}`);
      return response;
    }

    const parsed = parseJson(response.value, isPipedriveSuccess, "pipedrive response");
    if (!parsed.ok) {
      log.error(`pipedrive-create: lead ${lead.id} ${parsed.error}`);
      return parsed;
    }

    if (!parsed.value.success) {
      log.error(`pipedrive-create: lead ${lead.id} API returned success=false`);
      return { ok: false, error: "pipedrive: API returned success=false" };
    }

    log.info(`pipedrive-create: lead ${lead.id} created`);
    return { ok: true, value: undefined };
  },
};
