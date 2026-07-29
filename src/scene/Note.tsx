import { useEffect, useState } from "react";

/**
 * The note behind the machine — opened from the envelope button in the
 * top-right corner.
 *
 * ─── EDIT THE NOTE HERE ────────────────────────────────────────────────
 * Everything Emily reads lives in NOTE below, and nothing else in this
 * file needs touching. `title` is the heading; each string in `paragraphs`
 * renders as its own paragraph. Plain text — no markup, no escaping, and
 * apostrophes/emoticons are fine as-is. Add or remove paragraphs freely.
 * ───────────────────────────────────────────────────────────────────────
 */
const NOTE = {
  title: "AYO happy birthday emily :^)",
  paragraphs: [
    "my thought process behind this website was whenever you are sitting down to design and you need a moment to clear your head from the day that happened or is yet to happen, you could visit this site to help you get started! I often find that a minute of peace helps me focus for so much longer",
    "i hand made the 3d models + animation in the back. i also pulled all the songs from your spotify profile/playlists and had the songs, artworks, and textures curated to match the time of day you visit this site (ik all about those late night portfolio sessions XD)",
  ],
};

export function Note() {
  const [open, setOpen] = useState(false);
  // the nudge stops for good once she's opened it
  const [everOpened, setEverOpened] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function toggle() {
    setOpen((v) => !v);
    setEverOpened(true);
  }

  return (
    <div className="note">
      <button
        className={everOpened ? "note-btn" : "note-btn nudging"}
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? "Close the note" : "Open the note"}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      </button>

      {open && (
        <article className="note-panel">
          <h2>{NOTE.title}</h2>
          {NOTE.paragraphs.map((text) => (
            <p key={text.slice(0, 24)}>{text}</p>
          ))}
        </article>
      )}
    </div>
  );
}
