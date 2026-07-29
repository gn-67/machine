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

/**
 * `spotify:` URI for the same track, with playlist context.
 *
 * Unlike the web URL above, `context` genuinely works here: this is the
 * scheme the Spotify desktop/mobile app registers as its own deep-link
 * handler, and the app (not a browser) interprets `context=spotify:playlist:…`
 * as "start playing this track as part of that playlist" — so opening this
 * URI, when the app is installed, begins playback immediately instead of
 * just navigating to a page. See openSong() for the fallback when it isn't.
 */
export function songSpotifyUri(song: Song): string | null {
  if (!song.url) return null;
  const track = `spotify:track:${song.id}`;
  if (!song.playlistId) return track;
  return `${track}?context=${encodeURIComponent(`spotify:playlist:${song.playlistId}`)}`;
}

/**
 * Best-effort "start playing" for a song: try the app deep link first: if
 * the tab loses visibility within the window below, assume the OS handed
 * off to the Spotify app (which then autoplays) and stop there. Otherwise —
 * no app installed, or the browser blocked the handoff — fall back to the
 * playlist web page, where playback still needs a manual press.
 *
 * Known limitation: some browsers show a "open in Spotify?" confirmation
 * dialog before handing off. If the visitor hasn't answered it by the time
 * the fallback timer fires, both the app *and* the web fallback tab can end
 * up opening. There's no reliable way to detect that dialog from the page.
 */
export function openSong(song: Song, fallbackDelayMs = 1500): void {
  const webUrl = songPlayUrl(song);
  const uri = songSpotifyUri(song);
  if (!webUrl) return;
  if (!uri) {
    window.open(webUrl, "_blank", "noopener");
    return;
  }

  let handedOff = false;
  const onVisibilityChange = () => {
    if (document.hidden) handedOff = true;
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  window.location.href = uri;

  setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (!handedOff) window.open(webUrl, "_blank", "noopener");
  }, fallbackDelayMs);
}
