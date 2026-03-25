import type { MonthPeriod } from "@/lib/schemas/types";
import { fetchMonthlyAnalytics } from "./fetch-monthly-analytics";

export type FetchExecutor = (
  period: MonthPeriod,
) => Promise<Record<string, unknown>>;

const executors: Record<string, FetchExecutor> = {
  "monthly-analytics-review": fetchMonthlyAnalytics as unknown as FetchExecutor,
};

export function getExecutor(workflowSlug: string): FetchExecutor | undefined {
  return executors[workflowSlug];
}
