import { useEffect, useRef, useState } from "react";
import { MOODS, MOOD_LABELS, type Mood, type Pull } from "./content/types";
import { currentMood } from "./content/timeOfDay";
import { pull } from "./content/pull";
import "./App.css";

/**
 * Initial visual prototype: the Blender meadow renders are the scene itself.
 * Each mood is a 6s looping video (same locked camera, same baked wind sim,
 * so grass motion is frame-identical across moods). All four stay mounted and
 * crossfade via opacity; on mood change the incoming video is seeked to the
 * outgoing one's timestamp, so the field never jumps. Rolling calls the real
 * pull() (anti-repeat cycling included) but the cards come up blank — their
 * faces are the next step.
 */

const CARD_KINDS = ["song", "artwork", "texture"] as const;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function App() {
  const [mood, setMood] = useState<Mood>(() => currentMood());
  const [result, setResult] = useState<Pull | null>(null);
  const [rollId, setRollId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const videoRefs = useRef<Partial<Record<Mood, HTMLVideoElement | null>>>({});
  const prevMoodRef = useRef<Mood>(mood);

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

  function handleRoll() {
    try {
      setResult(pull(mood));
      setRollId((n) => n + 1);
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

      <header className="hud hud-top">
        <h1>machine</h1>
        <nav className="mood-picker" aria-label="Time of day">
          {MOODS.map((m) => (
            <button
              key={m}
              className={m === mood ? "mood-btn active" : "mood-btn"}
              onClick={() => setMood(m)}
            >
              {MOOD_LABELS[m]}
            </button>
          ))}
        </nav>
      </header>

      <div className="hud hud-bottom">
        {error && <p className="error">{error}</p>}

        {result && (
          <section className="cards" key={rollId} aria-label="Your pull">
            {CARD_KINDS.map((kind, i) => (
              <article
                className="card blank"
                key={kind}
                style={{ animationDelay: `${i * 0.09}s` }}
              >
                <span className="card-kind">{kind}</span>
              </article>
            ))}
          </section>
        )}

        <button className="roll-btn" onClick={handleRoll}>
          {result ? "roll again" : "roll"}
        </button>
      </div>
    </main>
  );
}
