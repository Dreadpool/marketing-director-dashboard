"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Check,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  StaggerContainer,
  StaggerItem,
} from "@/components/motion/page-transition";

interface CalendarWorkflow {
  slug: string;
  title: string;
  cadence: string;
  isDue: boolean;
  nextDueDate: string | null;
  lastCompletedAt: string | null;
  lastPeriod: { year: number; month: number } | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function CalendarPage() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [workflows, setWorkflows] = useState<CalendarWorkflow[]>([]);

  useEffect(() => {
    fetch("/api/workflows/calendar")
      .then((res) => res.json())
      .then((data) => setWorkflows(data.workflows ?? []))
      .catch(console.error);
  }, []);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const days: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  // Find workflows due on the 1st of the viewed month
  const dueOnFirst = workflows.filter((w) => {
    if (!w.nextDueDate) return false;
    const due = new Date(w.nextDueDate);
    return due.getFullYear() === viewYear && due.getMonth() === viewMonth;
  });

  // Check if any are overdue (due date is in the past)
  const overdueWorkflows = workflows.filter((w) => {
    if (!w.nextDueDate) return false;
    return new Date(w.nextDueDate) < now && w.isDue;
  });

  return (
    <StaggerContainer>
      <StaggerItem>
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Calendar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upcoming and due workflow analyses
          </p>
        </div>
      </StaggerItem>

      {/* Overdue warnings */}
      {overdueWorkflows.length > 0 && (
        <StaggerItem>
          <Card className="mb-4 border-red-500/30">
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
        </StaggerItem>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Calendar grid */}
        <StaggerItem>
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
                  {MONTH_NAMES[viewMonth]} {viewYear}
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
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <div
                      key={day}
                      className="pb-2 text-center text-[10px] font-medium text-muted-foreground"
                    >
                      {day}
                    </div>
                  ),
                )}
                {days.map((day, i) => {
                  const isToday =
                    day === now.getDate() &&
                    viewMonth === now.getMonth() &&
                    viewYear === now.getFullYear();
                  const isFirst = day === 1;
                  const hasDue = isFirst && dueOnFirst.length > 0;

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
                          {hasDue && (
                            <div className="mt-1 space-y-0.5">
                              {dueOnFirst.map((w) => (
                                <Link
                                  key={w.slug}
                                  href={`/workflows/${w.slug}`}
                                  className="block truncate rounded bg-gold/10 px-1 py-0.5 text-[9px] text-gold transition-colors hover:bg-gold/20"
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
        </StaggerItem>

        {/* Sidebar: upcoming workflows */}
        <StaggerItem>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Upcoming Workflows
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {workflows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active workflows configured.
                </p>
              ) : (
                workflows.map((w) => (
                  <Link
                    key={w.slug}
                    href={`/workflows/${w.slug}`}
                    className="block rounded-md border border-border p-3 transition-colors hover:border-gold/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{w.title}</span>
                      {w.isDue ? (
                        <Badge
                          variant="outline"
                          className="border-gold/20 text-[10px] text-gold"
                        >
                          Due
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/20 text-[10px] text-emerald-400"
                        >
                          Done
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      {w.isDue ? (
                        <>
                          <Clock className="h-2.5 w-2.5" />
                          <span>{w.cadence}</span>
                        </>
                      ) : w.lastPeriod ? (
                        <>
                          <Check className="h-2.5 w-2.5" />
                          <span>
                            {MONTH_ABBR[w.lastPeriod.month - 1]}{" "}
                            {w.lastPeriod.year}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </StaggerItem>
      </div>
    </StaggerContainer>
  );
}
