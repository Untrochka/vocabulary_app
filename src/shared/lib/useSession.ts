"use client";

import { useEffect, useState } from "react";
import type { SessionApiResult, SessionResponse } from "@/entities/session/model";

// Both HomeScreen and StudyScreen fetch /api/session on mount — previously
// each screen duplicated the same fetch/error boilerplate.
export function useSession() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d: SessionApiResult) => ("error" in d ? setError(d.error) : setSession(d)))
      .catch(() => setError("Failed to load. Check your Notion connection."));
  }, []);

  return { session, error };
}
