/**
 * CMS-lite content store.
 *
 * Content lives in plain JSON files under ./data — adding an entry means
 * adding an object to the right file. Everything is validated here at load
 * so a typo'd mood or missing attribution fails loudly in dev, not silently
 * as an empty pool in production.
 */
import { MOODS, type Artwork, type ContentItem, type Mood, type Song, type Texture } from "./types";
import songsJson from "./data/songs.json";
import artworkJson from "./data/artwork.json";
import texturesJson from "./data/textures.json";

function fail(file: string, item: unknown, problem: string): never {
  throw new Error(`Invalid content in ${file}: ${problem}\n${JSON.stringify(item, null, 2)}`);
}

function validateBase(file: string, item: Record<string, unknown>, kind: ContentItem["kind"]) {
  if (item.kind !== kind) fail(file, item, `kind must be "${kind}"`);
  if (typeof item.id !== "string" || !item.id) fail(file, item, "id is required");
  if (!MOODS.includes(item.mood as Mood)) fail(file, item, `mood must be one of: ${MOODS.join(", ")}`);
  if (typeof item.attribution !== "string" || !item.attribution.trim())
    fail(file, item, "attribution is required — every card says why it was picked");
}

function requireString(file: string, item: Record<string, unknown>, field: string) {
  if (typeof item[field] !== "string" || !(item[field] as string).trim())
    fail(file, item, `${field} is required`);
}

export function loadSongs(raw: unknown[]): Song[] {
  const seen = new Set<string>();
  return raw.map((entry) => {
    const item = entry as Record<string, unknown>;
    validateBase("songs.json", item, "song");
    requireString("songs.json", item, "title");
    requireString("songs.json", item, "artist");
    if (item.source !== "spotify-sync" && item.source !== "manual")
      fail("songs.json", item, 'source must be "spotify-sync" or "manual"');
    if (item.source === "spotify-sync") {
      requireString("songs.json", item, "playlistId");
      requireString("songs.json", item, "playlistName");
    }
    if (seen.has(item.id as string)) fail("songs.json", item, `duplicate id "${item.id}"`);
    seen.add(item.id as string);
    return item as unknown as Song;
  });
}

function loadArtwork(raw: unknown[]): Artwork[] {
  return raw.map((entry) => {
    const item = entry as Record<string, unknown>;
    validateBase("artwork.json", item, "artwork");
    requireString("artwork.json", item, "title");
    requireString("artwork.json", item, "artist");
    return item as unknown as Artwork;
  });
}

function loadTextures(raw: unknown[]): Texture[] {
  return raw.map((entry) => {
    const item = entry as Record<string, unknown>;
    validateBase("textures.json", item, "texture");
    requireString("textures.json", item, "title");
    requireString("textures.json", item, "description");
    return item as unknown as Texture;
  });
}

export const songs: Song[] = loadSongs(songsJson);
export const artwork: Artwork[] = loadArtwork(artworkJson);
export const textures: Texture[] = loadTextures(texturesJson);

export function poolFor(mood: Mood) {
  return {
    songs: songs.filter((s) => s.mood === mood),
    artwork: artwork.filter((a) => a.mood === mood),
    textures: textures.filter((t) => t.mood === mood),
  };
}
