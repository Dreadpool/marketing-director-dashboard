type Args = {
  campaignId: string;
  segmentDescription: string;
  responseCount: number;
  threshold: number;
  campaignUrl: string;
  senderName: string | null;
};

export function analystHandoff({
  campaignId,
  segmentDescription,
  responseCount,
  threshold,
  campaignUrl,
  senderName,
}: Args): { subject: string; html: string } {
  const sender = senderName ?? "the dashboard";
  return {
    subject: `Customer interview campaign ready for analysis · ${responseCount}/${threshold} responses`,
    html: `
<!doctype html>
<html>
  <body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
    <p>Hi,</p>
    <p>${sender} flagged a customer interview campaign as ready for analysis.</p>
    <table style="border-collapse: collapse; margin: 16px 0; font-size: 14px;">
      <tr><td style="padding: 4px 12px 4px 0; color:#666;">Segment:</td><td style="padding: 4px 0;"><strong>${segmentDescription}</strong></td></tr>
      <tr><td style="padding: 4px 12px 4px 0; color:#666;">Responses:</td><td style="padding: 4px 0;">${responseCount} of ${threshold}</td></tr>
      <tr><td style="padding: 4px 12px 4px 0; color:#666;">Campaign:</td><td style="padding: 4px 0; font-family: monospace; font-size: 12px;">${campaignId}</td></tr>
    </table>
    <p>Open the campaign in the dashboard:</p>
    <p style="margin: 16px 0;">
      <a href="${campaignUrl}" style="background:#111; color:#fff; padding:10px 20px; text-decoration:none; border-radius:6px; display:inline-block; font-size: 14px;">
        View campaign
      </a>
    </p>
    <p style="margin-top: 32px; font-size: 14px; color: #555;">
      To produce the brief, open Claude Code in this repo and run:
    </p>
    <pre style="background:#f5f5f5; padding:12px; border-radius:6px; font-family: monospace; font-size: 13px; overflow-x: auto;">/analyze-customer-interviews ${campaignId}</pre>
    <p style="color:#888; font-size:12px; margin-top: 32px;">
      This is an automated notification from the Marketing Director Dashboard.
    </p>
  </body>
</html>`,
  };
}
