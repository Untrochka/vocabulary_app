"use client";

// Client-side errors used to go into console.error and vanish without a
// trace. A ring buffer in localStorage — so after a failure you can open the
// console and see what happened instead of guessing from the user's description.

const KEY = "vocab:errorLog";
const MAX_ENTRIES = 50;

export interface LoggedError {
  at: string; // ISO timestamp
  message: string;
  context?: string;
}

export function logError(message: string, context?: string): void {
  if (typeof window === "undefined") return;
  try {
    const list = readLog();
    list.push({ at: new Date().toISOString(), message, context });
    while (list.length > MAX_ENTRIES) list.shift();
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // localStorage unavailable (private mode, etc.) — nowhere to log, not critical
  }
}

export function readLog(): LoggedError[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LoggedError[]) : [];
  } catch {
    return [];
  }
}

export function clearLog(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}

let installed = false;

export function installGlobalErrorLogging(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => logError(e.message, "window.onerror"));
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    logError(message, "unhandledrejection");
  });
}
