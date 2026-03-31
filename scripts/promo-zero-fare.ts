import { BigQuery } from "@google-cloud/bigquery";

const PROJECT_ID = process.env.BIGQUERY_PROJECT_ID ?? "jovial-root-443516-a7";
const DATASET = process.env.BIGQUERY_DATASET ?? "tds_sales";
const bq = new BigQuery({ projectId: PROJECT_ID });

async function query1_zeroFareOrders() {
  const sql = `
    SELECT
      order_id,
      CAST(purchase_date AS STRING) AS purchase_date,
      purchaser_first_name,
      purchaser_last_name,
      LOWER(TRIM(purchaser_email)) AS purchaser_email,
      promotion_code,
      COALESCE(total_sale, 0) AS total_sale,
      COALESCE(fares, 0) AS fares,
      COALESCE(amount_discounted, 0) AS amount_discounted,
      trip_origin_stop,
      trip_destination_stop,
      num_passengers,
      selling_agency,
      selling_agent,
      CAST(depart_date AS STRING) AS depart_date
    FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
    WHERE selling_company = 'Salt Lake Express'
      AND (activity_type IS NULL OR activity_type = 'Sale')
      AND COALESCE(total_sale, 0) = 0
      AND promotion_code IS NOT NULL
      AND DATE(purchase_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    ORDER BY purchase_date DESC
  `;
  const [rows] = await bq.query({ query: sql });
  return rows;
}

async function query2_repeatAbusers() {
  const sql = `
    SELECT
      LOWER(TRIM(purchaser_email)) AS email,
      purchaser_first_name,
      purchaser_last_name,
      COUNT(*) AS zero_fare_promo_count,
      COUNT(DISTINCT promotion_code) AS distinct_promos_used,
      ARRAY_AGG(DISTINCT promotion_code) AS promo_codes,
      CAST(MIN(purchase_date) AS STRING) AS first_zero_fare,
      CAST(MAX(purchase_date) AS STRING) AS last_zero_fare
    FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
    WHERE selling_company = 'Salt Lake Express'
      AND (activity_type IS NULL OR activity_type = 'Sale')
      AND COALESCE(total_sale, 0) = 0
      AND promotion_code IS NOT NULL
      AND purchaser_email IS NOT NULL
    GROUP BY email, purchaser_first_name, purchaser_last_name
    HAVING COUNT(*) > 1
    ORDER BY zero_fare_promo_count DESC
  `;
  const [rows] = await bq.query({ query: sql });
  return rows;
}

async function query3_promoCodeSummary() {
  const sql = `
    SELECT
      promotion_code,
      COUNT(*) AS zero_fare_orders,
      COUNT(DISTINCT LOWER(TRIM(purchaser_email))) AS distinct_users,
      SUM(COALESCE(num_passengers, 1)) AS total_passengers_free,
      CAST(MIN(purchase_date) AS STRING) AS first_used,
      CAST(MAX(purchase_date) AS STRING) AS last_used,
      ARRAY_AGG(DISTINCT selling_agency IGNORE NULLS) AS booking_channels,
      ARRAY_AGG(DISTINCT CONCAT(trip_origin_stop, ' → ', trip_destination_stop) IGNORE NULLS) AS routes
    FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
    WHERE selling_company = 'Salt Lake Express'
      AND (activity_type IS NULL OR activity_type = 'Sale')
      AND COALESCE(total_sale, 0) = 0
      AND promotion_code IS NOT NULL
      AND DATE(purchase_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    GROUP BY promotion_code
    ORDER BY zero_fare_orders DESC
  `;
  const [rows] = await bq.query({ query: sql });
  return rows;
}

async function main() {
  console.log("Running promo code $0 fare analysis...\n");

  const [orders, repeats, summary] = await Promise.all([
    query1_zeroFareOrders(),
    query2_repeatAbusers(),
    query3_promoCodeSummary(),
  ]);

  // --- Query 1: All $0 fare orders (last 30 days) ---
  console.log("=".repeat(80));
  console.log(`QUERY 1: $0 FARE ORDERS WITH PROMO CODES (Last 30 Days) — ${orders.length} orders`);
  console.log("=".repeat(80));

  for (const o of orders as Record<string, unknown>[]) {
    const bookLead = o.depart_date && o.purchase_date
      ? Math.round((new Date(String(o.depart_date)).getTime() - new Date(String(o.purchase_date)).getTime()) / 86400000)
      : "?";
    console.log(
      `  ${o.order_id} | ${String(o.purchase_date).slice(0, 10)} | ${o.purchaser_first_name} ${o.purchaser_last_name} | ${o.purchaser_email}` +
      `\n    Promo: ${o.promotion_code} | Pax: ${o.num_passengers} | Fares: $${o.fares} | Discounted: $${o.amount_discounted}` +
      `\n    Route: ${o.trip_origin_stop} → ${o.trip_destination_stop}` +
      `\n    Channel: ${o.selling_agency} / ${o.selling_agent} | Depart: ${String(o.depart_date ?? "").slice(0, 10)} | Book lead: ${bookLead} days`
    );
    console.log();
  }

  // --- Query 2: Repeat abusers (all-time) ---
  console.log("\n" + "=".repeat(80));
  console.log(`QUERY 2: REPEAT $0 PROMO USERS (All-Time) — ${repeats.length} users`);
  console.log("=".repeat(80));

  for (const r of repeats as Record<string, unknown>[]) {
    console.log(
      `  ${r.email} (${r.purchaser_first_name} ${r.purchaser_last_name})` +
      `\n    $0 orders: ${r.zero_fare_promo_count} | Distinct promos: ${r.distinct_promos_used}` +
      `\n    Codes used: ${(r.promo_codes as string[]).join(", ")}` +
      `\n    First: ${String(r.first_zero_fare).slice(0, 10)} | Last: ${String(r.last_zero_fare).slice(0, 10)}`
    );
    console.log();
  }

  // --- Query 3: Promo code summary ---
  console.log("\n" + "=".repeat(80));
  console.log(`QUERY 3: PROMO CODE SUMMARY (Last 30 Days) — ${summary.length} codes`);
  console.log("=".repeat(80));

  for (const s of summary as Record<string, unknown>[]) {
    console.log(
      `  ${s.promotion_code}` +
      `\n    $0 orders: ${s.zero_fare_orders} | Distinct users: ${s.distinct_users} | Free passengers: ${s.total_passengers_free}` +
      `\n    First: ${String(s.first_used).slice(0, 10)} | Last: ${String(s.last_used).slice(0, 10)}` +
      `\n    Channels: ${(s.booking_channels as string[]).join(", ")}` +
      `\n    Routes: ${(s.routes as string[]).join("; ")}`
    );
    console.log();
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
