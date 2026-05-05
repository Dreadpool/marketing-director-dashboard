"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Criteria = Record<string, unknown>;

type SampleRow = {
  customer_id: string;
  email: string;
  name: string | null;
  trips_lifetime: number;
  total_spend_lifetime: number;
  last_trip_date: string;
  first_trip_date: string;
  top_route: string | null;
};

type PreviewResult = {
  count: number;
  sample_rows: SampleRow[];
  revenue_profile: {
    avg_lifetime_spend: number;
    median_lifetime_spend: number;
    distinct_customers: number;
    avg_trips_per_customer: number;
  };
};

type Guide = {
  warm_up?: string[];
  first_thought?: string[];
  passive_looking?: string[];
  active_looking?: string[];
  deciding?: string[];
  first_use?: string[];
  ongoing_use?: string[];
  wrap?: string[];
};

const STAGE_ORDER: (keyof Guide)[] = [
  "warm_up",
  "first_thought",
  "passive_looking",
  "active_looking",
  "deciding",
  "first_use",
  "ongoing_use",
  "wrap",
];

const STAGE_LABELS: Record<keyof Guide, { label: string; helper: string }> = {
  warm_up: { label: "Warm-up", helper: "Open with low-stakes story prompts" },
  first_thought: { label: "First thought", helper: "When did they first consider switching" },
  passive_looking: { label: "Passive looking", helper: "Noticing alternatives without acting" },
  active_looking: { label: "Active looking", helper: "Comparing alternatives in detail" },
  deciding: { label: "Deciding", helper: "The trigger event — highest-value section" },
  first_use: { label: "First use", helper: "First experience with the new option" },
  ongoing_use: { label: "Ongoing use", helper: "Whether the switch stuck" },
  wrap: { label: "Wrap", helper: "Catch-all final question" },
};

