"use client";

// Offline queue for session answers. If /api/study is unreachable due to lack
// of network (not a Notion error — that's already retried on the server),
// the user's answer must not be lost: we store it in IndexedDB and flush it
// once the connection comes back.

import { logError } from "@/shared/lib/errorLog";

const DB_NAME = "vocab-offline-queue";
const STORE = "answers";

export interface QueuedAnswer {
  localId: string;
  payload: unknown;
  queuedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "localId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

function supported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

export async function enqueueAnswer(payload: unknown): Promise<void> {
  if (!supported()) return;
  const item: QueuedAnswer = { localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`, payload, queuedAt: Date.now() };
  try {
    await withStore("readwrite", (s) => s.add(item));
  } catch (e) {
    logError(`Failed to save the answer offline: ${String(e)}`, "offlineQueue.enqueue");
  }
}

export async function queueSize(): Promise<number> {
  if (!supported()) return 0;
  try {
    return await withStore("readonly", (s) => s.count());
  } catch {
    return 0;
  }
}

// Tries to send all accumulated offline answers. Sends them one at a time —
// the same protection against a parallel request storm as on the server.
export async function flushQueue(): Promise<{ flushed: number; remaining: number }> {
  if (!supported()) return { flushed: 0, remaining: 0 };
  let all: QueuedAnswer[];
  try {
    all = await withStore("readonly", (s) => s.getAll());
  } catch {
    return { flushed: 0, remaining: 0 };
  }

  let flushed = 0;
  for (const item of all) {
    try {
      const res = await fetch("/api/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      if (!res.ok) break; // server unavailable again — leave the rest queued
      await withStore("readwrite", (s) => s.delete(item.localId));
      flushed++;
    } catch {
      break; // still no network — stop retrying until the next call
    }
  }
  return { flushed, remaining: all.length - flushed };
}
