"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/shared/ui/Icon";
import { DuoButton } from "@/shared/ui/Button";
import { formatDueIn } from "@/shared/lib/srs";
import { useSession } from "@/shared/lib/useSession";
import type { StreakSummary } from "@/shared/lib/streaks";

const DAY_LETTERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function HomeScreen() {
  const { session: s, error: err } = useSession();
  const [streak, setStreak] = useState<StreakSummary | null>(null);

  useEffect(() => {
    fetch("/api/streak").then((r) => r.json()).then(setStreak).catch(() => {});
  }, []);

  const toLearn = s?.newToLearn?.length ?? 0;
  const toReview = (s?.duePassive?.length ?? 0) + (s?.dueActive?.length ?? 0) + (s?.newActive?.length ?? 0);
  const level = s ? Math.floor(s.counts.mastered / 20) + 1 : 1;
  const goal = s ? s.caps.passivePerDay + s.caps.activePerDay : 1;
  const doneToday = s ? s.today.passive + s.today.active : 0;
  const xpPct = Math.min(100, Math.round((doneToday / goal) * 100));
  const nothing = s && toLearn === 0 && toReview === 0;

  return (
    <div className="rise">
      {/* top stats bar — like Duolingo's home screen: streak,
          league/level, XP, no card backgrounds, just icon + number */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <Icon name="flame" fill style={{ width: 26, height: 26 }} className="text-fox" />
          <span className="font-extrabold text-xl text-eel">{streak?.current ?? 0}</span>
        </div>
        <div className="w-10 h-10 rounded-full grid place-items-center font-extrabold text-white text-[15px] bg-bee shadow-[inset_0_-3px_0_0_theme(colors.beeDark)]">
          {level}
        </div>
        <div className="flex items-center gap-1.5">
          <Icon name="zap" fill style={{ width: 24, height: 24 }} className="text-macaw" />
          <span className="font-extrabold text-xl text-eel">{doneToday * 10}</span>
        </div>
      </div>

      {/* daily goal — progress bar in the spirit of Duolingo's Daily Quest */}
      <div className="flex items-center gap-2.5 mb-5 bg-polar border-2 border-swan rounded-2xl px-3.5 py-3">
        <Icon name="trophy" fill style={{ width: 20, height: 20 }} className="text-bee shrink-0" />
        <div className="flex-1">
          <div className="text-[11px] text-wolf font-bold uppercase tracking-wide mb-1">Today&apos;s goal</div>
          <div className="h-3 rounded-full bg-swan overflow-hidden">
            <div className="h-full rounded-full bg-bee transition-[width] duration-700" style={{ width: `${xpPct}%` }} />
          </div>
        </div>
        <span className="text-xs text-wolf font-extrabold shrink-0">{doneToday}/{goal}</span>
      </div>

      {/* activity week */}
      {streak && (
        <div className="flex items-center gap-1.5 mb-5">
          {streak.week.map((d, i) => {
            const isToday = i === streak.week.length - 1;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full aspect-square rounded-full border-2 flex items-center justify-center ${
                    d.met ? "bg-feather border-featherDark" : "bg-white border-swan"
                  } ${isToday && !d.met ? "border-macaw" : ""}`}
                >
                  {d.met && <Icon name="check" style={{ width: 14, height: 14, strokeWidth: 3 }} className="text-white" />}
                </div>
                <span className="text-[10px] text-hare font-bold">{DAY_LETTERS[new Date(d.date + "T00:00:00").getDay() === 0 ? 6 : new Date(d.date + "T00:00:00").getDay() - 1]}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="font-display text-[26px] text-eel mt-1">Hey, Azizhon</div>
      <div className="text-wolf font-bold mb-[18px]">
        {nothing ? "All done for today — nice work" : "New words are waiting for you today"}
        {streak?.status === "broken" && streak.best > 0 && " · streak broke, a new one starts today"}
      </div>

      {err && <div className="rounded-2xl border-2 border-cardinal bg-cardinal/10 text-cardinalDark px-4 py-3 text-sm font-bold mb-4">{err}</div>}

      <div className="relative rounded-2xl p-5 bg-white border-2 border-swan shadow-card">
        <h3 className="m-0 mb-3.5 text-[12px] tracking-wide uppercase text-wolf font-extrabold">Today&apos;s plan</h3>
        <div className="flex gap-3 mb-[18px]">
          <div className="flex-1 bg-polar rounded-2xl p-3.5 text-center border-2 border-swan">
            <div className="font-display text-[32px] leading-none text-feather">{toLearn}</div>
            <div className="text-xs text-wolf font-bold mt-1">to learn</div>
          </div>
          <div className="flex-1 bg-polar rounded-2xl p-3.5 text-center border-2 border-swan">
            <div className="font-display text-[32px] leading-none text-macaw">{toReview}</div>
            <div className="text-xs text-wolf font-bold mt-1">to review</div>
          </div>
        </div>
        {nothing ? (
          <Link href="/add"><DuoButton variant="green">Add words</DuoButton></Link>
        ) : (
          <Link href="/study">
            <DuoButton variant="green">Start lesson <Icon name="arrow" style={{ width: 19, height: 19 }} /></DuoButton>
          </Link>
        )}
        <div className="flex gap-2 mt-3.5 text-xs text-wolf font-bold justify-center">Passive: <em className="not-italic text-eel font-extrabold">{s?.today.passive ?? 0}/{s?.caps.passivePerDay ?? 8}</em> · Active: <em className="not-italic text-eel font-extrabold">{s?.today.active ?? 0}/{s?.caps.activePerDay ?? 12}</em></div>
        {s && s.laterToday.count > 0 && (
          <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-macaw font-bold">
            <Icon name="repeat" style={{ width: 13, height: 13 }} />
            more today: <b>{s.laterToday.count}</b> words
            {s.laterToday.nextAt && <>· next in <b>{formatDueIn(s.laterToday.nextAt)}</b></>}
          </div>
        )}
      </div>

      <Link href="/reading" className="mt-3 block">
        <DuoButton variant="blue"><Icon name="book" style={{ width: 18, height: 18 }} /> Mini-reading from today&apos;s words</DuoButton>
      </Link>

      <div className="grid grid-cols-3 gap-2.5 mt-4">
        <div className="bg-white border-2 border-swan rounded-2xl p-3 text-center"><b className="font-display text-xl block text-eel">{s?.counts.total ?? 0}</b><span className="text-[11px] text-wolf font-bold">total words</span></div>
        <div className="bg-white border-2 border-swan rounded-2xl p-3 text-center"><b className="font-display text-xl block text-feather">{s?.counts.mastered ?? 0}</b><span className="text-[11px] text-wolf font-bold">active</span></div>
        <div className="bg-white border-2 border-swan rounded-2xl p-3 text-center"><b className="font-display text-xl block text-macaw">{s?.counts.learning ?? 0}</b><span className="text-[11px] text-wolf font-bold">in progress</span></div>
      </div>

      <Link href="/add" className="mt-4 block">
        <DuoButton variant="white"><Icon name="plus" style={{ width: 18, height: 18 }} /> Add words</DuoButton>
      </Link>
    </div>
  );
}
