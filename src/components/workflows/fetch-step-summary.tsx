"use client";

import {
  MetaAdsFetchSummary,
  isMetaAdsMetrics,
} from "./meta-ads-fetch-summary";
import {
  PromoCodeFetchSummary,
  isPromoCodeMetrics,
} from "./promo-code-fetch-summary";
import {
  SeoRankingFetchSummary,
  isSeoRankingMetrics,
} from "./seo-ranking-fetch-summary";
import {
  GoogleAdsFetchSummary,
  isGoogleAdsMetrics,
} from "./google-ads-fetch-summary";

import type { MonthlyMarketing } from "@/lib/workflows/executors/fetch-monthly-analytics";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const number = new Intl.NumberFormat("en-US");

export function FetchStepSummary({ data }: { data: unknown }) {
  if (isPromoCodeMetrics(data)) return <PromoCodeFetchSummary data={data} />;
  if (isGoogleAdsMetrics(data)) return <GoogleAdsFetchSummary data={data} />;
  if (isMetaAdsMetrics(data)) return <MetaAdsFetchSummary data={data} />;
  if (isSeoRankingMetrics(data)) return <SeoRankingFetchSummary data={data} />;
  if (
    !data ||
    typeof data !== "object" ||
    !("kind" in data) ||
    data.kind !== "monthly-marketing"
  )
    return null;

  const { current, priorYear } = data as MonthlyMarketing;
  const metrics = [
    ["Bookings", "orders", number],
    ["Purchasing emails", "purchasers", number],
    ["First-time purchasers", "newPurchasers", number],
    ["Returning purchasers", "returningPurchasers", number],
    ["Ad spend", "adSpend", currency],
    ["Spend per first-time purchaser", "costPerNewPurchaser", currency],
  ] as const;

  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr>
          <th scope="col" className="py-2 text-left">
            Metric
          </th>
          <th scope="col" className="text-right">
            Selected month
          </th>
          <th scope="col" className="text-right">
            Same month last year
          </th>
        </tr>
      </thead>
      <tbody>
        {metrics.map(([label, key, format]) => (
          <tr key={key} className="border-t">
            <th scope="row" className="py-2 text-left font-normal">
              {label}
            </th>
            {[current, priorYear].map((month, i) => (
              <td key={i} className="text-right">
                {month?.[key] == null
                  ? "Unavailable"
                  : format.format(month[key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
