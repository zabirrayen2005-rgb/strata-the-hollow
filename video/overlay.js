// Injected by video/record.mjs with page.addInitScript (never loaded by the game itself).
// The four overlay pieces from the build kit, drawn over the live game so they are captured with the footage:
//   overlay.solved(n, name, feature)   top-right Solved check + its dot on the counter
//   overlay.scene(act, promise)        top-left scene title
//   overlay.sync(appText, gameText, ring)   App -> Game callout + pulsing ring at ring = { x, y }
//   overlay.finale()                   closing list of all 15 checks
//   overlay.preset([n, ...])           fill counter dots earned in an earlier take (no animation)
// Fonts are the game's own (vendor/fonts: Rajdhani, Inter, JetBrains Mono).
(function () {
  'use strict';
  const COL = { 1: '#ffb020', 2: '#3ddc97', 3: '#9fe7ff', 4: '#4fc3f7', 5: '#ffd27a', 6: '#ffd27a', 7: '#5fd0ff', 8: '#5fd0ff',
    9: '#ffd36b', 10: '#ff8fb1', 11: '#ffd36b', 12: '#3ddc97', 13: '#c27bff', 14: '#c27bff', 15: '#ffb020' };
  const NAME = { 1: 'Blackouts', 2: 'Rationing', 3: 'Cooling', 4: 'Water', 5: 'Tunnels', 6: 'Space', 7: 'Network cut', 8: 'Split families',
    9: 'Lung disease', 10: 'Medicine', 11: 'Sunlight', 12: 'Food', 13: 'Is the surface safe?', 14: 'Who goes first', 15: 'The way up' };
  const GREEN = '#3ddc97';
  const CSS = `
  #vo{position:fixed;inset:0;pointer-events:none;z-index:9999;font-family:Inter,system-ui,sans-serif;color:#fff;overflow:hidden}
  #vo *{box-sizing:border-box}
  #vo .solved{position:absolute;top:40px;right:40px;width:380px;height:96px;border-radius:12px;background:rgba(8,11,17,.88);border:1px solid var(--c);
    border-left:6px solid var(--c);display:flex;align-items:center;gap:14px;padding:0 14px 0 14px;transform:translateX(460px);opacity:0;
    transition:transform .3s cubic-bezier(.2,.8,.2,1),opacity .3s ease;transform-origin:var(--ox,50%) var(--oy,150%);box-shadow:0 10px 30px rgba(0,0,0,.45)}
  #vo .solved.in{transform:none;opacity:1}
  #vo .solved.out{transition:transform .25s ease-in,opacity .25s ease-in;transform:translate(var(--dx,0),var(--dy,60px)) scale(.04);opacity:0}
  #vo .solved .ck{flex:0 0 48px;width:48px;height:48px;border-radius:50%;background:${GREEN};display:grid;place-items:center;box-shadow:0 0 18px rgba(61,220,151,.55)}
  #vo .solved .ck path{stroke:#fff;stroke-width:4.5;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:30;stroke-dashoffset:30}
  #vo .solved.in .ck path{transition:stroke-dashoffset .4s ease .25s;stroke-dashoffset:0}
  #vo .solved .tx{min-width:0;flex:1;display:flex;flex-direction:column;justify-content:center}
  #vo .solved .l1{font:500 15px/17px 'JetBrains Mono',monospace;color:var(--c);letter-spacing:.04em;white-space:nowrap;text-transform:uppercase}
  #vo .solved .l2{font:700 36px/34px Rajdhani,sans-serif;letter-spacing:.06em;color:#fff}
  #vo .solved .l3{font:400 16px/19px Inter,sans-serif;color:#c8d4e6;white-space:nowrap}
  #vo .count{position:absolute;top:144px;right:30px;width:284px;padding:7px 10px 9px;border-radius:10px;background:rgba(8,11,17,.62);opacity:0;transition:opacity .4s ease}
  #vo .count.on{opacity:1}
  #vo .count .lb{font:500 13px/16px 'JetBrains Mono',monospace;letter-spacing:.1em;color:#c8d4e6;text-align:right;margin-bottom:7px;text-shadow:0 1px 6px #000}
  #vo .count .dots{display:flex;gap:6px}
  #vo .count i{display:block;width:12px;height:12px;border-radius:50%;background:rgba(8,11,17,.7);border:1px solid rgba(200,212,230,.45);transition:background .25s,border-color .25s,box-shadow .25s,transform .25s}
  #vo .count i.on{background:var(--c);border-color:var(--c);box-shadow:0 0 8px var(--c)}
  #vo .count i.pop{transform:scale(1.7)}
  #vo .scene{position:absolute;left:48px;top:150px;opacity:0;transform:translateX(-18px);transition:opacity .35s ease,transform .35s ease}
  #vo .scene.in{opacity:1;transform:none}
  #vo .scene .a{font:500 14px/18px 'JetBrains Mono',monospace;letter-spacing:.16em;color:#ffb020;text-transform:uppercase;text-shadow:0 1px 8px #000}
  #vo .scene .p{font:700 34px/38px Rajdhani,sans-serif;letter-spacing:.03em;color:#fff;margin-top:4px;text-shadow:0 2px 14px rgba(0,0,0,.95),0 0 3px #000}
  #vo .scene .bar{width:54px;height:3px;background:#ffb020;margin-top:10px;border-radius:2px}
  #vo .sync{position:absolute;left:500px;bottom:160px;transform:translate(-50%,14px);opacity:0;transition:opacity .3s ease,transform .3s ease;
    display:flex;align-items:center;gap:14px;padding:12px 20px;border-radius:999px;background:rgba(8,11,17,.9);border:1px solid rgba(95,208,255,.55);
    box-shadow:0 10px 30px rgba(0,0,0,.5);white-space:nowrap}
  #vo .sync.in{opacity:1;transform:translate(-50%,0)}
  #vo .sync .side{display:flex;align-items:center;gap:10px}
  #vo .sync .k{font:500 11px/13px 'JetBrains Mono',monospace;letter-spacing:.18em;color:#5fd0ff}
  #vo .sync .g .k{color:${GREEN}}
  #vo .sync .v{font:600 17px/20px Inter,sans-serif;color:#fff}
  #vo .sync svg{flex:0 0 auto}
  #vo .ring{position:absolute;width:90px;height:90px;margin:-45px 0 0 -45px;border-radius:50%;border:2px solid #5fd0ff;opacity:0;box-shadow:0 0 14px rgba(95,208,255,.6),inset 0 0 14px rgba(95,208,255,.25)}
  #vo .ring.go{animation:voRing 1s ease-out 3}
  @keyframes voRing{0%{transform:scale(.45);opacity:0}18%{opacity:1}100%{transform:scale(1.35);opacity:0}}
  #vo .fin{position:absolute;top:36px;right:40px;width:460px}
  #vo .fin .h{font:700 30px/32px Rajdhani,sans-serif;letter-spacing:.06em;color:#fff;text-align:right;white-space:nowrap;margin-bottom:6px;text-shadow:0 2px 12px #000;opacity:0;transition:opacity .4s}
  #vo .fin .h b{color:${GREEN}}
  #vo .fin .h.in{opacity:1}
  #vo .fin .r{display:flex;align-items:center;justify-content:flex-end;gap:12px;height:56px;opacity:0;transform:translateX(30px);transition:opacity .3s ease,transform .3s ease}
  #vo .fin .r.in{opacity:1;transform:none}
  #vo .fin .r .n{font:500 12px/14px 'JetBrains Mono',monospace;color:var(--c);letter-spacing:.08em;text-align:right}
  #vo .fin .r .t{font:600 19px/22px Rajdhani,sans-serif;letter-spacing:.04em;color:#fff;text-align:right;text-shadow:0 1px 8px #000}
  #vo .fin .r .c{flex:0 0 26px;width:26px;height:26px;border-radius:50%;background:${GREEN};display:grid;place-items:center;box-shadow:0 0 10px rgba(61,220,151,.5)}
  `;
  const CHECK = s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M5.5 12.5l4.2 4.2L18.5 7.8"/></svg>`;
  const PHONE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5fd0ff" stroke-width="1.8" stroke-linecap="round"><rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M11 18.5h2"/></svg>';
  const CUBE = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${GREEN}" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.8l8 4.4v9.6l-8 4.4-8-4.4V7.2z"/><path d="M4 7.2l8 4.4 8-4.4M12 11.6v9.6"/></svg>`;
  const ARROW = '<svg width="34" height="14" viewBox="0 0 34 14" fill="none" stroke="#c8d4e6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 7h30M26 2l5 5-5 5"/></svg>';

  let root, countEl, done = [], queue = [], busy = false, lastStart = -1e9, finaleOn = false;
  const log = [];                                   // what was shown and when (performance.now ms), read back by the recorder
  const mark = (type, extra) => log.push(Object.assign({ type, at: performance.now() }, extra || {}));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function ensure() {
    if (root) return root;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = document.createElement('div'); root.id = 'vo'; document.body.appendChild(root);
    countEl = document.createElement('div'); countEl.className = 'count';
    countEl.innerHTML = '<div class="lb">0 / 15 SOLVED</div><div class="dots">' + Array.from({ length: 15 }, () => '<i></i>').join('') + '</div>';
    root.appendChild(countEl);
    return root;
  }
  function fill(n, pop) {
    if (!done.includes(n)) done.push(n);
    const dots = countEl.querySelectorAll('i'), d = dots[done.indexOf(n)];
    d.style.setProperty('--c', COL[n]); d.classList.add('on');
    if (pop) { d.classList.add('pop'); setTimeout(() => d.classList.remove('pop'), 260); }
    countEl.querySelector('.lb').textContent = done.length + ' / 15 SOLVED';
    countEl.classList.add('on');
    return d;
  }
  function fit(el, min) { let s = parseFloat(getComputedStyle(el).fontSize); while (el.scrollWidth > el.clientWidth && s > min) { s -= .5; el.style.fontSize = s + 'px'; } }
  async function showSolved(n, name, feature) {
    ensure();
    const el = document.createElement('div'); el.className = 'solved'; el.style.setProperty('--c', COL[n]);
    el.innerHTML = `<div class="ck">${CHECK(30)}</div><div class="tx"><div class="l1">PROBLEM #${n} · ${name}</div><div class="l2">SOLVED</div><div class="l3">by ${feature}</div></div>`;
    root.appendChild(el);
    fit(el.querySelector('.l3'), 11); fit(el.querySelector('.l1'), 11);
    void el.offsetWidth; el.classList.add('in'); mark('solved', { n });
    countEl.classList.add('on');
    await wait(300 + 2600);
    // shrink into the dot this check will fill
    const idx = done.includes(n) ? done.indexOf(n) : done.length, dot = countEl.querySelectorAll('i')[idx];
    const a = el.getBoundingClientRect(), b = dot.getBoundingClientRect();
    el.style.setProperty('--dx', (b.left + b.width / 2 - (a.left + a.width / 2)) + 'px');
    el.style.setProperty('--dy', (b.top + b.height / 2 - (a.top + a.height / 2)) + 'px');
    el.style.transformOrigin = '50% 50%'; el.classList.add('out');
    await wait(230); fill(n, true); mark('dot', { n });
    await wait(60); el.remove();
  }
  async function pump() {
    if (busy) return; busy = true;
    while (queue.length) {
      const gap = 3200 - (performance.now() - lastStart); if (gap > 0) await wait(gap);     // never two at once
      const q = queue.shift(); lastStart = performance.now();
      await showSolved(q.n, q.name, q.feature);
    }
    busy = false;
  }
  const O = {
    log, colours: COL, names: NAME,
    solved(n, name, feature) { ensure(); queue.push({ n, name: name || NAME[n], feature }); pump(); },
    preset(list) { ensure(); for (const n of list) fill(n, false); },
    scene(act, promise, ms) {
      ensure(); const el = document.createElement('div'); el.className = 'scene';
      el.innerHTML = `<div class="a">${act}</div><div class="p">${promise}</div><div class="bar"></div>`;
      root.appendChild(el); void el.offsetWidth; el.classList.add('in'); mark('scene', { act });
      setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, ms || 2500);
    },
    sync(appText, gameText, ring, ms) {
      ensure(); const el = document.createElement('div'); el.className = 'sync';
      el.innerHTML = `<div class="side a">${PHONE}<div><div class="k">APP</div><div class="v">${appText}</div></div></div>${ARROW}<div class="side g">${CUBE}<div><div class="k">GAME</div><div class="v">${gameText}</div></div></div>`;
      root.appendChild(el); void el.offsetWidth; el.classList.add('in'); mark('sync', { app: appText, ring });
      let r = null;
      if (ring && isFinite(ring.x) && isFinite(ring.y)) { r = document.createElement('div'); r.className = 'ring'; r.style.left = ring.x + 'px'; r.style.top = ring.y + 'px'; root.appendChild(r); void r.offsetWidth; r.classList.add('go');
        if (typeof ring.track === 'function') { const ringEl = r, upd = () => { if (!ringEl.isConnected) return; const q = ring.track();      // keep the ring on its object while the camera moves
          if (q && q.front !== false && isFinite(q.x) && isFinite(q.y)) { ringEl.style.left = q.x + 'px'; ringEl.style.top = q.y + 'px'; ringEl.style.visibility = 'visible'; } else ringEl.style.visibility = 'hidden';
          requestAnimationFrame(upd); }; requestAnimationFrame(upd); } }
      setTimeout(() => { el.classList.remove('in'); setTimeout(() => { el.remove(); if (r) r.remove(); }, 350); }, ms || 3500);
    },
    async finale() {
      ensure(); finaleOn = true; mark('finale');
      countEl.classList.remove('on');
      const box = document.createElement('div'); box.className = 'fin';
      box.innerHTML = `<div class="h"><b>${done.length} / 15</b> PROBLEMS SOLVED</div>` +
        Array.from({ length: 15 }, (_, i) => i + 1).map(n => `<div class="r" data-n="${n}" style="--c:${COL[n]}"><div><div class="n">#${n}</div><div class="t">${NAME[n]}</div></div><div class="c">${CHECK(16).replace('<path', '<path stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"')}</div></div>`).join('');
      root.appendChild(box); void box.offsetWidth; box.querySelector('.h').classList.add('in');
      const rows = [...box.querySelectorAll('.r')];
      for (const r of rows) { if (!done.includes(+r.dataset.n)) r.querySelector('.c').style.background = 'rgba(200,212,230,.25)'; r.classList.add('in'); await wait(100); }
    },
    state() { return { done: done.slice(), queued: queue.length, busy, finale: finaleOn }; },
  };
  window.overlay = O;
})();
