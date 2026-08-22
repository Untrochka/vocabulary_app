import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/shared/lib/cronAuth";
import { getSessionSummary } from "@/shared/lib/session";
import { sendStudyNotification } from "@/shared/lib/telegram";
import { prisma } from "@/shared/lib/prisma";
import { todayISO } from "@/shared/lib/srs";

export const dynamic = "force-dynamic";

// Evening reminder — only if today's daily minimum hasn't been met.
// Tone is neutral: a fact, not a reproach.
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const today = todayISO();
    const day = await prisma.dailyActivity.findUnique({ where: { date: today } });
    if (day?.minimumMet) return NextResponse.json({ sent: false, reason: "minimum already met" });

    const s = await getSessionSummary();
    const total = s.newToLearn.length + s.duePassive.length + s.dueActive.length + s.newActive.length;
    if (total === 0) return NextResponse.json({ sent: false, reason: "nothing ready" });

    await sendStudyNotification(`${total} words are waiting for review today.`);
    return NextResponse.json({ sent: true, total });
  } catch (e: any) {
    console.error("cron/evening failed", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
