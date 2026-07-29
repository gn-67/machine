import { useEffect, useRef, useState } from "react";
import { MOODS, type Mood, type Pull } from "./content/types";
import { moodForMinutes, nowMinutes } from "./content/timeOfDay";
import { pull } from "./content/pull";
import { TimeDial } from "./scene/Dial";
import { MoodWords } from "./scene/MoodWords";
import { CardDetail } from "./scene/CardDetail";
import { EffectsOverlay } from "./scene/Effects";
import { Note } from "./scene/Note";
import "./App.css";

/**
 * Time is the master state: the dial (right) holds minutes-since-midnight,
 * the mood derives from it, and the mood drives the crossfading meadow
 * videos, the mood words (bottom), and which pool a roll draws from.
 * Until the visitor touches the dial it tracks the real clock; touching it
 * detaches, and "back to now" re-attaches. The three card slots (left) fill
 * with blank cards on roll — their faces are the next step.
 */

const CARD_KINDS = ["song", "artwork", "texture"] as const;
type CardKind = (typeof CARD_KINDS)[number];

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The machine's silhouette in the render, as source UV bounds. */
const MACHINE_UV = { u0: 0.456, v0: 0.188, u1: 0.674, v1: 0.85 };

/**
 * Screen rect for a region given in the backdrop video's source UV,
 * replicating `object-fit: cover; object-position: 63% center` — the same
 * math as the shader overlay's crop uniform. Lets HTML controls sit on
 * physical parts of the rendered machine at any viewport size.
 */
function useCoverRect(u0: number, v0: number, u1: number, v1: number) {
  const [rect, setRect] = useState<Record<string, string>>({});
  useEffect(() => {
    const aspect = 16 / 9;
    const calc = () => {
      const vp = window.innerWidth / window.innerHeight;
      let ox = 0;
      let oy = 0;
      let fx = 1;
      let fy = 1;
      if (vp < aspect) {
        fx = vp / aspect;
        ox = (1 - fx) * 0.63;
      } else {
        fy = aspect / vp;
        oy = (1 - fy) * 0.5;
      }
      const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
      setRect({
        left: pct((u0 - ox) / fx),
        top: pct((v0 - oy) / fy),
        width: pct((u1 - u0) / fx),
        height: pct((v1 - v0) / fy),
      });
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [u0, v0, u1, v1]);
  return rect;
}

export default function App() {
  const [minutes, setMinutes] = useState(() => nowMinutes());
  const [dialTouched, setDialTouched] = useState(false);
  const [result, setResult] = useState<Pull | null>(null);
  const [selectedKind, setSelectedKind] = useState<CardKind | null>(null);
  const [rollId, setRollId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const videoRefs = useRef<Partial<Record<Mood, HTMLVideoElement | null>>>({});
  const cardColumnRef = useRef<HTMLElement>(null);

  const mood = moodForMinutes(minutes);
  const prevMoodRef = useRef<Mood>(mood);
  // the machine itself is the roll target
  const machineRect = useCoverRect(
    MACHINE_UV.u0,
    MACHINE_UV.v0,
    MACHINE_UV.u1,
    MACHINE_UV.v1,
  );

  // Follow the real clock until the dial is touched.
  useEffect(() => {
    if (dialTouched) return;
    const tick = setInterval(() => setMinutes(nowMinutes()), 30_000);
    return () => clearInterval(tick);
  }, [dialTouched]);

  useEffect(() => {
    if (prefersReducedMotion()) return; // posters only, no motion

    const prev = prevMoodRef.current;
    prevMoodRef.current = mood;
    const next = videoRefs.current[mood];
    if (!next) return;

    const leaving = prev !== mood ? videoRefs.current[prev] : null;
    if (leaving && !leaving.paused && Number.isFinite(leaving.currentTime)) {
      try {
        next.currentTime = leaving.currentTime;
      } catch {
        // metadata not loaded yet — video starts at 0, still seamless enough
      }
    }
    next.play().catch(() => {
      // autoplay blocked — poster remains, scene is still usable
    });
    if (leaving) {
      const t = setTimeout(() => leaving.pause(), 1100); // after the crossfade
      return () => clearTimeout(t);
    }
  }, [mood]);

  function handleDialChange(nextMinutes: number) {
    setDialTouched(true);
    setMinutes(nextMinutes);
  }

  function handleBackToNow() {
    setDialTouched(false);
    setMinutes(nowMinutes());
  }

  useEffect(() => {
    if (!selectedKind) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedKind(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!cardColumnRef.current?.contains(e.target as Node)) setSelectedKind(null);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [selectedKind]);

  function handleRoll() {
    try {
      setResult(pull(mood));
      setRollId((n) => n + 1);
      setSelectedKind(null);
      setError(null);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main className={`scene mood-${mood}`}>
      <div className="backdrop" aria-hidden="true">
        {MOODS.map((m) => (
          <video
            key={m}
            ref={(el) => {
              videoRefs.current[m] = el;
            }}
            className={m === mood ? "bg visible" : "bg"}
            src={`/renders/${m}.mp4`}
            poster={`/renders/${m}.webp`}
            muted
            loop
            playsInline
            preload={m === mood ? "auto" : "metadata"}
          />
        ))}
      </div>

      <EffectsOverlay mood={mood} />

      <header className="hud hud-top">
        <h1>machine</h1>
      </header>

      <Note />

      <aside className="hud-left" ref={cardColumnRef}>
        <div className="card-stack" aria-label="Your pull">
          {CARD_KINDS.map((kind, i) => {
            const preview = result
              ? kind === "song"
                ? result.song.albumArt
                : result[kind].image
              : null;
            return (
              <button
                key={result ? `${rollId}-${kind}` : kind}
                className={`card ${result ? "popped" : "slot"}${selectedKind === kind ? " selected" : ""}`}
                style={result ? { animationDelay: `${i * 0.12}s` } : undefined}
                disabled={!result}
                aria-pressed={selectedKind === kind}
                onClick={() => setSelectedKind((k) => (k === kind ? null : kind))}
              >
                {result &&
                  (preview ? (
                    <img className="card-preview" src={preview} alt="" />
                  ) : (
                    <div className="card-preview placeholder" aria-hidden="true" />
                  ))}
                <span className="card-kind">{kind}</span>
              </button>
            );
          })}
        </div>
        {result && selectedKind && (
          <CardDetail key={`${rollId}-${selectedKind}`} item={result[selectedKind]} />
        )}
      </aside>

      <div className="hud-right">
        <TimeDial minutes={minutes} mood={mood} onChange={handleDialChange} />
        <button
          className={dialTouched ? "now-btn visible" : "now-btn"}
          onClick={handleBackToNow}
          tabIndex={dialTouched ? 0 : -1}
        >
          back to now
        </button>
      </div>

      <button
        className="machine-hotspot"
        style={machineRect}
        onClick={handleRoll}
        aria-label={result ? "Roll again" : "Roll"}
      >
        {rollId > 0 && <span key={rollId} className="roll-pulse" aria-hidden="true" />}
      </button>

      <div className="hud hud-bottom">
        {error && <p className="error">{error}</p>}
        <MoodWords mood={mood} />
      </div>
    </main>
  );
}
