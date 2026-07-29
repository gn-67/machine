import { useState } from "react";
import { MOODS, MOOD_LABELS, type Mood, type Pull } from "./content/types";
import { currentMood } from "./content/timeOfDay";
import { pull } from "./content/pull";
import "./App.css";

/**
 * Initial visual prototype: the Blender meadow renders are the scene itself.
 * All four moods stay mounted and crossfade via opacity, so changing the time
 * of day never flashes or reloads. Rolling calls the real pull() (anti-repeat
 * cycling included) but the cards come up blank — their faces are the next
 * step.
 */

const RENDERS: Record<Mood, string> = {
  sunrise: "/renders/sunrise.webp",
  "high-noon": "/renders/high-noon.webp",
  "golden-hour": "/renders/golden-hour.webp",
  midnight: "/renders/midnight.webp",
};

const CARD_KINDS = ["song", "artwork", "texture"] as const;

export default function App() {
  const [mood, setMood] = useState<Mood>(() => currentMood());
  const [result, setResult] = useState<Pull | null>(null);
  const [rollId, setRollId] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
          <img
            key={m}
            src={RENDERS[m]}
            alt=""
            className={m === mood ? "bg visible" : "bg"}
            draggable={false}
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
