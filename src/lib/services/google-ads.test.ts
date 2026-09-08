import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    async getClient() {
      return { getAccessToken: async () => ({ token: "test-token" }) };
    }
  },
}));
import { gaqlQuery } from "./google-ads";
afterEach(() => vi.unstubAllGlobals());
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
