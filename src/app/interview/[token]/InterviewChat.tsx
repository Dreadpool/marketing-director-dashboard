"use client";

import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

export function InterviewChat({
  token,
  initialTranscript,
}: {
  token: string;
  initialTranscript: Turn[];
}) {
  const [turns, setTurns] = useState<Turn[]>(initialTranscript);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  // If transcript is empty, kick off the first assistant turn.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (turns.length === 0) {
      void send("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(message: string) {
    setBusy(true);
    setError(null);
    if (message) {
      setTurns((prev) => [...prev, { role: "user", content: message }]);
    }
    try {
      const res = await fetch(`/api/interview/${token}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json()) as
        | { assistant_message: string; is_complete: boolean }
        | { error: string };
      if (!res.ok) {
        setError("error" in data ? data.error : "Something went wrong.");
        setBusy(false);
        return;
      }
      const ok = data as { assistant_message: string; is_complete: boolean };
      setTurns((prev) => [...prev, { role: "assistant", content: ok.assistant_message }]);
      if (ok.is_complete) setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || busy || done) return;
    setInput("");
    await send(message);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-4">
        {turns.map((t, i) => (
          <Bubble key={i} role={t.role} content={t.content} />
        ))}
        {busy && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {done ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
          <p className="font-medium">Thanks for sharing your story.</p>
          <p className="mt-1">
            Your loyalty points will appear in your account within one business day. You
            can close this page.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="border-t border-slate-200 pt-4 flex gap-3 items-end"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e);
              }
            }}
            rows={2}
            disabled={busy}
            placeholder="Type your answer…"
            className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}

function Bubble({ role, content }: Turn) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-slate-900 text-white rounded-br-sm"
            : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3">
        <span className="inline-flex gap-1">
          <span className="size-1.5 rounded-full bg-slate-400 animate-pulse [animation-delay:0ms]" />
          <span className="size-1.5 rounded-full bg-slate-400 animate-pulse [animation-delay:150ms]" />
          <span className="size-1.5 rounded-full bg-slate-400 animate-pulse [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  );
}
