// src/components/workflows/evaluation-wizard.tsx

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Loader2, RotateCcw, ArrowLeft } from "lucide-react";
import { EvaluationStep } from "@/components/workflows/evaluation-step";
import { ActionSummaryView } from "@/components/workflows/steps/action-summary";
import type {
  PreparedStep,
  EvaluationActionItem,
  UserDecision,
  EvaluationSummary,
} from "@/lib/workflows/evaluations/types";
import {
  getMainSpineSteps,
  getDiagnosticSteps,
} from "@/lib/workflows/evaluations/meta-ads-monthly";

type WizardState =
  | { phase: "loading" }
  | { phase: "step"; runId: string; currentStep: PreparedStep }
  | { phase: "summary"; runId: string; summary: EvaluationSummary }
  | { phase: "error"; message: string };

interface EvaluationWizardProps {
  parentRunId: string;
  slug: string;
  period: { year: number; month: number };
  onBack: () => void;
}

export function EvaluationWizard({
  parentRunId,
  slug,
  period,
  onBack,
}: EvaluationWizardProps) {
  const [state, setState] = useState<WizardState>({ phase: "loading" });
  const initRef = useRef(false);

  // Initialize evaluation on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      try {
        const res = await fetch(
          `/api/workflows/${slug}/runs/${parentRunId}/evaluate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ period }),
          },
        );

        if (!res.ok) {
          const data = await res.json();
          setState({
            phase: "error",
            message: data.error ?? "Failed to start evaluation",
          });
          return;
        }

        const data = await res.json();

        if (data.currentStep) {
          setState({
            phase: "step",
            runId: data.runId,
            currentStep: data.currentStep,
          });
        } else {
          setState({
            phase: "error",
            message: "Unexpected response from server",
          });
        }
      } catch (err) {
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : "Network error",
        });
      }
    }

    init();
  }, [slug, parentRunId, period]);

  const handleRespond = useCallback(
    async (
      stepId: string,
      decision: UserDecision,
      overrideReason: string | undefined,
      actionItemsList: EvaluationActionItem[],
    ) => {
      if (state.phase !== "step") return;

      const currentRunId = state.runId;
      setState({ phase: "loading" });

      try {
        const res = await fetch(
          `/api/workflows/${slug}/runs/${currentRunId}/steps/${stepId}/respond`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              decision,
              overrideReason,
              actionItems: actionItemsList,
              period,
            }),
          },
        );

        if (!res.ok) {
          const data = await res.json();
          setState({
            phase: "error",
            message: data.error ?? "Failed to submit response",
          });
          return;
        }

        const data = await res.json();

        if (data.done) {
          setState({
            phase: "summary",
            runId: currentRunId,
            summary: data.summary,
          });
        } else if (data.nextStep) {
          setState({
            phase: "step",
            runId: currentRunId,
            currentStep: data.nextStep,
          });
        }
      } catch (err) {
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : "Network error",
        });
      }
    },
    [state, slug, period],
  );

  const handleRetry = useCallback(async () => {
    if (state.phase !== "step") return;

    const stepId = state.currentStep.stepId;
    const currentRunId = state.runId;
    setState({ phase: "loading" });

    try {
      const res = await fetch(
        `/api/workflows/${slug}/runs/${currentRunId}/steps/${stepId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ retry: true, period }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        setState({ phase: "error", message: data.error ?? "Retry failed" });
        return;
      }

      const data = await res.json();
      setState({
        phase: "step",
        runId: currentRunId,
        currentStep: data.step,
      });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }, [state, slug, period]);

  const mainSpineSteps = getMainSpineSteps();
  const diagnosticSteps = getDiagnosticSteps();

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Dashboard
      </button>

      {/* Loading */}
      {state.phase === "loading" && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="mt-4 text-sm text-muted-foreground">
            Preparing evaluation...
          </p>
        </div>
      )}

      {/* Error */}
      {state.phase === "error" && (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{state.message}</p>
          <button
            onClick={onBack}
            className="mt-4 flex items-center gap-2 mx-auto rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Back to Dashboard
          </button>
        </div>
      )}

      {/* Progress Bar */}
      {(state.phase === "step" || state.phase === "summary") && (
        <EvaluationProgressBar
          mainSpineSteps={mainSpineSteps}
          diagnosticSteps={diagnosticSteps}
          currentStepId={
            state.phase === "step" ? state.currentStep.stepId : null
          }
          allStepIds={
            state.phase === "step"
              ? state.currentStep.allStepIds
              : state.summary.completedSteps.map((s) => s.stepId)
          }
          completedStepIds={
            state.phase === "step"
              ? state.currentStep.completedSteps.map((s) => s.stepId)
              : state.summary.completedSteps.map((s) => s.stepId)
          }
        />
      )}

      {/* Current Step */}
      {state.phase === "step" &&
        state.currentStep.stepId !== "step6-action-summary" && (
          <EvaluationStep
            step={state.currentStep}
            onRespond={handleRespond}
            onRetry={handleRetry}
          />
        )}

      {/* Step 6: Action Summary (special rendering) */}
      {state.phase === "step" &&
        state.currentStep.stepId === "step6-action-summary" && (
          <ActionSummaryView
            step={state.currentStep}
            period={period}
            onFinish={async (finalItems) => {
              await handleRespond(
                "step6-action-summary",
                "agree",
                undefined,
                finalItems,
              );
            }}
          />
        )}

      {/* Completed Summary */}
      {state.phase === "summary" && (
        <div className="space-y-6">
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
            <p className="text-sm font-medium text-emerald-400">
              Evaluation Complete
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {state.summary.allActionItems.length} action items saved
            </p>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 mx-auto rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Back to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Progress Bar ───────────────────────────────────────────────────────────

function EvaluationProgressBar({
  mainSpineSteps,
  diagnosticSteps,
  currentStepId,
  allStepIds,
  completedStepIds,
}: {
  mainSpineSteps: { id: string; label: string; spineStep: number | null }[];
  diagnosticSteps: { id: string; label: string }[];
  currentStepId: string | null;
  allStepIds: string[];
  completedStepIds: string[];
}) {
  const hasDiagnostics = diagnosticSteps.some((d) =>
    allStepIds.includes(d.id),
  );

  function stepStatus(
    id: string,
  ): "completed" | "active" | "pending" | "placeholder" {
    if (completedStepIds.includes(id)) return "completed";
    if (id === currentStepId) return "active";
    if (!allStepIds.includes(id)) return "placeholder";
    return "pending";
  }

  const statusColors: Record<string, string> = {
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    active: "bg-gold/10 text-gold border-gold/30",
    pending: "bg-muted text-muted-foreground border-border",
    placeholder: "bg-muted/50 text-muted-foreground/40 border-border/50",
  };

  return (
    <div className="space-y-2">
      {/* Main spine */}
      <div className="flex items-center gap-1 flex-wrap">
        {mainSpineSteps.map((step, i) => {
          const status = stepStatus(step.id);
          return (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${statusColors[status]}`}
              >
                <span className="text-[10px] opacity-60">
                  {step.spineStep}
                </span>
                {step.label}
                {status === "placeholder" && (
                  <span className="text-[9px] opacity-50">Phase 2</span>
                )}
              </div>
              {i < mainSpineSteps.length - 1 && (
                <div
                  className={`mx-1 h-px w-4 ${status === "completed" ? "bg-emerald-500/30" : "bg-border"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* CPA Diagnostic sub-bar */}
      {hasDiagnostics && (
        <div className="ml-8 flex items-center gap-1 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mr-1">
            CPA Diagnostic
          </span>
          {diagnosticSteps.map((step, i) => {
            const status = stepStatus(step.id);
            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColors[status]}`}
                >
                  {step.label.replace("D", "").split(":")[0]}
                </div>
                {i < diagnosticSteps.length - 1 && (
                  <div
                    className={`mx-0.5 h-px w-3 ${status === "completed" ? "bg-emerald-500/30" : "bg-border"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
