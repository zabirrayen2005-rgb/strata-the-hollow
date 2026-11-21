# Strata demo video

Everything that makes the 3-minute demo video lives in this folder. It records the real game and the Strata phone, adds the Solved checks and callouts on top, and exports a silent video for the team's voiceover. Nothing here is loaded by the game.

## What you get (in `video/out/`)

| File | What it is |
|---|---|
| `strata_demo.mp4` | The video: 3:14, 1920 × 1080, 30 fps, no voice |
| `strata_demo_captions.mp4` | The same video with the script burned in as subtitles |
| `voiceover.srt` | The script as a subtitle file, one cue per line |
| `teleprompter.html` | Plays the video with the current line large and a countdown to the next |
| `clips/S1.mp4` … `S7.mp4` | Each scene on its own, with `S<n>.marks.json` (when each action ran) |
| `report.json` | The done-when checklist, checked by the build |
| `strata_demo_final.mp4` | The video with the team's voices (made by `mix.mjs`) |

`out/` is not stored on GitHub (the videos are too large). Rebuild it with the commands below.

## Make the video

Needs Node 20 or newer and Google Chrome. Run these from the repo root.

```powershell
npm install --prefix video
```
```powershell
node video/record.mjs
```
```powershell
node video/assemble.mjs
```

- `record.mjs` records the three takes (about 10 minutes). A Chrome window opens and plays the game by itself; leave it alone until it closes. It starts the game server if it isn't running.
- `assemble.mjs` cuts the takes together, makes the captions, subtitle file, teleprompter and scene clips, and prints the checklist. It stops with an error if a take has a problem.
- To redo part of the video, edit `timeline.json`, record only that take (`node video/record.mjs A`), then assemble again.

## Add the voices

1. Open `video/out/teleprompter.html` (double-click it; no server needed). Space plays and pauses, R restarts, the arrow keys jump between lines. Use the A / B / C buttons to highlight your own lines.
2. Each speaker records one track from 0:00 to the end while watching it, saying only their own lines. Save them as `video/vo/A.wav`, `video/vo/B.wav`, `video/vo/C.wav` (m4a, mp3 and other common formats work too).
3. Mix:

```powershell
node video/mix.mjs
```

That lines the three tracks up at 0:00, cleans them lightly, levels them to −16 LUFS and writes `out/strata_demo_final.mp4`. If one speaker is early or late, slide that track: `node video/mix.mjs --shift B=-0.25` (seconds; negative is earlier). If one line is wrong, re-record that speaker's file and mix again.

Voices: **A** Narrator (11 lines), **B** Strata (20 lines), **C** Closer (1 line), then all three say the last line together.

## Files

| File | Job |
|---|---|
| `timeline.json` | The single source of truth: every shot, overlay, check and voiceover line with its time |
| `record.mjs` | The recorder |
| `driver.js` | Injected into the page: camera moves, walking, phone scrolling, frame stepping |
| `overlay.js` | Injected into the page: Solved check, counter, scene title, App → Game callout, finale |
| `assemble.mjs` | Cuts, joins, captions, teleprompter, checklist |
| `teleprompter.html` | Template for the teleprompter |
| `mix.mjs` | Adds the voices |
| `grab.mjs`, `sheet.mjs` | Review helpers: pull frames from a take into a contact sheet |

## How the capture works

The recorder owns the page clock. It moves the clock forward 1/30 s, lets the game draw, saves that frame, and repeats. The game, the phone and the overlays all read that clock, so the video is an exact 30 fps at full High quality on any computer, and every action lands on its planned frame.

The build kit asked for a real-time DevTools screencast, with a macOS screen recording as the fallback. On the Windows laptop this was built on, the screencast reached 26 to 31 fps, and below 34 fps the game lowers its own 3D resolution, so real-time capture made the world blurry. Frame stepping replaces both methods.

## Where this differs from the build kit

**Added (not in the kit)**

- **Strata Assistant, 1:50 to 2:04.** The kit was written before the assistant existed. After the Ask Strata question on Mesh, the video shows Connections (a signed memory card being allowed, the Directorate archive blocked, the Surface Relay off) and the assistant answering from the allowed card. This adds one voiceover line (33 lines, not 32) and 4 seconds, so scenes 5 to 7 start 4 s later than in the kit and the video is 3:14.

**Changed so the shot works**

- **Takes.** A covers scenes 1 to 4, B is the 4-second blackout insert, C covers scenes 5 to 7 (the kit's take D is the end of C).
- **Starting a new game.** A clean browser profile has no save, so the game hides the New game button. The recorder clicks "Click to enter", which starts a new game.
- **Opening shot.** Mara starts at (−3.5, −1.8), not (−3, 1.5): the bathroom queue blocks the walk to the lift from the kit's spot.
- **Water sign.** The sign faces west, so it is filmed from (−14.1, 2.5). From the kit's (−10, 1.4) only its back is visible.
- **Scene 4 start.** Mara cuts to the south side of the queue and walks to (−9, −1.5). From the north side the lift column hides the beam that climbs the shaft, and the queue can't be crossed. The scene 3 → 4 change is an 8-frame crossfade.
- **Directorate split.** The app asks for confirmation before applying it (`apply` then `confirmdir`); the insert shows both taps.
- **Cooling toggle.** The buttons are `data-act="heat"` with `data-arg="1"` (Directorate split) and `"0"` (Strata split).
- **Scene clips.** They are cut from the finished master. To redo a scene, re-record its take.
- **Captions.** Drawn by Chrome with the game's Inter font, then laid over the video (ffmpeg can't read the game's `.woff2` fonts). Style as specified: 34 px, white, 2 px black outline, bottom-left.

**Recorder nudges to the running game** (state only; no screen is faked)

- **Forecast seed.** The game reseeds its 500-run forecast from the wall-clock minute. The page clock starts in the minute that gives seed 2094, so every take shows 96%.
- **Network-cut timer.** The game cuts the network 14 s after the power fix unless Life is open. The shot list lowers the phone while Life is still being shown, so the recorder restarts that timer at 1:00 and makes the 40 s hold run out at 1:26 (`"do": "netcut"`).
- **Continuity between takes.** Take B copies take A's countdown so the brownout matches. Take C carries the play time over so the ending's TIME stat covers the whole run, and shows the 10 checks earned earlier (`preset`).
- **Act 2 banner.** The game announces "Act 2 · Network" the moment the fair split is applied (0:45). The video introduces Act 2 at 1:30, so that one banner is held back for 6 s (`"do": "hud"`).
- **Pointer lock** is switched off in the recording browser so the game never drops to its pause menu.

**Small mismatches left as they are**

- The Home ring reads 1:36 at 0:14, not 1:4x: the game's countdown starts at 1:52 and the phone opens 14 s in.
- The probe card reads "hotspot 4 of 5" at 2:19 (the kit says 3 of 5); the drone is slightly ahead.

**One game fix made alongside**

- `js/story.js`: the water sign's "15 L PER PERSON" was wider than the board and showed as "L PER PERS". The text now shrinks to fit. This is the only file changed outside `video/`.

## Hook names checked against the game

All hooks the kit names exist and are used as written: `__strata.jump`, `.start`, `.travel`, `.P`, `.story().model`, `.story().interact`; `StrataPhone.open`, `.close`, `.go`; and the `data-act` buttons `bypass`, `preview`, `apply`, `fixleak`, `lamps`, `triage`, `broadcast`, `ava`, `crew`, `sign`, `stagger`, `finish`. The assistant shots use `#askq`, `data-act="ask"` and `data-act="cardallow"`, and the screens `conn` and `chat`.
