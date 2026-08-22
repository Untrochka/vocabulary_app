"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type Name as IconName } from "@/shared/ui/Icon";
import { DuoButton } from "@/shared/ui/Button";
import { nextIntervalLabel, type Grade } from "@/shared/lib/srs";
import { buildSpeakingPrompts } from "@/shared/lib/speakingPrompts";
import { submitAnswer, type StudyAnswerPayload } from "@/shared/lib/studyApi";
import { useSession } from "@/shared/lib/useSession";
import { buildStudyQueue, type Item } from "@/shared/lib/studyQueue";
import type { SessionCard } from "@/entities/session/model";

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

const GRADES: { g: Grade; label: string; color: string; border: string; bg: string }[] = [
  { g: 0, label: "Again", color: "text-cardinalDark", border: "border-cardinal", bg: "bg-cardinal/10" },
  { g: 1, label: "Hard", color: "text-beeDark", border: "border-bee", bg: "bg-bee/10" },
  { g: 2, label: "Good", color: "text-featherDark", border: "border-feather", bg: "bg-feather/10" },
  { g: 3, label: "Easy", color: "text-macawDark", border: "border-macaw", bg: "bg-macaw/10" },
];

const RETRY_GAP = 2; // how many cards to wait before retrying within a block

const speak = (t: string) => { try { const u = new SpeechSynthesisUtterance(t); u.lang = "en-US"; speechSynthesis.speak(u); } catch {} };

