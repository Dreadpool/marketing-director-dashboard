"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ActionItem {
  id: string;
  text: string;
  priority: string | null;
  category: string | null;
  completed: boolean;
}

interface ActionItemsProps {
  items: ActionItem[];
  onToggle: (id: string, completed: boolean) => void;
}

const priorityColors: Record<string, string> = {
  high: "bg-red-500/10 text-red-400 border-red-500/20",
  medium: "bg-gold/10 text-gold border-gold/20",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export function ActionItems({ items, onToggle }: ActionItemsProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "flex items-start gap-3 rounded-md border border-border p-3 transition-colors",
            item.completed && "opacity-50",
          )}
        >
          <button
            onClick={() => onToggle(item.id, !item.completed)}
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
                item.completed && "line-through text-muted-foreground",
              )}
            >
              {item.text}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
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
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
