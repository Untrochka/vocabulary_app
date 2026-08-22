import type { SrsState } from "@/shared/lib/srs";
import type { CAPS } from "@/shared/config/app";

// The single source of truth for the shape of the /api/session response. Both
// the backend (session/route.ts) and the screens (HomeScreen, StudyScreen) are
// typed from this file, so a field rename here is caught by tsc instead of
// failing at runtime in production (as happened with s.active after the rename to dueActive/newActive).
export interface SessionCard {
  id: string;
  word: string;
  tr1: string;
  tr2: string;
  ipa: string;
  example: string;
  strength: number;
  passive: SrsState;
  active: SrsState;
}

export interface SessionResponse {
  newToLearn: SessionCard[];
  duePassive: SessionCard[];
  dueActive: SessionCard[];
  newActive: SessionCard[];
  counts: { total: number; mastered: number; learning: number };
  caps: typeof CAPS;
  today: { passive: number; active: number };
  laterToday: { count: number; nextAt: string | null };
}

export type SessionApiResult = SessionResponse | { error: string };
