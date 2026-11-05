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
    slug: "creative-pipeline",
    title: "Creative Pipeline",
    description:
      "Autoresearch loop for Meta static ads. Agent generates 12 concept briefs per cycle from accumulated outcomes + industry priors. Review and push to Meta from here.",
    icon: "palette",
    status: "active",
    cadence: { frequency: "monthly", dueRule: { type: "day-of-month", day: 1 } },
    dataSources: ["meta_ads"],
    steps: [
      {
        id: "inputs",
        label: "Inputs",
        description: "What the agent read this cycle",
        type: "view",
      },
      {
        id: "briefs",
        label: "Briefs",
        description: "12 generated concept briefs",
        type: "view",
      },
      {
        id: "push",
        label: "Ship to Meta",
        description: "Push approved briefs to Meta Ads Manager",
        type: "action",
      },
      {
        id: "monitor",
        label: "Monitor",
        description: "Outcomes and metric trend",
        type: "view",
      },
    ],
  },
  {
    slug: "seo-ranking-analysis",
    title: "SEO Ranking Analysis",
    description:
      "Keyword rank tracking, visibility scoring, tier distribution, biggest movers, and GSC quick wins (striking distance + CTR optimization).",
    icon: "trending-up",
    status: "active",
    cadence: { frequency: "monthly", dueRule: { type: "day-of-month", day: 3 } },
    dataSources: ["google_sheets", "google_search_console"],
    steps: [
      {
        id: "fetch",
        label: "Fetch Data",
        description: "Pull keyword rankings from Google Sheets",
        type: "fetch",
        dataSources: ["google_sheets"],
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
    ],
  },
  {
    slug: "meta-ads-analysis",
    title: "Meta Ads Analysis",
    description:
      "Campaign, ad set, creative, and audience performance.",
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
    ],
  },
  {
    slug: "google-ads-analysis",
    title: "Google Ads Analysis",
    description:
      "Campaign performance by segment (Brand/Non-Brand/Competitor/PMax), CPA/ROAS decision metrics, ground truth comparison, and MoM/YoY trends.",
    icon: "search",
    status: "active",
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
    ],
  },
  {
    slug: "monthly-analytics-review",
    title: "Monthly Analytics Review",
    description:
      "Booking counts, first and returning purchasers, marketing spend, and acquisition cost.",
    icon: "calendar",
    status: "active",
    cadence: { frequency: "monthly", dueRule: { type: "day-of-month", day: 10 } },
    dataSources: ["bigquery", "quickbooks_gl"],
    steps: [
      {
        id: "fetch",
        label: "Fetch Data",
        description:
          "Count bookings and purchasers in BigQuery and retrieve ad spend from QuickBooks GL",
        type: "fetch",
        dataSources: ["bigquery", "quickbooks_gl"],
      },
    ],
  },
  {
    slug: "promo-code-analysis",
    title: "Promo Code Analysis",
    description:
      "Review promo-code usage, discounts, and first-time purchasers. Enter a code and optional campaign cost.",
    icon: "ticket",
    status: "active",
    cadence: { frequency: "on-demand", dueRule: { type: "on-demand" } },
    dataSources: ["bigquery"],
    steps: [
      {
        id: "fetch",
        label: "Fetch Promo Data",
        description: "Pull all orders with this promo code from BigQuery",
        type: "fetch",
        dataSources: ["bigquery"],
      },
    ],
  },
  {
    slug: "customer-interviews",
    title: "Customer Interviews",
    description:
      "Saved customer interview campaigns and responses. New interviews are closed.",
    icon: "megaphone",
    status: "active",
    cadence: { frequency: "on-demand", dueRule: { type: "on-demand" } },
    dataSources: ["bigquery"],
    steps: [
      {
        id: "plan",
        label: "Plan",
        description: "Pick segment, draft questions, set reward + threshold (in Claude Code)",
        type: "view",
      },
      {
        id: "collect",
        label: "Collect",
        description: "Review saved responses",
        type: "view",
      },
      {
        id: "analyze",
        label: "Analyze",
        description: "Forces coding + timeline + codes (in Claude Code)",
        type: "view",
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
