import type { Workflow } from "@/lib/workflows";

type Period = { year: number; month: number };

type CompletedRun = {
  periodYear: number;
  periodMonth: number;
};

/**
 * Get the period that currently needs analysis.
 * Monthly = previous month (on March 30, due period is February).
 * Returns null for on-demand workflows.
 */
export function getCurrentDuePeriod(workflow: Workflow): Period | null {
  const { frequency } = workflow.cadence;
  if (frequency === "on-demand") return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  if (frequency === "monthly") {
    // Previous month
    if (month === 0) return { year: year - 1, month: 12 };
    return { year, month };
  }

  if (frequency === "quarterly") {
    // Previous quarter's last month
    const currentQuarter = Math.floor(month / 3); // 0-3
    if (currentQuarter === 0) return { year: year - 1, month: 12 };
    return { year, month: currentQuarter * 3 };
  }

  if (frequency === "yearly") {
    return { year: year - 1, month: 12 };
  }

  return null;
}

/**
 * Get the calendar date by which analysis for a period should be completed.
 * Applies the workflow's due rule to the month AFTER the period.
 * February period + day-of-month:10 = March 10.
 */
export function getDueDateForPeriod(
  workflow: Workflow,
  period: Period,
): Date | null {
  const { dueRule } = workflow.cadence;
  if (dueRule.type === "on-demand") return null;

  // The due date falls in the month after the period
  let dueYear = period.year;
  let dueMonth = period.month + 1; // 1-indexed, so +1 goes to next month
  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear += 1;
  }

  if (dueRule.type === "day-of-month") {
    return new Date(dueYear, dueMonth - 1, dueRule.day);
  }

  if (dueRule.type === "nth-weekday") {
    return getNthWeekday(dueYear, dueMonth, dueRule.n, dueRule.weekday);
  }

  return null;
}

/**
 * Check if a completed run exists for the given period.
 */
export function isPeriodSatisfied(
  completedRuns: CompletedRun[],
  period: Period,
): boolean {
  return completedRuns.some(
    (run) => run.periodYear === period.year && run.periodMonth === period.month,
  );
}

/**
 * Get the nth occurrence of a weekday in a given month.
 * n=1 for first, weekday: 0=Sun, 1=Mon, ..., 6=Sat.
 * month is 1-indexed (1=January).
 */
export function getNthWeekday(
  year: number,
  month: number,
  n: number,
  weekday: number,
): Date {
  const firstOfMonth = new Date(year, month - 1, 1);
  const firstWeekday = firstOfMonth.getDay();

  let dayOfMonth = 1 + ((weekday - firstWeekday + 7) % 7);
  dayOfMonth += (n - 1) * 7;

  return new Date(year, month - 1, dayOfMonth);
}

/**
 * Format a cadence for display.
 */
export function formatCadence(cadence: Workflow["cadence"]): string {
  return cadence.frequency.charAt(0).toUpperCase() + cadence.frequency.slice(1);
}