export default function StudyScreen() {
  const router = useRouter();
  const { session, error: err } = useSession();
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tally, setTally] = useState({ learned: 0, reviewed: 0, active: 0 });
  const [touchedWords, setTouchedWords] = useState<{ word: string; tr1: string }[]>([]);
  const [cardError, setCardError] = useState<{ message: string; payload: StudyAnswerPayload; key: keyof typeof tally } | null>(null);

  useEffect(() => {
    if (session) setQueue(buildStudyQueue(session));
  }, [session]);

  const speakingIdeas = useMemo(() => buildSpeakingPrompts(touchedWords), [touchedWords]);

  const total = queue?.length ?? 0;
  const cur = queue?.[i];
  const pct = total ? Math.round((i / total) * 100) : 0;

  function advance() {
    setBusy(false);
    setFlipped(false);
    setI((x) => x + 1);
  }

  // Defers the card to later within the same review block — no server
  // request. Used when the word hasn't passed the check yet.
  function retryLater() {
    if (!cur) return;
    setQueue((q) => {
      if (!q) return q;
      const copy = [...q];
      const insertAt = Math.min(i + 1 + RETRY_GAP, copy.length);
      copy.splice(insertAt, 0, cur);
      return copy;
    });
    setFlipped(false);
    setI((x) => x + 1);
  }

  function noteWord(w: SessionCard) {
    setTouchedWords((list) => (list.some((x) => x.word === w.word) ? list : [...list, { word: w.word, tr1: w.tr1 }]));
  }

  async function send(payload: StudyAnswerPayload, key: keyof typeof tally) {
    if (busy) return;
    setBusy(true);
    setCardError(null);
    const result = await submitAnswer(payload);
    if (result.status === "error") {
      // Notion rejected the write even after the server-side retry — we
      // honestly show this and stay on the card instead of moving on as if nothing happened.
      setBusy(false);
      setCardError({ message: result.message, payload, key });
      return;
    }
    setTally((t) => ({ ...t, [key]: t[key] + 1 }));
    advance();
  }

  function retryCard() {
    if (!cardError) return;
    send(cardError.payload, cardError.key);
  }

  const onLearnShow = () => { setFlipped(false); setI((x) => x + 1); };

  function onCheckGrade(mode: "learnCheck" | "activeLearnCheck", w: SessionCard, g: Grade) {
    if (busy) return;
    if (g <= 1) { retryLater(); return; }
    noteWord(w);
    if (mode === "learnCheck") {
      send({ id: w.id, action: "learn", grade: g }, "learned");
    } else {
      send({ id: w.id, action: "review", mode: "active", grade: g }, "active");
    }
  }

  function onReviewGrade(w: SessionCard, mode: "passive" | "active", g: Grade) {
    if (g >= 2) noteWord(w);
    send({ id: w.id, action: "review", mode, grade: g }, mode === "passive" ? "reviewed" : "active");
  }

  if (err) return <Center><p className="text-cardinalDark font-bold text-center">{err}</p><Back router={router} /></Center>;
  if (!queue) return <Center><p className="text-wolf font-bold">Loading…</p></Center>;

  if (!cur) {
    return (
      <div className="rise text-center pt-10">
        <div className="pop text-bee"><Icon name="trophy" fill style={{ width: 84, height: 84 }} /></div>
        <h2 className="font-display text-[30px] text-eel mt-3.5 mb-1.5">Lesson complete!</h2>
        <p className="text-wolf font-bold mb-[22px]">{tally.learned} learned · {tally.reviewed + tally.active} reviewed</p>
        <div className="flex gap-3 justify-center mb-[26px]">
          <Chip b={`+${tally.learned * 10 + (tally.reviewed + tally.active) * 4}`} s="XP" color="text-bee" />
          <Chip b={`${tally.active}`} s="active" color="text-feather" />
          <Chip b={`${tally.learned}`} s="new" color="text-feather" />
        </div>
        {speakingIdeas.length > 0 && (
          <div className="text-left rounded-2xl p-5 mb-[22px] bg-white border-2 border-swan shadow-card">
            <h3 className="m-0 mb-3.5 text-[12px] tracking-wide uppercase text-wolf font-extrabold flex items-center gap-1.5">
              <Icon name="mic" style={{ width: 15, height: 15 }} className="text-macaw" /> Speaking ideas for today
            </h3>
            <div className="flex flex-col gap-2.5">
              {speakingIdeas.map((idea, idx) => (
                <div key={idx} className="bg-polar rounded-2xl p-3.5 border-2 border-swan text-sm font-semibold leading-relaxed text-eel">{idea}</div>
              ))}
            </div>
          </div>
        )}
        <DuoButton variant="green" onClick={() => router.push("/")}>Home</DuoButton>
      </div>
    );
  }

  // "divider" is the only item type with word: null, and the only one where w below is unread.
  const w = cur.word!;

  return (
    <div className="rise">
      {/* lesson header — exit cross + thick progress bar, like Duolingo */}
      <div className="flex items-center gap-3 mb-[18px]">
        <button onClick={() => router.push("/")} aria-label="Exit lesson" className="text-hare hover:text-wolf shrink-0">
          <Icon name="x" style={{ width: 24, height: 24, strokeWidth: 3 }} />
        </button>
        <div className="flex-1 h-4 rounded-full bg-swan overflow-hidden">
          <div className="h-full rounded-full bg-feather transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {cardError && (
        <div className="rounded-2xl border-2 border-cardinal bg-cardinal/10 text-cardinalDark px-4 py-3 text-sm font-bold mb-4 flex items-center justify-between gap-3">
          <span>{cardError.message}</span>
          <button onClick={retryCard} disabled={busy} className="shrink-0 px-3 py-1.5 rounded-xl bg-cardinal/15 border-2 border-cardinal font-extrabold text-xs disabled:opacity-50">Retry</button>
        </div>
      )}

      {cur.type === "learnShow" && <Tag icon="book" cls="text-featherDark bg-feather/10">Learning a new word</Tag>}
      {cur.type === "learnCheck" && <Tag icon="check" cls="text-macawDark bg-macaw/10">Checking new words</Tag>}
      {cur.type === "passive" && <Tag icon="repeat" cls="text-macawDark bg-macaw/10">Review · recognition</Tag>}
      {cur.type === "activeLearnShow" && <Tag icon="zap" fill cls="text-beeDark bg-bee/10">Active word — memorize it first</Tag>}
      {cur.type === "activeLearnCheck" && <Tag icon="zap" fill cls="text-beeDark bg-bee/10">Checking an active word</Tag>}
      {cur.type === "active" && <Tag icon="zap" fill cls="text-beeDark bg-bee/10">Active practice</Tag>}

      {/* DIVIDER */}
      {cur.type === "divider" && (
        <>
          <Card>
            <div className="pop text-macaw"><Icon name="repeat" style={{ width: 56, height: 56 }} /></div>
            <h3 className="font-display text-[22px] text-eel mt-3">New words learned</h3>
            <p className="text-wolf font-bold mt-1.5">Now let&apos;s review words from previous days</p>
          </Card>
          <div className="mt-[18px]"><DuoButton variant="green" onClick={() => setI((x) => x + 1)}>Next <Icon name="arrow" style={{ width: 18, height: 18 }} /></DuoButton></div>
        </>
      )}

      {/* LEARN SHOW (passive) */}
      {cur.type === "learnShow" && (
        <>
          <Card>
            <DictEntry w={w} />
            <div className="mt-[18px] text-[13px] text-hare font-bold flex items-center gap-1.5"><Icon name="mic" style={{ width: 15, height: 15 }} /> Say it out loud and make up your own sentence</div>
          </Card>
          <div className="mt-[18px]"><DuoButton variant="green" onClick={onLearnShow} disabled={busy}>Got it <Icon name="arrow" style={{ width: 18, height: 18 }} /></DuoButton></div>
        </>
      )}

      {/* LEARN CHECK (passive) — same UI as a regular recognition review */}
      {cur.type === "learnCheck" && (
        <PassiveBody w={w} flipped={flipped} onFlip={() => setFlipped(true)}
          onPick={(g) => onCheckGrade("learnCheck", w, g)} disabled={busy}
          label={(g) => nextIntervalLabel(w.passive, g)} />
      )}

      {/* PASSIVE (due review) */}
      {cur.type === "passive" && (
        <PassiveBody w={w} flipped={flipped} onFlip={() => setFlipped(true)}
          onPick={(g) => onReviewGrade(w, "passive", g)} disabled={busy}
          label={(g) => nextIntervalLabel(w.passive, g)} />
      )}

      {/* ACTIVE LEARN SHOW — word + translation are shown right away, this isn't a test yet */}
      {cur.type === "activeLearnShow" && (
        <>
          <Card>
            <DictEntry w={w} compact />
            <div className="mt-[18px] text-[13px] text-hare font-bold flex items-center gap-1.5"><Icon name="mic" style={{ width: 15, height: 15 }} /> This is an active word — you&apos;ll need to recall it yourself soon</div>
          </Card>
          <div className="mt-[18px]"><DuoButton variant="green" onClick={onLearnShow} disabled={busy}>Got it <Icon name="arrow" style={{ width: 18, height: 18 }} /></DuoButton></div>
        </>
      )}

      {/* ACTIVE LEARN CHECK / ACTIVE (due review) — you type the word yourself, comparison is strict and without hints */}
      {(cur.type === "activeLearnCheck" || cur.type === "active") && (
        <ActiveBody key={w.id} w={w}
          onResult={(g) => (cur.type === "activeLearnCheck" ? onCheckGrade("activeLearnCheck", w, g) : onReviewGrade(w, "active", g))}
          disabled={busy}
          label={(g) => nextIntervalLabel(w.active, g)} />
      )}
    </div>
  );
}

