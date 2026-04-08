/**
 * xAI (Grok) API client using raw fetch.
 * Uses the OpenAI-compatible chat completions endpoint.
 */

type ChatCompletionResponse = {
  choices: { message: { content: string } }[];
};

export async function callXai(
  system: string,
  userMessage: string,
  maxTokens: number = 4096,
): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY environment variable is not set");
  }

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4-1-fast-reasoning",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`xAI API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  return data.choices[0].message.content;
}
