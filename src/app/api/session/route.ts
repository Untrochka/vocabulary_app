import { NextResponse } from "next/server";
import { getSessionSummary } from "@/shared/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getSessionSummary());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to load. Check NOTION_TOKEN, NOTION_DATABASE_ID, and the database fields." }, { status: 500 });
  }
}