// The word card's dictionary entry: large word, transcription, translation.
function DictEntry({ w, compact }: { w: SessionCard; compact?: boolean }) {
  return (
    <>
      <div className={`font-display leading-[1.05] text-eel ${compact ? "text-[36px]" : "text-[42px]"}`}>{w.word}</div>
      {w.ipa && <div className="text-macaw text-[17px] mt-2 font-bold">{w.ipa}</div>}
      <Speaker t={w.word} />
      <div className="h-px bg-swan w-4/5 my-5" />
      {w.tr2 && <div className="font-display italic text-macaw text-sm mb-1">{w.tr2}</div>}
      <div className="text-[18px] font-bold leading-snug text-eel">{w.tr1 || "—"}</div>
      {w.example && <div className="mt-4 text-sm text-wolf italic font-semibold leading-relaxed">&ldquo;{w.example}&rdquo;</div>}
    </>
  );
}

function PassiveBody({ w, flipped, onFlip, onPick, disabled, label }: { w: SessionCard; flipped: boolean; onFlip: () => void; onPick: (g: Grade) => void; disabled: boolean; label: (g: Grade) => string }) {
  return (
    <>
      <Card>
        {!flipped ? (
          <>
            <div className="font-display leading-[1.05] text-[42px] text-eel">{w.word}</div>
            {w.ipa && <div className="text-macaw text-[17px] mt-2 font-bold">{w.ipa}</div>}
            <Speaker t={w.word} />
            <div className="mt-4 text-xs text-hare font-bold">tap to check the translation</div>
          </>
        ) : (
          <div key="answer" className="card-reveal">
            <div className="font-display text-[28px] text-eel">{w.word}</div>
            <div className="h-px bg-swan w-4/5 my-5" />
            {w.tr2 && <div className="font-display italic text-macaw text-sm mb-1">{w.tr2}</div>}
            <div className="text-[18px] font-bold leading-snug text-eel">{w.tr1 || "—"}</div>
            {w.example && <div className="mt-4 text-sm text-wolf italic font-semibold leading-relaxed">&ldquo;{w.example}&rdquo;</div>}
          </div>
        )}
      </Card>
      <div className="mt-[18px]">
        {!flipped
          ? <DuoButton variant="blue" onClick={onFlip}>Show answer</DuoButton>
          : <Grades onPick={onPick} disabled={disabled} label={label} />}
      </div>
    </>
  );
}

