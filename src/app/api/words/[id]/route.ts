import { NextResponse } from "next/server";
import { repo } from "@/shared/lib/repository";
import type { Word } from "@/entities/word/model";

export const dynamic = "force-dynamic";

// Editing base fields of an already-existing word (chosen from the duplicate
// picker on the add screen). We don't touch SRS state here — that's what
// /api/study is for.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const existing = await repo.get(id);
    if (!existing) return NextResponse.json({ error: "Word not found" }, { status: 404 });

    const body = await req.json();
    const fields: Partial<Word> = {};
    if (typeof body.word === "string" && body.word.trim()) fields.word = body.word.trim();
    if (typeof body.tr1 === "string") fields.tr1 = body.tr1;
    if (typeof body.tr2 === "string") fields.tr2 = body.tr2;
    if (typeof body.ipa === "string") fields.ipa = body.ipa;
    if (typeof body.example === "string") fields.example = body.example;

    await repo.update(id, fields);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Update failed" }, { status: 500 });
  }
}
