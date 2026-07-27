# src/scene — Phase 3 visual layer lands here

This folder is the clean integration point for the 3D/visual layer. **Nothing in
`src/content` should ever import from here** — the content pipeline stays
headless so the visual layer is swappable.

## What arrives (built separately, handed off later)

- Blender-authored **meadow + vending machine** scene, exported as glTF/GLB
  (place exports in `public/models/`).

## Planned structure

- `Scene.tsx` — react-three-fiber `<Canvas>` shell, mounts everything below
- `Machine.tsx` — loads the GLB, wires named nodes (dial, button, dispense slot) to interactions
- `Sky.tsx` — procedural per-mood sky/lighting (gradient, sun/moon, stars at midnight); independent of the meadow model
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
