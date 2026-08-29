import { NextResponse } from "next/server";
import { repo } from "@/shared/lib/repository";
import { listLearnedDays } from "@/shared/lib/reading";

export const dynamic = "force-dynamic";

// Lists the days that have at least one word with a translation, for the
// reading day-picker — most recent first.
export async function GET() {
  try {
    const words = await repo.listAll();
    return NextResponse.json({ days: listLearnedDays(words) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to load the day list" }, { status: 500 });
  }
}
