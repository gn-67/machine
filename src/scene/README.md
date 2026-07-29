# src/scene — Phase 3 visual layer lands here

This folder is the clean integration point for the 3D/visual layer. **Nothing in
`src/content` should ever import from here** — the content pipeline stays
headless so the visual layer is swappable.

## What arrives (built separately, handed off later)

- Blender-authored **meadow + vending machine** scene, exported as glTF/GLB
  (place exports in `public/models/`).

## Mood renders (already delivered)

`public/renders/{sunrise,high-noon,golden-hour,midnight}.mp4` — four 6-second
1920×1080/24fps looping videos of the meadow scene from the *same locked
camera*, differing only in sky/lighting. The grass sways (hair dynamics +
gusting wind); the wind sim was baked **once** and all four moods rendered
over the same frames, so grass motion is pixel-identical across moods at any
timestamp. Loops are made seamless by cross-blending the final second into
the first. `public/renders/{mood}.webp` is each video's first frame, used as
the `poster` for instant paint.

Playback pattern (implemented in `src/App.tsx`): all four `<video>`s stay
mounted; only the active one plays; on mood change the incoming video is
seeked to the outgoing one's `currentTime`, faded in over ~0.9s, then the old
one is paused. Because the loops share a timeline, the field never jumps.

Produced from `emilybday.blend` with the World's Nishita Sky Texture; recipe
per mood (unlisted values stay at the file's own: sun size ≈ 14°, sun
intensity 12.8, background strength 1.0):

| mood        | sun disc | elevation | rotation  | other                                        |
| ----------- | -------- | --------- | --------- | -------------------------------------------- |
| sunrise     | on       | 0.8°      | 0.192 rad | (file's own draft, untouched)                |
| high-noon   | on       | 60°       | 0.192 rad | sun intensity 0.05, bg strength 0.3          |
| golden-hour | on, 3°   | 2°        | 0.78 rad  | sun intensity 6, dust 5, bg 0.7 — small disc because the 14° disc averages too white for golden light |
| midnight    | off      | −4°       | 3.63 rad  | bg 1.4; glow rotated behind camera so the sky is blue ambient, machine lights carry the frame |

Pipeline scripts (run against the .blend, never modify it):
`scripts/render-moods.py` (stills), `scripts/render-sway-frames.py`
(sim + per-frame mood renders), `scripts/make-loops.py` (seamless loop
blend + H.264 encode + posters).

A snapshot of the scene file is committed at `blender/emilybday.blend`
(saved 2026-07-29 00:06) so renders are reproducible from any machine —
e.g. `blender --background blender/emilybday.blend --python
scripts/render-moods.py -- final out/`. Note: the "Edensor-FREE" font the
Text objects reference is not in the repo; without it installed, text falls
back to Blender's default font (which is what all current renders show).

## Planned structure

- `Scene.tsx` — react-three-fiber `<Canvas>` shell, mounts everything below
- `Machine.tsx` — loads the GLB, wires named nodes (dial, button, dispense slot) to interactions
- `Sky.tsx` — per-mood sky/lighting; the four renders above are the look
  reference (and can *be* the background outright), with optional extras
  layered on top (stars at midnight)
- `Dial.tsx` — analog mood dial + small digital readout (may be HTML overlay rather than 3D)
- `Cards.tsx` — tumble-out animation for the three result cards

## Contract with the content layer (already stable)

```ts
import { pull } from "../content/pull";          // (mood) => { song, artwork, texture }
import { currentMood } from "../content/timeOfDay"; // default dial position
import { MOODS, MOOD_LABELS } from "../content/types";
```

The scene only needs to: show the dial set to a mood, call `pull(mood)` on
button press, and present the returned three items. All pool/anti-repeat/
attribution logic is handled behind `pull()`.

## Blender export requests (for whoever authors the model)

- glTF Binary (.glb), +Y up, real-world-ish scale (machine ≈ 1.8 m tall)
- Separate, **named** objects for: `Dial`, `Button`, `Screen`, `DispenseSlot`
  so they can be animated/raycast individually
- Baked or simple PBR materials — no Blender-only procedural nodes
- Keep it light: target < 10 MB, textures ≤ 2048px
