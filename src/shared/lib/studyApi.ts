"use client";

// The single point for sending an answer to /api/study. Distinguishes two
// different failure modes:
//  - the network is unavailable entirely (fetch throws) → queue it in the
//    offline queue and don't block the session, flush it once the network is back;
//  - the server received the request, but the Notion write failed even
//    after the server-side retry → this is no longer "lost", it's a visible
//    error the user must explicitly retry rather than silently sail past.

import { enqueueAnswer } from "@/shared/lib/offlineQueue";
import { logError } from "@/shared/lib/errorLog";
import type { Grade } from "@/shared/lib/srs";

export type SubmitResult = { status: "ok" } | { status: "queued" } | { status: "error"; message: string };

// The request shape expected by POST /api/study (see body parsing in route.ts).
export type StudyAnswerPayload =
  | { id: string; action: "learn"; grade: Grade }
  | { id: string; action: "review"; mode: "passive" | "active"; grade: Grade };

export async function submitAnswer(payload: StudyAnswerPayload): Promise<SubmitResult> {
  let res: Response;
  try {
    res = await fetch("/api/study", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // fetch threw — meaning the request never got past the browser (no network)
    await enqueueAnswer(payload);
    logError(`Answer queued offline: ${String(e)}`, "studyApi.submitAnswer");
    return { status: "queued" };
  }

  if (res.ok) return { status: "ok" };

  let message = "Failed to save the answer";
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
  } catch {}
  logError(message, "studyApi.submitAnswer");
  return { status: "error", message };
}
