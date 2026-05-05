import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  interviewArtifacts,
  interviewCampaigns,
  interviewResponses,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NotifyAnalystButton } from "./NotifyAnalystButton";

export const dynamic = "force-dynamic";

const STATE_META: Record<
  string,
  { label: string; tone: string; helper: string }
> = {
  draft: {
    label: "Draft",
    tone: "bg-slate-200/10 text-slate-300",
    helper: "Campaign created but invites haven't gone out yet.",
  },
  sending: {
    label: "Sending invites",
    tone: "bg-blue-500/10 text-blue-300",
    helper: "Invite emails are going out to the segment now. This takes a few seconds.",
  },
  collecting: {
    label: "Collecting responses",
    tone: "bg-amber-500/10 text-amber-300",
    helper:
      "Customers are completing their interviews. Most responses arrive within 5–10 days. We'll flip this to 'Ready for analysis' automatically once the threshold is hit.",
  },
  ready: {
    label: "Ready for analysis",
    tone: "bg-emerald-500/10 text-emerald-300",
    helper:
      "Threshold reached. Hand this off to your analyst — they'll produce a brief with themes, quotes, and recommendations.",
  },
  analyzed: {
    label: "Analyzed",
    tone: "bg-purple-500/10 text-purple-300",
    helper: "Analysis complete. The brief and artifact are below.",
  },
  archived: {
    label: "Archived",
    tone: "bg-slate-500/10 text-slate-400",
    helper: "Campaign archived for historical reference.",
  },
  failed_fetch: {
    label: "Fetch failed",
    tone: "bg-red-500/10 text-red-300",
    helper: "Couldn't fetch the segment from BigQuery. Try a different criteria set.",
  },
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [campaign] = await db
    .select()
    .from(interviewCampaigns)
    .where(eq(interviewCampaigns.id, id));

  if (!campaign) notFound();

  const responses = await db
    .select()
    .from(interviewResponses)
    .where(eq(interviewResponses.campaignId, id))
    .orderBy(desc(interviewResponses.completedAt));

  const artifacts = await db
    .select()
    .from(interviewArtifacts)
    .where(eq(interviewArtifacts.campaignId, id))
    .orderBy(desc(interviewArtifacts.uploadedAt));

  const completed = responses.filter((r) => r.status === "completed");
  const inProgress = responses.filter((r) => r.status === "in_progress");

  const stateMeta = STATE_META[campaign.state] ?? {
    label: campaign.state,
    tone: "bg-slate-200/10 text-slate-300",
    helper: "",
  };

  return (
    <div className="px-8 py-10 max-w-6xl mx-auto">
      <Link
        href="/workflows/customer-interviews"
        className="text-xs text-slate-500 hover:text-slate-300"
      >
        ← All campaigns
      </Link>

      <header className="border-b border-slate-800 pb-6 mb-8 mt-4">
        <div className="flex items-center gap-3">
          <Badge className={stateMeta.tone}>{stateMeta.label}</Badge>
          <span className="text-xs font-mono text-slate-500">{campaign.id}</span>
        </div>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">
          {campaign.segmentDescription}
        </h1>
        {stateMeta.helper && (
          <p className="mt-3 text-sm text-slate-400 max-w-3xl">{stateMeta.helper}</p>
        )}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Stat label="Invited" value={String(responses.length)} />
          <Stat label="Started" value={String(inProgress.length + completed.length)} />
          <Stat
            label="Completed"
            value={`${completed.length} / ${campaign.responseThreshold}`}
          />
          <Stat label="Reward" value={`${campaign.rewardLoyaltyPoints} pts`} />
        </div>
      </header>

      {campaign.state === "ready" && (
        <Card className="p-6 mb-8 border-emerald-700/40 bg-emerald-950/30">
          <p className="text-xs uppercase tracking-widest text-emerald-300">
            Ready for analysis
          </p>
          <p className="mt-2 text-sm text-slate-200 max-w-2xl">
            You hit your response threshold. Send this campaign to your analyst — they&apos;ll
            review the transcripts and produce a brief that lands back here within a day.
          </p>
          <div className="mt-4">
            <NotifyAnalystButton campaignId={campaign.id} />
          </div>

          <details className="mt-6 text-sm">
            <summary className="cursor-pointer text-slate-400 hover:text-slate-200">
              Are you the analyst? Run the analysis yourself ↓
            </summary>
            <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs text-slate-400 mb-2">
                In a fresh Claude Code session in the customer-interview-plugin repo:
              </p>
              <pre className="rounded bg-slate-950 px-4 py-3 text-sm text-emerald-200 font-mono overflow-x-auto">
                /analyze-customer-interviews {campaign.id}
              </pre>
              <p className="mt-3 text-xs text-slate-500">
                The plugin will pull transcripts from this dashboard, run forces coding +
                timeline placement + code candidates, walk you through human-cluster theming, and
                upload the brief back here.
              </p>
            </div>
          </details>
        </Card>
      )}

      {campaign.state === "collecting" && completed.length === 0 && (
        <Card className="p-6 mb-8 bg-slate-900/30">
          <p className="text-sm text-slate-300">
            Invites went out to <strong>{responses.length} customers</strong>. Responses typically
            arrive over 5–10 days as people find time to chat. Refresh this page to see counts
            update — there&apos;s nothing for you to do until the threshold hits.
          </p>
        </Card>
      )}

      {artifacts.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-medium text-slate-100 mb-4">Analysis</h2>
          <div className="grid gap-3">
            {artifacts.map((a) => (
              <Card key={a.id} className="p-5">
                <p className="text-xs text-slate-500">
                  {new Date(a.uploadedAt).toLocaleString()}
                </p>
                <h3 className="mt-1 text-base font-medium text-slate-100">{a.title}</h3>
                <details className="mt-3" open>
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-200">
                    View brief
                  </summary>
                  <pre className="mt-3 max-h-[600px] overflow-auto rounded bg-slate-950/50 p-4 text-xs text-slate-300 whitespace-pre-wrap">
                    {a.briefMarkdown}
                  </pre>
                </details>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-medium text-slate-100 mb-4">
          Responses ({responses.length})
        </h2>
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50 text-xs uppercase tracking-widest text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-normal">Customer</th>
                <th className="text-left px-4 py-3 font-normal">Status</th>
                <th className="text-left px-4 py-3 font-normal">Turns</th>
                <th className="text-left px-4 py-3 font-normal">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {responses.map((r) => {
                const turns = Array.isArray(r.transcript) ? r.transcript.length : 0;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <div className="text-slate-200">
                        {r.customerName ?? r.customerEmail}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {r.customerEmail}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{turns}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {r.completedAt ? new Date(r.completedAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                );
              })}
              {responses.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No invitees yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3">
      <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-medium text-slate-100">{value}</p>
    </div>
  );
}
