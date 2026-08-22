"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/shared/ui/Icon";
import { DuoButton } from "@/shared/ui/Button";
import { BackButton } from "@/shared/ui/BackButton";

interface ReadingWord { word: string; tr1: string; }
interface Pick_ { word: string; sentence: string; }
interface LookupResult {
  tr1?: string;
  tr2?: string;
  existing?: { id: string; word: string; tr1: string; status: string };
}

// Splits the story on **word** markers placed by the model around today's
// target words, into plain text and highlighted chunks — no third-party
// markdown parser, the model's markup is always simple and predictable.
function splitHighlighted(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((chunk, i) => ({ text: chunk, hl: i % 2 === 1 }));
}

// Splits the story into sentences (for translation context), without
// touching markup markers — periods/!/? never occur inside them.
function sentencesOf(story: string): string[] {
  return (story.match(/[^.!?]+[.!?]*/g) ?? [story]).map((s) => s.trim()).filter(Boolean);
}

const WORD_RE = /^[A-Za-z']+$/;

// Makes every word in a sentence clickable (for lookup in context), while
// preserving the highlight on today's target words from **markers**.
function renderSentence(sentence: string, keyPrefix: string, onPick: (word: string, sentence: string) => void) {
  const plain = sentence.replace(/\*\*(.+?)\*\*/g, "$1");
  let idx = 0;
  return splitHighlighted(sentence).flatMap((seg) =>
    seg.text.split(/([A-Za-z']+)/).map((part) => {
      idx++;
      if (!part) return null;
      if (!WORD_RE.test(part)) return <span key={`${keyPrefix}-${idx}`}>{part}</span>;
      return (
        <span
          key={`${keyPrefix}-${idx}`}
          role="button"
          tabIndex={0}
          onClick={() => onPick(part, plain)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onPick(part, plain); }}
          className={`cursor-pointer rounded px-0.5 -mx-0.5 transition-colors hover:bg-bee/25 active:bg-bee/40 ${seg.hl ? "text-macawDark bg-macaw/10" : ""}`}
        >
          {part}
        </span>
      );
    })
  );
}

export default function ReadingScreen() {
  const router = useRouter();
  const [story, setStory] = useState<string | null>(null);
  const [words, setWords] = useState<ReadingWord[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  const [pick, setPick] = useState<Pick_ | null>(null);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [addState, setAddState] = useState<"idle" | "adding" | "added" | "error">("idle");

  function load() {
    setLoading(true); setErr(null); setStory(null);
    try { speechSynthesis.cancel(); } catch {}
    fetch("/api/reading")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErr(d.error);
        else { setStory(d.story); setWords(d.words ?? []); }
      })
      .catch(() => setErr("Failed to load the story — check your connection"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    return () => { try { speechSynthesis.cancel(); } catch {} };
  }, []);

  function playAll() {
    if (!story) return;
    try {
      speechSynthesis.cancel();
      const plain = story.replace(/\*\*(.+?)\*\*/g, "$1");
      const u = new SpeechSynthesisUtterance(plain);
      u.lang = "en-US";
      u.rate = 0.95;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      speechSynthesis.speak(u);
    } catch {}
  }

  function onWordPick(word: string, sentence: string) {
    setPick({ word, sentence });
    setLookup(null); setLookupErr(null); setAddState("idle");
    setLookupLoading(true);
    fetch("/api/reading/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, sentence }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.error) setLookupErr(d.error); else setLookup(d); })
      .catch(() => setLookupErr("Failed to get the translation"))
      .finally(() => setLookupLoading(false));
  }

  async function addWord() {
    if (!pick || !lookup || lookup.existing) return;
    setAddState("adding");
    try {
      const r = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: pick.word, tr1: lookup.tr1, tr2: lookup.tr2, example: pick.sentence }),
      });
      const d = await r.json();
      setAddState(d.error ? "error" : "added");
    } catch {
      setAddState("error");
    }
  }

  return (
    <div className="rise">
      <div className="flex items-center gap-3 mb-5">
        <BackButton />
        <h2 className="font-display text-[22px] text-eel">Mini-reading</h2>
      </div>

      {loading && (
        <Center>
          <div className="pop text-macaw"><Icon name="book" style={{ width: 56, height: 56 }} /></div>
          <p className="text-wolf font-bold mt-3">Preparing a story from today&apos;s words…</p>
        </Center>
      )}

      {err && !loading && (
        <Center>
          <p className="text-cardinalDark font-bold text-center">{err}</p>
          <div className="w-full mt-4"><DuoButton variant="white" onClick={load}>Try again</DuoButton></div>
        </Center>
      )}

      {story && !loading && !err && (
        <>
          <div className="rounded-3xl bg-white border-2 border-swan shadow-card p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-wolf font-extrabold uppercase tracking-wide">{words.length} words of the day in the story</span>
              <button
                onClick={playAll}
                aria-label="Play the story"
                className={`w-11 h-11 rounded-full bg-polar border-2 border-swan grid place-items-center active:scale-90 transition-transform ${speaking ? "text-feather" : "text-macaw"}`}
              >
                <Icon name="volume" style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <p className="text-[10px] text-hare font-bold mb-3">tap any word — I&apos;ll show the translation, and you can add it to the dictionary</p>
            <p className="text-[17px] leading-relaxed text-eel font-semibold">
              {sentencesOf(story).map((sentence, si) => (
                <span key={si}>{renderSentence(sentence, `s${si}`, onWordPick)} </span>
              ))}
            </p>
          </div>

          {words.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {words.map((w) => (
                <span key={w.word} className="px-2.5 py-1 rounded-full text-xs font-bold border-2 border-swan bg-white text-wolf">
                  {w.word} <span className="text-hare">— {w.tr1}</span>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2.5 mt-5">
            <DuoButton variant="white" onClick={load}>Another story</DuoButton>
            <DuoButton variant="green" onClick={() => router.push("/")}>Done</DuoButton>
          </div>
        </>
      )}

      {pick && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setPick(null)}>
          <div className="rise w-full max-w-[440px] bg-white rounded-t-3xl border-2 border-b-0 border-swan p-5 pb-7" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-display text-[20px] text-eel">{pick.word}</span>
              <button onClick={() => setPick(null)} aria-label="Close" className="w-8 h-8 rounded-full bg-polar border-2 border-swan grid place-items-center text-wolf">
                <Icon name="x" style={{ width: 14, height: 14, strokeWidth: 3 }} />
              </button>
            </div>
            <p className="text-xs text-hare font-semibold mb-4 leading-relaxed">«{pick.sentence}»</p>

            {lookupLoading && <p className="text-wolf font-bold text-sm">Looking up the translation…</p>}
            {lookupErr && !lookupLoading && <p className="text-cardinalDark font-bold text-sm">{lookupErr}</p>}

            {lookup?.existing && (
              <div className="rounded-2xl bg-polar border-2 border-swan p-3.5">
                <p className="text-eel font-bold text-sm">Already in the dictionary — {lookup.existing.tr1 || "no translation"}</p>
                <p className="text-wolf text-xs font-semibold mt-1">{lookup.existing.status}</p>
              </div>
            )}

            {lookup && !lookup.existing && (
              <>
                <div className="rounded-2xl bg-polar border-2 border-swan p-3.5 mb-4">
                  <p className="text-eel font-extrabold text-lg">{lookup.tr1}</p>
                  {lookup.tr2 && <p className="text-wolf text-xs font-semibold mt-0.5">{lookup.tr2}</p>}
                </div>
                {addState === "added" ? (
                  <p className="text-featherDark font-extrabold text-sm text-center">Added! It will appear in today&apos;s lesson.</p>
                ) : (
                  <DuoButton variant="green" disabled={addState === "adding"} onClick={addWord}>
                    {addState === "adding" ? "Adding…" : "Add to dictionary"}
                  </DuoButton>
                )}
                {addState === "error" && <p className="text-cardinalDark font-bold text-xs mt-2 text-center">Failed to add, try again</p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="rise flex flex-col items-center justify-center gap-2 min-h-[50vh] text-center">{children}</div>;
}
