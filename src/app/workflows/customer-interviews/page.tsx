import Link from "next/link";
import { db } from "@/db";
import { interviewCampaigns } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const STATE_LABELS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-slate-200/10 text-slate-300" },
  sending: { label: "Sending invites", tone: "bg-blue-500/10 text-blue-300" },
  collecting: { label: "Collecting responses", tone: "bg-amber-500/10 text-amber-300" },
  ready: { label: "Ready for analysis", tone: "bg-emerald-500/10 text-emerald-300" },
  analyzed: { label: "Analyzed", tone: "bg-purple-500/10 text-purple-300" },
  archived: { label: "Archived", tone: "bg-slate-500/10 text-slate-400" },
  failed_fetch: { label: "Fetch failed", tone: "bg-red-500/10 text-red-300" },
};

export default async function CustomerInterviewsPage() {
  const campaigns = await db
    .select()
    .from(interviewCampaigns)
    .orderBy(desc(interviewCampaigns.createdAt));

  return (
    <div className="px-8 py-10 max-w-6xl mx-auto">
      <header className="border-b border-slate-800 pb-6 mb-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">workflow</p>
            <h1 className="mt-1 text-3xl font-medium tracking-tight">Customer Interviews</h1>
            <p className="mt-3 text-slate-400 max-w-2xl text-sm">
              Run structured Jobs-to-be-Done switch interviews against any customer segment.
              The dashboard handles delivery and runs the interviews; you review the results when
              they&apos;re ready.
            </p>
          </div>
          <Link href="/workflows/customer-interviews/new">
            <Button>+ New campaign</Button>
          </Link>
        </div>
      </header>

      <HowItWorks />

      <h2 className="text-sm font-medium uppercase tracking-widest text-slate-500 mt-12 mb-4">
        Campaigns
      </h2>

      {campaigns.length === 0 && (
        <Card className="p-12 text-center border-dashed">
          <p className="text-slate-300">No campaigns yet.</p>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Click <strong>New campaign</strong> above to pick a segment, draft the interview
            questions, and start sending invites. The whole setup takes about 5 minutes.
          </p>
          <Link href="/workflows/customer-interviews/new">
            <Button className="mt-6">Start your first campaign</Button>
          </Link>
        </Card>
      )}

      <div className="grid gap-4">
        {campaigns.map((c) => {
          const stateMeta = STATE_LABELS[c.state] ?? {
            label: c.state,
            tone: "bg-slate-200/10 text-slate-300",
          };
          const pct =
            c.responseThreshold > 0
              ? Math.min(100, Math.round((c.responsesCompleted / c.responseThreshold) * 100))
              : 0;
          const isReady = c.state === "ready";
          return (
            <Link key={c.id} href={`/workflows/customer-interviews/${c.id}`}>
              <Card className="p-6 hover:border-slate-700 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Badge className={stateMeta.tone}>{stateMeta.label}</Badge>
                      <span className="text-xs text-slate-500 font-mono">
                        {c.id.slice(0, 8)}
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-medium text-slate-100">
                      {c.segmentDescription}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Created {new Date(c.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <div>{c.invitesSent} sent</div>
                    <div className="mt-1 text-slate-100">
                      <strong>{c.responsesCompleted}</strong>
                      <span className="text-slate-500"> / {c.responseThreshold}</span>
                    </div>
                    <div className="text-slate-500">responses</div>
                  </div>
                </div>
                <div className="mt-4">
                  <Progress value={pct} />
                </div>
                {isReady && (
                  <div className="mt-4 rounded-md border border-emerald-700/40 bg-emerald-950/40 px-4 py-3">
                    <p className="text-sm text-emerald-200">
                      <strong>Ready for analysis.</strong> Open this campaign to send it to your
                      analyst.
                    </p>
                  </div>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function HowItWorks() {
  const stages = [
    {
      n: 1,
      title: "Plan",
      time: "5 min",
      description:
        "Pick a segment from BigQuery, review AI-drafted interview questions, set a loyalty-point reward.",
      who: "You",
    },
    {
      n: 2,
      title: "Collect",
      time: "5–10 days",
      description:
        "Customers click their invite, chat with an AI interviewer trained to follow your guide. Responses log here automatically.",
      who: "Dashboard",
    },
    {
      n: 3,
      title: "Analyze",
      time: "30 min",
      description:
        "When responses hit your threshold, send the campaign to your analyst. They produce a brief with themes, quotes, and recommendations.",
      who: "Your analyst",
    },
  ];
  return (
    <Card className="p-6 bg-slate-900/30">
      <p className="text-xs uppercase tracking-widest text-slate-500 mb-4">How it works</p>
      <div className="grid md:grid-cols-3 gap-6">
        {stages.map((s) => (
          <div key={s.n} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="size-7 rounded-full bg-slate-800 text-slate-200 text-xs font-medium grid place-items-center">
                {s.n}
              </span>
              <h3 className="text-base font-medium text-slate-100">{s.title}</h3>
              <span className="text-xs text-slate-500">· {s.time}</span>
            </div>
            <p className="text-sm text-slate-400">{s.description}</p>
            <p className="text-xs text-slate-500">
              <span className="text-slate-400">Who: </span>
              {s.who}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
