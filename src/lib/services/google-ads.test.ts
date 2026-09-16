import { afterEach, describe, expect, it, vi } from "vitest";
const authOptions = vi.hoisted(() => vi.fn());
vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    constructor(options: unknown) {
      authOptions(options);
    }
    async getClient() {
      return { getAccessToken: async () => ({ token: "test-token" }) };
    }
  },
}));
import { gaqlQuery } from "./google-ads";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("Google Cloud project access", () => {
  it("uses OAuth and manager routing without sending a developer token", async () => {
    vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "obsolete-token");
    vi.stubEnv("GOOGLE_CREDENTIALS_JSON", "");
    const fetch = vi.fn().mockResolvedValue(Response.json({ results: [] }));
    vi.stubGlobal("fetch", fetch);

    await gaqlQuery("SELECT customer.id FROM customer LIMIT 1");

    expect(fetch.mock.calls[0][1].headers).toEqual({
      Authorization: "Bearer test-token",
      "login-customer-id": "4381990003",
      "Content-Type": "application/json",
    });
    expect(authOptions).toHaveBeenCalledWith({
      scopes: ["https://www.googleapis.com/auth/adwords"],
    });
  });

  it("uses the deployment service account when inline credentials are configured", async () => {
    const credentials = {
      client_email: "ads@example.com",
      private_key: "test-key",
    };
    vi.stubEnv("GOOGLE_CREDENTIALS_JSON", JSON.stringify(credentials));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ results: [] })),
    );

    await gaqlQuery("SELECT customer.id FROM customer LIMIT 1");

    expect(authOptions).toHaveBeenCalledWith({
      credentials,
      scopes: ["https://www.googleapis.com/auth/adwords"],
    });
  });
});
describe("Google query completeness", () => {
  it("collects every page using the same query", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ results: [{ id: 1 }], nextPageToken: "page2" }),
      )
      .mockResolvedValueOnce(Response.json({ results: [{ id: 2 }] }));
    vi.stubGlobal("fetch", fetch);
    expect(await gaqlQuery("SELECT campaign.id FROM campaign")).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      query: "SELECT campaign.id FROM campaign",
      pageToken: "page2",
    });
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it("throws rather than returning a partial first page", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ results: [{ id: 1 }], nextPageToken: "p" }),
        )
        .mockResolvedValueOnce(new Response("unavailable", { status: 503 })),
    );
    await expect(gaqlQuery("query")).rejects.toThrow("unavailable");
  });
  it("rejects repeated tokens instead of double-counting or looping", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(async () =>
          Response.json({ results: [], nextPageToken: "p" }),
        ),
    );
    await expect(gaqlQuery("query")).rejects.toThrow("repeated");
  });
});
