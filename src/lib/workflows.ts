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
    slug: "creative-content-planning",
    title: "Creative/Content Planning",
    description:
      "Monthly content brainstorm: campaign themes, creative assets, social calendar, and content pipeline.",
    icon: "palette",
    status: "coming-soon",
    cadence: { frequency: "monthly", dueRule: { type: "day-of-month", day: 1 } },
    dataSources: [],
    steps: [
      {
        id: "fetch",
        label: "Fetch Data",
        description: "Pull prior month performance and content calendar",
        type: "fetch",
      },
      {
        id: "analyze",
        label: "Initial Analysis",
        description: "Content performance review, theme identification",
        type: "analyze",
      },
      {
        id: "recommend",
        label: "Recommendations",
        description: "Content calendar and creative briefs for the month",
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
    status: "active",
    cadence: { frequency: "monthly", dueRule: { type: "day-of-month", day: 3 } },
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
        id: "recommend",
        label: "Recommendations",
        description: "SEO priorities and content opportunities",
        type: "recommend",
      },
    ],
  },
  {
    slug: "email-marketing-review",
    title: "Email Marketing Review",
    description:
      "Email campaign performance, open/click rates, list health, and segmentation analysis.",
    icon: "mail",
    status: "coming-soon",
    cadence: { frequency: "monthly", dueRule: { type: "day-of-month", day: 3 } },
    dataSources: [],
    steps: [
      {
        id: "fetch",
        label: "Fetch Data",
        description: "Pull email campaign metrics",
        type: "fetch",
      },
      {
        id: "analyze",
        label: "Initial Analysis",
        description: "Open rates, click rates, list growth, segmentation",
        type: "analyze",
      },
      {
        id: "recommend",
        label: "Recommendations",
        description: "Email optimization and audience targeting actions",
        type: "recommend",
      },
    ],
  },
  {
    slug: "flyer-event-planning",
    title: "Flyer/Event Planning",
    description:
      "Monthly event calendar, flyer design briefs, venue partnerships, and promotional collateral planning.",
    icon: "image",
    status: "coming-soon",
    cadence: { frequency: "monthly", dueRule: { type: "nth-weekday", n: 1, weekday: 1 } },
    dataSources: [],
    steps: [
      {
        id: "fetch",
        label: "Fetch Data",
        description: "Pull upcoming events and venue schedules",
        type: "fetch",
      },
      {
        id: "analyze",
        label: "Initial Analysis",
        description: "Event calendar review, past flyer performance",
        type: "analyze",
      },
      {
        id: "recommend",
        label: "Recommendations",
        description: "Flyer briefs and event promotion plan",
        type: "recommend",
      },
    ],
  },
  {
    slug: "meta-ads-analysis",
    title: "Meta Ads Analysis",
    description:
      "Campaign performance diagnostics, creative fatigue detection, audience insights, and prioritized action items.",
    icon: "megaphone",
    status: "active",
    cadence: { frequency: "monthly", dueRule: { type: "day-of-month", day: 10 } },
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
    cadence: { frequency: "monthly", dueRule: { type: "day-of-month", day: 10 } },
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
        id: "recommend",
        label: "Recommendations",
        description: "Prioritized action items for Google campaigns",
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
    cadence: { frequency: "monthly", dueRule: { type: "day-of-month", day: 10 } },
    dataSources: ["bigquery", "quickbooks_gl"],
    steps: [
      {
        id: "fetch",
        label: "Fetch Data",
        description:
          "Pull sales orders from BigQuery, ad spend from QuickBooks GL, CardPointe settlements",
        type: "fetch",
        dataSources: ["bigquery", "quickbooks_gl"],
      },
      {
        id: "analyze",
        label: "Initial Analysis",
        description:
          "Revenue breakdown, payment analysis, customer segmentation, promo codes, CAC",
        type: "analyze",
      },
      {
        id: "recommend",
        label: "Recommendations",
        description:
          "Budget, pricing, retention, operations, and customer-care action items",
        type: "recommend",
      },
    ],
  },
  {
    slug: "promo-code-analysis",
    title: "Promo Code Analysis",
    description:
      "Promo code performance analysis: usage rates, revenue impact, discount costs, and abuse detection. Future: auto-triggered on promo expiration.",
    icon: "ticket",
    status: "coming-soon",
    cadence: { frequency: "on-demand", dueRule: { type: "on-demand" } },
    dataSources: ["bigquery"],
    steps: [
      {
        id: "fetch",
        label: "Fetch Data",
        description: "Pull promo code usage from BigQuery",
        type: "fetch",
        dataSources: ["bigquery"],
      },
      {
        id: "analyze",
        label: "Initial Analysis",
        description: "Usage rates, revenue impact, discount analysis",
        type: "analyze",
      },
      {
        id: "recommend",
        label: "Recommendations",
        description: "Promo strategy adjustments and abuse prevention",
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
