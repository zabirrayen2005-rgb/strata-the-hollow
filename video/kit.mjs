// Packs a small "voiceover kit" for teammates.   node video/kit.mjs
//   out/strata_voiceover_kit.zip  ->  teleprompter.html, strata_demo.mp4 (720p copy, under 30 MB so it can be sent in a chat),
//                                     SCRIPT.txt, HOW_TO_RECORD.txt, voiceover.srt
// Unzip it anywhere and open teleprompter.html: it plays the video next to it, no install needed.
import ffmpegPath from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const TL = JSON.parse(fs.readFileSync(path.join(here, 'timeline.json'), 'utf8'));
const OUT = path.join(here, 'out'), KIT = path.join(OUT, 'voiceover_kit'), ZIP = path.join(OUT, 'strata_voiceover_kit.zip');
const need = f => { if (!fs.existsSync(path.join(OUT, f))) { console.error(`out/${f} is missing. Run node video/assemble.mjs first.`); process.exit(1); } };
['strata_demo.mp4', 'teleprompter.html', 'voiceover.srt'].forEach(need);
fs.rmSync(KIT, { recursive: true, force: true }); fs.mkdirSync(KIT, { recursive: true });

const clock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const NAME = { A: 'A (Narrator)', B: 'B (Strata)', C: 'C (Closer)', ABC: 'ALL THREE' };
const VO = TL.voiceover, sceneOf = t => TL.scenes.find(s => t >= s.start && t < s.end);
const count = v => VO.filter(c => c.voice === v).length;

let script = `STRATA DEMO VIDEO - VOICEOVER SCRIPT\n${clock(TL.length)} long, ${VO.length} lines, three voices.\n\n`;
script += `Voice A - Narrator: tells Mara's story. Low, steady, a little grave. ${count('A')} lines.\n`;
script += `Voice B - Strata: explains what the app does. Clear, confident, slightly faster. ${count('B')} lines.\n`;
script += `Voice C - Closer: one line near the end. Then all three say the last line together.\n\n`;
script += `Start each line when its time comes up. Say numbers as written. If you finish early, stop: silence is fine, rushing is not.\n`;
let last = null;
for (const c of VO) { const sc = sceneOf(c.start); if (sc && sc !== last) { script += `\n--- ${sc.title} (${clock(sc.start)} to ${clock(sc.end)}) ---\n`; last = sc; }
  script += `${clock(c.start).padStart(4)} - ${clock(c.end)}  ${NAME[c.voice].padEnd(13)} ${c.text}\n`; }
for (const v of ['A', 'B', 'C']) { script += `\n\n===== ONLY VOICE ${v} =====\n`;
  for (const c of VO.filter(c => c.voice.includes(v))) script += `${clock(c.start).padStart(4)}  ${c.voice === 'ABC' ? '(all together) ' : ''}${c.text}\n`; }
fs.writeFileSync(path.join(KIT, 'SCRIPT.txt'), script.replace(/\n/g, '\r\n'));

const how = `HOW TO RECORD YOUR VOICE

1. Unzip this folder. Keep all the files together.
2. Open teleprompter.html (double-click). It plays the video with your line in large type and a countdown to the next line.
   Space = play / pause.   R = restart.   Left / Right arrows = jump between lines.
   Click your voice (A, B or C) under "Highlight my lines" so the other speakers' lines are dimmed.
3. Watch it through once without recording.
4. Record in a quiet room, phone or laptop mic about 15 cm (a hand's width) from your mouth:
   - Start your recorder.
   - Clap once at the same moment you press Space to start the video. The clap is how the tracks get lined up.
   - Say only your own lines, each one when it comes up. Stay quiet during everyone else's lines.
   - Let it run to the end (${clock(TL.length)}), then stop the recorder.
5. If you stumble, carry on to the end. You can redo the whole take: one clean take is easier to mix than patched lines.
6. Name the file A, B or C for your voice (for example B.m4a) and send it back. Any common format works: wav, m4a, mp3.

The last line, "Strata. The truth, and the way up.", is said by all three, each on their own recording.
`;
fs.writeFileSync(path.join(KIT, 'HOW_TO_RECORD.txt'), how.replace(/\n/g, '\r\n'));
fs.copyFileSync(path.join(OUT, 'teleprompter.html'), path.join(KIT, 'teleprompter.html'));
fs.copyFileSync(path.join(OUT, 'voiceover.srt'), path.join(KIT, 'voiceover.srt'));

// a 720p copy of the silent video, small enough to send in a chat, under the name the teleprompter expects
const r = spawnSync(ffmpegPath, ['-y', '-v', 'error', '-i', path.join(OUT, 'strata_demo.mp4'), '-vf', 'scale=1280:720:flags=lanczos',
  '-c:v', 'libx264', '-preset', 'medium', '-b:v', '1050k', '-maxrate', '1300k', '-bufsize', '2600k', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '32k', '-movflags', '+faststart', path.join(KIT, 'strata_demo.mp4')], { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }

fs.rmSync(ZIP, { force: true });
const z = spawnSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${KIT}\\*' -DestinationPath '${ZIP}' -CompressionLevel Fastest`], { encoding: 'utf8' });
if (z.status !== 0 || !fs.existsSync(ZIP)) { console.error('zip failed: ' + z.stderr); process.exit(1); }
console.log(`${path.relative(path.join(here, '..'), ZIP)}  ${(fs.statSync(ZIP).size / 1048576).toFixed(1)} MB`);
for (const f of fs.readdirSync(KIT)) console.log('  ' + f.padEnd(22) + (fs.statSync(path.join(KIT, f)).size / 1048576).toFixed(2) + ' MB');
