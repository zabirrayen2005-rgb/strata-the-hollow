// Records the takes of the demo video from the real game.
//   node video/record.mjs            record every take (A, B, C)
//   node video/record.mjs A C        record only these takes
// Everything it does is read from video/timeline.json. It never edits the game: driver.js and overlay.js are injected at run time.
//
// Capture is frame-stepped. The recorder owns the page clock (Playwright's clock API), advances it 1/30 s, lets the game
// render, saves that frame, and repeats. The game, the phone and the overlays all read that same clock, so the result is an
// exact 30 fps at full High quality on any computer, and every action lands on its planned frame.
// (Real-time DevTools screencast managed 26-31 fps on the build laptop, and below 34 fps the game lowers its own 3D resolution.)
//
// Output: video/out/takes/<take>.mp4 and <take>.marks.json (when each action ran, every check, ring positions).
import { chromium } from 'playwright-core';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const TL = JSON.parse(fs.readFileSync(path.join(here, 'timeline.json'), 'utf8'));
const OUT = path.join(here, 'out'), TAKES = path.join(OUT, 'takes');
const URL = 'http://localhost:5180/?video=1';
const FPS = TL.fps, [W, H] = TL.size;
const PRE = 0.5, POST = 0.5;                                  // handles recorded before and after each take
const STEP = [33, 33, 34];                                    // ms per frame: 100 ms every 3 frames = exactly 30 fps
const PRESS = 3;                                              // frames a button is held down, so its pressed state shows
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(TAKES, { recursive: true });

