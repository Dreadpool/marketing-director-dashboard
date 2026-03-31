import { BigQuery } from "@google-cloud/bigquery";

const PROJECT_ID = process.env.BIGQUERY_PROJECT_ID ?? "jovial-root-443516-a7";
const DATASET = process.env.BIGQUERY_DATASET ?? "tds_sales";
const bq = new BigQuery({ projectId: PROJECT_ID });

// ── 1. Per-code, per-agent breakdown: who is actually entering these codes? ──
async function agentUsageByCode() {
  const sql = `
    SELECT
      promotion_code,
      selling_agency,
      selling_agent,
      COUNT(*) AS order_count,
      SUM(COALESCE(num_passengers, 1)) AS total_pax,
      ROUND(SUM(COALESCE(amount_discounted, 0)), 2) AS total_discounted,
      COUNT(DISTINCT LOWER(TRIM(purchaser_email))) AS distinct_customers,
      -- how many of those customers have SLE emails?
      COUNTIF(
        LOWER(TRIM(purchaser_email)) LIKE '%@saltlakeexpress.com'
        OR LOWER(TRIM(purchaser_email)) LIKE '%@sle.com'
      ) AS sle_email_orders,
      COUNTIF(
        LOWER(TRIM(purchaser_email)) NOT LIKE '%@saltlakeexpress.com'
        AND LOWER(TRIM(purchaser_email)) NOT LIKE '%@sle.com'
      ) AS external_email_orders
    FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
    WHERE selling_company = 'Salt Lake Express'
      AND (activity_type IS NULL OR activity_type = 'Sale')
      AND COALESCE(total_sale, 0) = 0
      AND promotion_code IS NOT NULL
      AND DATE(purchase_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    GROUP BY promotion_code, selling_agency, selling_agent
    ORDER BY promotion_code, order_count DESC
  `;
  const [rows] = await bq.query({ query: sql });
  return rows as Record<string, unknown>[];
}

// ── 2. For external customers: who are they, how many times, what code? ──
async function externalCustomerDetail() {
  const sql = `
    SELECT
      promotion_code,
      LOWER(TRIM(purchaser_email)) AS email,
      CONCAT(purchaser_first_name, ' ', purchaser_last_name) AS name,
      selling_agent,
      selling_agency,
      COUNT(*) AS order_count,
      SUM(COALESCE(num_passengers, 1)) AS total_pax,
      ROUND(SUM(COALESCE(amount_discounted, 0)), 2) AS total_value_given_free,
      ARRAY_AGG(
        DISTINCT CONCAT(trip_origin_stop, ' → ', trip_destination_stop)
        IGNORE NULLS
      ) AS routes
    FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
    WHERE selling_company = 'Salt Lake Express'
      AND (activity_type IS NULL OR activity_type = 'Sale')
      AND COALESCE(total_sale, 0) = 0
      AND promotion_code IS NOT NULL
      AND DATE(purchase_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      AND LOWER(TRIM(purchaser_email)) NOT LIKE '%@saltlakeexpress.com'
      AND LOWER(TRIM(purchaser_email)) NOT LIKE '%@sle.com'
    GROUP BY promotion_code, email, name, selling_agent, selling_agency
    ORDER BY promotion_code, total_value_given_free DESC
  `;
  const [rows] = await bq.query({ query: sql });
  return rows as Record<string, unknown>[];
}

// ── 3. Web API usage specifically (code used without an agent) ──
async function webApiUsage() {
  const sql = `
    SELECT
      promotion_code,
      order_id,
      CAST(purchase_date AS STRING) AS purchase_date,
      CONCAT(purchaser_first_name, ' ', purchaser_last_name) AS name,
      LOWER(TRIM(purchaser_email)) AS email,
      COALESCE(num_passengers, 1) AS pax,
      ROUND(COALESCE(amount_discounted, 0), 2) AS value_given_free,
      CONCAT(trip_origin_stop, ' → ', trip_destination_stop) AS route
    FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
    WHERE selling_company = 'Salt Lake Express'
      AND (activity_type IS NULL OR activity_type = 'Sale')
      AND COALESCE(total_sale, 0) = 0
      AND promotion_code IS NOT NULL
      AND DATE(purchase_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      AND (selling_agency LIKE '%Web%' OR selling_agency LIKE '%API%' OR selling_agent LIKE '%Web%')
    ORDER BY purchase_date DESC
  `;
  const [rows] = await bq.query({ query: sql });
  return rows as Record<string, unknown>[];
}

