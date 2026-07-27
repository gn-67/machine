/**
 * Core content model for the inspiration machine.
 *
 * Every piece of content is tagged with a time-of-day mood and carries a
 * required attribution — the "why this was picked for you" line that shows
 * on every card.
 */

export const MOODS = [
  "sunrise",
  "high-noon",
  "golden-hour",
  "dusk",
  "midnight",
] as const;

export type Mood = (typeof MOODS)[number];

export const MOOD_LABELS: Record<Mood, string> = {
  sunrise: "Sunrise",
  "high-noon": "High Noon",
  "golden-hour": "Golden Hour",
  dusk: "Dusk",
  midnight: "Midnight",
};

interface ContentBase {
  /** Stable unique id. Spotify tracks use their Spotify track id. */
  id: string;
  mood: Mood;
  /** Why this was picked — always displayed. e.g. "from your late night drive playlist" */
  attribution: string;
}

export interface Song extends ContentBase {
  kind: "song";
  title: string;
  /** Display string; joined for multi-artist tracks. */
  artist: string;
  albumArt: string | null;
  /** Link out to the track (Spotify URL for synced tracks). */
  url: string | null;
  /** Where this entry came from: the sync script or a hand-picked addition. */
  source: "spotify-sync" | "manual";
}

export interface Artwork extends ContentBase {
  kind: "artwork";
  title: string;
  artist: string;
  year: string | null;
  /** Image path (local /public asset) or remote URL. Null renders a mood-tinted placeholder. */
  image: string | null;
  /** Optional link to where the piece lives (museum page, artist site…). */
  url: string | null;
}

export interface Texture extends ContentBase {
  kind: "texture";
  /** Short evocative name, e.g. "Sun-warmed terracotta". */
  title: string;
  /** One-line description of the material/close-up. */
  description: string;
  image: string | null;
  url: string | null;
}

export type ContentItem = Song | Artwork | Texture;

/** One pull from the machine: exactly one of each kind. */
export interface Pull {
  mood: Mood;
  song: Song;
  artwork: Artwork;
  texture: Texture;
}
