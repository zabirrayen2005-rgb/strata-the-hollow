// review helper: node grab.mjs <take> <abs seconds...>  -> scout/<take>_<t>.jpg and a contact sheet
import ff from 'ffmpeg-static'; import { execFileSync } from 'node:child_process'; import fs from 'node:fs';
const [take, ...ts] = process.argv.slice(2);
const TL = JSON.parse(fs.readFileSync('timeline.json', 'utf8')), from = take === 'final' ? 0 : TL.takes[take].from, pre = take === 'final' ? 0 : 0.5;
const src = take === 'final' ? 'out/strata_demo.mp4' : `out/takes/${take}.mp4`;
fs.mkdirSync('scout', { recursive: true });
const files = [];
for (const t of ts) { const f = `scout/${take}_${t}.jpg`; execFileSync(ff, ['-y', '-v', 'error', '-ss', String(+t - from + pre), '-i', src, '-frames:v', '1', '-q:v', '3', f]); files.push(f); }
for (let i = 0; i < files.length; i += 4) execFileSync(process.execPath, ['sheet.mjs', `scout/${take}_sheet${i / 4}.jpg`, ...files.slice(i, i + 4)]);
console.log('sheets:', Math.ceil(files.length / 4));
