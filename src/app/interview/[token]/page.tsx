import { db } from "@/db";
import { interviewCampaigns, interviewResponses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { InterviewChat } from "./InterviewChat";

export const dynamic = "force-dynamic";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [response] = await db
    .select()
    .from(interviewResponses)
    .where(eq(interviewResponses.token, token));

  if (!response) {
    notFound();
  }

  const [campaign] = await db
    .select()
    .from(interviewCampaigns)
    .where(eq(interviewCampaigns.id, response.campaignId));

  if (!campaign) {
    notFound();
  }

  if (response.status === "completed") {
    return (
      <main className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-medium tracking-tight">All set — thank you.</h1>
        <p className="mt-4 text-slate-600">
          You&apos;ve already completed this interview. We&apos;ve sent a note to add{" "}
          <strong>{campaign.rewardLoyaltyPoints} loyalty points</strong> to your account.
        </p>
        <p className="mt-2 text-slate-600">
          If you have anything else you wanted to share, just reply to the email we sent.
        </p>
      </main>
    );
  }

  const initialTranscript = Array.isArray(response.transcript)
    ? (response.transcript as { role: "user" | "assistant"; content: string }[])
    : [];

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <header className="border-b border-slate-200 pb-4 mb-6">
        <p className="text-xs uppercase tracking-widest text-slate-500">Salt Lake Express</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">A quick conversation</h1>
        <p className="mt-2 text-sm text-slate-600">
          Take your time. There are no right answers — we just want to hear your story.
          When we&apos;re done, we&apos;ll add{" "}
          <strong>{campaign.rewardLoyaltyPoints} loyalty points</strong> to your account.
        </p>
      </header>
      <InterviewChat token={token} initialTranscript={initialTranscript} />
    </main>
  );
}
