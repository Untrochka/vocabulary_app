// Wrapper around Notion API calls: transient errors (429/5xx/network) must
// not silently lose the user's answer — one retry with backoff, and all
// calls go through a shared queue so we don't bombard Notion with parallel requests for every word in a session.

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransient(e: any): boolean {
  const status = e?.status;
  if (status === 429) return true;
  if (typeof status === "number" && status >= 500) return true;
  const code = e?.code;
  return code === "ECONNRESET" || code === "ETIMEDOUT" || code === "service_unavailable";
}

// Notion doesn't expose Retry-After through the client library, so the
// backoff is fixed: 429s usually clear in seconds, not minutes.
function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000);
}

// Single-threaded queue: the next call starts only after the previous one
// (including its retries) has finished — rules out a storm of parallel
// requests if something in the future decides to update words via Promise.all.
let tail: Promise<unknown> = Promise.resolve();

export class NotionCallError extends Error {
  constructor(message: string, public readonly cause: unknown) {
    super(message);
    this.name = "NotionCallError";
  }
}

export function notionCall<T>(fn: () => Promise<T>, label: string, maxRetries = 1): Promise<T> {
  const run = async (): Promise<T> => {
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (e) {
        if (attempt >= maxRetries || !isTransient(e)) {
          throw new NotionCallError(`Notion: failed to execute "${label}"`, e);
        }
        await sleep(backoffMs(attempt));
        attempt++;
      }
    }
  };

  const scheduled = tail.then(run, run);
  // Detach the queue tail from this specific call's result, so one failed
  // operation doesn't block every subsequent one forever.
  tail = scheduled.catch(() => undefined);
  return scheduled;
}
