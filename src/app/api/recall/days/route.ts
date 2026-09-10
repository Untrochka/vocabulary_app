import { NextResponse } from "next/server";
import { repo } from "@/shared/lib/repository";
import { listActiveDays } from "@/shared/lib/recall";

export const dynamic = "force-dynamic";

// Lists the days that have at least one word with a first active review,
// for the recall day-picker — most recent first.
export async function GET() {
  try {
    const words = await repo.listAll();
    return NextResponse.json({ days: listActiveDays(words) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to load the day list" }, { status: 500 });
  }
}