// ── 4. Total revenue impact ──
async function revenueImpact() {
  const sql = `
    SELECT
      promotion_code,
      COUNT(*) AS orders,
      ROUND(SUM(COALESCE(amount_discounted, 0)), 2) AS total_revenue_lost,
      ROUND(AVG(COALESCE(amount_discounted, 0)), 2) AS avg_ticket_value,
      ROUND(MIN(COALESCE(amount_discounted, 0)), 2) AS min_ticket,
      ROUND(MAX(COALESCE(amount_discounted, 0)), 2) AS max_ticket
    FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
    WHERE selling_company = 'Salt Lake Express'
      AND (activity_type IS NULL OR activity_type = 'Sale')
      AND COALESCE(total_sale, 0) = 0
      AND promotion_code IS NOT NULL
      AND DATE(purchase_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    GROUP BY promotion_code
    ORDER BY total_revenue_lost DESC
  `;
  const [rows] = await bq.query({ query: sql });
  return rows as Record<string, unknown>[];
}

async function main() {
  const [agents, externals, webApi, revenue] = await Promise.all([
    agentUsageByCode(),
    externalCustomerDetail(),
    webApiUsage(),
    revenueImpact(),
  ]);

  // ════════════════════════════════════════════════════════════════
  // SECTION 1: Revenue impact summary
  // ════════════════════════════════════════════════════════════════
  console.log("═".repeat(80));
  console.log("REVENUE IMPACT (Last 30 Days)");
  console.log("═".repeat(80));
  let grandTotal = 0;
  for (const r of revenue) {
    console.log(
      `  ${String(r.promotion_code).padEnd(20)} ${String(r.orders).padStart(4)} orders  |  ` +
      `$${Number(r.total_revenue_lost).toLocaleString()} lost  |  ` +
      `avg $${r.avg_ticket_value}  |  range $${r.min_ticket}–$${r.max_ticket}`
    );
    grandTotal += Number(r.total_revenue_lost);
  }
  console.log(`\n  TOTAL: $${grandTotal.toLocaleString()} in free rides across ${revenue.reduce((s, r) => s + Number(r.orders), 0)} orders`);

  // ════════════════════════════════════════════════════════════════
  // SECTION 2: Who is entering each code? (Agent breakdown)
  // ════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(80));
  console.log("WHO IS ENTERING EACH CODE? (Agent → Code breakdown)");
  console.log("═".repeat(80));

  let currentCode = "";
  for (const a of agents) {
    if (a.promotion_code !== currentCode) {
      currentCode = String(a.promotion_code);
      console.log(`\n  ── ${currentCode} ──`);
    }
    console.log(
      `    ${String(a.selling_agent).padEnd(25)} (${a.selling_agency})` +
      `\n      ${a.order_count} orders, ${a.total_pax} pax, $${Number(a.total_discounted).toLocaleString()} discounted` +
      `\n      ${a.sle_email_orders} SLE-email orders, ${a.external_email_orders} external-email orders`
    );
  }

  // ════════════════════════════════════════════════════════════════
  // SECTION 3: Every external customer who got a free ride
  // ════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(80));
  console.log("EXTERNAL CUSTOMERS RECEIVING FREE RIDES (non-SLE emails)");
  console.log("═".repeat(80));

  currentCode = "";
  for (const e of externals) {
    if (e.promotion_code !== currentCode) {
      currentCode = String(e.promotion_code);
      console.log(`\n  ── ${currentCode} ──`);
    }
    console.log(
      `    ${e.name} (${e.email})` +
      `\n      ${e.order_count} orders, ${e.total_pax} pax, $${Number(e.total_value_given_free).toLocaleString()} free` +
      `\n      Booked by: ${e.selling_agent} (${e.selling_agency})` +
      `\n      Routes: ${(e.routes as string[]).join("; ")}`
    );
  }

  // ════════════════════════════════════════════════════════════════
  // SECTION 4: Web/API bookings (codes used without office agent)
  // ════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(80));
  console.log("WEB/API BOOKINGS (codes entered by customers directly)");
  console.log("═".repeat(80));

  if (webApi.length === 0) {
    console.log("  None found.");
  } else {
    for (const w of webApi) {
      console.log(
        `  ${String(w.purchase_date).slice(0, 10)} | ${w.name} (${w.email})` +
        `\n    Code: ${w.promotion_code} | ${w.pax} pax | $${w.value_given_free} free | ${w.route}`
      );
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
