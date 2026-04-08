"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Check,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarWorkflow {
  slug: string;
  title: string;
  cadence: string;
  status: "due" | "completed" | "coming-soon" | "on-demand";
  duePeriod: { year: number; month: number } | null;
  dueDate: string | null;
  viewDueDate?: string | null;
  viewPeriod?: { year: number; month: number } | null;
  viewSatisfied?: boolean;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function WorkflowCalendar() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [workflows, setWorkflows] = useState<CalendarWorkflow[]>([]);

  const fetchData = useCallback(() => {
    fetch(`/api/workflows/calendar?year=${viewYear}&month=${viewMonth}`)
      .then((res) => res.json())
      .then((data) => setWorkflows(data.workflows ?? []))
      .catch(console.error);
  }, [viewYear, viewMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function prevMonth() {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const days: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const dueDateMap: Record<number, CalendarWorkflow[]> = {};
  for (const w of workflows) {
    if (!w.viewDueDate) continue;
    const d = new Date(w.viewDueDate);
    if (d.getFullYear() === viewYear && d.getMonth() + 1 === viewMonth) {
      const day = d.getDate();
      if (!dueDateMap[day]) dueDateMap[day] = [];
      dueDateMap[day].push(w);
    }
  }

  const agendaDays = Object.keys(dueDateMap)
    .map(Number)
    .sort((a, b) => a - b);

  const overdueWorkflows = workflows.filter((w) => {
    if (!w.dueDate || w.status !== "due") return false;
    return new Date(w.dueDate) < now;
  });

  return (
    <div className="space-y-4">
      {overdueWorkflows.length > 0 && (
        <Card className="border-red-500/30">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4" />
              <span>
                {overdueWorkflows.length} overdue workflow
                {overdueWorkflows.length > 1 ? "s" : ""}:{" "}
                {overdueWorkflows.map((w) => w.title).join(", ")}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <button
              onClick={prevMonth}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <CardTitle className="text-sm font-medium">
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </CardTitle>
            <button
              onClick={nextMonth}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="pb-2 text-center text-[10px] font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {days.map((day, i) => {
              const isToday =
                day === now.getDate() &&
                viewMonth === now.getMonth() + 1 &&
                viewYear === now.getFullYear();
              const dayWorkflows = day ? dueDateMap[day] ?? [] : [];

              return (
                <div
                  key={i}
                  className={cn(
                    "flex min-h-[60px] flex-col rounded-md p-1.5",
                    day && "border border-border/50",
                    isToday && "border-gold/30 bg-gold/5",
                  )}
                >
                  {day && (
                    <>
                      <span
                        className={cn(
                          "text-xs",
                          isToday
                            ? "font-medium text-gold"
                            : "text-muted-foreground",
                        )}
                      >
                        {day}
                      </span>
                      {dayWorkflows.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {dayWorkflows.map((w) => (
                            <Link
                              key={w.slug}
                              href={`/workflows/${w.slug}`}
                              className={cn(
                                "block truncate rounded px-1 py-0.5 text-[9px] transition-colors",
                                w.viewSatisfied
                                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                  : "bg-gold/10 text-gold hover:bg-gold/20",
                              )}
                            >
                              {w.title}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {MONTH_NAMES[viewMonth - 1]} Agenda
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agendaDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No workflows due this month.
            </p>
          ) : (
            <div className="space-y-4">
              {agendaDays.map((day) => {
                const dayWorkflows = dueDateMap[day];
                const dateStr = `${MONTH_ABBR[viewMonth - 1]} ${day}`;
                const dayOfWeek = new Date(
                  viewYear,
                  viewMonth - 1,
                  day,
                ).toLocaleDateString("en-US", { weekday: "short" });

                return (
                  <div key={day} className="flex gap-4">
                    <div className="w-16 shrink-0 pt-0.5">
                      <div className="text-xs font-medium text-foreground">
                        {dateStr}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {dayOfWeek}
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 border-l border-border/50 pl-4">
                      {dayWorkflows.map((w) => (
                        <Link
                          key={w.slug}
                          href={`/workflows/${w.slug}`}
                          className="flex items-center justify-between rounded-md border border-border p-2.5 transition-colors hover:border-gold/30"
                        >
                          <div className="flex items-center gap-2">
                            {w.viewSatisfied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-gold" />
                            )}
                            <span className="text-sm font-medium">
                              {w.title}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              w.viewSatisfied
                                ? "border-emerald-500/20 text-emerald-400"
                                : "border-gold/20 text-gold",
                            )}
                          >
                            {w.viewSatisfied ? "Done" : "Due"}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
