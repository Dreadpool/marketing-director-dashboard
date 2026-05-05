import { getTransporter, FROM_INTERVIEWS, RESERVATIONS_EMAIL } from "./smtp-client";
import { interviewInvite } from "./templates/interview-invite";
import { interviewThanks } from "./templates/interview-thanks";
import { csrLoyaltyPoints } from "./templates/csr-loyalty-points";
import { analystHandoff } from "./templates/analyst-handoff";

export async function sendInterviewInvite(args: {
  to: string;
  customerName: string | null;
  interviewUrl: string;
  rewardPoints: number;
}) {
  const { subject, html } = interviewInvite({
    customerName: args.customerName,
    interviewUrl: args.interviewUrl,
    rewardPoints: args.rewardPoints,
  });
  return getTransporter().sendMail({
    from: FROM_INTERVIEWS,
    to: args.to,
    subject,
    html,
  });
}

export async function sendInterviewThanks(args: {
  to: string;
  customerName: string | null;
  rewardPoints: number;
}) {
  const { subject, html } = interviewThanks({
    customerName: args.customerName,
    rewardPoints: args.rewardPoints,
  });
  return getTransporter().sendMail({
    from: FROM_INTERVIEWS,
    to: args.to,
    subject,
    html,
  });
}

export async function sendAnalystHandoff(args: {
  to: string;
  campaignId: string;
  segmentDescription: string;
  responseCount: number;
  threshold: number;
  campaignUrl: string;
  senderName: string | null;
}) {
  const { subject, html } = analystHandoff({
    campaignId: args.campaignId,
    segmentDescription: args.segmentDescription,
    responseCount: args.responseCount,
    threshold: args.threshold,
    campaignUrl: args.campaignUrl,
    senderName: args.senderName,
  });
  return getTransporter().sendMail({
    from: FROM_INTERVIEWS,
    to: args.to,
    subject,
    html,
  });
}

export async function sendCsrLoyaltyPoints(args: {
  customerName: string | null;
  customerEmail: string;
  customerId: string;
  rewardPoints: number;
  campaignId: string;
}) {
  const { subject, html } = csrLoyaltyPoints(args);
  return getTransporter().sendMail({
    from: FROM_INTERVIEWS,
    to: RESERVATIONS_EMAIL,
    subject,
    html,
  });
}
