import type { DataSource } from "@/lib/schemas/types";
import type { WorkflowCadence, WorkflowStepDef } from "./workflows/types";

export interface Workflow {
  slug: string;
  title: string;
  description: string;
  icon: string;
  status: "coming-soon" | "active";
  cadence: WorkflowCadence;
  dataSources: DataSource[];
  steps: WorkflowStepDef[];
}

export const workflows: Workflow[] = [
  {
    slug: "meta-ads-analysis",
    title: "Meta Ads Analysis",
    description:
      "Campaign performance diagnostics, creative fatigue detection, audience insights, and prioritized action items.",
    icon: "megaphone",
    status: "coming-soon",
    cadence: "monthly",
    dataSources: ["meta_ads"],
    steps: [
      {
        id: "fetch",
        label: "Fetch Data",
        description: "Pull campaign data from Meta Ads API",
        type: "fetch",
        dataSources: ["meta_ads"],
      },
      {
        id: "analyze",
        label: "Initial Analysis",
        description:
          "Campaign performance, creative metrics, audience efficiency",
        type: "analyze",
      },
      {
        id: "explore",
        label: "Deep Exploration",
        description: "Creative fatigue detection, audience overlap, spend efficiency",
        type: "explore",
      },
      {
        id: "recommend",
        label: "Recommendations",
        description: "Prioritized action items for Meta campaigns",
        type: "recommend",
      },
    ],
  },
  {
    slug: "google-ads-analysis",
    title: "Google Ads Analysis",
    description:
      "Campaign spend summaries, search terms, geographic performance, and CAC calculations.",
    icon: "search",
    status: "coming-soon",
    cadence: "monthly",
    dataSources: ["google_ads", "bigquery"],
    steps: [
      {
        id: "fetch",
        label: "Fetch Data",
        description: "Pull campaign data from Google Ads API + BigQuery",
        type: "fetch",
        dataSources: ["google_ads", "bigquery"],
      },
      {
        id: "analyze",
        label: "Initial Analysis",
        description: "Spend summaries, search terms, geographic performance",
        type: "analyze",
      },
      {
        id: "explore",
        label: "Deep Exploration",
        description: "Keyword efficiency, geo targeting, daily trends",
        type: "explore",
      },
      {
        id: "recommend",
        label: "Recommendations",
        description: "Prioritized action items for Google campaigns",
        type: "recommend",
      },
    ],
  },
  {
    slug: "bigquery-sales-analysis",
    title: "BigQuery Sales Analysis",
    description:
      "Revenue calculations, customer segmentation, trip analysis, and payment breakdowns.",
    icon: "database",
    status: "coming-soon",
    cadence: "monthly",
    dataSources: ["bigquery"],
    steps: [
      {
        id: "fetch",
        label: "Fetch Data",
        description: "Pull sales and customer data from BigQuery",
        type: "fetch",
        dataSources: ["bigquery"],
      },
      {
        id: "analyze",
        label: "Initial Analysis",
        description: "Revenue, orders, customer segmentation, payment methods",
        type: "analyze",
      },
      {
        id: "explore",
        label: "Deep Exploration",
        description: "Route analysis, LTV patterns, payment trends",
        type: "explore",
      },
      {
        id: "recommend",
        label: "Recommendations",
        description: "Revenue optimization and customer retention actions",
        type: "recommend",
      },
    ],
  },
  {
    slug: "seo-ranking-analysis",
    title: "SEO Ranking Analysis",
    description:
      "Keyword rank tracking, visibility scoring, tier distribution, and biggest movers across websites.",
    icon: "trending-up",
    status: "coming-soon",
    cadence: "monthly",
    dataSources: ["google_sheets"],
    steps: [
      {
        id: "fetch",
        label: "Fetch Data",
        description: "Pull keyword rankings from Google Sheets",
        type: "fetch",
        dataSources: ["google_sheets"],
      },
      {
        id: "analyze",
        label: "Initial Analysis",
        description: "Visibility scoring, tier distribution, rank changes",
        type: "analyze",
      },
      {
        id: "explore",
        label: "Deep Exploration",
        description: "Biggest movers, cross-site patterns, competitive gaps",
        type: "explore",
      },
      {
        id: "recommend",
        label: "Recommendations",
        description: "SEO priorities and content opportunities",
        type: "recommend",
      },
    ],
  },
  {
    slug: "monthly-analytics-review",
    title: "Monthly Analytics Review",
    description:
      "Unified monthly report combining all sources: revenue, customers, CAC, payment analysis, and promo codes.",
    icon: "calendar",
    status: "active",
    cadence: "monthly",
    dataSources: ["bigquery", "meta_ads", "google_ads"],
    steps: [
      {
        id: "fetch",
        label: "Fetch Data",
        description: "Pull from BigQuery, Meta Ads, and Google Ads",
        type: "fetch",
        dataSources: ["bigquery", "meta_ads", "google_ads"],
      },
      {
        id: "analyze",
        label: "Initial Analysis",
        description:
          "Revenue, customers, CAC, ROAS calculations and pattern detection",
        type: "analyze",
      },
      {
        id: "explore",
        label: "Deep Exploration",
        description:
          "Dig into anomalies and drivers based on initial findings",
        type: "explore",
      },
      {
        id: "recommend",
        label: "Recommendations",
        description: "Prioritized action items with reasoning",
        type: "recommend",
      },
    ],
  },
];

export function getWorkflowBySlug(slug: string): Workflow | undefined {
  return workflows.find((w) => w.slug === slug);
}

export function formatSlugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
