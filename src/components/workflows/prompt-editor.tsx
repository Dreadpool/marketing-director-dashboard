"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Save, RotateCcw } from "lucide-react";

interface PromptEditorProps {
  workflowSlug: string;
  stepId: string;
}

export function PromptEditor({ workflowSlug, stepId }: PromptEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!expanded || loaded) return;

    fetch(`/api/workflows/${workflowSlug}/steps/${stepId}/prompt`)
      .then((res) => res.json())
      .then((data) => {
        setPrompt(data.prompt ?? "");
        setDefaultPrompt(data.defaultPrompt ?? "");
        setIsCustom(data.isCustom ?? false);
        setLoaded(true);
      })
      .catch(console.error);
  }, [expanded, loaded, workflowSlug, stepId]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/workflows/${workflowSlug}/steps/${stepId}/prompt`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frameworkPrompt: prompt }),
      });
      setIsCustom(true);
    } catch (err) {
      console.error("Failed to save prompt:", err);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setPrompt(defaultPrompt);
    setIsCustom(false);
  }

  return (
    <div className="border-t border-border pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        Framework Prompt
        {isCustom && (
          <span className="ml-1 rounded bg-gold/10 px-1.5 py-0.5 text-[10px] text-gold">
            customized
          </span>
        )}
      </button>
      {expanded && (
        <div className="mt-3 space-y-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={12}
            className="w-full rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-xs font-medium text-gold-foreground transition-colors hover:bg-gold/90 disabled:opacity-50"
            >
              <Save className="h-3 w-3" />
              {saving ? "Saving..." : "Save"}
            </button>
            {isCustom && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" />
                Reset to Default
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
