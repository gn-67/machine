/**
 * Pull logic: given a mood, hand back one song + one artwork + one texture
 * from that mood's pool.
 *
 * Not purely random — the machine avoids repeating an item until its pool is
 * exhausted, so successive pulls feel curated rather than like a broken
 * shuffle. Seen-item history persists in localStorage (per kind + mood) and
 * resets automatically once a pool has been fully cycled.
 */
import { poolFor } from "./store";
import type { ContentItem, Mood, Pull } from "./types";

export interface SeenStore {
  get(key: string): string[];
  set(key: string, ids: string[]): void;
}

/** localStorage-backed store; falls back to in-memory when unavailable (SSR, private mode). */
function defaultSeenStore(): SeenStore {
  const memory = new Map<string, string[]>();
  return {
    get(key) {
      try {
        const raw = window.localStorage.getItem(`machine:seen:${key}`);
        return raw ? (JSON.parse(raw) as string[]) : [];
      } catch {
        return memory.get(key) ?? [];
      }
    },
    set(key, ids) {
      memory.set(key, ids);
      try {
        window.localStorage.setItem(`machine:seen:${key}`, JSON.stringify(ids));
      } catch {
        // memory fallback already updated
      }
    },
  };
}

function pickFrom<T extends ContentItem>(
  pool: T[],
  key: string,
  store: SeenStore,
  random: () => number,
): T {
  if (pool.length === 0) {
    throw new Error(`Empty content pool for ${key} — add entries to the JSON before pulling`);
  }
  let seen = store.get(key);
  let unseen = pool.filter((item) => !seen.includes(item.id));
  if (unseen.length === 0) {
    // Full cycle complete — reset, but avoid immediately repeating the last item.
    const last = seen[seen.length - 1];
    seen = [];
    unseen = pool.length > 1 ? pool.filter((item) => item.id !== last) : pool;
  }
  const picked = unseen[Math.floor(random() * unseen.length)];
  store.set(key, [...seen, picked.id]);
  return picked;
}

export function pull(
  mood: Mood,
  opts: { store?: SeenStore; random?: () => number } = {},
): Pull {
  const store = opts.store ?? defaultSeenStore();
  const random = opts.random ?? Math.random;
  const pools = poolFor(mood);
  return {
    mood,
    song: pickFrom(pools.songs, `song:${mood}`, store, random),
    artwork: pickFrom(pools.artwork, `artwork:${mood}`, store, random),
    texture: pickFrom(pools.textures, `texture:${mood}`, store, random),
  };
}
