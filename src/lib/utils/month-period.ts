import type { DateRange, MonthPeriod } from "@/lib/schemas/types";

export function getMonthDateRange(period: MonthPeriod): DateRange {
  return {
    start: `${period.year}-${pad2(period.month)}-01`,
    end: `${period.year}-${pad2(period.month)}-${pad2(daysInMonth(period))}`,
  };
}

function daysInMonth(period: MonthPeriod): number {
  return new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
