import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../core/types.js";
import { buildPersonPayload, pipedriveCreate } from "./pipedrive-create.js";

const lead: Lead = {
  id: "ld_0002",
  name: "Тарас Тестовий",
  email: "taras@studio-nova.example.test",
  phone: "+380 (99) 123-45-67",
  source: "website",
  budgetUsd: 5000,
  createdAt: "2026-09-12T10:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("pipedrive-create", () => {
  it("будує payload з усіма полями ліда для CRM", () => {
    const payload = buildPersonPayload(lead);
    expect(payload.name).toBe("Тарас Тестовий");
    expect(payload.email).toEqual(["taras@studio-nova.example.test"]);
    expect(payload.phone).toEqual(["+380 (99) 123-45-67"]);
  });

  it("повертає помилку, якщо не задано PIPEDRIVE_API_TOKEN", async () => {
    vi.stubEnv("PIPEDRIVE_API_TOKEN", "");
    vi.stubEnv("PIPEDRIVE_DOMAIN", "test-company");

    await expect(pipedriveCreate.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable PIPEDRIVE_API_TOKEN",
    });
  });

  it("повертає помилку, якщо не задано PIPEDRIVE_DOMAIN", async () => {
    vi.stubEnv("PIPEDRIVE_API_TOKEN", "fake-token-12345");
    vi.stubEnv("PIPEDRIVE_DOMAIN", "");

    await expect(pipedriveCreate.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable PIPEDRIVE_DOMAIN",
    });
  });

  it("надсилає дані ліда в Pipedrive API з Bearer token у заголовку", async () => {
    vi.stubEnv("PIPEDRIVE_API_TOKEN", "fake-token-12345");
    vi.stubEnv("PIPEDRIVE_DOMAIN", "test-company");
    vi.spyOn(console, "log").mockImplementation(() => {});

    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ success: true, data: { id: 123 } }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await pipedriveCreate.send(lead);

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://test-company.pipedrive.com/api/v1/persons");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer fake-token-12345" });

    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      name: "Тарас Тестовий",
      email: ["taras@studio-nova.example.test"],
      phone: ["+380 (99) 123-45-67"],
    });
  });

  it("повертає помилку, якщо Pipedrive API відповідає помилкою", async () => {
    vi.stubEnv("PIPEDRIVE_API_TOKEN", "fake-token-12345");
    vi.stubEnv("PIPEDRIVE_DOMAIN", "test-company");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const fetchMock = vi.fn(async () => new Response("Internal Server Error", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await pipedriveCreate.send(lead);

    expect(result.ok).toBe(false);
    expect(result).toHaveProperty("error");
  });

  it("повертає помилку, якщо Pipedrive API повертає success=false", async () => {
    vi.stubEnv("PIPEDRIVE_API_TOKEN", "fake-token-12345");
    vi.stubEnv("PIPEDRIVE_DOMAIN", "test-company");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: false, error: "Invalid data" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await pipedriveCreate.send(lead);

    expect(result.ok).toBe(false);
    expect(result).toHaveProperty("error", "pipedrive: API returned success=false");
  });
});
