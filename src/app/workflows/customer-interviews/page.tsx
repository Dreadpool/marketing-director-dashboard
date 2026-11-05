import Link from "next/link";
import { db } from "@/db";
import { interviewCampaigns } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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
              New interviews are closed. Saved campaigns and responses are available below.
            </p>
          </div>
        </div>
      </header>


      <h2 className="text-sm font-medium uppercase tracking-widest text-slate-500 mt-12 mb-4">
        Campaigns
      </h2>

      {campaigns.length === 0 && (
        <Card className="p-12 text-center border-dashed">
          <p className="text-slate-300">No campaigns yet.</p>
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
