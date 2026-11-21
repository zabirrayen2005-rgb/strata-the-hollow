// Adds the team's voices to the finished video.   node video/mix.mjs
// Put one recording per speaker in video/vo/:  A.wav  B.wav  C.wav  (wav, m4a, mp3, aac, ogg, flac, webm or mp4 all work).
// Each recording runs from 0:00 of the video, made while watching out/teleprompter.html and saying only that speaker's lines.
// Each track is lined up at 0:00, cleaned lightly (afftdn), levelled to -16 LUFS, then the three are mixed and joined to
// out/strata_demo.mp4 as out/strata_demo_final.mp4. The picture is copied, not re-encoded.
// If one line is off, re-record just that speaker's file and run this again.
//   node video/mix.mjs --shift B=-0.25     slide one speaker earlier (negative) or later (positive), in seconds
import ffmpegPath from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const TL = JSON.parse(fs.readFileSync(path.join(here, 'timeline.json'), 'utf8'));
const OUT = path.join(here, 'out'), VO = path.join(here, 'vo'), LEN = TL.length;
const EXT = ['wav', 'm4a', 'mp3', 'aac', 'ogg', 'flac', 'webm', 'mp4', 'mov'];
const fail = m => { console.error('MIX FAILED: ' + m); process.exit(1); };
const video = path.join(OUT, 'strata_demo.mp4');
if (!fs.existsSync(video)) fail('out/strata_demo.mp4 is missing. Run node video/assemble.mjs first.');

const shift = {};
process.argv.forEach((a, i) => { if (a === '--shift') for (const p of (process.argv[i + 1] || '').split(',')) { const [k, v] = p.split('='); if (k && isFinite(+v)) shift[k.toUpperCase()] = +v; } });

const voices = [];
for (const v of ['A', 'B', 'C']) {
  const f = EXT.map(e => path.join(VO, `${v}.${e}`)).find(p => fs.existsSync(p));
  if (f) voices.push({ v, file: f }); else console.warn(`warning: no recording for voice ${v} (expected video/vo/${v}.wav): mixing without it`);
}
if (!voices.length) fail('no recordings found in video/vo/. Expected A.wav, B.wav and C.wav.');

const args = ['-y', '-v', 'error', '-i', video];
let fc = '';
voices.forEach(({ v, file }, i) => {
  args.push('-i', file);
  const s = shift[v] || 0;
  // mono -> light noise reduction -> speech high-pass -> level to -16 LUFS -> line up at 0:00 -> exactly the video's length
  const move = s > 0 ? `adelay=${Math.round(s * 1000)}:all=1,` : s < 0 ? `atrim=start=${-s},asetpts=PTS-STARTPTS,` : '';
  fc += `[${i + 1}:a]aformat=sample_rates=48000:channel_layouts=mono,${move}afftdn=nr=10:nf=-45,highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=11,apad,atrim=end=${LEN},asetpts=PTS-STARTPTS[a${i}];`;
});
fc += `${voices.map((_, i) => `[a${i}]`).join('')}amix=inputs=${voices.length}:duration=longest:normalize=0,alimiter=limit=0.89,aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo[mix]`;   // loudnorm works at a higher rate: bring it back to 48 kHz
const final = path.join(OUT, 'strata_demo_final.mp4');
args.push('-filter_complex', fc, '-map', '0:v', '-map', '[mix]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(LEN), '-movflags', '+faststart', final);
const r = spawnSync(ffmpegPath, args, { encoding: 'utf8' });
if (r.status !== 0) fail((r.stderr || '').trim().split('\n').slice(-3).join(' | '));
console.log(`mixed ${voices.map(x => x.v + (shift[x.v] ? ` (${shift[x.v] > 0 ? '+' : ''}${shift[x.v]} s)` : '')).join(', ')} -> ${path.relative(path.join(here, '..'), final)}`);
