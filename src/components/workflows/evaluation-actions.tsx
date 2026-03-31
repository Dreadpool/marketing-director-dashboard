// src/components/workflows/evaluation-actions.tsx

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvaluationActionItem } from "@/lib/workflows/evaluations/types";

const priorityColors: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

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

interface EvaluationActionsProps {
  items: EvaluationActionItem[];
  onChange: (items: EvaluationActionItem[]) => void;
  stepId: string;
}

export function EvaluationActions({
  items,
  onChange,
  stepId,
}: EvaluationActionsProps) {
  const [newText, setNewText] = useState("");

  function handleAdd() {
    if (!newText.trim()) return;
    onChange([
      ...items,
      {
        text: newText.trim(),
        priority: "medium",
        owner: "agency",
        stepId,
      },
    ]);
    setNewText("");
  }

  function handleRemove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function handleTextChange(index: number, text: string) {
    const updated = [...items];
    updated[index] = { ...updated[index], text };
    onChange(updated);
  }

  function handlePriorityChange(
    index: number,
    priority: EvaluationActionItem["priority"],
  ) {
    const updated = [...items];
    updated[index] = { ...updated[index], priority };
    onChange(updated);
  }

  function handleOwnerChange(
    index: number,
    owner: EvaluationActionItem["owner"],
  ) {
    const updated = [...items];
    updated[index] = { ...updated[index], owner };
    onChange(updated);
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={`${item.stepId}-${i}`}
          className="rounded-md border border-border p-3 space-y-2"
        >
          <div className="flex items-start gap-2">
            <textarea
              value={item.text}
              onChange={(e) => handleTextChange(i, e.target.value)}
              rows={2}
              className="flex-1 resize-none rounded-md bg-muted/50 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
            />
            <button
              onClick={() => handleRemove(i)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Priority selector */}
            <div className="flex gap-1">
              {(["critical", "high", "medium"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePriorityChange(i, p)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] uppercase transition-colors",
                    item.priority === p
                      ? priorityColors[p]
                      : "border-border text-muted-foreground/50 hover:text-muted-foreground",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="h-3 w-px bg-border" />
            {/* Owner selector */}
            <div className="flex gap-1">
              {(["agency", "director", "joint"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => handleOwnerChange(i, o)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                    item.owner === o
                      ? ownerColors[o]
                      : "border-border text-muted-foreground/50 hover:text-muted-foreground",
                  )}
                >
                  {ownerLabels[o]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Add new item */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="Add action item..."
          className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-gold/50"
        />
        <button
          onClick={handleAdd}
          disabled={!newText.trim()}
          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Read-only display for summary view ─────────────────────────────────────

export function EvaluationActionsReadonly({
  items,
}: {
  items: EvaluationActionItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={`${item.stepId}-${i}`}
          className="flex items-start gap-3 rounded-md border border-border p-3"
        >
          <div className="flex-1">
            <p className="text-sm">{item.text}</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn("text-[10px] uppercase", priorityColors[item.priority])}
              >
                {item.priority}
              </Badge>
              <Badge
                variant="outline"
                className={cn("text-[10px]", ownerColors[item.owner])}
              >
                {ownerLabels[item.owner]}
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
