"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone,
  Search,
  TrendingUp,
  Calendar,
  Mail,
  Palette,
  ImageIcon,
  Ticket,
} from "lucide-react";
import { workflows } from "@/lib/workflows";
import { formatCadence } from "@/lib/workflows/cadence";
import {
  StaggerContainer,
  StaggerItem,
} from "@/components/motion/page-transition";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ElementType> = {
  megaphone: Megaphone,
  search: Search,
  "trending-up": TrendingUp,
  calendar: Calendar,
  mail: Mail,
  palette: Palette,
  image: ImageIcon,
  ticket: Ticket,
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface CalendarWorkflow {
  slug: string;
  status: "due" | "completed" | "coming-soon" | "on-demand";
  duePeriod: { year: number; month: number } | null;
  dueDate: string | null;
  cadence: string;
}

export default function WorkflowsPage() {
  const [calendarData, setCalendarData] = useState<
    Record<string, CalendarWorkflow>
  >({});

  useEffect(() => {
    fetch("/api/workflows/calendar")
      .then((res) => res.json())
      .then((data) => {
        const map: Record<string, CalendarWorkflow> = {};
        for (const w of data.workflows ?? []) {
          map[w.slug] = w;
        }
        setCalendarData(map);
      })
      .catch(console.error);
  }, []);

  return (
    <StaggerContainer>
      <StaggerItem>
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Workflows
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recurring marketing analysis workflows
          </p>
        </div>
      </StaggerItem>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workflows.map((workflow) => {
          const Icon = iconMap[workflow.icon] ?? Calendar;
          const cal = calendarData[workflow.slug];

          let statusLabel = "Coming Soon";
          let statusStyle = "";

          if (cal) {
            if (cal.status === "due" && cal.duePeriod) {
              statusLabel = `Due ${MONTH_NAMES[cal.duePeriod.month - 1]} ${cal.duePeriod.year}`;
              statusStyle = "bg-gold/10 text-gold border-gold/20";
            } else if (cal.status === "completed" && cal.duePeriod) {
              statusLabel = `Completed ${MONTH_NAMES[cal.duePeriod.month - 1]} ${cal.duePeriod.year}`;
              statusStyle =
                "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            } else if (cal.status === "on-demand") {
              statusLabel = "On Demand";
            }
          }

          return (
            <StaggerItem key={workflow.slug}>
              <Link href={`/workflows/${workflow.slug}`}>
                <Card
                  className={cn(
                    "group h-full cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gold/5",
                    cal?.status === "due" && "border-gold/30",
                  )}
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gold/10">
                        <Icon className="h-4 w-4 text-gold" />
                      </div>
                      <CardTitle className="text-sm font-medium leading-tight">
                        {workflow.title}
                      </CardTitle>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge
                        variant={
                          workflow.status === "active" ? "outline" : "secondary"
                        }
                        className={cn(
                          "text-[10px] uppercase tracking-wider",
                          statusStyle,
                        )}
                      >
                        {statusLabel}
                      </Badge>
                      {workflow.status === "active" && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatCadence(workflow.cadence)}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {workflow.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          );
        })}
      </div>
    </StaggerContainer>
  );
}
