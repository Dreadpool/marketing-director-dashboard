import type { GA4TrafficRow, GA4EcommerceRow } from "../sources/ga4";
import type { DateRange } from "../types";
import type {
  NormalizedTraffic,
  NormalizedConversions,
  NormalizedRevenue,
} from "../metrics";
import { createProvenance } from "../utils";

export function normalizeGA4Data(
  trafficRows: GA4TrafficRow[],
  ecommerceRows: GA4EcommerceRow[],
  dateRange: DateRange,
): {
  traffic: NormalizedTraffic;
  conversions: NormalizedConversions;
  revenue: NormalizedRevenue;
} {
  const notes: string[] = [];
  const startDate = new Date(dateRange.start);
  if (startDate < new Date("2025-04-10")) {
    notes.push("GA4 tracking unreliable before April 10, 2025");
  }

  const provenance = createProvenance("ga4", dateRange, {
    attributionWindow: "none",
    notes: notes.length > 0 ? notes : undefined,
  });

  const totalSessions = trafficRows.reduce((sum, r) => sum + r.sessions, 0);
  const totalUsers = trafficRows.reduce((sum, r) => sum + r.totalUsers, 0);
  const totalNewUsers = trafficRows.reduce(
    (sum, r) => sum + (r.newUsers ?? 0),
    0,
  );
  const weightedBounceRate =
    totalSessions > 0
      ? trafficRows.reduce(
          (sum, r) => sum + r.bounceRate * r.sessions,
          0,
        ) / totalSessions
      : 0;
  const weightedDuration =
    totalSessions > 0
      ? trafficRows.reduce(
          (sum, r) => sum + (r.averageSessionDuration ?? 0) * r.sessions,
          0,
        ) / totalSessions
      : 0;

  const channelMap = new Map<
    string,
    { sessions: number; users: number; bounceWeighted: number }
  >();
  for (const r of trafficRows) {
    const channel = r.sessionDefaultChannelGroup ?? "Unknown";
    const existing = channelMap.get(channel) ?? {
      sessions: 0,
      users: 0,
      bounceWeighted: 0,
    };
    existing.sessions += r.sessions;
    existing.users += r.totalUsers;
    existing.bounceWeighted += r.bounceRate * r.sessions;
    channelMap.set(channel, existing);
  }

  const traffic: NormalizedTraffic = {
    sessions: totalSessions,
    totalUsers,
    newUsers: totalNewUsers,
    bounceRate: weightedBounceRate,
    avgSessionDuration: weightedDuration,
    byChannel: Array.from(channelMap.entries()).map(([channel, data]) => ({
      channel,
      sessions: data.sessions,
      users: data.users,
      bounceRate:
        data.sessions > 0 ? data.bounceWeighted / data.sessions : 0,
    })),
    provenance,
  };

  const totalTransactions = ecommerceRows.reduce(
    (sum, r) => sum + r.transactions,
    0,
  );
  const totalRevenue = ecommerceRows.reduce(
    (sum, r) => sum + r.purchaseRevenue,
    0,
  );

  const conversions: NormalizedConversions = {
    source: "ga4",
    count: totalTransactions,
    attributionWindow: "none",
    isGroundTruth: false,
    label: "GA4 Purchase Events",
    provenance,
  };

  const revenue: NormalizedRevenue = {
    source: "ga4",
    amount: totalRevenue,
    attributionWindow: "none",
    isGroundTruth: false,
    provenance,
  };

  return { traffic, conversions, revenue };
}
