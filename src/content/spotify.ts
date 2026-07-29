/**
 * Spotify link helpers for song cards.
 */
import type { Song } from "./types";

/**
 * URL that opens the track *inside its source playlist*: when the link opens
 * in the Spotify app (mobile/desktop), the `context` param makes playback
 * continue through the playlist instead of stopping after the one song.
 * Falls back to the plain track link for manual entries with no playlist.
 */
export function songPlayUrl(song: Song): string | null {
  if (!song.url) return null;
  if (!song.playlistId) return song.url;
  return `${song.url}?context=${encodeURIComponent(`spotify:playlist:${song.playlistId}`)}`;
}
