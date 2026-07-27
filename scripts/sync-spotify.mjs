#!/usr/bin/env node
/**
 * Sync songs from public Spotify playlists into src/content/data/songs.json.
 *
 * Uses the Client Credentials flow (no user login — public playlist data only)
 * and runs locally/in CI, so the client secret never reaches the browser and
 * the deployed site stays fully static.
 *
 * Usage:
 *   1. Put SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env (see .env.example)
 *   2. Map playlists to moods in scripts/spotify.playlists.json
 *   3. npm run sync-spotify
 *
 * Behavior:
 *   - Idempotent: keyed by Spotify track id; re-running refreshes synced tracks.
 *   - Never touches manual entries (source: "manual").
 *   - Synced tracks whose playlist was removed from the config are dropped.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SONGS_PATH = join(root, "src/content/data/songs.json");
const CONFIG_PATH = join(root, "scripts/spotify.playlists.json");
const MOODS = ["sunrise", "high-noon", "golden-hour", "dusk", "midnight"];

// --- tiny .env loader (no dependency needed) -------------------------------
const envPath = join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error(
    "Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET.\n" +
      "Copy .env.example to .env and fill in credentials from https://developer.spotify.com/dashboard",
  );
  process.exit(1);
}

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
  if (!entry.attribution?.trim()) {
    console.error(`Playlist "${entry.playlist}" needs an attribution line`);
    process.exit(1);
  }
}

function playlistId(ref) {
  const urlMatch = ref.match(/playlist[/:]([A-Za-z0-9]+)/);
  return urlMatch ? urlMatch[1] : ref;
}

// --- Spotify API -----------------------------------------------------------
async function getToken() {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Token request failed (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

async function fetchPlaylistTracks(token, id) {
  const tracks = [];
  let url =
    `https://api.spotify.com/v1/playlists/${id}/tracks` +
    `?fields=next,items(track(id,name,external_urls,artists(name),album(images)))&limit=100`;
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Playlist ${id} fetch failed (${res.status}): ${await res.text()}`);
    const page = await res.json();
    for (const item of page.items ?? []) {
      const track = item.track;
      if (!track?.id) continue; // skip local files / unavailable tracks
      tracks.push({
        id: track.id,
        title: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        albumArt: track.album?.images?.[0]?.url ?? null,
        url: track.external_urls?.spotify ?? null,
      });
    }
    url = page.next;
  }
  return tracks;
}

// --- merge -----------------------------------------------------------------
const token = await getToken();
const existing = JSON.parse(readFileSync(SONGS_PATH, "utf8"));
const manual = existing.filter((s) => s.source === "manual");

const synced = [];
const seenIds = new Set();
for (const entry of entries) {
  const id = playlistId(entry.playlist);
  const tracks = await fetchPlaylistTracks(token, id);
  console.log(`✓ ${tracks.length} tracks from ${entry.mood} playlist (${id})`);
  for (const track of tracks) {
    if (seenIds.has(track.id)) continue; // same track in two playlists: first mood wins
    seenIds.add(track.id);
    synced.push({
      kind: "song",
      id: track.id,
      mood: entry.mood,
      title: track.title,
      artist: track.artist,
      albumArt: track.albumArt,
      url: track.url,
      source: "spotify-sync",
      attribution: entry.attribution,
    });
  }
}

writeFileSync(SONGS_PATH, JSON.stringify([...manual, ...synced], null, 2) + "\n");
console.log(
  `\nWrote ${manual.length} manual + ${synced.length} synced songs to src/content/data/songs.json`,
);
