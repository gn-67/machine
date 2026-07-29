import { describe, expect, it } from "vitest";
import playlistsConfig from "../../scripts/spotify.playlists.json";
import { moodForHour, moodForMinutes, DAY_MINUTES } from "./timeOfDay";
import { pull } from "./pull";
import type { SeenStore } from "./pull";
import { songPlayUrl } from "./spotify";
import { poolFor, songs, artwork, textures } from "./store";
import { MOODS, type Mood, type Song } from "./types";

function memoryStore(): SeenStore {
  const map = new Map<string, string[]>();
  return {
    get: (key) => map.get(key) ?? [],
    set: (key, ids) => void map.set(key, ids),
  };
}

describe("moodForHour", () => {
  it("maps the day onto the four moods", () => {
    expect(moodForHour(5)).toBe("sunrise");
    expect(moodForHour(8)).toBe("sunrise");
    expect(moodForHour(9)).toBe("high-noon");
    expect(moodForHour(15)).toBe("high-noon");
    expect(moodForHour(16)).toBe("golden-hour");
    expect(moodForHour(18)).toBe("golden-hour");
    expect(moodForHour(19)).toBe("golden-hour");
    expect(moodForHour(21)).toBe("golden-hour");
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

describe("moodForMinutes", () => {
  it("agrees with moodForHour at boundaries", () => {
    expect(moodForMinutes(5 * 60)).toBe("sunrise");
    expect(moodForMinutes(5 * 60 - 15)).toBe("midnight");
    expect(moodForMinutes(16 * 60)).toBe("golden-hour");
    expect(moodForMinutes(21 * 60 + 45)).toBe("golden-hour");
    expect(moodForMinutes(22 * 60)).toBe("midnight");
  });

  it("wraps past midnight in both directions", () => {
    expect(moodForMinutes(DAY_MINUTES + 30)).toBe("midnight");
    expect(moodForMinutes(-30)).toBe("midnight");
    expect(moodForMinutes(DAY_MINUTES + 6 * 60)).toBe("sunrise");
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

describe("spotify playlist config", () => {
  const config = playlistsConfig as { playlists: { mood: string; playlist: string }[] };

  it("maps every playlist to a real mood", () => {
    for (const entry of config.playlists) {
      expect(MOODS, entry.playlist).toContain(entry.mood as Mood);
    }
  });

  it("has a resolvable id for every playlist, with no duplicates", () => {
    const ids = config.playlists.map((entry) => {
      const match = entry.playlist.match(/playlist[/:]([A-Za-z0-9]+)/);
      expect(match, `no playlist id in "${entry.playlist}"`).not.toBeNull();
      return match![1];
    });
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("songPlayUrl", () => {
  const base: Song = {
    kind: "song",
    id: "track123",
    mood: "midnight",
    title: "t",
    artist: "a",
    albumArt: null,
    url: "https://open.spotify.com/track/track123",
    source: "manual",
    attribution: "why",
  };

  it("links straight to the track when there is no playlist context", () => {
    expect(songPlayUrl(base)).toBe("https://open.spotify.com/track/track123");
  });

  it("adds the playlist context for synced tracks", () => {
    const synced: Song = {
      ...base,
      source: "spotify-sync",
      playlistId: "pl456",
      playlistName: "late night drive",
    };
    expect(songPlayUrl(synced)).toBe(
      "https://open.spotify.com/track/track123?context=spotify%3Aplaylist%3Apl456",
    );
  });

  it("returns null when the song has no url", () => {
    expect(songPlayUrl({ ...base, url: null })).toBeNull();
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
