"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function NotifyAnalystButton({ campaignId }: { campaignId: string }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/interviews/campaigns/${campaignId}/notify-analyst`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "send failed");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "send failed");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p className="text-sm text-emerald-300">
        ✓ Email sent to your analyst. They&apos;ll take it from here.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleClick} disabled={busy}>
        {busy ? "Sending…" : "Send to analyst"}
      </Button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
