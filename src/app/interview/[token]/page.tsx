import { db } from "@/db";
import { interviewCampaigns, interviewResponses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

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

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-medium">This interview is closed.</h1>
      <p className="mt-4 text-slate-600">To share feedback, please reply to your invitation email.</p>
    </main>
  );
}
