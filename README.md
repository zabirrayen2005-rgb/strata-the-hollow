# Strata — The Hollow

A first-person 3D game that runs in the browser. It is set in 2087, when two billion people live underground in **the Hollow**. A single lift connects three worlds:

| Level | What it is |
|---|---|
| **The Deep** | The crowded bottom level: a bathroom queue, a ration window, a clinic |
| **Director residences** | Eight private apartments for the Directorate, in two wings |
| **The surface** | An irradiated suburb in fog. You have about five minutes of air |

Someone up there knows something the Deep doesn't. Find out what, and make sure everyone hears it.

## How to play

| Desktop | Phone / tablet | Action |
|---|---|---|
| Mouse (or drag) | Drag on the right side | Look around |
| W A S D, hold Shift to run | Drag on the left side, **Run** button | Walk / run |
| **E** | **E · Use** | Talk, pick up, read. Hold to use machines |
| 1 / 2 / 3 inside the lift | Tap a floor button | The Deep / Director level / Surface |
| F | **Light** | Flashlight |
| Esc | **II** | Pause |

### The story loop

1. **The Deep:** collect your ration at the Food pickup window.
2. Trade the ration for a **rad-shield** at the Clinic. It's your lift clearance, and it slows radiation damage.
3. Ride the lift to the **Director level** (press 2).
4. Search the apartments. Teo the housekeeper will point you to the **surface keycard** in Apartment 07.
5. Ride to the **surface** (press 3) and follow the road to the red light: the **beacon relay**.
6. **Hold E** to transmit the Director's logs to every screen in the Deep, then get back to the lift before your air runs out.
7. Return to the Deep to see the ending. After that, free roam is unlocked.

There are 4 collectible notes (lore). Progress saves automatically in the browser. Use **New game** on the menu to start over.

## Run it locally

You need [Node.js](https://nodejs.org) (any recent version). There are no packages to install.

```bash
node serve.js
```

Then open http://localhost:5180. The first load unpacks about 28 MB of world data, so give it a few seconds.

To try the touch controls on a desktop, open http://localhost:5180/?touch=1.

## Project layout

```
index.html          page, HUD and menus (all CSS lives here)
js/game.js          engine: renderer, post-processing, world loading, movement, collision, lift, radiation, audio
js/story.js         gameplay: objectives, inventory, characters and dialogue, notes, beacon, ending, save
js/touch.js         touch controls (virtual joystick, look-drag, buttons)
data/levels.js      level layout: collision shapes, zones, doors, lamps, radiation hotspots
assets/world.js     3D world (gzipped glTF, base64), authored in Blender
assets/textures.js  material textures (base64 JPEG)
assets/lightmaps.js baked lighting for the three levels (base64 JPEG)
serve.js            tiny zero-dependency static server for local play
```

Three.js r128 is loaded from a CDN (cdnjs and jsDelivr).

### Coordinates

Level data uses Blender's floor plan: `(x, y)` on the floor and `z0` for each level's height. In three.js a point becomes `(x, z0 + height, -y)`. `story.js` uses the same convention, so you can drop new characters or pickups in by floor-plan coordinates.

### Debug hooks

`window.__strata` exposes the player (`P`), `setLevel('D'|'R'|'S')`, `travel()`, `health`, `start()` and `tick(n)`, which steps `n` frames by hand. These help with testing in the browser console.

## Credits

World, engine and original prototype by the Strata team. Story layer, characters, touch controls and repo setup were added with Claude Code.
