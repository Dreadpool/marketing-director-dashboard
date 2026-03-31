"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PromptEditor } from "./prompt-editor";
import { FetchStepSummary } from "./fetch-step-summary";

interface StepResultProps {
  stepId: string;
  label: string;
  status: string;
  aiOutput: string | null;
  outputData: unknown;
  error: string | null;
  workflowSlug: string;
  stepType: string;
}

export function StepResult({
  stepId,
  label,
  status,
  aiOutput,
  outputData,
  error,
  workflowSlug,
  stepType,
}: StepResultProps) {
  const [expanded, setExpanded] = useState(status === "completed");

  const statusColor =
    status === "completed"
      ? "bg-emerald-500/10 text-emerald-400"
      : status === "failed"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <CardTitle className="text-sm font-medium">{label}</CardTitle>
          </div>
          <Badge variant="secondary" className={cn("text-[10px]", statusColor)}>
            {status}
          </Badge>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {stepType === "fetch" && outputData != null ? (
            <FetchStepSummary data={outputData} />
          ) : null}
          {aiOutput && (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {aiOutput}
              </ReactMarkdown>
            </div>
          )}
          {stepType !== "fetch" && (
            <PromptEditor workflowSlug={workflowSlug} stepId={stepId} />
          )}
        </CardContent>
      )}
    </Card>
  );
}