// every shot of a take, in time order (a shot may name its own take, e.g. the take B insert inside scene 2)
function shotsOf(take) {
  const list = [];
  for (const sc of TL.scenes) for (const s of sc.shots) if ((s.take || sc.take) === take) list.push({ ...s, scene: sc.id });
  return list.sort((a, b) => a.t - b.t);
}
async function ensureServer() {
  try { await fetch('http://localhost:5180/'); return null; } catch {}
  const srv = spawn(process.execPath, ['serve.js'], { cwd: path.join(here, '..'), stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { await sleep(150); try { await fetch('http://localhost:5180/'); return srv; } catch {} }
  throw new Error('The game server did not start on port 5180');
}
// The game reseeds its 500-run forecast from the wall-clock minute. Starting the page clock inside the right minute pins the
// seed, so every take shows the same forecast numbers (timeline.json "seed").
function clockStart(seed) {
  const want = (((seed - 2087) % 1000) + 1000) % 1000, minute = Math.floor(Date.now() / 60000);
  return new Date((Math.floor(minute / 1000) * 1000 + want) * 60000 + 2000);
}
const describe = s => s.overlay ? `overlay ${s.overlay}${s.n ? ' #' + s.n : ''}` : s.check ? 'check' : s.expect ? `expect "${s.expect}"` : `${s.do}${s.sel ? ' ' + s.sel : s.scr ? ' ' + s.scr : s.state ? ' ' + s.state : ''}`;

async function recordTake(name) {
  const take = TL.takes[name]; if (!take) throw new Error('No take ' + name);
  const shots = shotsOf(name);
  console.log(`\n=== take ${name}: ${take.from}s to ${take.to}s, ${shots.length} shots`);
  const marks = { take: name, from: take.from, to: take.to, pre: PRE, actions: [], checks: [], rings: {}, problems: [] };
  const mp4 = path.join(TAKES, name + '.mp4');
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: [
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--autoplay-policy=no-user-gesture-required', `--window-size=${W},${H}`, '--window-position=0,0', '--hide-scrollbars', '--mute-audio'] });
  const enc = spawn(ffmpegPath, ['-y', '-v', 'error', '-f', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-vf', `scale=${W}:${H}:in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p`,
    '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', '-r', String(FPS),
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', mp4], { stdio: ['pipe', 'ignore', 'pipe'] });
  let encErr = ''; enc.stderr.on('data', d => encErr += d);
  const encDone = new Promise(r => enc.on('close', r));
  const started = Date.now();
  try {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });   // a new context is a clean profile
    const page = await ctx.newPage();
    await page.clock.install({ time: clockStart(TL.seed) });
    await page.addInitScript({ path: path.join(here, 'driver.js') });
    await page.addInitScript({ path: path.join(here, 'overlay.js') });
    page.on('pageerror', e => marks.problems.push('page error: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) marks.problems.push('console error: ' + m.text()); });
    await page.goto(URL);
    await page.waitForFunction(() => window.__strata && document.getElementById('menu').style.display === 'flex', null, { timeout: 90000 });
    await page.addStyleTag({ content: '* { cursor: none !important; }' });
    await page.click('[data-q="high"]');
    await page.evaluate(() => document.fonts.ready.then(() => true));
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const cdp = await ctx.newCDPSession(page);

    // ---- from here the recorder owns the clock
    await page.clock.pauseAt(await ev(() => Date.now()) + 200);
    let frame = 0;                                              // frames stepped since the game started
    const later = [];                                           // [frame, fn] continuations (button release, next keystroke)
    let t0 = Infinity;                                          // frame at which video time take.from falls
    const videoTime = () => take.from + (frame - t0) / FPS;
    async function step(capture) {
      for (let i = later.length - 1; i >= 0; i--) if (later[i][0] <= frame) { const fn = later.splice(i, 1)[0][1]; await fn(); }
      await page.clock.runFor(STEP[frame % 3]);
      await ev(ms => window.__vid.stepAnims(ms), STEP[frame % 3]);
      if (capture) { const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95, optimizeForSpeed: true });
        if (!enc.stdin.write(Buffer.from(r.data, 'base64'))) await new Promise(res => enc.stdin.once('drain', res));
        marks.frames = (marks.frames || 0) + 1; }
      frame++;
    }
    const steps = async (seconds, capture) => { for (let n = Math.round(seconds * FPS); n > 0; n--) await step(capture); };
    const act = makeActions(page, ev, marks, { later, frameNow: () => frame, videoTime });

    // ---- start the game for this take
    const go = await ev(() => { const r = document.getElementById('go').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.mouse.click(go[0], go[1]);          // a clean profile has no save, so "Click to enter" starts a new game (the New game button is hidden)
    await ev(() => window.__vid.watchdog());
    if (take.start === 'new') {
      for (const s of take.setup || []) await act(s);
      t0 = Math.round(0.6 * FPS);                   // video time 0 sits inside the game's own fade from black
      await steps(0.6 - PRE, false);
    } else {
      await ev(async o => { await window.__strata.jump(o.jump, { life: !!o.life }); window.__strata.start(); }, take.start);
      if (take.preset) await ev(list => window.overlay.preset(list), take.preset);
      await steps(4.6, false);                      // let the level banner clear
      for (const s of take.setup || []) { if (s.do === 'wait') await steps(s.s, false); else { await act(s); await steps(0.1, false); } }
      await steps(0.7, false);
      t0 = frame + Math.round(PRE * FPS);
      const pl = (take.setup || []).find(s => s.do === 'played');         // carry the run's play time over from the take before, so the ending's TIME stat is the whole run
      if (pl) await ev(v => { window.__strata.story().model.S.played = v; }, pl.at + 0.6 - PRE);
      const cd = (take.setup || []).find(s => s.do === 'countdown');   // match the brownout of the take this one is cut into
      if (cd) await ev(left => { const M = window.__strata.story().model; M.cd = M.cd0 - left; }, cd.at + 0.6 - PRE);
    }

    // ---- run the shots, one frame at a time
    const endFrame = t0 + Math.round((take.to - take.from + POST) * FPS);
    let i = 0;
    while (frame < endFrame) {
      while (i < shots.length && shots[i].t <= videoTime() + 1e-6) {
        const s = shots[i++]; let result, error = null;
        try { result = await act(s); } catch (e) { error = String(e.message || e).split('\n')[0]; }
        const m = { scene: s.scene, t: s.t, at: +videoTime().toFixed(3), late: +(videoTime() - s.t).toFixed(3), what: describe(s) };
        if (error) { m.error = error; marks.problems.push(`${s.t}s ${m.what}: ${error}`); }
        if (s.check || s.expect) { m.ok = result === true; if (s.why) m.why = s.why; marks.checks.push(m); if (!m.ok) marks.problems.push(`${s.t}s check failed: ${s.why || s.check || s.expect}`); }
        else { if (result && typeof result === 'object' && 'x' in result) { m.ring = result; marks.rings[s.t] = result; } marks.actions.push(m); }
      }
      await step(true);
      if (frame % 300 === 0) process.stdout.write(`  ${videoTime().toFixed(0)}s `);
    }
    const state = await ev(() => ({ menuHits: window.__vid.menuHits, menu: window.__vid.menuVisible(), log: window.overlay.log, now: performance.now(), pr: window.__strata.renderer.getPixelRatio() }));
    if (state.menuHits || state.menu) marks.problems.push('the pause menu appeared during the take');
    if (state.pr < 0.99) marks.problems.push('the game lowered its 3D resolution to ' + state.pr.toFixed(2));
    marks.overlayLog = state.log.map(l => { const { at, ...rest } = l; return { ...rest, t: +(videoTime() - (state.now - at) / 1000).toFixed(2) }; });
    marks.pixelRatio = +state.pr.toFixed(2);
  } finally { await browser.close(); enc.stdin.end(); await encDone; }
  if (encErr.trim()) marks.problems.push('ffmpeg: ' + encErr.trim().split('\n').pop());
  marks.fps = FPS; marks.file = path.relative(here, mp4).replace(/\\/g, '/'); marks.recorded = new Date().toISOString(); marks.tookSeconds = Math.round((Date.now() - started) / 1000);
  fs.writeFileSync(path.join(TAKES, name + '.marks.json'), JSON.stringify(marks, null, 1));
  const worst = marks.actions.concat(marks.checks).reduce((a, m) => Math.max(a, Math.abs(m.late)), 0);
  console.log(`\ntake ${name}: ${marks.frames} frames at ${FPS} fps, worst timing ${worst.toFixed(3)}s, checks ${marks.checks.filter(c => c.ok).length}/${marks.checks.length}, ${marks.tookSeconds}s to record`);
  for (const p of marks.problems) console.log('  PROBLEM  ' + p);
  return marks;
}

// one function per kind of shot in timeline.json
function makeActions(page, ev, marks, R) {
  // a real mouse press at the button's centre, held for a few frames so the pressed state is on screen
  async function press(sel, hold) {
    const h = await ev(s => window.__vid.hit(s), sel);
    if (!h.ok) throw new Error(`cannot click ${sel}: ${h.why}`);
    await page.mouse.move(h.x, h.y); await page.mouse.down();
    if (hold) R.later.push([R.frameNow() + hold, () => page.mouse.up()]); else await page.mouse.up();
  }
  return async function act(s) {
    if (s.overlay === 'solved') return ev(o => window.overlay.solved(o.n, o.name, o.by), s);
    if (s.overlay === 'scene') return ev(o => window.overlay.scene(o.act, o.promise), s);
    if (s.overlay === 'sync') return ev(o => window.__vid.sync(o.app, o.game, o, o.dur), s);
    if (s.overlay === 'finale') return ev(() => { window.overlay.finale(); });
    if (s.check) return ev(src => { const M = window.__strata.story().model, overlay = window.overlay; try { return !!eval(src); } catch (e) { return false; } }, s.check);   // eslint-disable-line no-eval
    if (s.expect) return ev(text => { const el = document.querySelector('#sp .scr'); const norm = t => t.replace(/\s+/g, ' ').toLowerCase(); return !!el && norm(el.textContent).includes(norm(text)); }, s.expect);
    switch (s.do) {
      case 'wait': case 'countdown': case 'played': return;          // handled by the take set-up
      case 'teleport': return ev(o => { const V = window.__vid; V.teleport(o.to[0], o.to[1], o.yaw, o.pitch); if (o.aim) V.aim(o.aim, o.screen); }, s);
      case 'pose': return ev(o => { const P = window.__strata.P; if (o.yaw != null) P.yaw = o.yaw; if (o.pitch != null) P.pitch = o.pitch; }, s);
      case 'look': return ev(o => { const V = window.__vid; const q = { ...o }; if (o.aimOn === 'site') { const st = V.site(); q.aim = [st[0], st[1], o.h || 1]; } void V.look(q, o.dur); }, s);
      case 'walk': return ev(o => { const V = window.__vid, P = window.__strata.P; let to = o.to;
        if (to === 'site') { const st = V.site(), d = Math.hypot(st[0] - P.x, st[1] - P.y), k = Math.max(0, (d - (o.stop || 1.8)) / d); to = [P.x + (st[0] - P.x) * k, P.y + (st[1] - P.y) * k]; }
        void V.walk(to[0], to[1], o.dur); }, s);
      case 'follow': return ev(o => window.__vid.followObject(o.object, o.on), s);
      case 'phone': return ev(o => { const SP = window.StrataPhone; if (o.go) SP.go(o.go); if (o.state === 'open') SP.open(); else SP.close(); }, s);
      case 'go': return ev(scr => window.StrataPhone.go(scr), s.scr);
      case 'scroll': return ev(o => { const V = window.__vid, b = V.body(); if (!b) return;
        if (o.text) void V.scrollToText(o.text, o.dur, o.offset); else if (o.sel) void V.scrollTo('' + o.sel, o.dur, o.offset);
        else void V.scrollTo(o.to === 'bottom' ? 1e6 : o.to === 'top' ? 0 : o.to, o.dur); }, s);
      case 'click': return press(s.sel, PRESS);
      case 'type': { await press(s.sel, 0); const gap = FPS / (s.cps || 12), f0 = R.frameNow() + 2;       // real keystrokes, spaced on the frame clock
        [...s.text].forEach((ch, k) => R.later.push([f0 + Math.round(k * gap), () => page.keyboard.type(ch)])); return; }
      case 'key': return page.keyboard.press(s.key);
      case 'travel': return ev(to => { void window.__strata.travel(to); }, s.to);
      case 'interact': return ev(() => window.__strata.story().interact());
      // hold back one of the game's own HUD elements for a few seconds (timeline.json says which and why)
      case 'hud': return ev(o => { const el = document.getElementById(o.hide); if (!el) return; el.style.visibility = 'hidden'; setTimeout(() => { el.style.visibility = ''; }, o.for * 1000); }, s);
      // The Directorate cuts the network 14 s after the power fix unless the Life screen is open (the game holds it up to 40 s).
      // The shot list lowers the phone while Life is still being shown, so the recorder re-times that one story timer:
      //   mode "hold"  restarts the 14 s wait;   fireAt: T  makes the 40 s Life hold run out at video time T.
      case 'netcut': return ev(o => { const S = window.__strata.story().model.S; S.flags.powerAt = o.mode === 'hold' ? S.played : S.played - (40 - (o.fireAt - o.now)); }, { ...s, now: R.videoTime() });
      default: throw new Error('Unknown shot: ' + JSON.stringify(s));
    }
  };
}

const want = process.argv.slice(2).filter(a => !a.startsWith('-'));
const names = want.length ? want : Object.keys(TL.takes);
const srv = await ensureServer();
let bad = 0;
try { for (const n of names) { const m = await recordTake(n); if (m.problems.length) bad++; } }
finally { if (srv) srv.kill(); }
if (bad) { console.error(`\n${bad} take(s) have problems: see video/out/takes/*.marks.json`); process.exit(1); }
console.log('\nAll takes recorded cleanly.');
