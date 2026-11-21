// Builds the finished video from the recorded takes.   node video/assemble.mjs
//   out/strata_demo.mp4            the video, no voice (silent stereo track so editing apps accept it)
//   out/strata_demo_captions.mp4   the same video with the voiceover burned in as subtitles
//   out/voiceover.srt              one cue per voiceover line
//   out/teleprompter.html          plays the video with the current line and a countdown to the next
//   out/clips/S1.mp4 ... S7.mp4    each scene on its own, with S<n>.marks.json
//   out/report.json                the done-when checklist, checked
//   node video/assemble.mjs --check      re-run only the checklist on what is already built
//   node video/assemble.mjs --captions   rebuild only the subtitles and the captioned video
// It fails loudly if a take is missing, has a problem, or any action landed more than 0.3 s from its planned time.
import { chromium } from 'playwright-core';
import ffmpegPath from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const TL = JSON.parse(fs.readFileSync(path.join(here, 'timeline.json'), 'utf8'));
const OUT = path.join(here, 'out'), TAKES = path.join(OUT, 'takes'), CLIPS = path.join(OUT, 'clips'), TMP = path.join(OUT, 'tmp');
const FPS = TL.fps, [W, H] = TL.size, LEN = TL.length, XF = 8;           // XF: frames of crossfade between scenes
for (const d of [CLIPS, TMP]) fs.mkdirSync(d, { recursive: true });
const CHECK_ONLY = process.argv.includes('--check'), CAPTIONS_ONLY = process.argv.includes('--captions');
const fail = msg => { console.error('\nASSEMBLY FAILED: ' + msg); process.exit(1); };
function ff(args, what) {
  const r = spawnSync(ffmpegPath, ['-y', '-v', 'error', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) fail(`${what}: ${(r.stderr || '').trim().split('\n').slice(-3).join(' | ')}`);
  return r;
}
function probe(file) {
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8' }), s = r.stderr || '';
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(s), v = /Video: (\w+).*?, (\d{3,5})x(\d{3,5}).*?([\d.]+) fps/.exec(s);
  return { seconds: d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : 0, codec: v && v[1], width: v && +v[2], height: v && +v[3], fps: v && +v[4], audio: /Audio: (\w+)/.test(s) ? /Audio: (\w+)/.exec(s)[1] : null };
}
const clock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- 1. the takes and their marks
const marks = {};
for (const name of Object.keys(TL.takes)) {
  const f = path.join(TAKES, name + '.marks.json'), v = path.join(TAKES, name + '.mp4');
  if (!fs.existsSync(f) || !fs.existsSync(v)) fail(`take ${name} has not been recorded (node video/record.mjs ${name})`);
  const m = marks[name] = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (m.from !== TL.takes[name].from || m.to !== TL.takes[name].to) fail(`take ${name} was recorded for a different timeline: record it again`);
  if (m.problems.length) fail(`take ${name} has problems:\n  ` + m.problems.join('\n  '));
  for (const a of m.actions.concat(m.checks)) if (Math.abs(a.late) > 0.3) fail(`take ${name}: "${a.what}" planned at ${a.t}s landed at ${a.at}s`);
}
const pre = name => marks[name].pre;
const fr = (name, abs) => Math.round((abs - TL.takes[name].from + pre(name)) * FPS);      // frame of a take at an absolute video time

// ---------------------------------------------------------------- 2. the master cut
// Scene order comes from timeline.json. Inside a scene the cuts are hard (including the take B insert); between scenes the
// timeline says "continuous" (same shot carries on), "cut" (the kit's 0:52 hard cut) or "xfade" (8-frame crossfade).
const pieces = [];                                             // [take, fromAbs, toAbs] in order
for (const sc of TL.scenes) {
  const ins = sc.shots.filter(s => s.take && s.take !== sc.take).map(s => s.take).filter((v, i, a) => a.indexOf(v) === i);
  let t = sc.start;
  for (const b of ins) { const B = TL.takes[b]; if (B.from > t) pieces.push([sc.take, t, B.from, sc.id]); pieces.push([b, B.from, B.to, sc.id]); t = B.to; }
  if (t < sc.end) pieces.push([sc.take, t, sc.end, sc.id]);
}
const inputs = Object.keys(TL.takes), idx = n => inputs.indexOf(n);
const xfades = TL.scenes.filter(s => s.in === 'xfade').map(s => s.start);
// group the pieces into runs separated by crossfades
const runs = [[]];
for (const p of pieces) { if (xfades.includes(p[1]) && p[1] === TL.scenes.find(s => s.id === p[3]).start) runs.push([]); runs[runs.length - 1].push(p); }
let fc = '', n = 0; const runLabels = [];
runs.forEach((run, ri) => {
  const labels = [];
  run.forEach((p, pi) => {
    let [take, a, b] = p;
    const first = pi === 0, last = pi === run.length - 1, prevRun = runs[ri - 1], nextRun = runs[ri + 1];
    // real handles exist when the crossfade joins two different takes: borrow 4 frames from each side
    let f0 = fr(take, a), f1 = fr(take, b);
    if (first && prevRun && prevRun[prevRun.length - 1][0] !== take) f0 -= XF / 2;
    if (last && nextRun && nextRun[0][0] !== take) f1 += XF / 2;
    const l = `p${n++}`; fc += `[${idx(take)}:v]trim=start_frame=${f0}:end_frame=${f1},setpts=PTS-STARTPTS,fps=${FPS},format=yuv420p,settb=1/${FPS}[${l}];`; labels.push(l);
  });
  let out = `r${ri}`;
  fc += labels.length > 1 ? `${labels.map(l => `[${l}]`).join('')}concat=n=${labels.length}:v=1:a=0,settb=1/${FPS}[${out}];` : `[${labels[0]}]null[${out}];`;
  runLabels.push(out);
});
let cur = runLabels[0];
for (let ri = 1; ri < runs.length; ri++) {
  const T = runs[ri][0][1], sameTake = runs[ri - 1][runs[ri - 1].length - 1][0] === runs[ri][0][0];
  // same take (a jump cut inside one recording): hold the last frame and fade the new shot in over it
  let a = cur; if (sameTake) { a = `h${ri}`; fc += `[${cur}]tpad=stop_mode=clone:stop_duration=${XF / FPS}[${a}];`; }
  const offset = sameTake ? T : T - XF / 2 / FPS, out = `x${ri}`;
  fc += `[${a}][${runLabels[ri]}]xfade=transition=fade:duration=${XF / FPS}:offset=${offset.toFixed(5)},settb=1/${FPS}[${out}];`; cur = out;
}
fc += `[${cur}]fade=t=in:st=0:d=0.5,fade=t=out:st=${LEN - 1}:d=1,format=yuv420p[v]`;
const master = path.join(OUT, 'strata_demo.mp4');
const ENC = ['-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'];
const SILENT = ['-f', 'lavfi', '-t', String(LEN), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'];
if (!CHECK_ONLY && !CAPTIONS_ONLY) { console.log('cutting the master…');
ff([...inputs.flatMap(i => ['-i', path.join(TAKES, i + '.mp4')]), ...SILENT, '-filter_complex', fc, '-map', '[v]', '-map', `${inputs.length}:a`,
  ...ENC, '-c:a', 'aac', '-b:a', '128k', '-t', String(LEN), '-movflags', '+faststart', master], 'master cut'); }

// ---------------------------------------------------------------- 3. scene clips + their marks
if (!CHECK_ONLY && !CAPTIONS_ONLY) console.log('scene clips…');
for (const sc of CHECK_ONLY || CAPTIONS_ONLY ? [] : TL.scenes) {
  ff(['-ss', String(sc.start), '-t', String(sc.end - sc.start), '-i', master, ...ENC, '-crf', '17', '-an', path.join(CLIPS, sc.id + '.mp4')], 'clip ' + sc.id);
  const all = Object.values(marks).flatMap(m => m.actions.concat(m.checks).map(a => ({ ...a, take: m.take }))).filter(a => a.scene === sc.id).sort((a, b) => a.at - b.at);
  fs.writeFileSync(path.join(CLIPS, sc.id + '.marks.json'), JSON.stringify({ scene: sc.id, title: sc.title, start: sc.start, end: sc.end, actions: all }, null, 1));
}

// ---------------------------------------------------------------- 4. subtitles
const stamp = t => { const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
// lines of at most 42 characters, as even as possible
function wrap(text, max = 42) {
  const words = text.split(' '), n = Math.max(1, Math.ceil(text.length / max));
  for (let lines = n; lines <= n + 2; lines++) {
    const target = text.length / lines, out = []; let cur = '';
    for (const w of words) { const next = cur ? cur + ' ' + w : w;
      if (cur && next.length > max) { out.push(cur); cur = w; }
      else if (cur && out.length < lines - 1 && cur.length >= target - 3 && next.length > target + 3) { out.push(cur); cur = w; }
      else cur = next; }
    if (cur) out.push(cur);
    if (out.length <= lines && out.every(l => l.length <= max)) return out;
  }
  return [text];
}
const VO = TL.voiceover;
// voiceover.srt: one cue per script line (a long line wraps to three rows)
fs.writeFileSync(path.join(OUT, 'voiceover.srt'), VO.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${wrap(c.text).join('\n')}\n`).join('\n'));
// Burned-in captions show at most 2 rows of 42 characters, so a long line is shown in two parts, timed by length.
const CAPS = [];
for (const c of VO) {
  const rows = wrap(c.text), parts = []; for (let i = 0; i < rows.length; i += 2) parts.push(rows.slice(i, i + 2));
  const total = parts.reduce((n, p) => n + p.join(' ').length, 0); let t = c.start;
  for (const p of parts) { const d = (c.end - c.start) * p.join(' ').length / total; CAPS.push({ start: t, end: t + d, rows: p }); t += d; }
}
// Caption images are drawn by Chrome with the game's own Inter font (vendor/fonts), then laid over the video:
// Inter 34 px, white, 2 px black outline, bottom-left (60 px from the left, 70 px from the bottom) so they stay left of the phone.
const CAPH = 190;
if (!CHECK_ONLY) {
  console.log('captions…');
  const html = path.join(TMP, 'caption.html');
  fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="../../../vendor/fonts/fonts.css"><style>
    html,body{margin:0;background:transparent;height:${CAPH}px;overflow:hidden}
    #c{position:absolute;left:60px;bottom:70px;font:600 34px/42px Inter,sans-serif;color:#fff;white-space:pre;-webkit-text-stroke:4px #000;paint-order:stroke fill;text-shadow:0 2px 6px rgba(0,0,0,.6)}
    </style></head><body><div id="c"></div></body></html>`);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let widest = 0;
  try {
    const page = await browser.newPage({ viewport: { width: W, height: CAPH }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(html).href);
    const inter = await page.evaluate(() => document.fonts.load('600 34px Inter').then(f => f.length > 0 && document.fonts.check('600 34px Inter')));
    if (!inter) fail('the Inter font did not load for the captions');
    await page.screenshot({ path: path.join(TMP, 'blank.png'), omitBackground: true });
    for (let i = 0; i < CAPS.length; i++) {
      const w = await page.evaluate(t => { const el = document.getElementById('c'); el.textContent = t; return el.getBoundingClientRect().right; }, CAPS[i].rows.join('\n'));
      widest = Math.max(widest, w);
      await page.screenshot({ path: path.join(TMP, `cap${i}.png`), omitBackground: true });
    }
  } finally { await browser.close(); }
  if (widest > 990) fail(`a caption is ${Math.round(widest)} px wide and would run under the phone (limit 990)`);
  // one caption track: blank and caption stills in order, each held for its time, laid over the bottom strip of the video
  const list = []; let t = 0;
  const hold = (f, d) => { if (d > 0.0005) list.push(`file '${f}'\nduration ${d.toFixed(4)}`); };
  CAPS.forEach((c, i) => { hold('blank.png', c.start - t); hold(`cap${i}.png`, c.end - 0.04 - c.start); t = c.end - 0.04; });
  hold('blank.png', LEN - t + 1); list.push("file 'blank.png'");
  fs.writeFileSync(path.join(TMP, 'caps.txt'), list.join('\n') + '\n');
  ff(['-i', master, '-f', 'concat', '-safe', '0', '-i', path.join(TMP, 'caps.txt'),
    '-filter_complex', `[1:v]fps=${FPS},format=rgba[c];[0:v][c]overlay=x=0:y=${H - CAPH}:eof_action=pass,format=yuv420p[v]`,
    '-map', '[v]', '-map', '0:a', ...ENC, '-c:a', 'copy', '-t', String(LEN), '-movflags', '+faststart', path.join(OUT, 'strata_demo_captions.mp4')], 'captions video');
}

// ---------------------------------------------------------------- 5. teleprompter
const tp = fs.readFileSync(path.join(here, 'teleprompter.html'), 'utf8').replace('/*VOICEOVER*/[]', JSON.stringify(VO)).replace('/*LENGTH*/0', String(LEN));
fs.writeFileSync(path.join(OUT, 'teleprompter.html'), tp);

// ---------------------------------------------------------------- 6. the done-when checklist
console.log('checking…');
const P = probe(master), C = probe(path.join(OUT, 'strata_demo_captions.mp4'));
const ORDER = [1, 2, 4, 12, 10, 3, 9, 11, 7, 8, 14, 13, 6, 5, 15];
const planned = TL.scenes.flatMap(s => s.shots).filter(s => s.overlay === 'solved').sort((a, b) => a.t - b.t);
const shown = Object.values(marks).flatMap(m => m.overlayLog.filter(l => l.type === 'solved')).sort((a, b) => a.t - b.t);
const syncsPlanned = TL.scenes.flatMap(s => s.shots).filter(s => s.overlay === 'sync');
const syncsShown = Object.values(marks).flatMap(m => m.overlayLog.filter(l => l.type === 'sync'));
const checks = Object.values(marks).flatMap(m => m.checks);
function luma(file, t, crop) {
  const r = spawnSync(ffmpegPath, ['-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', `${crop ? crop + ',' : ''}signalstats,metadata=print:file=-`, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /YAVG=([\d.]+)/.exec(r.stdout || ''); return m ? Math.max(0, +m[1] - 16) : NaN;      // video-range luma: 16 is black
}
const lit = luma(master, 47.5), dark = luma(master, 39.8);      // same camera, phone lowered: fair split live vs Directorate split live
const screens = { home: 'phone open', power: 'go power', share: 'bypass', life: 'life', mesh: 'mesh', surface: 'surface', ret: 'sign' };
const report = [
  ['strata_demo.mp4 is 1920 × 1080 at 30 fps', P.width === W && P.height === H && Math.abs(P.fps - FPS) < 0.01, `${P.width}×${P.height} at ${P.fps} fps, ${P.codec}`],
  ['length is between 3:00 and 3:15', P.seconds >= 180 && P.seconds <= 195, `${P.seconds.toFixed(2)} s (${clock(P.seconds)})`],
  ['silent stereo audio track present', P.audio === 'aac', String(P.audio)],
  ['no pause menu, no game error and full 3D resolution in every take', Object.values(marks).every(m => !m.problems.length && m.pixelRatio >= 0.99), Object.values(marks).map(m => `${m.take}: ${m.frames} frames, ${m.problems.length} problems`).join('; ')],
  ['all 15 Solved checks appear once each, in the kit\'s order', shown.length === 15 && shown.every((s, i) => s.n === ORDER[i]), shown.map(s => s.n).join(', ')],
  ['each Solved check lands within 0.3 s of its planned time', shown.length === planned.length && shown.every((s, i) => Math.abs(s.t - planned[i].t) <= 0.3), 'largest gap ' + Math.max(...shown.map((s, i) => Math.abs(s.t - (planned[i] || {}).t))).toFixed(2) + ' s'],
  ['no two Solved checks overlap (at least 3.2 s apart)', shown.every((s, i) => i === 0 || s.t - shown[i - 1].t >= 3.19), 'closest pair ' + Math.min(...shown.slice(1).map((s, i) => s.t - shown[i].t)).toFixed(2) + ' s apart'],
  ['the counter reads 15 / 15 before the finale, and the finale runs', checks.some(c => c.t === 182.9 && c.ok) && Object.values(marks).some(m => m.overlayLog.some(l => l.type === 'finale')), ''],
  ['all 8 App → Game moments show their callout and ring', syncsShown.length === syncsPlanned.length && syncsShown.every(s => s.ring && isFinite(s.ring.x)), `${syncsShown.length} callouts, rings at ` + syncsShown.map(s => s.ring ? `${Math.round(s.ring.x)},${Math.round(s.ring.y)}` : 'none').join(' · ')],
  ['every story and number check passed while recording', checks.every(c => c.ok), `${checks.filter(c => c.ok).length} of ${checks.length}`],
  ['the Deep goes dark in the take B insert (brightness more than halves)', dark < lit / 2, `whole frame, above black: lit ${lit.toFixed(1)} → dark ${dark.toFixed(1)} (${Math.round(100 * (1 - dark / lit))}% darker)`],
  ['voiceover.srt has one cue per script line', fs.readFileSync(path.join(OUT, 'voiceover.srt'), 'utf8').trim().split(/\n\n+/).length === VO.length, `${VO.length} cues (the kit has 32; one was added for the Strata Assistant)`],
  ['captions video matches the master', C.width === W && Math.abs(C.seconds - P.seconds) < 0.1, `${C.seconds.toFixed(2)} s`],
  ['teleprompter.html written', fs.existsSync(path.join(OUT, 'teleprompter.html')), ''],
];
void screens;
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ built: new Date().toISOString(), length: P.seconds, checks: report.map(([what, ok, detail]) => ({ what, ok: !!ok, detail })) }, null, 1));
// keep the measured ring positions in timeline.json, as the kit asks ("ring": { x, y } per shot)
{ let changed = false; for (const sc of TL.scenes) for (const s of sc.shots) if (s.overlay === 'sync') { const r = marks[s.take || sc.take].rings[String(s.t)]; if (r && (!s.ring || s.ring.x !== r.x || s.ring.y !== r.y)) { s.ring = { x: r.x, y: r.y }; changed = true; } }
  if (changed) { let txt = fs.readFileSync(path.join(here, 'timeline.json'), 'utf8');
    for (const sc of TL.scenes) for (const s of sc.shots) if (s.overlay === 'sync' && s.ring) { const key = `"t": ${s.t}, `; const line = txt.split('\n').find(l => l.includes(key) && l.includes('"sync"')) || txt.split('\n').find(l => l.includes(`"t": ${s.t.toFixed(1)}, `) && l.includes('"sync"'));
      if (line) { const cleaned = line.replace(/, "ring": \{[^}]*\}/, ''); txt = txt.replace(line, cleaned.replace(/ \}(,?)\s*$/, `, "ring": { "x": ${s.ring.x}, "y": ${s.ring.y} } }$1`)); } }
    JSON.parse(txt); fs.writeFileSync(path.join(here, 'timeline.json'), txt); } }
fs.rmSync(TMP, { recursive: true, force: true });
let bad = 0;
for (const [what, ok, detail] of report) { if (!ok) bad++; console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}${detail ? '  [' + detail + ']' : ''}`); }
console.log(`\n${master}\nlength ${clock(P.seconds)} (${P.seconds.toFixed(2)} s)`);
if (bad) fail(`${bad} checklist item(s) failed`);
