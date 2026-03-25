"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  StaggerContainer,
  StaggerItem,
} from "@/components/motion/page-transition";

interface ActionItem {
  id: string;
  runId: string;
  stepId: string;
  workflowSlug: string;
  periodYear: number;
  periodMonth: number;
  text: string;
  priority: string | null;
  category: string | null;
  completed: boolean;
}

const priorityColors: Record<string, string> = {
  high: "bg-red-500/10 text-red-400 border-red-500/20",
  medium: "bg-gold/10 text-gold border-gold/20",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function ActionItemsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [filter, setFilter] = useState<"open" | "completed" | "all">("open");

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter === "open") params.set("completed", "false");
    if (filter === "completed") params.set("completed", "true");

    fetch(`/api/action-items?${params}`)
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []))
      .catch(console.error);
  }, [filter]);

  async function toggleItem(id: string, completed: boolean) {
    try {
      await fetch("/api/action-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, completed }),
      });
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, completed } : item)),
      );
    } catch (err) {
      console.error("Failed to toggle:", err);
    }
  }

  return (
    <StaggerContainer>
      <StaggerItem>
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Action Items
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tasks generated from workflow analyses
          </p>
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="mb-4 flex gap-1">
          {(["open", "completed", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f
                  ? "bg-gold/10 text-gold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </StaggerItem>

      {items.length === 0 ? (
        <StaggerItem>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <CheckSquare className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {filter === "open"
                  ? "No open action items. Run a workflow to generate recommendations."
                  : "No action items found."}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>
      ) : (
        <StaggerItem>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {items.length} {filter === "all" ? "" : filter} item
                {items.length !== 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 rounded-md border border-border p-3 transition-colors",
                    item.completed && "opacity-50",
                  )}
                >
                  <button
                    onClick={() => toggleItem(item.id, !item.completed)}
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                      item.completed
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                        : "border-muted-foreground/30 hover:border-gold",
                    )}
                  >
                    {item.completed && (
                      <svg
                        className="h-2.5 w-2.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1">
                    <p
                      className={cn(
                        "text-sm",
                        item.completed &&
                          "line-through text-muted-foreground",
                      )}
                    >
                      {item.text}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {item.priority && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] uppercase",
                            priorityColors[item.priority],
                          )}
                        >
                          {item.priority}
                        </Badge>
                      )}
                      {item.category && (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-muted-foreground"
                        >
                          {item.category}
                        </Badge>
                      )}
                      <Link
                        href={`/workflows/${item.workflowSlug}?run=${item.runId}&step=${item.stepId}`}
                        className="text-[10px] text-gold/70 transition-colors hover:text-gold"
                      >
                        {MONTH_NAMES[item.periodMonth - 1]}{" "}
                        {item.periodYear} analysis
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </StaggerItem>
      )}
    </StaggerContainer>
  );
}
