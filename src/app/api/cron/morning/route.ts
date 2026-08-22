import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/shared/lib/cronAuth";
import { getSessionSummary } from "@/shared/lib/session";
import { sendStudyNotification } from "@/shared/lib/telegram";
import { prisma } from "@/shared/lib/prisma";
import { todayISO } from "@/shared/lib/srs";

export const dynamic = "force-dynamic";

// Morning notification: only if active study hasn't been opened today yet
// and there's actually something to show — an honest count, not a "just in case".
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const today = todayISO();
    const day = await prisma.dailyActivity.findUnique({ where: { date: today } });
    if (day && (day.newWords > 0 || day.activeReviews > 0)) {
      return NextResponse.json({ sent: false, reason: "already studied today" });
    }

    const s = await getSessionSummary();
    const total = s.newToLearn.length + s.duePassive.length + s.dueActive.length + s.newActive.length;
    if (total === 0) return NextResponse.json({ sent: false, reason: "nothing ready" });

    const parts = [];
    if (s.newToLearn.length) parts.push(`${s.newToLearn.length} new`);
    const toReview = s.duePassive.length + s.dueActive.length + s.newActive.length;
    if (toReview) parts.push(`${toReview} to review`);

    await sendStudyNotification(`Good morning. Waiting for you today: ${parts.join(" · ")}.`);
    return NextResponse.json({ sent: true, total });
  } catch (e: any) {
    console.error("cron/morning failed", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
