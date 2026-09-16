import { afterEach, describe, expect, it, vi } from "vitest";

const googleConnection = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/google-ads", () => ({
  testConnection: googleConnection,
}));
vi.mock("@/lib/services/bigquery", () => ({
  testConnection: async () => ({ ok: true, latencyMs: 1 }),
}));
vi.mock("@/lib/services/meta-ads", () => ({
  testConnection: async () => ({ ok: true, latencyMs: 1 }),
}));
vi.mock("@/lib/services/bigquery-adspend", () => ({
  testAdSpendConnection: async () => ({ ok: true }),
}));

import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("Google Ads connection status", () => {
  it.each(["GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CREDENTIALS_JSON"])(
    "checks %s without a developer token",
    async (credentialName) => {
      vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "");
      vi.stubEnv("GOOGLE_APPLICATION_CREDENTIALS", "");
      vi.stubEnv("GOOGLE_CREDENTIALS_JSON", "");
      vi.stubEnv(credentialName, "configured");
      googleConnection.mockResolvedValue({ ok: true, latencyMs: 3 });

      const body = await (await GET()).json();

      expect(googleConnection).toHaveBeenCalledOnce();
      expect(
        body.sources.find(
          (source: { name: string }) => source.name === "Google Ads",
        ).status,
      ).toBe("connected");
    },
  );

  it("reports an authentication failure instead of claiming the connection is missing", async () => {
    vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "");
    vi.stubEnv("GOOGLE_APPLICATION_CREDENTIALS", "/configured/key.json");
    googleConnection.mockResolvedValue({
      ok: false,
      latencyMs: 3,
      error: "Access denied",
    });

    const body = await (await GET()).json();
    const google = body.sources.find(
      (source: { name: string }) => source.name === "Google Ads",
    );

    expect(google.status).toBe("error");
    expect(google.error).toBe("Access denied");
  });
});
