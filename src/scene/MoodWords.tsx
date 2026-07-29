import type { Mood } from "../content/types";

/**
 * Three words that catch each mood's feeling. Keyed by mood so a change
 * remounts the row and the words stagger back in over the video crossfade.
 */
const MOOD_WORDS: Record<Mood, [string, string, string]> = {
  sunrise: ["soft", "hopeful", "waking"],
  "high-noon": ["bright", "clear", "alive"],
  "golden-hour": ["warm", "wistful", "glowing"],
  midnight: ["quiet", "deep", "dreaming"],
};

export function MoodWords({ mood }: { mood: Mood }) {
  return (
    <p className="mood-words" key={mood}>
      {MOOD_WORDS[mood].map((word, i) => (
        <span key={word} style={{ animationDelay: `${0.15 + i * 0.16}s` }}>
          {word}
        </span>
      ))}
    </p>
  );
}
