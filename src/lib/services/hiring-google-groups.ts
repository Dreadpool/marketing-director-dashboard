/** Google reporting identity is the ad group, independent of its mutable name and targets. */
export type HiringGoogleGroup = {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  currentState:
    | "Enabled"
    | "Ad group paused"
    | "Campaign paused"
    | "Removed"
    | "Unknown";
  locationInterests: string[];
  campaignTargets: string[];
  presence: string;
  deliveryStatus: string;
  coverageCheck: string;
  issues: string[];
};

type Row = Record<string, unknown>;
const record = (value: unknown): Row => (value ?? {}) as Row;
const num = (value: unknown) => {
  // Google omits zero-valued proto fields. Malformed data must not become zero.
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0)
    throw new Error("Invalid Google Ads metric");
  return n;
};
const genericName = /^(?:[A-Z]{2}|all|general|drivers?|cdl driver jobs)$/i;
const nonDriver =
  /mechanic|technician|dispatcher|customer service|payroll|reservations?/i;
// Report-owned campaign scope survives a campaign pause; cities are discovered, not configured.
export const trackedHiringCampaigns = ["23506774948", "24043574614"];
export const knownHiringGroups = [
  "195277974653",
  "195319893794",
  "197915916605",
  "199165553660",
  "199165553700",
];
const retiredCampaigns = new Set([
  "974434774",
  "16149093318",
  "23506629547",
  "23980073724",
]);
export const isHiringCampaign = (campaign: Row) =>
  trackedHiringCampaigns.includes(String(campaign.id)) ||
  /\bhiring\b/i.test(String(campaign.name));
const pretty = (value: unknown) =>
  String(value ?? "UNKNOWN")
    .toLowerCase()
    .replace(/_/g, " ");
// Approved by Brady September 7, 2026. Identity and coordinates, never a name match.
const approvedShops: Record<
  string,
  { campaignId: string; latitude: number; longitude: number; address: string }
> = {
  "197915916605": {
    campaignId: "23506774948",
    latitude: 40753466,
    longitude: -111963574,
    address: "700 Fulton St, Salt Lake City, UT 84104",
  },
  "199165553660": {
    campaignId: "24043574614",
    latitude: 47612414,
    longitude: -117507099,
    address: "4611 S Ben Franklin Ln, Spokane, WA 99224",
  },
};

export function googleMetrics(row: Row) {
  const m = record(row.metrics);
  return {
    costMicros: num(m.costMicros ?? m.cost_micros),
    impressions: num(m.impressions),
    clicks: num(m.clicks),
  };
}

/** Campaign totals independently catch omitted groups and duplicated metric rows. */
export function reconcileGoogleMetrics(performance: Row[], campaigns: Row[]) {
  const seen = new Set<string>();
  for (const row of performance) {
    const key = `${record(row.campaign).id}:${record(row.adGroup ?? row.ad_group).id}`;
    if (seen.has(key))
      throw new Error(`Duplicate Google ad-group metrics: ${key}`);
    seen.add(key);
  }
  const ids = new Set(
    [...performance, ...campaigns].map((r) => String(record(r.campaign).id)),
  );
  for (const id of ids) {
    const totals = (rows: Row[]) =>
      rows
        .filter((r) => String(record(r.campaign).id) === id)
        .reduce<ReturnType<typeof googleMetrics>>(
          (sum, row) => {
            const m = googleMetrics(row);
            return {
              costMicros: sum.costMicros + m.costMicros,
              impressions: sum.impressions + m.impressions,
              clicks: sum.clicks + m.clicks,
            };
          },
          { costMicros: 0, impressions: 0, clicks: 0 },
        );
    const groups = totals(performance);
    const campaign = totals(campaigns);
    if (
      Math.abs(groups.costMicros - campaign.costMicros) > 1 ||
      groups.clicks !== campaign.clicks ||
      groups.impressions !== campaign.impressions
    )
      throw new Error(
        `Google campaign ${id} totals do not reconcile with ad groups`,
      );
  }
}

