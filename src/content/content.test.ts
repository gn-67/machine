import { describe, expect, it } from "vitest";
import { moodForHour } from "./timeOfDay";
import { pull } from "./pull";
import type { SeenStore } from "./pull";
import { poolFor, songs, artwork, textures } from "./store";
import { MOODS } from "./types";

function memoryStore(): SeenStore {
  const map = new Map<string, string[]>();
  return {
    get: (key) => map.get(key) ?? [],
    set: (key, ids) => void map.set(key, ids),
  };
}

describe("moodForHour", () => {
  it("maps the day onto the five moods", () => {
    expect(moodForHour(5)).toBe("sunrise");
    expect(moodForHour(8)).toBe("sunrise");
    expect(moodForHour(9)).toBe("high-noon");
    expect(moodForHour(15)).toBe("high-noon");
    expect(moodForHour(16)).toBe("golden-hour");
    expect(moodForHour(18)).toBe("golden-hour");
    expect(moodForHour(19)).toBe("dusk");
    expect(moodForHour(21)).toBe("dusk");
    expect(moodForHour(22)).toBe("midnight");
    expect(moodForHour(0)).toBe("midnight");
    expect(moodForHour(4)).toBe("midnight");
  });

  it("rejects out-of-range hours", () => {
    expect(() => moodForHour(24)).toThrow();
    expect(() => moodForHour(-1)).toThrow();
    expect(() => moodForHour(3.5)).toThrow();
  });
});

describe("content store", () => {
  it("has at least one of each kind per mood", () => {
    for (const mood of MOODS) {
      const pools = poolFor(mood);
      expect(pools.songs.length, `songs for ${mood}`).toBeGreaterThan(0);
      expect(pools.artwork.length, `artwork for ${mood}`).toBeGreaterThan(0);
      expect(pools.textures.length, `textures for ${mood}`).toBeGreaterThan(0);
    }
  });

  it("every item carries an attribution", () => {
    for (const item of [...songs, ...artwork, ...textures]) {
      expect(item.attribution.trim(), item.id).not.toBe("");
    }
  });
});

describe("pull", () => {
  it("returns one item of each kind, all matching the mood", () => {
    const result = pull("midnight", { store: memoryStore() });
    expect(result.song.mood).toBe("midnight");
    expect(result.artwork.mood).toBe("midnight");
    expect(result.texture.mood).toBe("midnight");
    expect(result.song.kind).toBe("song");
    expect(result.artwork.kind).toBe("artwork");
    expect(result.texture.kind).toBe("texture");
  });

  it("does not repeat a song until the mood's pool is exhausted", () => {
    const store = memoryStore();
    const pool = poolFor("sunrise").songs;
    const seenIds = new Set<string>();
    for (let i = 0; i < pool.length; i++) {
      const { song } = pull("sunrise", { store });
      expect(seenIds.has(song.id), `repeated ${song.id} at pull ${i}`).toBe(false);
      seenIds.add(song.id);
    }
    expect(seenIds.size).toBe(pool.length);
  });

  it("cycles again after exhaustion without immediately repeating the last item", () => {
    const store = memoryStore();
    const pool = poolFor("sunrise").songs;
    let last = "";
    for (let i = 0; i < pool.length; i++) {
      last = pull("sunrise", { store }).song.id;
    }
    if (pool.length > 1) {
      expect(pull("sunrise", { store }).song.id).not.toBe(last);
    }
  });
});
