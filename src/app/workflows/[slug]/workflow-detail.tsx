"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2, BookOpen, ClipboardCheck } from "lucide-react";
import { PeriodSelector } from "@/components/workflows/period-selector";
import { StepProgress } from "@/components/workflows/step-progress";
import { StepResult } from "@/components/workflows/step-result";
import { ActionItems } from "@/components/workflows/action-items";
import { RunHistory } from "@/components/workflows/run-history";
import { formatCadence, getCurrentDuePeriod } from "@/lib/workflows/cadence";
import type { Workflow } from "@/lib/workflows";
import { EvaluationWizard } from "@/components/workflows/evaluation-wizard";

interface StepRun {
  id: string;
  stepId: string;
  stepOrder: number;
  status: string;
  outputData: unknown;
  aiOutput: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface ActionItem {
  id: string;
  text: string;
  priority: string | null;
  category: string | null;
  completed: boolean;
}

interface RunDetail {
  id: string;
  workflowSlug: string;
  periodYear: number;
  periodMonth: number;
  status: string;
  startedAt: string;
  completedAt: string | null;
  steps: StepRun[];
  actionItems: ActionItem[];
}

interface RunSummary {
  id: string;
  workflowSlug: string;
  periodYear: number;
  periodMonth: number;
  status: string;
  startedAt: string;
  completedAt: string | null;
}

interface WorkflowDetailProps {
  workflow: Workflow;
}

export function WorkflowDetail({ workflow }: WorkflowDetailProps) {
  const duePeriod = getCurrentDuePeriod(workflow);
  const now = new Date();
  const [year, setYear] = useState(duePeriod?.year ?? now.getFullYear());
  const [month, setMonth] = useState(duePeriod?.month ?? now.getMonth() + 1);
  const [running, setRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<RunDetail | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
  const [evaluationMode, setEvaluationMode] = useState(false);

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows/${workflow.slug}/runs`);
      const data = await res.json();
      setRuns(data.runs ?? []);
    } catch (err) {
      console.error("Failed to load runs:", err);
    }
  }, [workflow.slug]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  async function loadRunDetail(runId: string) {
    try {
      const res = await fetch(
        `/api/workflows/${workflow.slug}/runs/${runId}`,
      );
      const data = await res.json();
      setCurrentRun(data);
      setSelectedRunId(runId);
    } catch (err) {
      console.error("Failed to load run detail:", err);
    }
  }

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleRun() {
    setRunning(true);
    setCurrentRun(null);

    try {
      const res = await fetch(`/api/workflows/${workflow.slug}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: { year, month } }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Workflow execution failed:", data.error);
        setRunning(false);
        return;
      }

      // Start polling for progressive updates
      const runId = data.id;
      setSelectedRunId(runId);

      // Load initial state immediately
      await loadRunDetail(runId);

      // Clear any existing polling interval before starting a new one
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(
            `/api/workflows/${workflow.slug}/runs/${runId}`,
          );
          const detail = await pollRes.json();
          setCurrentRun(detail);

          if (detail.status === "completed" || detail.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setRunning(false);
            await loadRuns();
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 2000);
    } catch (err) {
      console.error("Failed to run workflow:", err);
      setRunning(false);
    }
  }

  async function handleToggleAction(id: string, completed: boolean) {
    try {
      await fetch("/api/action-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, completed }),
      });

      if (currentRun) {
        setCurrentRun({
          ...currentRun,
          actionItems: (currentRun.actionItems ?? []).map((item) =>
            item.id === id ? { ...item, completed } : item,
          ),
        });
      }
    } catch (err) {
      console.error("Failed to toggle action item:", err);
    }
  }

  // Evaluation wizard mode (meta-ads-analysis only)
  if (evaluationMode && currentRun) {
    return (
      <EvaluationWizard
        parentRunId={currentRun.id}
        slug={workflow.slug}
        period={{ year, month }}
        onBack={() => setEvaluationMode(false)}
      />
    );
  }

  // Build step statuses for the progress bar
  const stepStatuses = workflow.steps.map((step) => {
    const stepRun = currentRun?.steps?.find((s) => s.stepId === step.id);
    return {
      id: step.id,
      label: step.label,
      status: running
        ? stepRun?.status ?? "pending"
        : stepRun?.status ?? "pending",
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {workflow.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {workflow.description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {workflow.slug === "meta-ads-analysis" && (
              <a
                href="/guides/meta-ads-training.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Evaluation Guide
              </a>
            )}
            <Badge
              variant="outline"
              className="border-gold/20 text-xs text-gold"
            >
              {formatCadence(workflow.cadence)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <PeriodSelector
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
          disabled={running}
        />
        <button
          onClick={handleRun}
          disabled={running || workflow.status !== "active"}
          className="flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-medium text-gold-foreground transition-colors hover:bg-gold/90 disabled:opacity-50"
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {running ? "Running..." : "Run Analysis"}
        </button>
      </div>

      {/* Step Progress */}
      {(running || currentRun) && <StepProgress steps={stepStatuses} />}

      {/* Step Results */}
      {currentRun?.steps?.map((stepRun) => {
        const stepDef = workflow.steps.find((s) => s.id === stepRun.stepId);
        if (!stepDef) return null;

        return (
          <StepResult
            key={stepRun.id}
            stepId={stepRun.stepId}
            label={stepDef.label}
            status={stepRun.status}
            aiOutput={stepRun.aiOutput}
            outputData={stepRun.outputData}
            error={stepRun.error}
            workflowSlug={workflow.slug}
            stepType={stepDef.type}
          />
        );
      })}

      {/* Walk Through Evaluation button (meta-ads-analysis only, after fetch completes) */}
      {workflow.slug === "meta-ads-analysis" &&
        currentRun &&
        currentRun.steps?.some(
          (s) => s.stepId === "fetch" && s.status === "completed",
        ) && (
          <button
            onClick={() => setEvaluationMode(true)}
            className="flex items-center gap-2 rounded-md border border-gold/20 bg-gold/5 px-4 py-2.5 text-sm font-medium text-gold transition-colors hover:bg-gold/10"
          >
            <ClipboardCheck className="h-4 w-4" />
            Walk Through Evaluation
          </button>
        )}

      {/* Action Items */}
      {currentRun && currentRun.actionItems?.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium">Action Items</h2>
          <ActionItems
            items={currentRun.actionItems}
            onToggle={handleToggleAction}
          />
        </div>
      )}

      {/* Run History */}
      <RunHistory
        runs={runs}
        workflowSlug={workflow.slug}
        onSelectRun={loadRunDetail}
        onDeleteRun={async (runId) => {
          await fetch(`/api/workflows/${workflow.slug}/runs/${runId}`, {
            method: "DELETE",
          });
          if (selectedRunId === runId) {
            setCurrentRun(null);
            setSelectedRunId(undefined);
          }
          await loadRuns();
        }}
        selectedRunId={selectedRunId}
      />
    </div>
  );
}