export function buildHiringGoogleGroups(
  inventory: Row[],
  performance: Row[],
  criteria: Row[],
  campaignCriteria: Row[],
  locations: Row[],
) {
  const geo = new Map(
    locations.map((row) => {
      const g = record(row.geoTargetConstant ?? row.geo_target_constant);
      return [String(g.resourceName ?? g.resource_name), g];
    }),
  );
  const groupKey = (row: Row) => {
    const campaign = record(row.campaign);
    const group = record(row.adGroup ?? row.ad_group);
    return `${campaign.id}:${group.id}`;
  };
  const metrics = new Map(
    performance.map((row) => [groupKey(row), record(row.metrics)]),
  );
  // Keep groups removed during the period if Google still reports their spend.
  const groups = new Map(
    [...performance, ...inventory].map((row) => [groupKey(row), row]),
  );
  return [...groups]
    .flatMap(([key, row]) => {
      const campaign = record(row.campaign);
      const group = record(row.adGroup ?? row.ad_group);
      const name = String(group.name ?? "Unnamed ad group");
      if (!isHiringCampaign(campaign) || nonDriver.test(name)) return [];
      if (!campaign.id || !group.id)
        throw new Error("Google inventory is missing an entity ID");
      const m = metrics.get(key) ?? {};
      const spend = num(m.costMicros ?? m.cost_micros) / 1_000_000;
      const impressions = num(m.impressions);
      const clicks = num(m.clicks);
      const delivered = spend > 0 || impressions > 0 || clicks > 0;
      const campaignEnabled = campaign.status === "ENABLED";
      const groupEnabled = group.status === "ENABLED";
      // Named groups in tracked or newly enabled hiring campaigns form the current roster.
      // Historical delivery always stays visible, including generic or paused groups.
      if (
        !delivered &&
        !knownHiringGroups.includes(String(group.id)) &&
        ((!campaignEnabled && retiredCampaigns.has(String(campaign.id))) ||
          campaign.status === "REMOVED" ||
          group.status === "REMOVED" ||
          (genericName.test(name) && !groupEnabled))
      )
        return [];
      const local = criteria
        .filter((r) => groupKey(r) === key)
        .map((r) => record(r.adGroupCriterion ?? r.ad_group_criterion))
        .filter((c) => c.status !== "REMOVED");
      const parent = campaignCriteria
        .filter((r) => String(record(r.campaign).id) === String(campaign.id))
        .map((r) => record(r.campaignCriterion ?? r.campaign_criterion))
        .filter((c) => c.status !== "REMOVED");
      const reference = (criterion: Row) =>
        String(
          record(criterion.location).geoTargetConstant ??
            record(criterion.location).geo_target_constant ??
            "",
        );
      const positives = parent.filter(
        (c) => !c.negative && (!c.status || c.status === "ENABLED"),
      );
      const describe = (c: Row) => {
        if (c.proximity) {
          const p = record(c.proximity);
          const a = record(p.address);
          const point = record(p.geoPoint ?? p.geo_point);
          const address = [
            a.streetAddress ?? a.street_address,
            a.cityName ?? a.city_name,
            a.provinceCode ?? a.province_code,
            a.postalCode ?? a.postal_code,
          ]
            .filter(Boolean)
            .join(", ");
          const center =
            address ||
            `${Number(point.latitudeInMicroDegrees ?? point.latitude_in_micro_degrees) / 1e6}, ${Number(point.longitudeInMicroDegrees ?? point.longitude_in_micro_degrees) / 1e6}`;
          const unit = p.radiusUnits ?? p.radius_units;
          return `${c.negative ? "Excluded: " : ""}${p.radius} ${unit === "MILES" ? "mi" : unit === "KILOMETERS" ? "km" : "unknown units"} around ${center}`;
        }
        const target = geo.get(reference(c));
        const type = String(
          target?.targetType ?? target?.target_type ?? "Unknown type",
        );
        const label = target
          ? `${target.canonicalName ?? target.canonical_name ?? target.name} (${type === "DMA Region" ? "DMA region" : type.toLowerCase()})`
          : `Unresolved location ${reference(c)}`;
        return `${c.negative ? "Excluded: " : ""}${label}${c.status && c.status !== "ENABLED" ? ` [${c.status}]` : ""}`;
      };
      const issues: string[] = [];
      if (
        [...local, ...parent].some(
          (c) => !c.proximity && !geo.has(reference(c)),
        )
      )
        issues.push("A location could not be resolved; coverage needs review.");
      if (!positives.length)
        issues.push(
          "No positive campaign locations: Google may target all countries and territories.",
        );
      const geoSetting = record(
        campaign.geoTargetTypeSetting ?? campaign.geo_target_type_setting,
      );
      const geoType =
        geoSetting.positiveGeoTargetType ?? geoSetting.positive_geo_target_type;
      const presence =
        geoType === "PRESENCE"
          ? "Presence: people in or regularly in the campaign area"
          : geoType === "PRESENCE_OR_INTEREST"
            ? "Presence or interest: people outside the campaign area may qualify"
            : "Location matching unavailable";
      if (geoType !== "PRESENCE")
        issues.push("Campaign is not confirmed as Presence-only.");
      const currentState: HiringGoogleGroup["currentState"] =
        campaign.status === "REMOVED" || group.status === "REMOVED"
          ? "Removed"
          : campaign.status === "PAUSED"
            ? "Campaign paused"
            : group.status === "PAUSED"
              ? "Ad group paused"
              : campaignEnabled && groupEnabled
                ? "Enabled"
                : "Unknown";
      if (currentState === "Unknown")
        issues.push("Campaign or ad-group switch status is unknown.");
      if (
        currentState === "Removed" &&
        knownHiringGroups.includes(String(group.id))
      )
        issues.push(
          "A known hiring ad group or its campaign has been removed.",
        );
      const shop = approvedShops[String(group.id)];
      let coverageCheck =
        "No approved shop coverage rule. Campaign settings apply to this group.";
      if (shop) {
        const p = record(positives[0]?.proximity);
        const point = record(p.geoPoint ?? p.geo_point);
        const matched =
          String(campaign.id) === shop.campaignId &&
          positives.length === 1 &&
          Number(p.radius) === 50 &&
          (p.radiusUnits ?? p.radius_units) === "MILES" &&
          Math.abs(
            Number(
              point.latitudeInMicroDegrees ?? point.latitude_in_micro_degrees,
            ) - shop.latitude,
          ) <= 10 &&
          Math.abs(
            Number(
              point.longitudeInMicroDegrees ?? point.longitude_in_micro_degrees,
            ) - shop.longitude,
          ) <= 10 &&
          !parent.some((c) => c.negative) &&
          geoType === "PRESENCE";
        coverageCheck = matched
          ? "Matches approved 50-mile shop circle and Presence setting."
          : `Does not match approved 50 mi around ${shop.address}, Presence-only, with no additional targets or exclusions.`;
        if (!matched) issues.push(coverageCheck);
      } else if (campaignEnabled && groupEnabled)
        issues.push(
          "On without an approved shop coverage rule. Check campaign coverage before treating this as a separate hiring area.",
        );
      const primary = group.primaryStatus ?? group.primary_status;
      const campaignPrimary = campaign.primaryStatus ?? campaign.primary_status;
      const reasons = (group.primaryStatusReasons ??
        group.primary_status_reasons ??
        []) as unknown[];
      const deliveryStatus = `Ad group: ${pretty(primary)}; campaign: ${pretty(campaignPrimary)}${reasons.length ? ` (${reasons.map(pretty).join(", ")})` : ""}`;
      if (
        currentState === "Enabled" &&
        (primary === "NOT_ELIGIBLE" ||
          campaignPrimary === "NOT_ELIGIBLE" ||
          campaignPrimary === "ENDED" ||
          campaignPrimary === "PENDING")
      )
        issues.push(`Switches are on, but Google reports ${deliveryStatus}.`);
      const google: HiringGoogleGroup = {
        campaignId: String(campaign.id),
        campaignName: String(campaign.name),
        adGroupId: String(group.id),
        adGroupName: name,
        currentState,
        locationInterests: local.map(describe),
        campaignTargets: parent.map(describe),
        presence,
        deliveryStatus,
        coverageCheck,
        issues,
      };
      return [
        {
          platform: "Google Ads" as const,
          market: name,
          name: `${campaign.name} / ${name}`,
          entityStatus: `campaign=${campaign.status}; ad_group=${group.status}`,
          eligible: campaignEnabled && groupEnabled,
          spend,
          impressions,
          clicks,
          destinationUrl: null,
          sourceId: `campaign:${campaign.id}/ad-group:${group.id}`,
          notes: [
            `Ad-group location interests (not physical boundaries): ${google.locationInterests.join("; ") || "None"}.`,
            `Campaign coverage: ${google.campaignTargets.join("; ") || "No positive locations"}.`,
            presence,
            deliveryStatus,
            coverageCheck,
            ...issues,
          ],
          google,
        },
      ];
    })
    .sort(
      (a, b) =>
        a.market.localeCompare(b.market) ||
        a.sourceId.localeCompare(b.sourceId),
    );
}
