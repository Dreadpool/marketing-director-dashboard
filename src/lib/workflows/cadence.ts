import type { Workflow } from "@/lib/workflows";

type RunInfo = {
  completedAt: Date | null;
  periodYear: number;
  periodMonth: number;
};

/** Check if a workflow is due based on its cadence and last completed run */
export function isDue(workflow: Workflow, lastRun?: RunInfo): boolean {
  if (workflow.status !== "active") return false;
  if (!lastRun?.completedAt) return true;

  const now = new Date();
  const lastDate = lastRun.completedAt;

  switch (workflow.cadence) {
    case "monthly":
      return (
        now.getMonth() !== lastDate.getMonth() ||
        now.getFullYear() !== lastDate.getFullYear()
      );
    case "quarterly":
      return (
        Math.floor(now.getMonth() / 3) !==
          Math.floor(lastDate.getMonth() / 3) ||
        now.getFullYear() !== lastDate.getFullYear()
      );
    case "yearly":
      return now.getFullYear() !== lastDate.getFullYear();
    case "on-demand":
      return false;
  }
}

/** Get the next due date for a workflow */
export function getNextDueDate(
  workflow: Workflow,
  lastRun?: RunInfo,
): Date | null {
  if (workflow.status !== "active") return null;
  if (workflow.cadence === "on-demand") return null;

  const now = new Date();

  if (!lastRun?.completedAt) {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const last = lastRun.completedAt;

  switch (workflow.cadence) {
    case "monthly":
      return last.getMonth() === 11
        ? new Date(last.getFullYear() + 1, 0, 1)
        : new Date(last.getFullYear(), last.getMonth() + 1, 1);
    case "quarterly": {
      const nextQ = Math.floor(last.getMonth() / 3) + 1;
      return nextQ >= 4
        ? new Date(last.getFullYear() + 1, 0, 1)
        : new Date(last.getFullYear(), nextQ * 3, 1);
    }
    case "yearly":
      return new Date(last.getFullYear() + 1, 0, 1);
  }
}

/** Format a cadence label for display */
export function formatCadence(cadence: Workflow["cadence"]): string {
  return cadence.charAt(0).toUpperCase() + cadence.slice(1);
}
