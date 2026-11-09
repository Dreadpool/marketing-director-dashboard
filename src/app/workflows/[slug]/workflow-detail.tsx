"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, BookOpen } from "lucide-react";
import { PeriodSelector } from "@/components/workflows/period-selector";
import { StepResult } from "@/components/workflows/step-result";
import { RunHistory } from "@/components/workflows/run-history";
import { formatCadence, getCurrentDuePeriod } from "@/lib/workflows/cadence";
import type { Workflow } from "@/lib/workflows";
import { latestPeriodRun, getDataRetrievedAt } from "@/lib/workflows/saved-data";

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
  inputParams?: Record<string, unknown>;
}

interface WorkflowDetailProps {
  workflow: Workflow;
}

export function WorkflowDetail({ workflow }: WorkflowDetailProps) {
  const duePeriod = getCurrentDuePeriod(workflow);
  const now = new Date();
  const [year, setYear] = useState(duePeriod?.year ?? now.getFullYear());
  const [month, setMonth] = useState(duePeriod?.month ?? now.getMonth() + 1);
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentRun, setCurrentRun] = useState<RunDetail | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runsLoaded, setRunsLoaded] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const activeRunId = selectedRunId ?? latestPeriodRun(runs, year, month)?.id;
  const visibleRun = currentRun?.id === activeRunId ? currentRun : null;
  const running = posting || (visibleRun?.status === "running" && !error);
  const retrievedAt = getDataRetrievedAt(visibleRun?.steps?.find((s) => s.stepId === "fetch")?.outputData);
  const monthName = new Date(year, month - 1).toLocaleString("en-US", { month: "long" });

  const loadRuns = useCallback(async () => {
    const res = await fetch(`/api/workflows/${workflow.slug}/runs`);
    if (!res.ok) throw new Error("Could not load saved data. Try again.");
    const data = await res.json();
    setRuns(data.runs ?? []);
    setRunsLoaded(true);
  }, [workflow.slug]);

  useEffect(() => {
    loadRuns().catch((err) => { setError(err.message); setLoading(false); });
  }, [loadRuns]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setCurrentRun(null);
    setLoading(!!activeRunId || !runsLoaded);
    if (!activeRunId) return () => controller.abort();

    async function read() {
      try {
        const res = await fetch(`/api/workflows/${workflow.slug}/runs/${activeRunId}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Could not load this report. Try again.");
        const detail: RunDetail = await res.json();
        if (controller.signal.aborted) return;
        setCurrentRun(detail);
        setLoading(false);
        if (detail.status === "running") {
          timer = setTimeout(read, 2000);
        } else {
          await loadRuns();
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setLoading(false);
        setError(err instanceof Error ? err.message : "Could not load data.");
      }
    }
    read();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [activeRunId, runsLoaded, workflow.slug, loadRuns]);

  async function handleRun() {
    setPosting(true);
    setError(null);
    try {
      const bodyPayload: Record<string, unknown> = { period: { year, month } };
      const res = await fetch(`/api/workflows/${workflow.slug}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not retrieve data. Try again.");
      setLoading(true);
      setSelectedRunId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not retrieve data.");
    } finally {
      setPosting(false);
    }
  }

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
      <div>
          <div className="flex flex-wrap items-center gap-3">
            <PeriodSelector
              year={year}
              month={month}
              onChange={(y, m) => {
                setSelectedRunId(undefined);
                setError(null);
                setYear(y);
                setMonth(m);
              }}
              disabled={running}
            />
            <button
              onClick={handleRun}
              disabled={running || loading || workflow.status !== "active"}
              className="flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-medium text-gold-foreground transition-colors hover:bg-gold/90 disabled:opacity-50"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {running ? "Retrieving data…" : loading ? "Loading…" : visibleRun ? "Update data" : `Load ${monthName} data`}
            </button>

          </div>
      </div>

      <div role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {loading ? "Loading saved data…" : running ? "Retrieving source data…" : retrievedAt ? (
          <>Data retrieved <time dateTime={retrievedAt}>{new Date(retrievedAt).toLocaleString()}</time></>
        ) : !visibleRun ? `No saved data for ${monthName} ${year}.` : null}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {/* Step Results */}
      {visibleRun?.steps?.map((stepRun) => {
        const stepDef = workflow.steps.find((s) => s.id === stepRun.stepId);
        if (!stepDef) return null;

        return (
          <StepResult
            key={stepRun.id}
            label={stepDef.label}
            status={stepRun.status}
            outputData={stepRun.outputData}
            error={stepRun.error}
          />
        );
      })}

      {/* Run History */}
      <RunHistory
        runs={runs}
        onSelectRun={(runId) => {
          if (running) return;
          const run = runs.find((r) => r.id === runId);
          if (!run) return;
          setYear(run.periodYear);
          setMonth(run.periodMonth);
          setSelectedRunId(runId);
          setError(null);
        }}
        onDeleteRun={async (runId) => {
          if (!window.confirm("Delete this run and its data?")) return;
          try {
            const res = await fetch(`/api/workflows/${workflow.slug}/runs/${runId}`, {
              method: "DELETE",
            });
            if (!res.ok) {
              console.error("Failed to delete run:", await res.text());
              return;
            }
            if (activeRunId === runId) {
              setCurrentRun(null);
              setSelectedRunId(undefined);
            }
            await loadRuns();
          } catch (err) {
            console.error("Failed to delete run:", err);
          }
        }}
        selectedRunId={activeRunId}
      />
    </div>
  );
}
