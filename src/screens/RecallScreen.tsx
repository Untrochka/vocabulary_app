"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/shared/ui/Icon";
import { DuoButton } from "@/shared/ui/Button";
import { BackButton } from "@/shared/ui/BackButton";

interface RecallWord {
  id: string;
  tr1: string;
  word: string | null; // only present once this word has been answered
  explanation: { text: string; verdict: string | null; feedback: string | null } | null;
}
interface DayInfo { date: string; count: number; }

// Formats a "YYYY-MM-DD" as e.g. "Aug 20" — parsed as a local calendar date
// (T00:00:00), not a UTC instant, so it doesn't shift a day depending on
// the reader's timezone. Mirrors ReadingScreen's formatDayLabel.
function formatDayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const VERDICT_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  correct: { bg: "bg-feather/15 border-featherDark", text: "text-featherDark", label: "Nailed it" },
  partial: { bg: "bg-bee/15 border-beeDark", text: "text-beeDark", label: "Partial" },
  wrong: { bg: "bg-cardinal/10 border-cardinal", text: "text-cardinalDark", label: "Not quite" },
};

export default function RecallScreen() {
  const router = useRouter();
  const [days, setDays] = useState<DayInfo[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // null = today
  const [words, setWords] = useState<RecallWord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  function load(day: string | null) {
    setSelectedDay(day);
    setLoading(true); setErr(null);
    fetch(day ? `/api/recall?day=${day}` : "/api/recall")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErr(d.error);
        else {
          setWords(d.words ?? []);
          setDrafts(Object.fromEntries((d.words ?? []).map((w: RecallWord) => [w.id, ""])));
        }
      })
      .catch(() => setErr("Failed to load today's words"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(null);
    fetch("/api/recall/days").then((r) => r.json()).then((d) => setDays(d.days ?? [])).catch(() => {});
  }, []);

  async function submit(w: RecallWord, text: string) {
    if (submitting[w.id]) return;
    setSubmitting((s) => ({ ...s, [w.id]: true }));
    try {
      const day = selectedDay ?? new Date().toISOString().slice(0, 10);
      const r = await fetch("/api/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: w.id, forDate: day, text }),
      });
      const d = await r.json();
      if (!d.error) {
        setWords((ws) => ws.map((x) => (x.id === w.id ? { ...x, word: d.word, explanation: { text, verdict: d.verdict, feedback: d.feedback } } : x)));
      }
    } catch {
      // leave the draft in place — user can retry
    } finally {
      setSubmitting((s) => ({ ...s, [w.id]: false }));
    }
  }

  return (
    <div className="rise">
      <div className="flex items-center gap-3 mb-5">
        <BackButton />
        <h2 className="font-display text-[22px] text-eel">Recall</h2>
      </div>

      {days.length > 0 && (
        <div className="flex gap-2 overflow-x-auto mb-4 pb-1">
          <button
            onClick={() => load(null)}
            className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-extrabold border-2 transition-colors ${
              selectedDay === null ? "bg-macaw border-macaw text-white" : "bg-white border-swan text-wolf"
            }`}
          >
            Today
          </button>
          {days.map((d) => (
            <button
              key={d.date}
              onClick={() => load(d.date)}
              className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-extrabold border-2 transition-colors ${
                selectedDay === d.date ? "bg-macaw border-macaw text-white" : "bg-white border-swan text-wolf"
              }`}
            >
              {formatDayLabel(d.date)} · {d.count}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <Center>
          <div className="pop text-macaw"><Icon name="mic" style={{ width: 56, height: 56 }} /></div>
          <p className="text-wolf font-bold mt-3">Loading…</p>
        </Center>
      )}

      {err && !loading && (
        <Center>
          <p className="text-cardinalDark font-bold text-center">{err}</p>
          <div className="w-full mt-4"><DuoButton variant="white" onClick={() => load(selectedDay)}>Try again</DuoButton></div>
        </Center>
      )}

      {!loading && !err && words.length === 0 && (
        <Center>
          <div className="text-macaw"><Icon name="mic" style={{ width: 48, height: 48 }} /></div>
          <p className="text-wolf font-bold mt-3 text-center">
            No words became active on {selectedDay ? formatDayLabel(selectedDay) : "today"}.
          </p>
        </Center>
      )}

      {!loading && !err && words.length > 0 && (
        <>
          <p className="text-[10px] text-hare font-bold mb-3">
            only the translation is shown — type the English word from memory
          </p>
          <div className="flex flex-col gap-3.5">
            {words.map((w) => {
              const verdict = w.explanation?.verdict;
              const style = verdict ? VERDICT_STYLE[verdict] : null;
              const answered = w.explanation != null;
              return (
                <div key={w.id} className="rounded-3xl bg-white border-2 border-swan shadow-card p-4">
                  <div className="text-[11px] text-wolf font-extrabold uppercase tracking-wide mb-1">hint</div>
                  <div className="font-display text-lg text-eel mb-2.5">{w.tr1}</div>

                  {answered ? (
                    <>
                      <p className="text-xs text-hare font-semibold">your answer: <span className="text-wolf font-bold">{w.explanation!.text || "—"}</span></p>
                      {style && (
                        <div className={`mt-2.5 rounded-2xl border-2 px-3.5 py-2.5 ${style.bg}`}>
                          <div className="flex items-baseline justify-between">
                            <span className={`text-xs font-extrabold ${style.text}`}>{style.label}</span>
                            <span className="font-display text-base text-eel">{w.word}</span>
                          </div>
                          {w.explanation?.feedback && <p className="text-xs text-wolf font-semibold mt-1">{w.explanation.feedback}</p>}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <input
                        value={drafts[w.id] ?? ""}
                        onChange={(e) => setDrafts((d) => ({ ...d, [w.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") submit(w, (drafts[w.id] ?? "").trim()); }}
                        placeholder="Type the word…"
                        className="w-full rounded-2xl border-2 border-swan bg-polar px-3.5 py-2.5 text-sm font-semibold text-eel outline-none focus:border-macaw transition-colors"
                      />
                      <div className="flex gap-2 mt-2.5">
                        <DuoButton
                          variant="blue"
                          size="sm"
                          disabled={submitting[w.id] || !(drafts[w.id] ?? "").trim()}
                          onClick={() => submit(w, (drafts[w.id] ?? "").trim())}
                        >
                          {submitting[w.id] ? "Checking…" : "Check"}
                        </DuoButton>
                        <DuoButton variant="white" size="sm" disabled={submitting[w.id]} onClick={() => submit(w, "")}>
                          Don&apos;t remember
                        </DuoButton>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5">
            <DuoButton variant="green" onClick={() => router.push("/")}>Done</DuoButton>
          </div>
        </>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="rise flex flex-col items-center justify-center gap-2 min-h-[50vh] text-center">{children}</div>;
}
