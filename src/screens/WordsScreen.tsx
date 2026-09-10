"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/shared/ui/Icon";
import { BackButton } from "@/shared/ui/BackButton";

interface WordRow {
  id: string;
  word: string;
  tr1: string;
  status: string;
  priority: number;
  correctStreak: number;
  debtSince: string | null;
  batchId: string | null;
  activeWorthy: boolean | null;
}

const STATUS_LABEL: Record<string, string> = {
  "Не изучен": "New",
  "Изучен пассивно": "Recognized",
  "Выбран для активного изучения": "Picked for active",
  "Изучен активно": "Mastered",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "Не изучен", label: "New" },
  { key: "Изучен пассивно", label: "Recognized" },
  { key: "Выбран для активного изучения", label: "Picked" },
  { key: "Изучен активно", label: "Mastered" },
  { key: "debt", label: "Debt" },
] as const;

export default function WordsScreen() {
  const [words, setWords] = useState<WordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [sortAz, setSortAz] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/words")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErr(d.error);
        else setWords(d.words ?? []);
      })
      .catch(() => setErr("Failed to load the word list"))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    let list = words;
    if (filter === "debt") list = list.filter((w) => w.debtSince !== null);
    else if (filter !== "all") list = list.filter((w) => w.status === filter);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((w) => w.word.toLowerCase().includes(needle) || w.tr1.toLowerCase().includes(needle));
    return [...list].sort((a, b) => (sortAz ? a.word.localeCompare(b.word) : b.priority - a.priority));
  }, [words, filter, sortAz, q]);

  return (
    <div className="rise">
      <div className="flex items-center gap-3 mb-5">
        <BackButton />
        <h2 className="font-display text-[22px] text-eel">All words</h2>
        <span className="text-xs text-hare font-bold ml-auto">{words.length} total</span>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search…"
        className="w-full rounded-2xl border-2 border-swan bg-white px-3.5 py-2.5 text-sm font-semibold text-eel outline-none focus:border-macaw transition-colors mb-3"
      />

      <div className="flex gap-2 overflow-x-auto mb-3 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-extrabold border-2 transition-colors ${
              filter === f.key ? "bg-macaw border-macaw text-white" : "bg-white border-swan text-wolf"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-wolf font-extrabold uppercase tracking-wide">{shown.length} shown</span>
        <button
          onClick={() => setSortAz((x) => !x)}
          className="text-xs font-extrabold text-macaw flex items-center gap-1"
        >
          <Icon name="repeat" style={{ width: 13, height: 13 }} />
          sort: {sortAz ? "A–Z" : "priority"}
        </button>
      </div>

      {loading && <p className="text-wolf font-bold text-center mt-8">Loading…</p>}
      {err && !loading && <p className="text-cardinalDark font-bold text-center mt-8">{err}</p>}

      {!loading && !err && (
        <div className="flex flex-col gap-2">
          {shown.map((w) => (
            <div key={w.id} className="rounded-2xl bg-white border-2 border-swan p-3.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-eel truncate">{w.word}</span>
                  {w.debtSince && <Icon name="flame" fill style={{ width: 13, height: 13 }} className="text-fox shrink-0" />}
                  {w.batchId && <Icon name="book" style={{ width: 12, height: 12 }} className="text-macaw shrink-0" />}
                </div>
                <div className="text-xs text-hare font-semibold truncate">{w.tr1 || "—"}</div>
              </div>
              <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-full bg-polar border-2 border-swan text-wolf">
                {STATUS_LABEL[w.status] ?? w.status}
              </span>
              <span className="shrink-0 w-9 h-9 rounded-full bg-polar border-2 border-swan grid place-items-center text-xs font-extrabold text-eel">
                {w.priority}
              </span>
            </div>
          ))}
          {shown.length === 0 && <p className="text-wolf font-bold text-center mt-8">No words match.</p>}
        </div>
      )}
    </div>
  );
}
