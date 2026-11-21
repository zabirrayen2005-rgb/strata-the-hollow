// contact sheet helper for scouting: node sheet.mjs out.jpg a.jpg b.jpg c.jpg d.jpg
import ff from 'ffmpeg-static'; import { execFileSync } from 'node:child_process';
const [out, ...ins] = process.argv.slice(2);
const n = ins.length, cols = n <= 1 ? 1 : 2, rows = Math.ceil(n / cols);
const args = ['-y', '-v', 'error']; for (const i of ins) args.push('-i', i);
const f = ins.map((_, i) => `[${i}:v]scale=960:540[v${i}]`).join(';') + ';' + ins.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${n}:layout=${ins.map((_, i) => `${(i % cols) * 960}_${Math.floor(i / cols) * 540}`).join('|')}[o]`;
if (n === 1) args.push('-vf', 'scale=960:540'); else args.push('-filter_complex', f, '-map', '[o]');
args.push('-q:v', '4', out); execFileSync(ff, args);
