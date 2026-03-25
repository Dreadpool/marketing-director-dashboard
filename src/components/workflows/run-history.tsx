"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Run {
  id: string;
  periodYear: number;
  periodMonth: number;
  status: string;
  startedAt: string;
  completedAt: string | null;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface RunHistoryProps {
  runs: Run[];
  onSelectRun: (runId: string) => void;
  selectedRunId?: string;
}

export function RunHistory({
  runs,
  onSelectRun,
  selectedRunId,
}: RunHistoryProps) {
  if (runs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Run History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No runs yet. Select a period and click &quot;Run Analysis&quot; to
            get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Run History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {runs.map((run) => {
          const duration =
            run.completedAt && run.startedAt
              ? Math.round(
                  (new Date(run.completedAt).getTime() -
                    new Date(run.startedAt).getTime()) /
                    1000,
                )
              : null;

          return (
            <button
              key={run.id}
              onClick={() => onSelectRun(run.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                selectedRunId === run.id && "bg-accent",
              )}
            >
              <div className="flex items-center gap-2">
                {run.status === "completed" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : run.status === "failed" ? (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-gold" />
                )}
                <span>
                  {MONTH_NAMES[run.periodMonth - 1]} {run.periodYear}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {duration !== null && (
                  <span className="text-xs text-muted-foreground">
                    {duration >= 60
                      ? `${Math.floor(duration / 60)}m ${duration % 60}s`
                      : `${duration}s`}
                  </span>
                )}
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px]",
                    run.status === "completed" &&
                      "bg-emerald-500/10 text-emerald-400",
                    run.status === "failed" &&
                      "bg-destructive/10 text-destructive",
                    run.status === "running" && "bg-gold/10 text-gold",
                  )}
                >
                  {run.status}
                </Badge>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
