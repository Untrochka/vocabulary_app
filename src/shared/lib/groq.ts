// Shared Groq client — the reading feature (story generation, contextual
// translation) and the word grader both need the exact same resilient HTTP
// call, so it lives here once instead of being copy-pasted.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Groq pulled llama-3.3-70b-versatile and llama-3.1-8b-instant from the free
// tier (deprecated June 17, 2026, fully shut down August 16) —
// openai/gpt-oss-120b is the official replacement, also available for free.
export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 429 (rate limit) and 5xx (temporary overload) on Groq's free tier often
// self-recover within seconds — same one-retry-with-backoff principle used
// elsewhere in this app for flaky external calls, just without a shared
// queue: Groq requests don't write to a shared resource and don't need
// ordering. Retrying other 4xx codes besides 429 (invalid model, bad key) is
// pointless — it won't succeed on a second try either.
const isTransientStatus = (status: number) => status === 429 || status >= 500;

// openai/gpt-oss-* are reasoning models: before the final answer they first
// "think" in a separate channel, and that also costs tokens from the overall
// limit. If max_tokens is too small, the whole budget goes to reasoning and
// content comes back empty (documented Groq behavior, not a bug on our end)
// — hence the generous maxTokens callers use and reasoning_effort: "low", so
// we don't spend the budget on reasoning where the task is simple anyway.
export async function callGroq(
  messages: { role: string; content: string }[],
  opts: { temperature: number; maxTokens: number },
  attempt = 0
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: opts.temperature,
        max_completion_tokens: opts.maxTokens,
        reasoning_effort: "low",
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    if (isTransientStatus(res.status) && attempt < 1) {
      await sleep(1000 * 2 ** attempt);
      return callGroq(messages, opts, attempt + 1);
    }
    const text = await res.text().catch(() => "");
    throw new Error(`Groq API returned error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    const reason = data?.choices?.[0]?.finish_reason;
    throw new Error(
      reason === "length"
        ? "Groq cut off the response at the token limit before reaching the text — increase maxTokens for this call"
        : "Groq returned an empty response"
    );
  }
  return content;
}
