import { getBigQueryClient, PROJECT_ID } from "./bigquery-client";

const DATASET = process.env.BIGQUERY_DATASET ?? "tds_sales";

export type SegmentCriteria = {
  trip_count_last_n_days?: { days: number; op: ">=" | "<=" | "="; value: number };
  days_since_last_trip?: { op: ">" | "<" | ">=" | "<="; value: number };
  first_trip_before?: string;
  routes?: { from: string; to: string }[];
  total_spend?: { op: ">=" | "<=" | ">" | "<"; value: number };
  customer_segment?: "churned" | "active" | "first_timer" | "superconsumer";
};

export type SegmentSampleRow = {
  customer_id: string;
  email: string;
  name: string | null;
  trips_lifetime: number;
  total_spend_lifetime: number;
  last_trip_date: string;
  first_trip_date: string;
  top_route: string | null;
};

export type SegmentExploreResult = {
  count: number;
  sample_rows: SegmentSampleRow[];
  revenue_profile: {
    avg_lifetime_spend: number;
    median_lifetime_spend: number;
    distinct_customers: number;
    avg_trips_per_customer: number;
  };
  query_used: string;
};

const OP_MAP: Record<string, string> = {
  ">": ">",
  "<": "<",
  ">=": ">=",
  "<=": "<=",
  "=": "=",
};

function safeOp(op: string): string {
  return OP_MAP[op] ?? "=";
}

/**
 * Build a customer-rollup CTE and apply the supplied criteria as HAVING clauses.
 * SLE company filter and void exclusion are baked in.
 */
function buildExploreQuery(criteria: SegmentCriteria): string {
  const havingClauses: string[] = [];

  if (criteria.trip_count_last_n_days) {
    const op = safeOp(criteria.trip_count_last_n_days.op);
    const days = Math.max(1, Math.floor(criteria.trip_count_last_n_days.days));
    const value = Math.max(0, Math.floor(criteria.trip_count_last_n_days.value));
    havingClauses.push(
      `COUNTIF(DATE(purchase_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)) ${op} ${value}`,
    );
  }
  if (criteria.days_since_last_trip) {
    const op = safeOp(criteria.days_since_last_trip.op);
    const value = Math.max(0, Math.floor(criteria.days_since_last_trip.value));
    havingClauses.push(`DATE_DIFF(CURRENT_DATE(), MAX(DATE(purchase_date)), DAY) ${op} ${value}`);
  }
  if (criteria.first_trip_before) {
    const safeDate = criteria.first_trip_before.replace(/[^0-9-]/g, "");
    havingClauses.push(`MIN(DATE(purchase_date)) < DATE('${safeDate}')`);
  }
  if (criteria.total_spend) {
    const op = safeOp(criteria.total_spend.op);
    const value = Math.max(0, Number(criteria.total_spend.value));
    havingClauses.push(`SUM(COALESCE(total_sale, 0)) ${op} ${value}`);
  }
  if (criteria.customer_segment) {
    switch (criteria.customer_segment) {
      case "churned":
        havingClauses.push(
          "DATE_DIFF(CURRENT_DATE(), MAX(DATE(purchase_date)), DAY) >= 180 AND COUNT(*) >= 5",
        );
        break;
      case "active":
        havingClauses.push(
          "DATE_DIFF(CURRENT_DATE(), MAX(DATE(purchase_date)), DAY) <= 60",
        );
        break;
      case "first_timer":
        havingClauses.push(
          "COUNT(*) = 1 AND DATE_DIFF(CURRENT_DATE(), MAX(DATE(purchase_date)), DAY) <= 90",
        );
        break;
      case "superconsumer":
        havingClauses.push(
          "COUNTIF(DATE(purchase_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY)) >= 30",
        );
        break;
    }
  }

  let routeFilter = "";
  if (criteria.routes && criteria.routes.length > 0) {
    const pairs = criteria.routes
      .map(
        (r) =>
          `(trip_origin_stop = '${r.from.replace(/'/g, "''")}' AND trip_destination_stop = '${r.to.replace(/'/g, "''")}')`,
      )
      .join(" OR ");
    routeFilter = `AND (${pairs})`;
  }

  const havingSql = havingClauses.length > 0 ? `HAVING ${havingClauses.join(" AND ")}` : "";

  return `
    WITH customer_rollup AS (
      SELECT
        purchaser_email AS customer_id,
        ANY_VALUE(purchaser_email) AS email,
        ANY_VALUE(CONCAT(COALESCE(purchaser_first_name, ''), ' ', COALESCE(purchaser_last_name, ''))) AS name,
        COUNT(*) AS trips_lifetime,
        SUM(COALESCE(total_sale, 0)) AS total_spend_lifetime,
        CAST(MAX(DATE(purchase_date)) AS STRING) AS last_trip_date,
        CAST(MIN(DATE(purchase_date)) AS STRING) AS first_trip_date,
        APPROX_TOP_COUNT(CONCAT(COALESCE(trip_origin_stop, '?'), ' → ', COALESCE(trip_destination_stop, '?')), 1)[OFFSET(0)].value AS top_route
      FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
      WHERE selling_company = 'Salt Lake Express'
        AND (activity_type = 'Sale' OR activity_type IS NULL)
        AND order_id NOT IN (
          SELECT DISTINCT order_id
          FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
          WHERE activity_type = 'Void'
        )
        AND purchaser_email IS NOT NULL
        AND purchaser_email != ''
        ${routeFilter}
      GROUP BY purchaser_email
      ${havingSql}
    )
    SELECT
      (SELECT COUNT(*) FROM customer_rollup) AS total_count,
      (SELECT AVG(total_spend_lifetime) FROM customer_rollup) AS avg_spend,
      (SELECT APPROX_QUANTILES(total_spend_lifetime, 100)[OFFSET(50)] FROM customer_rollup) AS median_spend,
      (SELECT AVG(trips_lifetime) FROM customer_rollup) AS avg_trips,
      ARRAY(
        SELECT AS STRUCT customer_id, email, name, trips_lifetime, total_spend_lifetime, last_trip_date, first_trip_date, top_route
        FROM customer_rollup
        ORDER BY RAND()
        LIMIT 5
      ) AS sample_rows
  `;
}

