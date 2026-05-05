type Args = {
  customerName: string | null;
  rewardPoints: number;
};

export function interviewThanks({ customerName, rewardPoints }: Args): {
  subject: string;
  html: string;
} {
  const greeting = customerName ? `Hi ${customerName},` : "Hi there,";
  return {
    subject: `Thank you — ${rewardPoints} loyalty points are on the way`,
    html: `
<!doctype html>
<html>
  <body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
    <p>${greeting}</p>
    <p>Thank you for taking the time to walk us through your experience. The kind of detail you shared is exactly what helps us decide what to fix and what to build.</p>
    <p>We've sent a note to our reservations team to add <strong>${rewardPoints} loyalty points</strong> to your account. They'll show up within one business day.</p>
    <p>If you have anything else to share, just reply to this email.</p>
    <p style="color:#666; font-size:14px;">— The Salt Lake Express team</p>
  </body>
</html>`,
  };
}
