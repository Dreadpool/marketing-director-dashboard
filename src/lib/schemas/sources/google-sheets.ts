/** Ad spend row from Google Sheets */
export type SheetsAdSpendRow = {
  account_name: string;
  amount: number | null;
  month?: string;
  category?: string;
};

/** SEO ranking row from Google Sheets */
export type SheetsSEORankingRow = {
  keyword: string;
  site: string;
  /** Rank 1-100, or null if not tracked. "OTR" and "0" capped at 100 */
  rank: number | null;
  month: string;
};
