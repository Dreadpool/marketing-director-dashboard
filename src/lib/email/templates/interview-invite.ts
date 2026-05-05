type Args = {
  customerName: string | null;
  interviewUrl: string;
  rewardPoints: number;
};

export function interviewInvite({ customerName, interviewUrl, rewardPoints }: Args): {
  subject: string;
  html: string;
} {
  const greeting = customerName ? `Hi ${customerName},` : "Hi there,";
  return {
    subject: `Quick question — and ${rewardPoints} loyalty points for your time`,
    html: `
<!doctype html>
<html>
  <body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
    <p>${greeting}</p>
    <p>We're trying to understand how riders make decisions about transportation in this corridor — what works, what doesn't, what almost made you choose something else.</p>
    <p>If you'd be willing to share your story, we put together a short conversation you can have on your phone. It takes about 8–12 minutes. There are no right or wrong answers — we just want to hear what actually happened.</p>
    <p><strong>As a thank-you, we'll add ${rewardPoints} loyalty points to your account when you finish.</strong></p>
    <p style="margin: 32px 0;">
      <a href="${interviewUrl}" style="background:#111; color:#fff; padding:14px 24px; text-decoration:none; border-radius:6px; display:inline-block;">
        Start the interview
      </a>
    </p>
    <p style="color:#666; font-size:14px;">This link is just for you — please don't share it. If you'd rather not, no problem at all.</p>
    <p style="color:#666; font-size:14px;">— The Salt Lake Express team</p>
  </body>
</html>`,
  };
}
