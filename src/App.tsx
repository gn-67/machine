import { useState } from "react";
import { MOODS, MOOD_LABELS, type Mood, type Pull } from "./content/types";
import { currentMood } from "./content/timeOfDay";
import { pull } from "./content/pull";
import "./App.css";

/**
 * Phase 2 prototype: plain controls that validate the whole flow
 * (mood → pool → pull → cards with attribution) before the Phase 3
 * dial + 3D scene replace this shell.
 */
export default function App() {
  const [mood, setMood] = useState<Mood>(() => currentMood());
  const [result, setResult] = useState<Pull | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handlePull() {
    try {
      setResult(pull(mood));
      setError(null);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main className={`app mood-${mood}`}>
      <header>
        <h1>machine</h1>
        <p className="tagline">a small inspiration, on demand</p>
      </header>

      <section className="mood-picker" aria-label="Pick a mood">
        {MOODS.map((m) => (
          <button
            key={m}
            className={m === mood ? "mood-btn active" : "mood-btn"}
            onClick={() => setMood(m)}
          >
            {MOOD_LABELS[m]}
          </button>
        ))}
      </section>
      <p className="mood-note">
        dialed to <strong>{MOOD_LABELS[mood]}</strong>
        {mood === currentMood() && " — matching your clock right now"}
      </p>

      <button className="pull-btn" onClick={handlePull}>
        {result ? "pull again" : "pull"}
      </button>

      {error && <p className="error">{error}</p>}

      {result && (
        <section className="cards" aria-label="Your pull">
          <article className="card">
            <span className="card-kind">song</span>
            {result.song.albumArt ? (
              <img src={result.song.albumArt} alt="" className="card-img" />
            ) : (
              <div className="card-img placeholder" aria-hidden="true" />
            )}
            <h2>{result.song.title}</h2>
            <p className="card-sub">{result.song.artist}</p>
            {result.song.url && (
              <a href={result.song.url} target="_blank" rel="noreferrer">
                listen ↗
              </a>
            )}
            <p className="attribution">{result.song.attribution}</p>
          </article>

          <article className="card">
            <span className="card-kind">artwork</span>
            {result.artwork.image ? (
              <img src={result.artwork.image} alt={result.artwork.title} className="card-img" />
            ) : (
              <div className="card-img placeholder" aria-hidden="true" />
            )}
            <h2>{result.artwork.title}</h2>
            <p className="card-sub">
              {result.artwork.artist}
              {result.artwork.year && `, ${result.artwork.year}`}
            </p>
            {result.artwork.url && (
              <a href={result.artwork.url} target="_blank" rel="noreferrer">
                see it ↗
              </a>
            )}
            <p className="attribution">{result.artwork.attribution}</p>
          </article>

          <article className="card">
            <span className="card-kind">texture</span>
            {result.texture.image ? (
              <img src={result.texture.image} alt={result.texture.title} className="card-img" />
            ) : (
              <div className="card-img placeholder" aria-hidden="true" />
            )}
            <h2>{result.texture.title}</h2>
            <p className="card-sub">{result.texture.description}</p>
            <p className="attribution">{result.texture.attribution}</p>
          </article>
        </section>
      )}
    </main>
  );
}
