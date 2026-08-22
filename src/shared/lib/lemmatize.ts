// Maps irregular past tense / past participle → base infinitive form
const IRREGULAR: Record<string, string> = {
  // be
  was: "be", were: "be",
  // have
  had: "have",
  // do
  did: "do", done: "do",
  // go
  went: "go", gone: "go",
  // say
  said: "say",
  // get
  got: "get", gotten: "get",
  // make
  made: "make",
  // know
  knew: "know", known: "know",
  // take
  took: "take", taken: "take",
  // see
  saw: "see", seen: "see",
  // come
  came: "come",
  // think
  thought: "think",
  // give
  gave: "give", given: "give",
  // find
  found: "find",
  // tell
  told: "tell",
  // feel
  felt: "feel",
  // leave
  left: "leave",
  // keep
  kept: "keep",
  // begin
  began: "begin", begun: "begin",
  // hold
  held: "hold",
  // bring
  brought: "bring",
  // write
  wrote: "write", written: "write",
  // sit
  sat: "sit",
  // stand
  stood: "stand",
  // lose
  lost: "lose",
  // pay
  paid: "pay",
  // meet
  met: "meet",
  // lead
  led: "lead",
  // understand
  understood: "understand",
  // speak
  spoke: "speak", spoken: "speak",
  // spend
  spent: "spend",
  // grow
  grew: "grow", grown: "grow",
  // win
  won: "win",
  // buy
  bought: "buy",
  // send
  sent: "send",
  // fall
  fell: "fall", fallen: "fall",
  // sell
  sold: "sell",
  // break
  broke: "break", broken: "break",
  // catch
  caught: "catch",
  // teach
  taught: "teach",
  // fight
  fought: "fight",
  // throw
  threw: "throw", thrown: "throw",
  // choose
  chose: "choose", chosen: "choose",
  // drive
  drove: "drive", driven: "drive",
  // eat
  ate: "eat", eaten: "eat",
  // fly
  flew: "fly", flown: "fly",
  // forget
  forgot: "forget", forgotten: "forget",
  // freeze
  froze: "freeze", frozen: "freeze",
  // hide
  hid: "hide", hidden: "hide",
  // ride
  rode: "ride", ridden: "ride",
  // rise
  rose: "rise", risen: "rise",
  // ring
  rang: "ring", rung: "ring",
  // run
  ran: "run",
  // shake
  shook: "shake", shaken: "shake",
  // shoot
  shot: "shoot",
  // shrink
  shrank: "shrink", shrunk: "shrink",
  // sing
  sang: "sing", sung: "sing",
  // sink
  sank: "sink", sunk: "sink",
  // sleep
  slept: "sleep",
  // steal
  stole: "steal", stolen: "steal",
  // stick
  stuck: "stick",
  // sting
  stung: "sting",
  // strike
  struck: "strike",
  // swear
  swore: "swear", sworn: "swear",
  // sweep
  swept: "sweep",
  // swim
  swam: "swim", swum: "swim",
  // swing
  swung: "swing",
  // tear
  tore: "tear", torn: "tear",
  // wake
  woke: "wake", woken: "wake",
  // wear
  wore: "wear", worn: "wear",
  // weep
  wept: "weep",
  // wind
  wound: "wind",
  // withdraw
  withdrew: "withdraw", withdrawn: "withdraw",
  // draw
  drew: "draw", drawn: "draw",
  // drink
  drank: "drink", drunk: "drink",
  // feed
  fed: "feed",
  // bend
  bent: "bend",
  // bind
  bound: "bind",
  // bite
  bit: "bite", bitten: "bite",
  // bleed
  bled: "bleed",
  // blow
  blew: "blow", blown: "blow",
  // burst
  burst: "burst",
  // cast
  cast: "cast",
  // cost
  cost: "cost",
  // creep
  crept: "creep",
  // deal
  dealt: "deal",
  // dig
  dug: "dig",
  // flee
  fled: "flee",
  // fling
  flung: "fling",
  // forbid
  forbade: "forbid", forbidden: "forbid",
  // hang
  hung: "hang",
  // kneel
  knelt: "kneel",
  // lay
  laid: "lay",
  // leap
  leapt: "leap",
  // lend
  lent: "lend",
  // light
  lit: "light",
  // mean
  meant: "mean",
  // put
  put: "put",
  // quit
  quit: "quit",
  // read
  // "read" past tense is also "read" (same spelling, different pronunciation) - skip
  // seek
  sought: "seek",
  // shed
  shed: "shed",
  // shut
  shut: "shut",
  // slide
  slid: "slide",
  // speed
  sped: "speed",
  // split
  split: "split",
  // spread
  spread: "spread",
  // spring
  sprang: "spring", sprung: "spring",
  // arise
  arose: "arise", arisen: "arise",
  // bear
  bore: "bear", borne: "bear",
  // beat
  beaten: "beat",
  // become
  became: "become",
  // bite already done
  // build
  built: "build",
  // burn (British past: burnt)
  burnt: "burn",
  // dream (British past: dreamt)
  dreamt: "dream",
  // dwell
  dwelt: "dwell",
  // forget already done
  // forgive
  forgave: "forgive", forgiven: "forgive",
  // hit
  hit: "hit",
  // hurt
  hurt: "hurt",
  // knit (British: knit)
  // lay already done
  // learn (British: learnt)
  learnt: "learn",
  // lie (past of lie = lay)
  lay: "lie",
  // let
  // "let" past = "let" — skip (same form)
  // mislead
  misled: "mislead",
  // overcome
  overcame: "overcome",
  // rebuild
  rebuilt: "rebuild",
  // set
  // "set" past = "set" — skip
  // show (past participle: shown)
  shown: "show",
  // smell (British: smelt)
  smelt: "smell",
  // spell (British: spelt)
  spelt: "spell",
  // strive
  strove: "strive", striven: "strive",
  // weave
  wove: "weave", woven: "weave",
  // withdraw already done
  // wring
  wrung: "wring",
  // cut
  cut: "cut",
};

const CONSONANTS = new Set("bcdfghjklmnpqrstvwxyz");

// Converts a regular -ed past tense form to its base form
function stripEd(word: string): string | null {
  if (!word.endsWith("ed") || word.length < 4) return null;

  // tried → try
  if (word.endsWith("ied") && word.length > 4) {
    return word.slice(0, -3) + "y";
  }

  const stem = word.slice(0, -2); // remove "ed"

  // stopped → stop (doubled consonant)
  if (
    stem.length >= 3 &&
    CONSONANTS.has(stem[stem.length - 1]) &&
    stem[stem.length - 1] === stem[stem.length - 2]
  ) {
    return stem.slice(0, -1);
  }

  // loved → love (stem already ends in -e, past just added -d)
  if (stem.endsWith("e") && stem.length >= 3) {
    return stem;
  }

  // walked → walk (plain -ed removal)
  if (stem.length >= 2) {
    return stem;
  }

  return null;
}

/**
 * Returns the base (infinitive) form of a single English word.
 * Handles irregular verbs via a lookup table and regular -ed verbs via rules.
 * Multi-word phrases are returned unchanged.
 */
export function lemmatize(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  // Only lemmatize single words
  if (/\s/.test(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();

  // Irregular first — highest confidence
  if (IRREGULAR[lower]) return IRREGULAR[lower];

  // Regular -ed rules
  const base = stripEd(lower);
  if (base && base.length >= 2) return base;

  return trimmed;
}
