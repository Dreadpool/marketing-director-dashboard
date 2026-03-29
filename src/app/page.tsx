"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Users, Megaphone, TrendingUp, BarChart3 } from "lucide-react";
import {
  StaggerContainer,
  StaggerItem,
} from "@/components/motion/page-transition";
import type { DashboardMetrics } from "@/lib/schemas";
import { formatUSD } from "@/lib/schemas";
import { useEffect, useState } from "react";

function buildMetrics(data: DashboardMetrics | null) {
  if (!data) {
    return [
      { title: "Gross Bookings", value: "--", icon: DollarSign, description: "Total monthly bookings" },
      { title: "New Customers", value: "--", icon: Users, description: "First-time purchasers" },
      { title: "Ad Spend", value: "--", icon: Megaphone, description: "Combined Meta + Google" },
      { title: "ROAS", value: "--", icon: TrendingUp, description: "Return on ad spend" },
    ];
  }

  const roas = data.efficiency.roas[0];

  return [
    {
      title: "Gross Bookings",
      value: formatUSD(data.revenue.actual.amount),
      icon: DollarSign,
      description: `${data.revenue.totalOrders.toLocaleString()} orders, ${formatUSD(data.revenue.avgOrderValue)} avg`,
    },
    {
      title: "New Customers",
      value: data.customers.new.toLocaleString(),
      icon: Users,
      description: `${data.customers.returning.toLocaleString()} returning, ${formatUSD(data.customers.newAvgRevenue)} avg revenue`,
    },
    {
      title: "Ad Spend",
      value: formatUSD(data.adSpend.total),
      icon: Megaphone,
      description: data.adSpend.total > 0
        ? `CAC: ${formatUSD(data.efficiency.cac.value)}`
        : "No ad spend data",
    },
    {
      title: "ROAS",
      value: roas ? `${roas.value.toFixed(1)}x` : "--",
      icon: TrendingUp,
      description: roas
        ? `${formatUSD(roas.revenue)} revenue / ${formatUSD(roas.spend)} spend`
        : "Return on ad spend",
    },
  ];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
        return res.json();
      })
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const metrics = buildMetrics(data);

  return (
    <StaggerContainer>
      <StaggerItem>
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your marketing command center
          </p>
        </div>
      </StaggerItem>

      {error && (
        <StaggerItem>
          <Card className="mb-4 border-destructive/50 bg-destructive/5">
            <CardContent className="py-3">
              <p className="text-sm text-destructive">
                Failed to load metrics: {error}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <StaggerItem key={metric.title}>
              <Card className="group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gold/5">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {metric.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-gold" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="mt-2 h-3 w-36" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-semibold tracking-tight">
                        {metric.value}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {metric.description}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>
          );
        })}
      </div>

      <StaggerItem>
        <Card className="mt-8 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-gold/10 p-3">
              <BarChart3 className="h-6 w-6 text-gold" />
            </div>
            <p className="text-sm font-medium">
              Workflow insights will appear here
            </p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Run your first workflow from the{" "}
              <a href="/workflows" className="text-gold transition-colors hover:text-gold/80">
                Workflows
              </a>{" "}
              page to see analysis results and trends.
            </p>
          </CardContent>
        </Card>
      </StaggerItem>
    </StaggerContainer>
  );
}
