#!/usr/bin/env node
/**
 * Sync songs from public Spotify playlists into src/content/data/songs.json.
 *
 * Uses Spotify's public, unauthenticated endpoints:
 *   - open.spotify.com/embed/playlist/{id} — playlist name + full track list
 *   - open.spotify.com/oembed — per-track album art (documented endpoint)
 *
 * Why not the Web API: apps created after Spotify's 2025 dev-mode restrictions
 * get 403 on every track/playlist-items endpoint under Client Credentials
 * (verified against this project's app — token issues fine, playlist metadata
 * works, but /playlists/{id}/tracks and even /v1/tracks are Forbidden). The
 * embed route needs no credentials at all. If the embed page's __NEXT_DATA__
 * shape changes, the parse fails loudly here — nothing is half-written.
 *
 * Usage:
 *   1. Map playlists to moods in scripts/spotify.playlists.json
 *   2. npm run sync-spotify
 *
 * Behavior:
 *   - Idempotent: keyed by Spotify track id; re-running refreshes synced tracks.
 *   - Never touches manual entries (source: "manual").
 *   - Synced tracks whose playlist was removed from the config are dropped.
 *   - Attribution defaults to `from your "<playlist name>" playlist`; set
 *     `attribution` on a config entry to override.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SONGS_PATH = join(root, "src/content/data/songs.json");
const CONFIG_PATH = join(root, "scripts/spotify.playlists.json");
const MOODS = ["sunrise", "high-noon", "golden-hour", "midnight"];

// --- config ----------------------------------------------------------------
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const entries = (config.playlists ?? []).filter(
  (p) => p.playlist && !p.playlist.includes("PASTE_PUBLIC_PLAYLIST_URL_HERE"),
);
if (entries.length === 0) {
  console.error(`No playlists configured yet — add real playlist URLs to ${CONFIG_PATH}`);
  process.exit(1);
}
for (const entry of entries) {
  if (!MOODS.includes(entry.mood)) {
    console.error(`Playlist "${entry.playlist}" has invalid mood "${entry.mood}" (use: ${MOODS.join(", ")})`);
    process.exit(1);
  }
}

function playlistId(ref) {
  const urlMatch = ref.match(/playlist[/:]([A-Za-z0-9]+)/);
  return urlMatch ? urlMatch[1] : ref;
}

// --- public Spotify endpoints ----------------------------------------------
async function fetchPlaylistEmbed(id) {
  const res = await fetch(`https://open.spotify.com/embed/playlist/${id}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Playlist ${id} embed fetch failed (${res.status})`);
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (!match) throw new Error(`Playlist ${id}: no __NEXT_DATA__ in embed page — Spotify changed the embed format`);
  const entity = JSON.parse(match[1])?.props?.pageProps?.state?.data?.entity;
  if (!entity?.name || !Array.isArray(entity.trackList)) {
    throw new Error(`Playlist ${id}: unexpected embed data shape — Spotify changed the embed format`);
  }
  return {
    name: entity.name.trim(),
    tracks: entity.trackList
      .filter((t) => t.uri?.startsWith("spotify:track:"))
      .map((t) => ({
        id: t.uri.split(":").pop(),
        title: t.title,
        artist: t.subtitle,
      })),
  };
}

async function fetchAlbumArt(trackId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${trackId}`)}`,
    );
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Math.min(retryAfter > 0 ? retryAfter : 2 ** attempt * 2, 30);
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      continue;
    }
    if (!res.ok) return null; // art is nice-to-have; never fail the sync over it
    return (await res.json()).thumbnail_url ?? null;
  }
  return null; // still rate-limited — next sync run picks it up
}

/** Run tasks with bounded concurrency so ~200 oembed calls don't hammer Spotify. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

// --- merge -----------------------------------------------------------------
const existing = JSON.parse(readFileSync(SONGS_PATH, "utf8"));
const manual = existing.filter((s) => s.source === "manual");
const previousArt = new Map(existing.filter((s) => s.albumArt).map((s) => [s.id, s.albumArt]));

const synced = [];
const seenIds = new Set();
for (const entry of entries) {
  const id = playlistId(entry.playlist);
  const { name, tracks } = await fetchPlaylistEmbed(id);
  console.log(`✓ ${tracks.length} tracks from "${name}" → ${entry.mood} (${id})`);
  for (const track of tracks) {
    if (seenIds.has(track.id)) continue; // same track in two playlists: first mood wins
    seenIds.add(track.id);
    synced.push({
      kind: "song",
      id: track.id,
      mood: entry.mood,
      title: track.title,
      artist: track.artist,
      albumArt: previousArt.get(track.id) ?? null,
      url: `https://open.spotify.com/track/${track.id}`,
      source: "spotify-sync",
      playlistId: id,
      playlistName: name,
      attribution: entry.attribution?.trim() || `from your "${name}" playlist`,
    });
  }
}

const needArt = synced.filter((s) => !s.albumArt);
if (needArt.length > 0) {
  console.log(`Fetching album art for ${needArt.length} tracks…`);
  const art = await mapLimit(needArt, 3, (s) => fetchAlbumArt(s.id));
  needArt.forEach((s, i) => (s.albumArt = art[i]));
}

writeFileSync(SONGS_PATH, JSON.stringify([...manual, ...synced], null, 2) + "\n");
console.log(
  `\nWrote ${manual.length} manual + ${synced.length} synced songs to src/content/data/songs.json`,
);
