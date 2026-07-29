/**
 * Spotify link helpers for song cards.
 */
import type { Song } from "./types";

/**
 * URL that opens the track *inside its source playlist*.
 *
 * Note: a `?context=spotify:playlist:…` param on a track URL does NOT work —
 * `context_uri` is a Web API/SDK playback concept, and open.spotify.com
 * silently drops unknown query params, so those links just open the standalone
 * track. The form that actually lands you in the playlist is the playlist URL
 * with `?highlight=spotify:track:<id>`, which opens the playlist scrolled to
 * (and highlighting) that track.
 *
 * Falls back to the plain track link for manual entries with no playlist.
 */
export function songPlayUrl(song: Song): string | null {
  if (!song.url) return null;
  if (!song.playlistId) return song.url;
  const highlight = encodeURIComponent(`spotify:track:${song.id}`);
  return `https://open.spotify.com/playlist/${song.playlistId}?highlight=${highlight}`;
}
