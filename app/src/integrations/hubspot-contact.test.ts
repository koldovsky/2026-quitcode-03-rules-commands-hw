import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "../core/log.js";
import type { Lead } from "../core/types.js";
import { hubspotContact, toContactProperties } from "./hubspot-contact.js";

const API_URL = "https://api.hubspot.example.test/crm/v3/objects/contacts";
const TOKEN = "pat-na1-0000000000000000";

const lead: Lead = {
  id: "ld_0042",
  name: "Олена Тестова",
  email: "olena@studio-nova.example.test",
  phone: "+380 (00) 000-00-00",
  source: "website",
  budgetUsd: 4000,
  createdAt: "2026-09-10T08:00:00.000Z",
};

function stubFetch(response: () => Response) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => response());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubEnv(): void {
  vi.stubEnv("HUBSPOT_API_URL", API_URL);
  vi.stubEnv("HUBSPOT_TOKEN", TOKEN);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hubspot-contact", () => {
  it("надсилає контакт на URL із конфігу, а токен — заголовком", async () => {
    stubEnv();
    vi.spyOn(log, "info").mockImplementation(() => {});
    const fetchMock = stubFetch(() => new Response(JSON.stringify({ id: "701" }), { status: 200 }));

    const result = await hubspotContact.send(lead);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(API_URL);
    expect(url).not.toContain(TOKEN);
    // Очікуване тіло виписано літералом: звірка з toContactProperties() порівнювала б
    // реалізацію саму з собою і пропустила б помилку в мапінгу полів.
    expect(JSON.parse(String(init?.body))).toEqual({
      properties: {
        email: "olena@studio-nova.example.test",
        firstname: "Олена Тестова",
        lead_source: "website",
        createdate: "2026-09-10T08:00:00.000Z",
        phone: "+380 (00) 000-00-00",
        budget_usd: "4000",
      },
    });
    expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
  });

  it("повертає помилку, якщо не задано HUBSPOT_TOKEN", async () => {
    vi.stubEnv("HUBSPOT_API_URL", API_URL);
    vi.stubEnv("HUBSPOT_TOKEN", "");
    const fetchMock = stubFetch(() => new Response("{}", { status: 200 }));

    await expect(hubspotContact.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable HUBSPOT_TOKEN",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("відхиляє HUBSPOT_API_URL без https", async () => {
    vi.stubEnv("HUBSPOT_API_URL", "http://api.hubspot.example.test/crm/v3/objects/contacts");
    vi.stubEnv("HUBSPOT_TOKEN", TOKEN);
    const fetchMock = stubFetch(() => new Response("{}", { status: 200 }));

    await expect(hubspotContact.send(lead)).resolves.toEqual({
      ok: false,
      error: "hubspot-contact: HUBSPOT_API_URL must use https",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("повертає помилку на відмову HubSpot і не повторює неідемпотентний POST", async () => {
    stubEnv();
    const errorSpy = vi.spyOn(log, "error").mockImplementation(() => {});
    const fetchMock = stubFetch(() => new Response("boom", { status: 500 }));

    const result = await hubspotContact.send(lead);

    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(String(errorSpy.mock.calls[0]?.[0])).not.toContain(TOKEN);
  });

  it("вважає 409 «контакт уже існує» успіхом", async () => {
    stubEnv();
    vi.spyOn(log, "info").mockImplementation(() => {});
    stubFetch(() => new Response('{"category":"CONFLICT"}', { status: 409 }));

    await expect(hubspotContact.send(lead)).resolves.toEqual({ ok: true, value: undefined });
  });

  it("не надсилає порожні поля, яких немає в ліді", () => {
    const minimal: Lead = {
      id: "ld_0043",
      name: "Мінімальний Лід",
      email: "min@studio-nova.example.test",
      source: "referral",
      createdAt: "2026-09-10T09:00:00.000Z",
    };

    expect(toContactProperties(minimal)).toEqual({
      email: "min@studio-nova.example.test",
      firstname: "Мінімальний Лід",
      lead_source: "referral",
      createdate: "2026-09-10T09:00:00.000Z",
    });
  });

  it("не приймає відповідь несподіваної форми", async () => {
    stubEnv();
    vi.spyOn(log, "error").mockImplementation(() => {});
    stubFetch(() => new Response('{"contactId":701}', { status: 200 }));

    await expect(hubspotContact.send(lead)).resolves.toEqual({
      ok: false,
      error: "hubspot-contact: unexpected shape",
    });
  });
});
