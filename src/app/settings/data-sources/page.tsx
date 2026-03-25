"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  StaggerContainer,
  StaggerItem,
} from "@/components/motion/page-transition";
import { Database, RefreshCw } from "lucide-react";

type DataSourceStatus = {
  name: string;
  description: string;
  status: "connected" | "error" | "not_configured";
  latencyMs?: number;
  error?: string;
  lastChecked: string | null;
};

type DataSourcesResponse = {
  sources: DataSourceStatus[];
};

function StatusBadge({ status }: { status: DataSourceStatus["status"] }) {
  if (status === "connected") {
    return <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">Connected</Badge>;
  }
  if (status === "error") {
    return <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">Error</Badge>;
  }
  return <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">Not Configured</Badge>;
}

export default function DataSourcesPage() {
  const [data, setData] = useState<DataSourcesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/data-sources")
      .then((res) => res.json())
      .then((result) => { if (!cancelled) setData(result); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function handleRefresh() {
    setRefreshing(true);
    fetch("/api/data-sources")
      .then((res) => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setRefreshing(false));
  }

  return (
    <StaggerContainer>
      <StaggerItem>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Data Sources
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Connection status for all data integrations
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Test Connections
          </button>
        </div>
      </StaggerItem>

      <div className="grid gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <StaggerItem key={i}>
                <Card className="animate-pulse">
                  <CardContent className="py-6">
                    <div className="h-5 w-32 rounded bg-muted" />
                  </CardContent>
                </Card>
              </StaggerItem>
            ))
          : data?.sources.map((source) => (
              <StaggerItem key={source.name}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base font-medium">
                        {source.name}
                      </CardTitle>
                    </div>
                    <StatusBadge status={source.status} />
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {source.description}
                    </p>
                    {source.latencyMs != null && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Latency: {source.latencyMs}ms
                      </p>
                    )}
                    {source.error && (
                      <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 p-3">
                        <p className="text-xs font-medium text-destructive">Error</p>
                        <p className="mt-1 font-mono text-xs text-destructive/80">
                          {source.error}
                        </p>
                      </div>
                    )}
                    {source.lastChecked && (
                      <p className="mt-2 text-xs text-muted-foreground/60">
                        Last checked: {new Date(source.lastChecked).toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
      </div>

      <StaggerItem>
        <Card className="mt-8 border-dashed">
          <CardContent className="py-6">
            <h3 className="text-sm font-medium">Troubleshooting</h3>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>
                <strong>BigQuery &quot;not configured&quot;</strong> - Set <code className="rounded bg-muted px-1">GOOGLE_APPLICATION_CREDENTIALS</code> env var to the service account JSON path, and <code className="rounded bg-muted px-1">BIGQUERY_PROJECT_ID</code> to the GCP project.
              </li>
              <li>
                <strong>BigQuery &quot;permission denied&quot;</strong> - The service account needs <code className="rounded bg-muted px-1">roles/bigquery.user</code> and <code className="rounded bg-muted px-1">roles/bigquery.dataViewer</code> on the <code className="rounded bg-muted px-1">tds_sales</code> dataset.
              </li>
              <li>
                <strong>BigQuery &quot;view not found&quot;</strong> - Verify <code className="rounded bg-muted px-1">vw_sle_active_orders</code> and <code className="rounded bg-muted px-1">customer_first_order</code> views exist in the dataset.
              </li>
            </ul>
          </CardContent>
        </Card>
      </StaggerItem>
    </StaggerContainer>
  );
}
