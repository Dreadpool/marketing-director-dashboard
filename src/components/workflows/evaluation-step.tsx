// src/components/workflows/evaluation-step.tsx

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { EvaluationActions } from "./evaluation-actions";
import { DecisionMetricsViz } from "./steps/decision-metrics";
import {
  D1FrequencyViz,
  D2CpmTrendViz,
  D3CtrTrendViz,
  D4ConversionRateViz,
  D5PatternMatchViz,
} from "./steps/cpa-diagnostic";
import type {
  PreparedStep,
  EvaluationActionItem,
  UserDecision,
} from "@/lib/workflows/evaluations/types";

interface EvaluationStepProps {
  step: PreparedStep;
  onRespond: (
    stepId: string,
    decision: UserDecision,
    overrideReason: string | undefined,
    actionItems: EvaluationActionItem[],
  ) => Promise<void>;
  onRetry: () => Promise<void>;
}

function StepDataViz({
  stepId,
  data,
}: {
  stepId: string;
  data: Record<string, unknown>;
}) {
  switch (stepId) {
    case "step1-decision-metrics":
      return <DecisionMetricsViz data={data} />;
    case "d1-frequency":
      return <D1FrequencyViz data={data} />;
    case "d2-cpm-trend":
      return <D2CpmTrendViz data={data} />;
    case "d3-ctr-trend":
      return <D3CtrTrendViz data={data} />;
    case "d4-conversion-rate":
      return <D4ConversionRateViz data={data} />;
    case "d5-pattern-match":
      return <D5PatternMatchViz data={data} />;
    default:
      return null;
  }
}

export function EvaluationStep({
  step,
  onRespond,
  onRetry,
}: EvaluationStepProps) {
  // onRetry is available for error recovery but not yet wired into the step UI
  void onRetry;
  const [decision, setDecision] = useState<UserDecision | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [actionItems, setActionItems] = useState<EvaluationActionItem[]>(
    step.suggestedActions,
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!decision) return;
    if (decision === "override" && !overrideReason.trim()) return;

    setSubmitting(true);
    await onRespond(
      step.stepId,
      decision,
      decision === "override" ? overrideReason.trim() : undefined,
      actionItems,
    );
    setSubmitting(false);
  }

  return (
    <div className="space-y-4">
      {/* Step Header */}
      <div>
        <h2 className="font-heading text-lg font-semibold">{step.label}</h2>
        <p className="text-sm text-muted-foreground">{step.description}</p>
      </div>

      {/* Data Visualization */}
      <Card>
        <CardContent className="pt-6">
          <StepDataViz stepId={step.stepId} data={step.data} />
        </CardContent>
      </Card>

      {/* AI Evaluation */}
      {step.aiEvaluation && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              AI Evaluation
            </p>
            <div className="prose prose-invert prose-sm max-w-none prose-headings:text-foreground prose-headings:font-heading prose-strong:text-foreground prose-a:text-gold prose-th:text-xs prose-td:text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {step.aiEvaluation}
              </ReactMarkdown>
            </div>

            {/* Agree / Override buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDecision("agree")}
                disabled={submitting}
                className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  decision === "agree"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-emerald-500/20"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                Agree
              </button>
              <button
                onClick={() => setDecision("override")}
                disabled={submitting}
                className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  decision === "override"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-amber-500/20"
                }`}
              >
                <XCircle className="h-4 w-4" />
                Override
              </button>
            </div>

            {/* Override reason */}
            {decision === "override" && (
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why you disagree with the AI assessment..."
                rows={3}
                className="w-full rounded-md border border-amber-500/20 bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Items */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Action Items
          </p>
          <EvaluationActions
            items={actionItems}
            onChange={setActionItems}
            stepId={step.stepId}
          />
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleSubmit}
          disabled={
            !decision ||
            submitting ||
            (decision === "override" && !overrideReason.trim())
          }
          className="flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-medium text-gold-foreground transition-colors hover:bg-gold/90 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Next Step"}
        </button>
      </div>
    </div>
  );
}
