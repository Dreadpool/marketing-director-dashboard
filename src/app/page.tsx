"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportResponse } from "@/lib/types/mmc-report";
import KpiCards from "@/components/dashboard/kpi-cards";
import RouteTable from "@/components/dashboard/route-table";
import WorkflowCalendar from "@/components/dashboard/workflow-calendar";

export default function DashboardPage() {
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch("/api/mmc-report/months")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load months");
        return r.json();
      })
      .then((data) => {
        setMonths(data.months || []);
        const latest = data.latest || data.months?.[data.months.length - 1] || "";
        setSelectedMonth(latest);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedMonth) return;
    setLoading(true);
    setError(null);
    fetch(`/api/mmc-report?month=${selectedMonth}`)
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || "Failed to load report"); });
        return r.json();
      })
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setReport(null);
        setLoading(false);
      });
  }, [selectedMonth]);

  async function handleRefresh() {
    if (!selectedMonth || refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      const r = await fetch(`/api/mmc-report/refresh?month=${selectedMonth}`, { method: "POST" });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || "Failed to refresh");
      }
      const data = await r.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-heading text-lg font-semibold tracking-tight">
            Route Revenue
          </h1>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            disabled={loading}
            className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground font-sans focus:outline-none focus:border-ring disabled:opacity-50"
          >
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading || !selectedMonth}
            className="text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
            title="Re-fetch data from source"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-4">
                  <Skeleton className="h-3 w-20 mb-2" />
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="py-8">
              <Skeleton className="h-4 w-48 mx-auto" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Report */}
      {report && !loading && (
        <div className="space-y-4">
          <KpiCards summary={report.summary} />
          <details className="bg-card border border-border rounded-lg">
            <summary className="px-4 py-3 text-sm text-muted-foreground cursor-pointer hover:text-foreground">
              Route Details ({report.routes.length} routes)
            </summary>
            <div className="p-0">
              <RouteTable routes={report.routes} />
            </div>
          </details>
        </div>
      )}

      {/* Workflow Calendar */}
      <WorkflowCalendar />
    </div>
  );
}
