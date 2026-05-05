type Args = {
  customerName: string | null;
  customerEmail: string;
  customerId: string;
  rewardPoints: number;
  campaignId: string;
};

export function csrLoyaltyPoints({
  customerName,
  customerEmail,
  customerId,
  rewardPoints,
  campaignId,
}: Args): {
  subject: string;
  html: string;
} {
  const displayName = customerName ?? customerEmail;
  return {
    subject: `Add ${rewardPoints} loyalty points · ${displayName} · interview reward`,
    html: `
<!doctype html>
<html>
  <body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
    <p><strong>Customer interview completed — please add ${rewardPoints} loyalty points.</strong></p>
    <table style="border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 6px 12px 6px 0; color:#666;">Customer:</td><td style="padding: 6px 0;"><strong>${displayName}</strong></td></tr>
      <tr><td style="padding: 6px 12px 6px 0; color:#666;">Email:</td><td style="padding: 6px 0;">${customerEmail}</td></tr>
      <tr><td style="padding: 6px 12px 6px 0; color:#666;">Customer ID:</td><td style="padding: 6px 0; font-family: monospace;">${customerId}</td></tr>
      <tr><td style="padding: 6px 12px 6px 0; color:#666;">Points:</td><td style="padding: 6px 0;"><strong>${rewardPoints}</strong></td></tr>
      <tr><td style="padding: 6px 12px 6px 0; color:#666;">Campaign:</td><td style="padding: 6px 0; font-family: monospace; font-size: 12px;">${campaignId}</td></tr>
    </table>
    <p style="color:#666; font-size:14px;">This is an automated notification from the Marketing Director Dashboard customer interview workflow.</p>
  </body>
</html>`,
  };
}
