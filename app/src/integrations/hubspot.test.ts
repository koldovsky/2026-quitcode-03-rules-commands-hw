import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../core/types.js";
import { hubspot, toHubspotProperties } from "./hubspot.js";

const lead: Lead = {
  id: "ld_0003",
  name: "Тарас Тестовий",
  email: "taras@studio-nova.example.test",
  phone: "+380 (00) 000-00-01",
  source: "referral",
  budgetUsd: 2500,
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

describe("hubspot", () => {
  it("формує властивості контакту з email і телефоном", () => {
    expect(toHubspotProperties(lead)).toEqual({
      email: lead.email,
      firstname: lead.name,
      phone: lead.phone,
      lifecyclestage: "lead",
    });
  });

  it("повертає помилку, якщо не задано HUBSPOT_ACCESS_TOKEN", async () => {
    vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "");
    await expect(hubspot.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable HUBSPOT_ACCESS_TOKEN",
    });
  });

  it("апсертить контакт у HubSpot через batch/upsert і повертає ok", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"results":[{"id":"contact_001","new":true}]}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(hubspot.send(lead)).resolves.toEqual({ ok: true, value: undefined });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert");
    expect(init?.headers).toMatchObject({ authorization: "Bearer fake-hubspot-token-0000" });
    expect(JSON.parse(String(init?.body))).toEqual({
      inputs: [{ idProperty: "email", id: lead.email, properties: toHubspotProperties(lead) }],
    });
  });

  it("повторна відправка того самого email лишається ідемпотентною — той самий idProperty/id, без дублів", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"results":[{"id":"contact_001","new":false}]}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await hubspot.send(lead);
    await hubspot.send(lead); // симулює повтор після втраченої відповіді (ретрай postJson)

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      const [url, init] = call;
      expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert");
      const body = JSON.parse(String(init?.body));
      expect(body.inputs[0].idProperty).toBe("email");
      expect(body.inputs[0].id).toBe(lead.email);
    }
  });

  it("повертає помилку, якщо HubSpot відповів помилкою", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"status":"error","message":"invalid email"}', { status: 400 })),
    );

    await expect(hubspot.send(lead)).resolves.toEqual({
      ok: false,
      error: "POST https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert failed: HTTP 400",
    });
  });
});