function ActiveBody({ w, onResult, disabled, label }: { w: SessionCard; onResult: (g: Grade) => void; disabled: boolean; label: (g: Grade) => string }) {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const correct = checked && normalize(value) === normalize(w.word);

  function check() {
    if (!value.trim() || checked) return;
    setChecked(true);
  }

  return (
    <>
      <Card>
        {!checked ? (
          <>
            <div className="text-[24px] font-extrabold text-eel">{w.tr1 || "—"}</div>
            {w.tr2 && <div className="font-display italic text-macaw text-sm mt-1">{w.tr2}</div>}
            <input
              autoComplete="off"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") check(); }}
              placeholder="type the word…"
              className="mt-4 w-full max-w-[300px] py-3 px-4 rounded-2xl bg-white border-2 border-swan text-eel font-extrabold text-[17px] text-center outline-none focus:border-macaw"
            />
            <div className="mt-[18px] text-[13px] text-hare font-bold flex items-center gap-1.5"><Icon name="mic" style={{ width: 15, height: 15 }} /> Recall and type the English word yourself</div>
          </>
        ) : (
          <div key="checked" className="card-reveal">
            <div className="font-display text-[38px] text-eel">{w.word}</div>
            {w.ipa && <div className="text-macaw text-[17px] mt-2 font-bold">{w.ipa}</div>}
            <Speaker t={w.word} />
            <div className="h-px bg-swan w-4/5 my-5" />
            {w.tr2 && <div className="font-display italic text-macaw text-sm mb-1">{w.tr2}</div>}
            <div className="text-base text-wolf font-semibold leading-snug">{w.tr1 || "—"}</div>
            <div className={`stamp mt-4 text-sm font-extrabold ${correct ? "text-featherDark" : "text-cardinalDark"}`}>
              {correct ? "✓ Correct" : `✕ Incorrect · you wrote: "${value || "—"}"`}
            </div>
          </div>
        )}
      </Card>
      <div className="mt-[18px]">
        {!checked ? (
          <DuoButton variant="green" onClick={check} disabled={disabled || !value.trim()}>Check</DuoButton>
        ) : correct ? (
          <Grades onPick={onResult} disabled={disabled} label={label} subset={[1, 2, 3]} />
        ) : (
          <DuoButton variant="green" onClick={() => onResult(0)} disabled={disabled}>Next <Icon name="arrow" style={{ width: 18, height: 18 }} /></DuoButton>
        )}
      </div>
    </>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl min-h-[300px] flex flex-col justify-center items-center text-center bg-white border-2 border-swan shadow-card" style={{ padding: "30px 24px" }}>{children}</div>;
}
function Tag({ icon, cls, fill, children }: { icon: IconName; cls: string; fill?: boolean; children: React.ReactNode }) {
  return <div className={`inline-flex items-center gap-[7px] text-[11px] font-extrabold tracking-wide uppercase py-[7px] px-3.5 rounded-full mx-auto mb-3.5 w-fit ${cls}`} style={{ display: "flex" }}><Icon name={icon} fill={fill} style={{ width: 15, height: 15 }} />{children}</div>;
}
function Speaker({ t }: { t: string }) {
  return <button onClick={(e) => { e.stopPropagation(); speak(t); }} aria-label="Pronunciation" className="mt-3.5 w-[46px] h-[46px] rounded-full bg-polar border-2 border-swan grid place-items-center text-macaw active:scale-90 transition-transform"><Icon name="volume" style={{ width: 22, height: 22 }} /></button>;
}
function Grades({ onPick, disabled, label, subset }: { onPick: (g: Grade) => void; disabled: boolean; label: (g: Grade) => string; subset?: Grade[] }) {
  const items = subset ? GRADES.filter((x) => subset.includes(x.g)) : GRADES;
  return (
    <div className="grid gap-[9px]" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((x) => (
        <button key={x.g} disabled={disabled} onClick={() => onPick(x.g)} className={`rounded-2xl font-extrabold text-[15px] flex flex-col gap-[3px] items-center border-2 duo-press disabled:opacity-60 ${x.color} ${x.border} ${x.bg}`} style={{ padding: "13px 6px 11px", ["--duo-press" as any]: "2px" }}>
          {x.label}<small className="text-[10px] font-bold opacity-85">{label(x.g)}</small>
        </button>
      ))}
    </div>
  );
}
function Chip({ b, s, color }: { b: string; s: string; color: string }) {
  return <div className="bg-white border-2 border-swan rounded-2xl py-3.5 px-[18px] min-w-[90px]"><b className={`font-display text-[22px] block ${color}`}>{b}</b><span className="text-[11px] text-wolf font-bold">{s}</span></div>;
}
function Center({ children }: { children: React.ReactNode }) {
  return <div className="rise flex flex-col items-center justify-center gap-4 min-h-[60vh]">{children}</div>;
}
function Back({ router }: { router: ReturnType<typeof useRouter> }) {
  return <DuoButton variant="white" onClick={() => router.push("/")}>Home</DuoButton>;
}
