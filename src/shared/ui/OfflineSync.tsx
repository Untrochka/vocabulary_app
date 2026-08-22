"use client";

import { useEffect } from "react";
import { flushQueue } from "@/shared/lib/offlineQueue";
import { installGlobalErrorLogging } from "@/shared/lib/errorLog";

// Mounted once in the layout: flushes the offline answer queue on app load
// and when the network comes back, and enables global capture of unhandled errors into the log.
export function OfflineSync() {
  useEffect(() => {
    installGlobalErrorLogging();
    flushQueue();
    const onOnline = () => flushQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);
  return null;
}
