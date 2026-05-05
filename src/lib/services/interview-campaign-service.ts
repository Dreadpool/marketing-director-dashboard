import { db } from "@/db";
import { interviewCampaigns, interviewResponses } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  fetchSegmentMembers,
  type SegmentCriteria,
} from "./bigquery-interview-segment";
import { sendInterviewInvite } from "@/lib/email";
import { randomBytes } from "crypto";

function generateToken(): string {
  return randomBytes(20).toString("hex");
}

export type CreateCampaignParams = {
  segmentDescription: string;
  segmentCriteria: SegmentCriteria;
  questionsGuide: object;
  rewardLoyaltyPoints: number;
  responseThreshold: number;
  baseUrl: string;
};

export type CreateCampaignResult = {
  campaign_id: string;
  state: "collecting" | "failed_fetch";
  invites_sent: number;
  invites_attempted: number;
  send_errors: string[];
};

export async function createCampaignWithInvites(
  params: CreateCampaignParams,
): Promise<CreateCampaignResult> {
  const [campaign] = await db
    .insert(interviewCampaigns)
    .values({
      segmentDescription: params.segmentDescription,
      segmentCriteria: params.segmentCriteria as object,
      questionsGuide: params.questionsGuide,
      rewardLoyaltyPoints: params.rewardLoyaltyPoints,
      responseThreshold: params.responseThreshold,
      state: "draft",
    })
    .returning();

  let members: Awaited<ReturnType<typeof fetchSegmentMembers>>;
  try {
    members = await fetchSegmentMembers(params.segmentCriteria);
  } catch (err) {
    await db
      .update(interviewCampaigns)
      .set({ state: "failed_fetch" })
      .where(eq(interviewCampaigns.id, campaign.id));
    throw err;
  }

  if (members.length === 0) {
    await db
      .update(interviewCampaigns)
      .set({ state: "failed_fetch" })
      .where(eq(interviewCampaigns.id, campaign.id));
    throw new Error("segment matched zero customers");
  }

  const responseRows = members.map((m) => ({
    campaignId: campaign.id,
    token: generateToken(),
    customerId: m.customer_id,
    customerEmail: m.email,
    customerName: m.name,
    customerProfile: {
      trips_lifetime: m.trips_lifetime,
      total_spend_lifetime: m.total_spend_lifetime,
      last_trip_date: m.last_trip_date,
    },
    status: "invited" as const,
  }));

  await db.insert(interviewResponses).values(responseRows);

  await db
    .update(interviewCampaigns)
    .set({ state: "sending", sentAt: new Date() })
    .where(eq(interviewCampaigns.id, campaign.id));

  let sentCount = 0;
  const sendErrors: string[] = [];
  for (const row of responseRows) {
    try {
      await sendInterviewInvite({
        to: row.customerEmail,
        customerName: row.customerName,
        interviewUrl: `${params.baseUrl}/interview/${row.token}`,
        rewardPoints: params.rewardLoyaltyPoints,
      });
      sentCount++;
    } catch (err) {
      sendErrors.push(
        `${row.customerEmail}: ${err instanceof Error ? err.message : "send failed"}`,
      );
    }
  }

  await db
    .update(interviewCampaigns)
    .set({ invitesSent: sentCount, state: "collecting" })
    .where(eq(interviewCampaigns.id, campaign.id));

  return {
    campaign_id: campaign.id,
    state: "collecting",
    invites_sent: sentCount,
    invites_attempted: responseRows.length,
    send_errors: sendErrors,
  };
}
