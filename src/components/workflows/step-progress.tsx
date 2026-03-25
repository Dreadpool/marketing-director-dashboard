"use client";

import { Check, Loader2, AlertCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepProgressProps {
  steps: {
    id: string;
    label: string;
    status: string;
  }[];
}

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <Check className="h-3.5 w-3.5" />;
    case "running":
      return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    case "failed":
      return <AlertCircle className="h-3.5 w-3.5" />;
    default:
      return <Circle className="h-3.5 w-3.5" />;
  }
}

export function StepProgress({ steps }: StepProgressProps) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              step.status === "completed" && "bg-emerald-500/10 text-emerald-400",
              step.status === "running" && "bg-gold/10 text-gold",
              step.status === "failed" && "bg-destructive/10 text-destructive",
              step.status === "pending" && "bg-muted text-muted-foreground",
            )}
          >
            <StepIcon status={step.status} />
            {step.label}
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                "mx-1 h-px w-6",
                step.status === "completed" ? "bg-emerald-500/30" : "bg-border",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
