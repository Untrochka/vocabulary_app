"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/shared/ui/Icon";
import { DuoButton } from "@/shared/ui/Button";
import { BackButton } from "@/shared/ui/BackButton";
import type { PosGroup } from "@/shared/lib/translate";
import { parseEntry } from "@/shared/lib/parseEntry";
import { findMatches, type MatchCandidate } from "@/shared/lib/dedupe";

interface ExistingWord extends MatchCandidate {
  tr1: string; tr2: string; ipa: string; example: string;
}

const NEW_OPTION = "__new__";

export default function AddScreen() {
  const [tab, setTab] = useState<"one" | "bulk">("one");
  const [one, setOne] = useState({ word: "", tr1: "", tr2: "", ipa: "", example: "" });
  const [bulk, setBulk] = useState("");
  const [bulkChecked, setBulkChecked] = useState<{ text: string; isDup: boolean }[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [posOptions, setPosOptions] = useState<PosGroup[]>([]);
  const [allWords, setAllWords] = useState<ExistingWord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  function refreshAllWords() {
    fetch("/api/words").then((r) => r.json()).then((d) => {
      if (!d.error && Array.isArray(d.words)) setAllWords(d.words);
    }).catch(() => {});
  }

  useEffect(() => { refreshAllWords(); }, []);

  const matches = findMatches(one.word, allWords);

  function pickMatch(value: string) {
    if (value === NEW_OPTION) { setEditingId(null); return; }
    const m = allWords.find((w) => w.id === value);
    if (!m) return;
    setEditingId(m.id);
    setPosOptions([]);
    setOne({ word: m.word, tr1: m.tr1, tr2: m.tr2, ipa: m.ipa, example: m.example });
  }

  async function translateOne() {
    const w = one.word.trim();
    if (!w) return;
    setTranslating(true); setMsg(null); setPosOptions([]);
    try {
      const r = await fetch(`/api/translate?word=${encodeURIComponent(w)}`);
      const d = await r.json();
      if (d.error) { setMsg("⚠ " + d.error); }
      else {
        setOne((o) => ({
          ...o,
          tr1: d.tr1 ?? "",
          tr2: d.tr2 ?? "",
          ipa: d.ipa ?? "",
          example: d.example ?? "",
        }));
        setPosOptions(Array.isArray(d.byPos) ? d.byPos : []);
      }
    } catch { setMsg("⚠ Network error"); }
    setTranslating(false);
  }

  // Switch part of speech — no new request, from the groups already fetched.
  function pickPos(pos: string) {
    const g = posOptions.find((x) => x.pos === pos);
    if (!g) return;
    setOne((o) => ({ ...o, tr2: g.pos, tr1: g.terms.slice(0, 4).join(", ") }));
  }

  async function enrich() {
    setEnriching(true); setMsg(null);
    try {
      const r = await fetch("/api/words/enrich", { method: "POST" });
      const d = await r.json();
      if (d.error) setMsg("⚠ " + d.error);
      else setMsg(`Filled: ${d.filled} of ${d.total} · Not found in dictionary: ${d.notFound}`);
    } catch { setMsg("⚠ Network error"); }
    setEnriching(false);
  }

  async function submit(payload: any) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/words", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      const skippedNote = d.skipped?.length
        ? ` · skipped as gibberish: ${d.skipped.map((s: any) => `${s.word} (${s.reason})`).join(", ")}`
        : "";
      if (d.error) setMsg("⚠ " + d.error + skippedNote);
      else {
        setMsg(`Added: ${d.created}${skippedNote}`);
        setOne({ word: "", tr1: "", tr2: "", ipa: "", example: "" });
        setBulk(""); setBulkChecked(null);
        setEditingId(null);
        refreshAllWords();
      }
    } catch { setMsg("⚠ Network error"); }
    setBusy(false);
  }

  async function saveEdit() {
    if (!editingId) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/words/${editingId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: one.word, tr1: one.tr1, tr2: one.tr2, ipa: one.ipa, example: one.example }),
      });
      const d = await r.json();
      if (d.error) setMsg("⚠ " + d.error);
      else {
        setMsg("Saved");
        setOne({ word: "", tr1: "", tr2: "", ipa: "", example: "" });
        setEditingId(null);
        refreshAllWords();
      }
    } catch { setMsg("⚠ Network error"); }
    setBusy(false);
  }

  function checkBulk() {
    const raw = bulk.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const checked = raw.map((line) => {
      const { word } = parseEntry(line);
      return { text: line, isDup: findMatches(word, allWords).length > 0 };
    });
    setBulkChecked(checked);
  }

  const input = "w-full py-3 px-4 rounded-2xl bg-white border-2 border-swan text-eel font-bold text-[15px] outline-none focus:border-macaw placeholder:text-hare placeholder:font-semibold";

  return (
    <div className="rise">
      <div className="flex items-center gap-3 mb-5">
        <BackButton />
        <h2 className="font-display text-[22px] text-eel">Add words</h2>
      </div>

      <div className="flex gap-2 bg-polar border-2 border-swan rounded-2xl p-1 mb-4">
        {(["one", "bulk"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 rounded-xl font-extrabold text-sm ${tab === t ? "bg-feather text-white" : "text-wolf"}`}>{t === "one" ? "Single word" : "Batch"}</button>
        ))}
      </div>

      {tab === "one" ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2">
            <input className={input} placeholder="Word or phrase" value={one.word}
              onChange={(e) => { setOne({ ...one, word: e.target.value }); setEditingId(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") translateOne(); }} />
            <button disabled={translating || !one.word.trim()} onClick={translateOne}
              className="shrink-0 px-4 rounded-2xl bg-white border-2 border-swan font-extrabold text-sm text-macaw flex items-center gap-1.5 disabled:opacity-50">
              <Icon name="repeat" style={{ width: 15, height: 15 }} /> {translating ? "…" : "Translate"}
            </button>
          </div>

          {matches.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-beeDark font-extrabold uppercase tracking-wide">Looks like this is already in the dictionary</label>
              <select className={input} value={editingId ?? NEW_OPTION} onChange={(e) => pickMatch(e.target.value)}>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>{m.word}{m.tr1 ? ` — ${m.tr1}` : ""}</option>
                ))}
                <option value={NEW_OPTION}>+ Add new</option>
              </select>
              {editingId && <p className="text-hare text-xs font-bold">Editing an existing word — the fields below were filled in from it.</p>}
            </div>
          )}

          {posOptions.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {posOptions.map((g) => (
                <button key={g.pos} onClick={() => pickPos(g.pos)}
                  className={`px-3 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wide border-2 ${one.tr2 === g.pos ? "bg-macaw text-white border-macaw" : "bg-white text-wolf border-swan"}`}>
                  {g.pos}
                </button>
              ))}
            </div>
          )}

          <input className={input} placeholder="Translation (in Russian)" value={one.tr1} onChange={(e) => setOne({ ...one, tr1: e.target.value })} />
          <input className={input} placeholder="Part of speech (noun, verb…)" value={one.tr2} onChange={(e) => setOne({ ...one, tr2: e.target.value })} />
          <input className={input} placeholder="Transcription /…/" value={one.ipa} onChange={(e) => setOne({ ...one, ipa: e.target.value })} />
          <input className={input} placeholder="Example (optional)" value={one.example} onChange={(e) => setOne({ ...one, example: e.target.value })} />
          <div className="mt-1.5">
            <DuoButton variant="green" disabled={busy || !one.word.trim()} onClick={() => (editingId ? saveEdit() : submit(one))}>
              <Icon name={editingId ? "check" : "plus"} style={{ width: 18, height: 18 }} /> {editingId ? "Save" : "Add"}
            </DuoButton>
          </div>
          <p className="text-hare text-xs font-bold">Leave the translation empty — it will be filled in automatically when added.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="text-wolf text-sm font-semibold">Paste words separated by commas or on new lines. Translation, part of speech, transcription, and example will be filled in automatically. Part of speech can be set in parentheses: <span className="text-macaw">bank (noun)</span>.</p>
          <textarea className={`${input} min-h-[160px] resize-y leading-relaxed`} placeholder="word, uncle, clear, to elaborate, bank (noun)…" value={bulk}
            onChange={(e) => { setBulk(e.target.value); setBulkChecked(null); }} />

          <DuoButton variant="blue" disabled={!bulk.trim()} onClick={checkBulk}>
            <Icon name="repeat" style={{ width: 15, height: 15 }} /> Check
          </DuoButton>

          {bulkChecked && (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-1.5">
                {bulkChecked.map((c, idx) => (
                  <span key={idx} className={`px-2.5 py-1 rounded-full text-xs font-bold border-2 ${c.isDup ? "text-cardinalDark border-cardinal bg-cardinal/10" : "text-wolf border-swan bg-white"}`}>{c.text}</span>
                ))}
              </div>
              {bulkChecked.some((c) => c.isDup) && (
                <p className="text-cardinalDark text-xs font-bold">Highlighted words are already in the dictionary.</p>
              )}
            </div>
          )}

          <div className="mt-1.5">
            <DuoButton variant="green" disabled={busy || !bulk.trim()} onClick={() => submit({ text: bulk })}>
              <Icon name="plus" style={{ width: 18, height: 18 }} /> Add batch
            </DuoButton>
          </div>
        </div>
      )}

      <div className="mt-5">
        <DuoButton variant="white" disabled={enriching || busy} onClick={enrich}>
          <Icon name="repeat" style={{ width: 16, height: 16 }} />
          {enriching ? "Filling…" : "Fill in empty entries from the dictionary"}
        </DuoButton>
      </div>

      {msg && <div className="mt-3 rounded-2xl border-2 border-swan bg-polar px-4 py-3 text-sm font-bold text-center text-eel">{msg}</div>}
    </div>
  );
}
