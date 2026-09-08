import { afterEach, describe, expect, it, vi } from "vitest";
import { __metaAdsTest } from "@/lib/services/meta-ads";

describe("Meta Ads request retries", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries a network timeout and returns the successful response", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const request = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }))
      .mockResolvedValueOnce("ok");

    const result = __metaAdsTest.withRetry(request, "test request", 1);
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe("ok");
    expect(request).toHaveBeenCalledTimes(2);
  });
});