export function CampaignWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState<Criteria>({});
  const [criteriaText, setCriteriaText] = useState("{}");
  const [criteriaError, setCriteriaError] = useState<string | null>(null);
  const [criteriaReasoning, setCriteriaReasoning] = useState<string | null>(null);
  const [busySuggesting, setBusySuggesting] = useState(false);
  const [busyPreview, setBusyPreview] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  // Step 2
  const [busyDrafting, setBusyDrafting] = useState(false);
  const [guide, setGuide] = useState<Guide | null>(null);

  // Step 3
  const [rewardPoints, setRewardPoints] = useState(50);
  const [threshold, setThreshold] = useState(8);

  // Step 4
  const [busySend, setBusySend] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  async function handleSuggestCriteria() {
    if (description.trim().length < 4) {
      setCriteriaError("Add a description first");
      return;
    }
    setBusySuggesting(true);
    setCriteriaError(null);
    try {
      const res = await fetch("/api/interviews/draft-criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setCriteria(data.criteria ?? {});
      setCriteriaText(JSON.stringify(data.criteria ?? {}, null, 2));
      setCriteriaReasoning(data.reasoning ?? null);
    } catch (err) {
      setCriteriaError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusySuggesting(false);
    }
  }

  function handleCriteriaTextChange(text: string) {
    setCriteriaText(text);
    try {
      const parsed = JSON.parse(text);
      setCriteria(parsed);
      setCriteriaError(null);
    } catch {
      setCriteriaError("Invalid JSON — fix to preview");
    }
  }

  async function handlePreview() {
    setBusyPreview(true);
    setCriteriaError(null);
    try {
      const res = await fetch("/api/interviews/wizard/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "preview failed");
      setPreview(data);
    } catch (err) {
      setCriteriaError(err instanceof Error ? err.message : "preview failed");
    } finally {
      setBusyPreview(false);
    }
  }

  async function handleAdvanceToGuide() {
    if (!preview || preview.count < 5) {
      setCriteriaError(
        "Need at least 5 customers to run a meaningful interview. Adjust criteria.",
      );
      return;
    }
    setStep(2);
    if (!guide) {
      setBusyDrafting(true);
      try {
        const res = await fetch("/api/interviews/draft-guide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segment_description: description, criteria }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "draft failed");
        setGuide(data.guide ?? {});
      } catch (err) {
        setSendError(err instanceof Error ? err.message : "draft failed");
      } finally {
        setBusyDrafting(false);
      }
    }
  }

  async function handleRedraftGuide() {
    setBusyDrafting(true);
    setSendError(null);
    try {
      const res = await fetch("/api/interviews/draft-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment_description: description, criteria }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "draft failed");
      setGuide(data.guide ?? {});
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "draft failed");
    } finally {
      setBusyDrafting(false);
    }
  }

  function updateGuideStage(stage: keyof Guide, value: string[]) {
    setGuide((prev) => ({ ...(prev ?? {}), [stage]: value }));
  }

  async function handleSend() {
    setBusySend(true);
    setSendError(null);
    try {
      const res = await fetch("/api/interviews/wizard/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment_description: description,
          segment_criteria: criteria,
          questions_guide: guide,
          reward_loyalty_points: rewardPoints,
          response_threshold: threshold,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "send failed");
      router.push(`/workflows/customer-interviews/${data.campaign_id}`);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "send failed");
      setBusySend(false);
    }
  }

  const totalGuideQuestions = guide
    ? STAGE_ORDER.reduce((acc, key) => acc + (guide[key]?.length ?? 0), 0)
    : 0;

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto">
      <Link
        href="/workflows/customer-interviews"
        className="text-xs text-slate-500 hover:text-slate-300"
      >
        ← All campaigns
      </Link>

      <header className="mt-4 mb-8">
        <p className="text-xs uppercase tracking-widest text-slate-500">new campaign</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight">Plan a customer interview</h1>
      </header>

      <StepIndicator step={step} />

      {step === 1 && (
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-medium text-slate-100">Step 1 — Pick a segment</h2>
          <p className="mt-1 text-sm text-slate-400">
            Describe who you want to interview in plain English. We&apos;ll suggest filters and
            preview the segment from BigQuery so you know exactly who will get an invite.
          </p>

          <label className="mt-6 block">
            <span className="text-xs uppercase tracking-widest text-slate-500">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="e.g. Customers who used to ride frequently but haven't booked in 6+ months"
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </label>

          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleSuggestCriteria}
              disabled={busySuggesting || description.trim().length < 4}
            >
              {busySuggesting ? "Suggesting…" : "Suggest filters"}
            </Button>
            {criteriaReasoning && (
              <span className="text-xs text-slate-400 italic">{criteriaReasoning}</span>
            )}
          </div>

          <label className="mt-6 block">
            <span className="text-xs uppercase tracking-widest text-slate-500">Filter criteria</span>
            <textarea
              value={criteriaText}
              onChange={(e) => handleCriteriaTextChange(e.target.value)}
              rows={6}
              spellCheck={false}
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 font-mono text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Edit JSON directly. Common shorthand:{" "}
              <code>customer_segment</code> can be{" "}
              <code>churned</code>, <code>active</code>, <code>first_timer</code>, or{" "}
              <code>superconsumer</code>.
            </p>
          </label>

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={handlePreview} disabled={busyPreview || !!criteriaError}>
              {busyPreview ? "Previewing…" : "Preview segment"}
            </Button>
            {criteriaError && (
              <span className="text-xs text-red-400">{criteriaError}</span>
            )}
          </div>

          {preview && (
            <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500">Match count</p>
                  <p className="mt-1 text-3xl font-medium text-slate-100">{preview.count}</p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <div>
                    Avg lifetime spend{" "}
                    <strong className="text-slate-200">
                      ${preview.revenue_profile.avg_lifetime_spend.toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    Avg trips{" "}
                    <strong className="text-slate-200">
                      {preview.revenue_profile.avg_trips_per_customer.toFixed(1)}
                    </strong>
                  </div>
                </div>
              </div>

              {preview.count > 0 && preview.count < 5 && (
                <p className="mt-3 text-xs text-amber-400">
                  Fewer than 5 customers — too small to interview. Loosen criteria.
                </p>
              )}

              {preview.sample_rows.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">
                    Sample (5 random)
                  </p>
                  <table className="w-full text-xs">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="text-left px-2 py-1.5 font-normal">Email</th>
                        <th className="text-left px-2 py-1.5 font-normal">Trips</th>
                        <th className="text-left px-2 py-1.5 font-normal">Spend</th>
                        <th className="text-left px-2 py-1.5 font-normal">Last trip</th>
                        <th className="text-left px-2 py-1.5 font-normal">Top route</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {preview.sample_rows.map((r) => (
                        <tr key={r.customer_id}>
                          <td className="px-2 py-1.5 text-slate-300 font-mono">{r.email}</td>
                          <td className="px-2 py-1.5 text-slate-300">{r.trips_lifetime}</td>
                          <td className="px-2 py-1.5 text-slate-300">
                            ${r.total_spend_lifetime.toFixed(0)}
                          </td>
                          <td className="px-2 py-1.5 text-slate-400">{r.last_trip_date}</td>
                          <td className="px-2 py-1.5 text-slate-400">{r.top_route ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <Button
              onClick={handleAdvanceToGuide}
              disabled={!preview || preview.count < 5}
            >
              Continue → Draft guide
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-medium text-slate-100">Step 2 — Review interview guide</h2>
          <p className="mt-1 text-sm text-slate-400">
            AI drafted these questions following the Moesta switch-interview method. Edit, reorder,
            or remove anything that doesn&apos;t fit. Tighter is better — 12–18 questions total.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <Button variant="outline" onClick={handleRedraftGuide} disabled={busyDrafting}>
              {busyDrafting ? "Drafting…" : "Re-draft"}
            </Button>
            {guide && (
              <span className="text-xs text-slate-400">
                {totalGuideQuestions} questions across {STAGE_ORDER.filter((k) => (guide[k]?.length ?? 0) > 0).length} sections
              </span>
            )}
          </div>

          {busyDrafting && !guide && (
            <div className="mt-6 rounded-md border border-slate-800 bg-slate-900/30 p-8 text-center text-sm text-slate-400">
              Drafting guide…
            </div>
          )}

          {guide && (
            <div className="mt-6 space-y-4">
              {STAGE_ORDER.map((stage) => (
                <GuideStageEditor
                  key={stage}
                  label={STAGE_LABELS[stage].label}
                  helper={STAGE_LABELS[stage].helper}
                  questions={guide[stage] ?? []}
                  onChange={(qs) => updateGuideStage(stage, qs)}
                />
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-between gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              ← Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!guide || totalGuideQuestions < 5}
            >
              Continue → Reward + threshold
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-medium text-slate-100">Step 3 — Reward and threshold</h2>
          <p className="mt-1 text-sm text-slate-400">
            How many loyalty points should each customer earn for completing the interview, and how
            many completed responses do you want before analysis fires?
          </p>

          <div className="mt-6 grid md:grid-cols-2 gap-6">
            <label>
              <span className="text-xs uppercase tracking-widest text-slate-500">
                Loyalty points per response
              </span>
              <input
                type="number"
                min={0}
                value={rewardPoints}
                onChange={(e) => setRewardPoints(Math.max(0, Number(e.target.value) || 0))}
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
              />
              <p className="mt-1 text-xs text-slate-500">
                50–100 is typical. Bigger reward = higher response rate.
              </p>
            </label>

            <label>
              <span className="text-xs uppercase tracking-widest text-slate-500">
                Response threshold
              </span>
              <input
                type="number"
                min={1}
                value={threshold}
                onChange={(e) => setThreshold(Math.max(1, Number(e.target.value) || 1))}
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
              />
              <p className="mt-1 text-xs text-slate-500">
                5–8 for signal, 20+ for confidence. Below 5 isn&apos;t enough to spot a pattern.
              </p>
            </label>
          </div>

          <div className="mt-6 flex justify-between gap-3">
            <Button variant="outline" onClick={() => setStep(2)}>
              ← Back
            </Button>
            <Button onClick={() => setStep(4)} disabled={threshold < 1 || rewardPoints < 0}>
              Continue → Review
            </Button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-medium text-slate-100">Step 4 — Review and send</h2>
          <p className="mt-1 text-sm text-slate-400">
            One last check. Sending will fetch the full segment from BigQuery and email each
            customer their personal interview link via HubSpot.
          </p>

          <div className="mt-6 space-y-4">
            <ReviewRow label="Segment">{description}</ReviewRow>
            <ReviewRow label="Match count">{preview?.count ?? "?"} customers</ReviewRow>
            <ReviewRow label="Questions">{totalGuideQuestions} across {STAGE_ORDER.filter((k) => guide && (guide[k]?.length ?? 0) > 0).length} stages</ReviewRow>
            <ReviewRow label="Reward">{rewardPoints} loyalty points</ReviewRow>
            <ReviewRow label="Threshold">{threshold} completed responses before analysis</ReviewRow>
          </div>

          <div className="mt-6 rounded-md border border-amber-700/40 bg-amber-950/30 p-4">
            <p className="text-xs uppercase tracking-widest text-amber-300">heads up</p>
            <p className="mt-1.5 text-sm text-slate-200">
              Clicking <strong>Send invites</strong> emails {preview?.count ?? "?"} customers
              immediately. There is no &quot;cancel send&quot; — once invites go out they go out.
            </p>
          </div>

          {sendError && (
            <div className="mt-4 rounded-md border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-300">
              {sendError}
            </div>
          )}

          <div className="mt-6 flex justify-between gap-3">
            <Button variant="outline" onClick={() => setStep(3)} disabled={busySend}>
              ← Back
            </Button>
            <Button onClick={handleSend} disabled={busySend}>
              {busySend ? "Sending…" : `Send invites to ${preview?.count ?? "?"} customers`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  const labels = ["Segment", "Guide", "Reward", "Send"];
  return (
    <div className="flex items-center gap-2 text-xs">
      {labels.map((label, i) => {
        const n = i + 1;
        const isActive = n === step;
        const isDone = n < step;
        return (
          <div key={label} className="flex items-center gap-2">
            <Badge
              className={
                isActive
                  ? "bg-emerald-500/20 text-emerald-200"
                  : isDone
                    ? "bg-slate-700/30 text-slate-400"
                    : "bg-slate-900/30 text-slate-500"
              }
            >
              {n}. {label}
            </Badge>
            {n < 4 && <span className="text-slate-700">→</span>}
          </div>
        );
      })}
    </div>
  );
}

function GuideStageEditor({
  label,
  helper,
  questions,
  onChange,
}: {
  label: string;
  helper: string;
  questions: string[];
  onChange: (qs: string[]) => void;
}) {
  function update(i: number, value: string) {
    const next = [...questions];
    next[i] = value;
    onChange(next);
  }
  function remove(i: number) {
    onChange(questions.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...questions, ""]);
  }
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-slate-100">{label}</h3>
        <span className="text-xs text-slate-500">{helper}</span>
      </div>
      <div className="mt-3 space-y-2">
        {questions.map((q, i) => (
          <div key={i} className="flex gap-2">
            <textarea
              value={q}
              onChange={(e) => update(i, e.target.value)}
              rows={2}
              className="flex-1 rounded border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
            <button
              onClick={() => remove(i)}
              className="text-xs text-slate-500 hover:text-red-400 px-2"
              type="button"
            >
              remove
            </button>
          </div>
        ))}
        <button
          onClick={add}
          className="text-xs text-slate-400 hover:text-slate-200 underline"
          type="button"
        >
          + add question
        </button>
      </div>
    </div>
  );
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 border-b border-slate-800 pb-3">
      <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className="col-span-2 text-sm text-slate-200">{children}</p>
    </div>
  );
}
