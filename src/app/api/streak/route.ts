import { NextResponse } from "next/server";
import { getStreakSummary } from "@/shared/lib/streaks";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await getStreakSummary();
    return NextResponse.json(summary);
  } catch (e: any) {
    // Streak is a secondary metric: if the DB is unavailable, don't break the
    // home screen — just honestly show "no data" instead of a made-up number.
    return NextResponse.json({ current: 0, best: 0, status: "none", week: [], error: e?.message }, { status: 200 });
  }
}
