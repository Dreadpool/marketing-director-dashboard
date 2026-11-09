"use client";

import {
  MetaAdsFetchSummary,
  isMetaAdsMetrics,
} from "./meta-ads-fetch-summary";
import {
  SeoRankingFetchSummary,
  isSeoRankingMetrics,
} from "./seo-ranking-fetch-summary";
import {
  GoogleAdsFetchSummary,
  isGoogleAdsMetrics,
} from "./google-ads-fetch-summary";

export function FetchStepSummary({ data }: { data: unknown }) {
  if (isGoogleAdsMetrics(data)) return <GoogleAdsFetchSummary data={data} />;
  if (isMetaAdsMetrics(data)) return <MetaAdsFetchSummary data={data} />;
  if (isSeoRankingMetrics(data)) return <SeoRankingFetchSummary data={data} />;
  return null;
}
