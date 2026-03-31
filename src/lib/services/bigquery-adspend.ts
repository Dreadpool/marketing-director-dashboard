import type { MonthPeriod } from "@/lib/schemas/types";
import { getBigQueryClient, PROJECT_ID } from "./bigquery-client";

const GL_DATASET = "quickbooks_gl";

const AD_ACCOUNTS = ["65010", "65011", "65012", "65013", "65017"];

const ACCOUNT_LABELS: Record<string, string> = {
  "65010": "65010 · Advertising - Other",
  "65011": "65011 · Brand Advertising",
  "65012": "65012 · Targeted Advertising",
  "65013": "65013 · Promotional Advertising",
  "65017": "65017 · Sales Collateral",
};

/** Ad spend standardized to QuickBooks account categories */
export type AdSpendResult = {
  categories: Record<string, number>;
  total_spend: number;
  transaction_count: number;
};

export type AdSpendConnectionResult = {
  ok: boolean;
  error?: string;
  warning?: string;
};

/** Get monthly ad spend from QuickBooks GL in BigQuery, grouped by account category */
export async function getMonthlyAdSpend(
  period: MonthPeriod,
): Promise<AdSpendResult> {
  const bq = getBigQueryClient();
  const startDate = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
  const endDate = new Date(period.year, period.month, 0)
    .toISOString()
    .slice(0, 10);

  const [rows] = await bq.query({
    query: `
      SELECT account_number,
        SUM(debit) AS total_debit,
        SUM(credit) AS total_credit,
        COUNT(*) AS txn_count
      FROM \`${PROJECT_ID}.${GL_DATASET}.gl_transactions\`
      WHERE company = 'salt_lake_express'
        AND account_number IN UNNEST(@account_numbers)
        AND txn_date BETWEEN @start_date AND @end_date
      GROUP BY account_number
    `,
    params: {
      account_numbers: AD_ACCOUNTS,
      start_date: startDate,
      end_date: endDate,
    },
  });

  const categories: Record<string, number> = {
    "65011 · Brand Advertising": 0,
    "65012 · Targeted Advertising": 0,
    "65013 · Promotional Advertising": 0,
    "65017 · Sales Collateral": 0,
    "65010 · Advertising - Other": 0,
  };

  let totalTxnCount = 0;

  for (const row of rows) {
    const label = ACCOUNT_LABELS[row.account_number] ?? "65010 · Advertising - Other";
    const net = Number(row.total_debit ?? 0) - Number(row.total_credit ?? 0);
    categories[label] += net;
    totalTxnCount += Number(row.txn_count ?? 0);
  }

  const total_spend = Object.values(categories).reduce((a, b) => a + b, 0);

  return {
    categories,
    total_spend: Math.round(total_spend * 100) / 100,
    transaction_count: totalTxnCount,
  };
}

/** Test that QuickBooks GL ad spend data is accessible in BigQuery */
export async function testAdSpendConnection(
  period?: MonthPeriod,
): Promise<AdSpendConnectionResult> {
  try {
    const bq = getBigQueryClient();

    const yearFilter = period
      ? `AND EXTRACT(YEAR FROM txn_date) = @year`
      : "";

    const params: Record<string, unknown> = {};
    const types: Record<string, string> = {};
    if (period) {
      params.year = period.year;
      types.year = "INT64";
    }

    const [rows] = await bq.query({
      query: `
        SELECT
          COUNT(*) AS row_count,
          COUNT(DISTINCT FORMAT_DATE('%Y-%m', txn_date)) AS months_covered
        FROM \`${PROJECT_ID}.${GL_DATASET}.gl_transactions\`
        WHERE company = 'salt_lake_express'
          AND account_number IN ('65010', '65011', '65012', '65013', '65017')
          ${yearFilter}
      `,
      params,
      types,
    });

    const row = rows[0];
    const rowCount = Number(row?.row_count ?? 0);
    const monthsCovered = Number(row?.months_covered ?? 0);

    if (rowCount === 0) {
      return {
        ok: false,
        error: period
          ? `No ad spend data found for ${period.year} in QuickBooks GL.`
          : "No ad spend data found in QuickBooks GL.",
      };
    }

    if (period && monthsCovered < Math.ceil(period.month * 0.3)) {
      return {
        ok: true,
        warning: `Low data coverage for ${period.year}: only ${monthsCovered} of ${period.month} expected months have data.`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
