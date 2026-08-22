import { NextResponse } from "next/server";
import { repo } from "@/shared/lib/repository";
import { review, strength, todayISO, type Grade } from "@/shared/lib/srs";
import { CAPS, STATUS } from "@/shared/config/app";
import type { Word } from "@/entities/word/model";
import { isActiveMature } from "@/entities/word/status";
import { recordActivity, type ActivityKind } from "@/shared/lib/streaks";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, action, mode, grade } = body as {
      id: string; action: "learn" | "review"; mode?: "passive" | "active"; grade?: Grade;
    };
    const w = await repo.get(id);
    if (!w) return NextResponse.json({ error: "Word not found" }, { status: 404 });

    const fields: Partial<Word> = {};
    let activityKind: ActivityKind;

    if (action === "learn") {
      const passive = review(w.passive, grade ?? 2);
      fields.passive = passive;
      fields.learnedAt = w.learnedAt ?? todayISO();
      if (w.status === STATUS.new) fields.status = STATUS.passive;
      fields.strength = Math.max(strength(passive), strength(w.active));
      activityKind = "new";
    } else if (action === "review" && mode === "passive" && grade !== undefined) {
      const passive = review(w.passive, grade);
      fields.passive = passive;
      fields.strength = Math.max(strength(passive), strength(w.active));
      activityKind = "passive";
    } else if (action === "review" && mode === "active" && grade !== undefined) {
      const active = review(w.active, grade);
      fields.active = active;
      fields.status = isActiveMature(active, CAPS.activeMatureReps, CAPS.activeMatureDays)
        ? STATUS.active
        : STATUS.pickedActive;
      if (!w.learnedAt) fields.learnedAt = todayISO();
      fields.strength = Math.max(strength(w.passive), strength(active));
      activityKind = "active";
    } else {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    await repo.update(id, fields);

    // Streak is a secondary metric in a separate DB: a failure here shouldn't
    // turn an already-saved Notion answer into an error for the user.
    try {
      await recordActivity(activityKind);
    } catch (e) {
      console.error("streak: recordActivity failed", e);
    }

    return NextResponse.json({ ok: true, strength: fields.strength });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
