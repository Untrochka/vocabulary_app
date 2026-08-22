import { NextResponse } from "next/server";
import { repo } from "@/shared/lib/repository";
import { fetchTranslation } from "@/shared/lib/translate";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const words = await repo.listAll();
    const empty = words.filter((w) => !w.tr1);

    let filled = 0;
    let notFound = 0;

    for (const w of empty) {
      const t = await fetchTranslation(w.word);
      if (!t || !t.tr1) { notFound++; continue; }
      await repo.update(w.id, { tr1: t.tr1, tr2: t.tr2 ?? "", ipa: t.ipa ?? "", example: t.example ?? "" });
      filled++;
    }

    return NextResponse.json({ total: empty.length, filled, notFound });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
