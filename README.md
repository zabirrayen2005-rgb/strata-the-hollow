# Strata — The Hollow

A first-person 3D game that runs in the browser. It is set in 2087, when two billion people live underground in **the Hollow**. A single lift connects three worlds:

| Level | What it is |
|---|---|
| **The Deep** | The crowded bottom level: a bathroom queue, a ration window, a clinic |
| **Director residences** | Eight private apartments for the Directorate, in two wings |
| **The surface** | An irradiated suburb in fog. You have about five minutes of air |

You are **Mara**, in the Deep. Tonight the Directorate is cutting the power, the network and the truth. Your daughter **Ava** works two levels up. You have **Strata**, a phone app that solves the Hollow's problems in depth. The demo runs about 3 minutes and ends on the surface.

## How to play

| Desktop | Phone / tablet | Action |
|---|---|---|
| Mouse (or drag) | Drag on the right side | Look around |
| W A S D, hold Shift to run | Drag on the left side, **Run** button | Walk / run |
| **E** | **E · Use** | Talk, pick up, read. Hold to use machines |
| 1 / 2 / 3 inside the lift | Tap a floor button | The Deep / Director level / Surface |
| **Tab** (or click it, bottom right) | **Strata** button | Raise the Strata phone. Esc or tap outside to put it away |
| F | **Light** | Flashlight |
| Esc | **II** | Pause |

### The three acts

Each act follows the same pattern: **detect, explain, decide, the world reacts, verify**. Every app action changes the 3D world, and every number comes from a real engine in `js/engines.js`.

| Act | Problems | What happens | Engine |
|---|---|---|---|
| **1 · Power** | #1 Blackouts, #2 Rationing | The phone warns the Deep goes dark in about 1:52. Approve the AI's feed 3 bypass, then compare the Directorate's split with Strata's fair split. Lamps stop flickering and the lift unlocks (or the Deep goes dark if you pick the Directorate's split) | Monte Carlo forecast (500 runs); allocation with a survival minimum |
| **2 · Network** | #7 Network cut, #8 Split families | The network is cut. Glowing links appear between residents' phones. Broadcast the warning hop by hop, then check in on Ava: her signed "I'm safe" comes back up the lift shaft | Mesh flood (BFS) and best route (Dijkstra); ECDSA P-256 signatures |
| **3 · Surface** | #13 Is it safe?, #14 Who goes first | A drone maps the hotspots. Live probe numbers beat the Directorate's claim (about 5 min unprotected, 6 h in a suit). Strata picks the first crew and the probe site. Plant the probe, sign the reading, send it down | Dose model, protection options, safest site, crew selection |
| **Close** | #15 The way up | The return plan: 48,000 residents through one lift in 4 waves | Wave planner |

### Sponsors in the app

Each one shows a "Powered by" line on the screen where it's used. The artifact can't call outside services, so these run locally in the demo; the pitch explains the production hookup.

- **Microsoft:** the Hollow is modeled as an Azure Digital Twins-style graph (DTDL) built from the level data, with a Copilot-style assistant explaining each forecast and decision.
- **Caelon:** the power module is built like Caelon Prism: a live energy model with forecasting, and an AI that only acts within limits residents set.
- **MetroStar:** Comet-style UI; a HorizonHunt-style offline AI on the Mesh screen; a Falcon-style drone scouting the surface.

### The Strata phone

Press **Tab** to raise it. Screens: Home (countdown and digital twin), Power, Mesh, Fair share, Surface, Return plan. The world keeps running while the phone is up. On the surface, radiation still counts down.

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
js/story.js         Mara's three acts, world reactions (lamps, mesh links, drone, probe), characters, notes, save
js/touch.js         touch controls (virtual joystick, look-drag, buttons)
js/phone.js         Strata phone shell: frame, open/close, styles (the team's design)
js/app.js           Strata app screens for Mara's story, sponsor lines
js/engines.js       forecast, allocation, mesh routing, ECDSA signing, surface, crew, return plan, digital twin
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
