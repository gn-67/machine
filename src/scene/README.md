# src/scene — Phase 3 visual layer lands here

This folder is the clean integration point for the 3D/visual layer. **Nothing in
`src/content` should ever import from here** — the content pipeline stays
headless so the visual layer is swappable.

## What arrives (built separately, handed off later)

- Blender-authored **meadow + vending machine** scene, exported as glTF/GLB
  (place exports in `public/models/`).

## Mood renders (already delivered)

`public/renders/{sunrise,high-noon,golden-hour,midnight}.webp` — four
1920×1080 Cycles renders of the meadow scene from the *same locked camera*,
differing only in sky/lighting. One per mood, so the site can show the frame
for the active mood and crossfade between them on dial change (only light
changes, nothing jumps). Load all four up front (or lazy-load neighbors) and
animate `opacity` between two stacked planes/`<img>`s — no WebGL required,
though a three.js textured quad works the same way.

They were produced from `emilybday.blend` with the World's Nishita Sky
Texture; recipe per mood (everything else left at the file's values —
sun size ≈ 14°, sun intensity 12.8, background strength 1.0):

| mood        | sun disc | elevation | rotation      | other                                  |
| ----------- | -------- | --------- | ------------- | -------------------------------------- |
| sunrise     | on       | 0.8°      | 0.192 rad     | (file's own draft, untouched)          |
| high-noon   | on       | 60°       | 0.192 rad     | sun intensity 0.05, bg strength 0.3    |
| golden-hour | on       | 2°        | 0.492 rad     | dust density 3.0 (sun sits behind machine) |
| midnight    | off      | −9°       | 0.192 rad     | machine's interior lights carry the frame |

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
