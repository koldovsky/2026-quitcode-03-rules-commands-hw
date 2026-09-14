import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../core/types.js";
import { hubspotContact } from "./hubspot-contact.js";

const lead: Lead = {
  id: "ld_0003",
  name: "Марія Приклад",
  email: "maria@studio-nova.example.test",
  phone: "+380 (00) 111-11-11",
  source: "referral",
  createdAt: "2026-09-10T10:15:00.000Z",
};

beforeEach(() => {
  vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "fake-hubspot-token-0000");
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hubspot-contact", () => {
  it("створює контакт і повертає ok", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"id":"51999281444"}', { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(hubspotContact.send(lead)).resolves.toEqual({ ok: true, value: undefined });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts");
    expect(init?.headers).toMatchObject({ authorization: "Bearer fake-hubspot-token-0000" });
    expect(JSON.parse(String(init?.body))).toEqual({
      properties: {
        email: "maria@studio-nova.example.test",
        firstname: "Марія Приклад",
        phone: "+380 (00) 111-11-11",
        lead_source: "referral",
      },
    });
  });

  it("повертає помилку, якщо не задано HUBSPOT_ACCESS_TOKEN", async () => {
    vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "");
    await expect(hubspotContact.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable HUBSPOT_ACCESS_TOKEN",
    });
  });

  it("повертає помилку, якщо HubSpot відхилив запит", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response('{"status":"error","message":"Property values were not valid"}', { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(hubspotContact.send(lead)).resolves.toEqual({
      ok: false,
      error: "POST https://api.hubapi.com/crm/v3/objects/contacts failed: HTTP 400",
    });
  });

  it("вважає 409 (контакт уже існує) успішною доставкою", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"status":"error","category":"CONFLICT"}', { status: 409 })),
    );

    await expect(hubspotContact.send(lead)).resolves.toEqual({ ok: true, value: undefined });
  });
});
