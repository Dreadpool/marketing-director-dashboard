// src/components/workflows/steps/action-summary.tsx

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { EvaluationActions } from "@/components/workflows/evaluation-actions";
import { cn } from "@/lib/utils";
import type {
  PreparedStep,
  EvaluationActionItem,
} from "@/lib/workflows/evaluations/types";
import type { MonthPeriod } from "@/lib/schemas/types";

const ownerColors: Record<string, string> = {
  agency: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  director: "bg-gold/10 text-gold border-gold/20",
  joint: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

const ownerLabels: Record<string, string> = {
  agency: "Agency",
  director: "Director",
  joint: "Joint",
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

interface ActionSummaryViewProps {
  step: PreparedStep;
  period: MonthPeriod;
  onFinish: (finalItems: EvaluationActionItem[]) => Promise<void>;
}

export function ActionSummaryView({
  step,
  period,
  onFinish,
}: ActionSummaryViewProps) {
  // Collect all action items from completed steps
  const allPriorItems = step.completedSteps.flatMap((s) => s.actionItems);
  const [items, setItems] = useState<EvaluationActionItem[]>(allPriorItems);
  const [submitting, setSubmitting] = useState(false);

  // Group items by owner for summary stats
  const byOwner = items.reduce(
    (acc, item) => {
      acc[item.owner] = (acc[item.owner] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const byPriority = items.reduce(
    (acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  async function handleFinish() {
    setSubmitting(true);
    await onFinish(items);
    setSubmitting(false);
  }

  const monthNames = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="font-heading text-lg font-semibold">
          Action Items Summary
        </h2>
        <p className="text-sm text-muted-foreground">
          Review and finalize all action items from your{" "}
          {monthNames[period.month]} {period.year} evaluation. Edit text,
          priority, and owner before saving.
        </p>
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm text-muted-foreground">
          {items.length} item{items.length !== 1 ? "s" : ""} total
        </span>
        <div className="h-4 w-px bg-border" />
        {Object.entries(byPriority).map(([p, count]) => (
          <Badge
            key={p}
            variant="outline"
            className={cn("text-[10px] uppercase", priorityColors[p])}
          >
            {count} {p}
          </Badge>
        ))}
        <div className="h-4 w-px bg-border" />
        {Object.entries(byOwner).map(([o, count]) => (
          <Badge
            key={o}
            variant="outline"
            className={cn("text-[10px]", ownerColors[o])}
          >
            {count} {ownerLabels[o]}
          </Badge>
        ))}
      </div>

      {/* Completed steps review */}
      {step.completedSteps.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
              Evaluation Decisions
            </p>
            {step.completedSteps.map((cs) => (
              <div
                key={cs.stepId}
                className="flex items-center gap-2 text-sm"
              >
                <CheckCircle2
                  className={`h-3.5 w-3.5 ${cs.decision === "agree" ? "text-emerald-400" : "text-amber-400"}`}
                />
                <span className="font-medium">{cs.label}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${cs.decision === "agree" ? "text-emerald-400 border-emerald-500/20" : "text-amber-400 border-amber-500/20"}`}
                >
                  {cs.decision}
                </Badge>
                {cs.overrideReason && (
                  <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                    &mdash; {cs.overrideReason}
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Editable action items */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            All Action Items &mdash; Final Edit
          </p>
          <EvaluationActions
            items={items}
            onChange={setItems}
            stepId="step6-action-summary"
          />
        </CardContent>
      </Card>

      {/* Finish */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleFinish}
          disabled={submitting}
          className="flex items-center gap-2 rounded-md bg-gold px-6 py-2 text-sm font-medium text-gold-foreground transition-colors hover:bg-gold/90 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Complete Evaluation"}
        </button>
      </div>
    </div>
  );
}
