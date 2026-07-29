import picksData from "./data/picks.json";
import { loadSongs } from "./store";
import type { Mood, Song } from "./types";

/**
 * "Picks" are a separate pool from the regular song pools in songs.json:
 * hand-selected recommendations, not part of the anti-repeat roll cycle.
 * They only surface when a visitor asks for one via the "a pick" swap in
 * the expanded song view (see CardDetail.tsx / App.tsx's handleSwapToPick).
 * Loaded through the same validator as songs.json, so a typo'd mood or
 * missing field fails loudly here too.
 */
const PICKS: Song[] = loadSongs(picksData);

export function picksFor(mood: Mood): Song[] {
  return PICKS.filter((p) => p.mood === mood);
}

/** A random pick for the mood, avoiding an immediate repeat when possible. */
export function randomPick(mood: Mood, excludeId?: string): Song | null {
  const pool = picksFor(mood);
  if (pool.length === 0) return null;
  const candidates = pool.length > 1 ? pool.filter((p) => p.id !== excludeId) : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
