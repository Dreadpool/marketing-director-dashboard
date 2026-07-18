export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const mockResponses: { pattern: RegExp; response: string }[] = [
  {
    pattern: /workflow|task|schedule/i,
    response:
      "Your workflows are configured and ready. Once data sources are connected, I'll help you analyze campaign performance, track metrics, and generate action items for each workflow.",
  },
  {
    pattern: /metric|kpi|revenue|cac|roas/i,
    response:
      "Key metrics will populate once data sources are connected. I'll track revenue, first observed purchasers, ad spend, platform CPA, and platform ROAS across channels.",
  },
  {
    pattern: /meta|facebook|instagram/i,
    response:
      "The Meta Ads workflow will pull campaign data via the Meta Marketing API. I'll analyze creative performance, detect fatigue signals, and surface prioritized action items.",
  },
  {
    pattern: /google|search|ads/i,
    response:
      "The Google Ads workflow will query campaigns via GAQL, break down spend by campaign type, analyze search terms, and compare platform-reported CPA trends.",
  },
  {
    pattern: /help|what can you/i,
    response:
      "I'm your AI marketing assistant. I help with campaign analysis, metric interpretation, cross-channel comparisons, and generating action items. Ask me about any workflow or metric.",
  },
];

const defaultResponse =
  "I'm your AI marketing assistant. Once workflows are active, I'll help you analyze campaigns, interpret metrics, and generate action items. Ask me about any workflow to learn more.";

export function getMockResponse(input: string): string {
  for (const { pattern, response } of mockResponses) {
    if (pattern.test(input)) {
      return response;
    }
  }
  return defaultResponse;
}

export function createMessage(
  role: "user" | "assistant",
  content: string,
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date(),
  };
}
