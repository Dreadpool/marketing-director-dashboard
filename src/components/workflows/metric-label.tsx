"use client";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Definitions for Meta Ads metric abbreviations that appear in the dashboard.
// Keep the formula line precise: the dashboard's whole purpose is to remove
// ambiguity about what each number means. If the executor changes how a
// metric is computed, update the formula here too.
interface MetricDefinition {
  full: string;
  formula: string;
  note?: string;
}

export type MetricName =
  | "CVR"
  | "CTR"
  | "CPA"
  | "CPM"
  | "ROAS"
  | "Frequency"
  | "HookRate"
  | "HoldRate";

export const METRIC_DEFINITIONS: Record<MetricName, MetricDefinition> = {
  CVR: {
    full: "Click conversion rate",
    formula: "purchases / clicks",
    note: "Click CVR, not impression CVR.",
  },
  CTR: {
    full: "Click-through rate",
    formula: "clicks / impressions",
  },
  CPA: {
    full: "Cost per acquisition",
    formula: "spend / purchases",
    note: "Meta-reported. True CPA ≈ Meta CPA × 1.3 after over-attribution.",
  },
  CPM: {
    full: "Cost per mille (1,000 impressions)",
    formula: "spend / impressions × 1,000",
  },
  ROAS: {
    full: "Return on ad spend",
    formula: "revenue / spend",
    note: "Revenue, not profit. Below 3.0× loses money after COGS.",
  },
  Frequency: {
    full: "Average impressions per person",
    formula: "impressions / reach",
    note: "Above 3 typically signals creative fatigue.",
  },
  HookRate: {
    full: "Hook rate",
    formula: "3-second video views / impressions",
    note: "How many people stop scrolling. Below 25% is weak.",
  },
  HoldRate: {
    full: "Hold rate",
    formula: "thruplay / 3-second video views",
    note: "How many people watch to completion. Below 30% is weak.",
  },
};

interface MetricLabelProps {
  name: MetricName;
  className?: string;
  display?: string;
}

export function MetricLabel({ name, className, display }: MetricLabelProps) {
  const def = METRIC_DEFINITIONS[name];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className={cn(
            "cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2",
            className,
          )}
        >
          {display ?? name}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <div className="space-y-0.5">
            <p className="font-medium">{def.full}</p>
            <p className="font-mono text-[11px] opacity-90">{def.formula}</p>
            {def.note && (
              <p className="text-[11px] opacity-70">{def.note}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
