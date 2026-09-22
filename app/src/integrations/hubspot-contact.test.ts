import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../core/types.js";
import { buildContactProperties, hubspotContact } from "./hubspot-contact.js";

const lead: Lead = {
  id: "ld_0003",
  name: "Марія Тестова",
  email: "mariia@studio-nova.example.test",
  phone: "+380 (00) 000-00-00",
  source: "referral",
  budgetUsd: 12000,
  createdAt: "2026-09-10T10:15:00.000Z",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hubspot-contact", () => {
  it("створює контакт: перевіряємо URL, заголовок і тіло запиту", async () => {
    vi.stubEnv("HUBSPOT_API_URL", "https://api.hubspot.example.test/crm/v3/objects/contacts");
    vi.stubEnv("HUBSPOT_TOKEN", "fake-hubspot-token-0000");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"id":"301"}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(hubspotContact.send(lead)).resolves.toEqual({ ok: true, value: undefined });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.hubspot.example.test/crm/v3/objects/contacts");
    expect(JSON.parse(String(init?.body))).toEqual({
      properties: {
        email: "mariia@studio-nova.example.test",
        firstname: "Марія Тестова",
        lead_source: "referral",
        external_lead_id: "ld_0003",
        phone: "+380 (00) 000-00-00",
        budget_usd: 12000,
      },
    });
  });

  it("повертає помилку, якщо не задано HUBSPOT_TOKEN", async () => {
    vi.stubEnv("HUBSPOT_API_URL", "https://api.hubspot.example.test/crm/v3/objects/contacts");
    vi.stubEnv("HUBSPOT_TOKEN", "");

    await expect(hubspotContact.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable HUBSPOT_TOKEN",
    });
  });

  it("повертає помилку, якщо HubSpot відповів кодом помилки", async () => {
    vi.stubEnv("HUBSPOT_API_URL", "https://api.hubspot.example.test/crm/v3/objects/contacts");
    vi.stubEnv("HUBSPOT_TOKEN", "fake-hubspot-token-0000");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"message":"invalid token"}', { status: 401 })),
    );

    const result = await hubspotContact.send(lead);

    expect(result).toEqual({
      ok: false,
      error: "POST https://api.hubspot.example.test/crm/v3/objects/contacts failed: HTTP 401",
    });
  });

  it("не додає phone і budget_usd, якщо їх немає в ліді", () => {
    const minimal: Lead = {
      id: "ld_0004",
      name: "Без Телефона",
      email: "no-phone@studio-nova.example.test",
      source: "website",
      createdAt: "2026-09-10T11:00:00.000Z",
    };

    expect(buildContactProperties(minimal)).toEqual({
      email: "no-phone@studio-nova.example.test",
      firstname: "Без Телефона",
      lead_source: "website",
      external_lead_id: "ld_0004",
    });
  });
});
