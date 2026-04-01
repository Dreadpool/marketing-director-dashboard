import type { MonthPeriod } from "@/lib/schemas/types";

/**
 * Promo Code Analysis executor.
 * Expects params.promoCode (string) and optional params.campaignCost (number).
 * Full BigQuery implementation is Task 4.
 */
export async function fetchPromoCode(
  _period: MonthPeriod,
  params?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const promoCode = params?.promoCode as string | undefined;

  if (!promoCode) {
    throw new Error("promoCode is required in params");
  }

  // Placeholder — Task 4 will replace this with real BigQuery queries
  return {
    promoCode,
    campaignCost: params?.campaignCost ?? null,
    metadata: {
      note: "Executor not yet implemented. Task 4 will add BigQuery queries.",
    },
  };
}
