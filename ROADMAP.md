# machine — build roadmap

An inspiration vending machine. Pick a time-of-day mood, press the button, receive one song + one artwork + one texture — each with a note about why it was picked.

**Stack:** Vite + React + TypeScript. Spotify data is pulled by a local **sync script** (Client Credentials flow) that snapshots playlist tracks into committed JSON — so the deployed site is fully static, the client secret never ships to the browser, and hosting is free (Netlify/Vercel/GitHub Pages). Phase 3 visuals use `react-three-fiber` + `@react-three/drei`, receiving a Blender-authored glTF scene.

Moods: `sunrise · high-noon · golden-hour · dusk · midnight`

---

## Phase 1 — Backend & data pipeline ✅ highest priority

- [x] **1.1 Content data model** (`src/content/types.ts`)
  - `Song`, `Artwork`, `Texture` share a base: `id`, `mood`, `attribution` (required), plus type-specific fields (artist/album art/Spotify URL for songs; artist/year/image/source for artwork; description/image for textures).
  - Songs carry `source: "spotify-sync" | "manual"` for mixed sourcing.
- [x] **1.2 Content store** — plain JSON per type (`src/content/data/*.json`), validated at load by a lightweight schema check. CMS-lite: adding an entry = adding a JSON object.
- [x] **1.3 Spotify sync script** (`scripts/sync-spotify.mjs`)
  - Client Credentials flow; reads `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` from `.env`.
  - Config maps playlist URLs → mood + attribution line (`spotify.playlists.json`).
  - Fetches track name, artists, album art, external URL; merges into `songs.json` without clobbering manual entries; re-runnable (idempotent by track id).
- [x] **1.4 Pull logic** (`src/content/pull.ts`) — given a mood, return one song + artwork + texture from that mood's pool. Anti-repeat shuffle: no repeats until a pool is exhausted (persisted in `localStorage`).
- [x] **1.5 Local time → default mood** (`src/content/timeOfDay.ts`) — maps visitor's local hour to a mood, overridable.
- [x] **1.6 Unit tests** for pull logic + time mapping (Vitest).

## Phase 2 — Functional prototype (validate end-to-end, no fancy visuals)

- [x] **2.1 Bare-bones UI**: mood selector buttons (defaulting to local time), PULL button, three result cards with attributions.
- [ ] **2.2 Deploy** to Netlify/Vercel for shareable testing.
- [ ] **2.3 Load real content**: Gokul provides Spotify credentials + playlist URLs + hand-picked art/textures; run sync; verify pools.

## Phase 3 — Visual & interactive layer (after prototype validated)

- [ ] **3.1 Integration points**: `src/scene/` folder ready to receive the Blender glTF meadow + machine (r3f `<Canvas>` shell, glTF loader, named animation/interaction hooks). *No placeholder 3D before the handoff.*
- [ ] **3.2 Analog dial** mood selector + small digital screen readout.
- [ ] **3.3 Procedural sky/lighting** per mood (sky gradient, sun/moon position, stars at midnight) — independent of the meadow model.
- [ ] **3.4 Button-press → cards tumble out** animation (satisfying, not gaudy; spring physics).
- [ ] **3.5 Card flip/expand** to reveal attribution.
- [ ] **3.6 Polish pass**: motion timing, sound (optional), reduced-motion support, mobile.

## Phase 4 — Ship

- [ ] Final content pass (all five pools filled), cross-device QA, custom domain if desired.

---

## Locked decisions (do not relitigate)

Button press (not lever) · time-of-day moods only · 3 outputs (song/art/texture, no quotes) · attribution always shown · unlimited pulls, no gating · defaults to visitor's local time · clean & minimal, motion quality over feature quantity.