export async function exploreSegment(
  criteria: SegmentCriteria,
): Promise<SegmentExploreResult> {
  const query = buildExploreQuery(criteria);
  const bq = getBigQueryClient();
  const [rows] = await bq.query({ query });
  const r = rows[0] ?? {};
  const sample = (r.sample_rows ?? []) as SegmentSampleRow[];
  const count = Number(r.total_count ?? 0);
  return {
    count,
    sample_rows: sample.map((s) => ({
      customer_id: String(s.customer_id),
      email: String(s.email),
      name: s.name ? String(s.name).trim() || null : null,
      trips_lifetime: Number(s.trips_lifetime),
      total_spend_lifetime: Number(s.total_spend_lifetime),
      last_trip_date: String(s.last_trip_date),
      first_trip_date: String(s.first_trip_date),
      top_route: s.top_route ? String(s.top_route) : null,
    })),
    revenue_profile: {
      avg_lifetime_spend: Number(r.avg_spend ?? 0),
      median_lifetime_spend: Number(r.median_spend ?? 0),
      distinct_customers: count,
      avg_trips_per_customer: Number(r.avg_trips ?? 0),
    },
    query_used: query.trim(),
  };
}

/**
 * Fetch the full segment for sending invites — returns customer email + name + id only.
 */
export type SegmentMember = {
  customer_id: string;
  email: string;
  name: string | null;
  trips_lifetime: number;
  total_spend_lifetime: number;
  last_trip_date: string;
};

export async function fetchSegmentMembers(
  criteria: SegmentCriteria,
): Promise<SegmentMember[]> {
  const baseQuery = buildExploreQuery(criteria);
  // Replace the SELECT shell with a full member list pull.
  const bq = getBigQueryClient();
  const memberQuery = baseQuery.replace(
    /SELECT[\s\S]+?AS sample_rows\s*$/,
    `SELECT customer_id, email, name, trips_lifetime, total_spend_lifetime, last_trip_date FROM customer_rollup ORDER BY RAND()`,
  );
  const [rows] = await bq.query({ query: memberQuery });
  return rows.map((r: Record<string, unknown>) => ({
    customer_id: String(r.customer_id),
    email: String(r.email),
    name: r.name ? String(r.name).trim() || null : null,
    trips_lifetime: Number(r.trips_lifetime),
    total_spend_lifetime: Number(r.total_spend_lifetime),
    last_trip_date: String(r.last_trip_date),
  }));
}
