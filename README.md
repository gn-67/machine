# machine

An inspiration vending machine — a birthday gift. Dial in a time-of-day mood
(sunrise · high noon · golden hour · midnight), press the button, and
receive one song, one artwork, and one texture close-up — each with a note
about why it was picked.

Currently at **Phase 2** (functional prototype). See [ROADMAP.md](ROADMAP.md).

## Run it

```sh
npm install
npm run dev      # local dev server
npm test         # content + pull-logic tests
npm run build    # static production build in dist/
```

The deployed site is fully static — deployable to Netlify/Vercel/GitHub Pages
as-is.

## Adding content (CMS-lite)

All content lives in `src/content/data/*.json`. Every entry needs a `mood`
(one of `sunrise`, `high-noon`, `golden-hour`, `midnight` — golden hour
covers dusk) and an
`attribution` — the "why this was picked" line shown on the card. Entries are
validated at load; a typo fails the tests rather than silently emptying a pool.

- **Songs** (`songs.json`): synced from Spotify (below) and/or added by hand
  with `"source": "manual"`.
- **Artwork** (`artwork.json`): hand-picked. `image` is a URL or a path to a
  file in `public/`.
- **Textures** (`textures.json`): hand-picked material close-ups; `image: null`
  renders a placeholder swatch until the real image is added.

## Syncing songs from Spotify

No credentials needed: the sync reads Spotify's public embed/oEmbed endpoints.
(The official Web API returns 403 on all track data for apps created under the
2025 dev-mode restrictions, even with valid Client Credentials — see the note
in `scripts/sync-spotify.mjs`.)

1. Map public playlist URLs to moods in `scripts/spotify.playlists.json`.
   Attribution is generated from the playlist's real name (`from your "Name"
   playlist`); add an `attribution` field to a playlist entry to override it.
2. `npm run sync-spotify` — snapshots track name, artists, album art, link,
   and source playlist into `songs.json`. Re-runnable; never touches manual
   entries. Song cards should link via `songPlayUrl()` (`src/content/spotify.ts`),
   which opens the track inside its playlist so playback continues through it.

## Architecture notes

- `src/content/` — headless data layer: types, JSON store + validation,
  anti-repeat pull logic, local-time → mood mapping. No UI imports.
- `src/App.tsx` — Phase 2 shell proving the flow end to end; replaced in Phase 3.
- `src/scene/` — reserved for the Phase 3 visual layer (r3f meadow + machine);
  see its README for the handoff contract.
