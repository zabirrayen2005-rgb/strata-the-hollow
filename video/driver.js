// Injected by video/record.mjs (never loaded by the game itself).
// Camera, movement and phone-scroll helpers for filming, built only on the game's own hooks:
// window.__strata (P, scene, camera, story()), window.StrataPhone and the phone's DOM.
(function () {
  'use strict';
  // Automated browsers can't hold pointer lock; a lost lock would drop the game to its pause menu.
  Element.prototype.requestPointerLock = function () { return Promise.resolve(); };

  const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
  const jobs = new Set();
  let follow = null, walking = 0;
  function tween(dur, step) {
    return new Promise(res => {
      const t0 = performance.now(), job = { step, t0, dur: Math.max(1, dur * 1000), res };
      jobs.add(job);
    });
  }
  function tick() {
    requestAnimationFrame(tick);
    const G = window.__strata; if (!G) return;
    const now = performance.now();
    for (const j of [...jobs]) { const k = Math.min(1, (now - j.t0) / j.dur); j.step(k); if (k >= 1) { jobs.delete(j); j.res(); } }
    if (follow) follow();
    if (walking > 0) G.P.speed = walking;   // keeps the game's own head-bob and footsteps running while Mara is moved
  }
  requestAnimationFrame(tick);
  const P = () => window.__strata.P;
  const yawTo = (tx, ty) => Math.atan2(-(tx - P().x), ty - P().y);
  const near = (a, b) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a));      // b, unwrapped to the turn nearest a

  const V = {
    pose() { const p = P(); return { x: +p.x.toFixed(3), y: +p.y.toFixed(3), yaw: +p.yaw.toFixed(4), pitch: +p.pitch.toFixed(4), level: window.__strata.level, state: window.__strata.state }; },
    teleport(x, y, yaw, pitch) { const p = P(); p.x = x; p.y = y; if (yaw != null) p.yaw = yaw; if (pitch != null) p.pitch = pitch; p.speed = 0; },
    face(tx, ty, pitch) { const p = P(); p.yaw = yawTo(tx, ty); if (pitch != null) p.pitch = pitch; },
    // walk in a straight line; speed follows the eased tween so starts and stops are soft
    walk(x, y, dur) {
      const p = P(), x0 = p.x, y0 = p.y, len = Math.hypot(x - x0, y - y0); let last = 0;
      return tween(dur, k => { const e = ease(k); p.x = x0 + (x - x0) * e; p.y = y0 + (y - y0) * e; walking = k < 1 ? Math.max(.5, len / dur * (6 * k * (1 - k))) : 0; last = e; });
    },
    // yaw/pitch that put the point p = [x, y, h] (game units) at the frame pixel s = [sx, sy]
    aimAngles(pt, s) {
      const p = P(), G = window.__strata, c = G.camera, tanV = Math.tan(c.fov * Math.PI / 360), tanH = tanV * c.aspect;
      const nx = (s[0] - innerWidth / 2) / (innerWidth / 2), ny = (innerHeight / 2 - s[1]) / (innerHeight / 2);
      const d = Math.hypot(pt[0] - p.x, pt[1] - p.y), elev = Math.atan2(pt[2] - p.eye, d);
      return { yaw: yawTo(pt[0], pt[1]) + Math.atan(nx * tanH), pitch: Math.max(-1.3, Math.min(1.3, elev - Math.atan(ny * tanV))) };
    },
    aim(pt, s) { const a = V.aimAngles(pt, s), p = P(); p.yaw = a.yaw; p.pitch = a.pitch; },
    // pan to a yaw/pitch, to face a floor point, or to frame a point at a pixel (re-aimed every frame, so it works while walking)
    look(o, dur) {
      const p = P(), y0 = p.yaw, p0 = p.pitch;
      return tween(dur, k => {
        const e = ease(k); let ty = y0, tp = o.pitch != null ? o.pitch : null;
        if (o.aim) { const a = V.aimAngles(o.aim, o.screen || [innerWidth / 2, innerHeight / 2]); ty = near(y0, a.yaw); tp = a.pitch; }
        else if (o.at) ty = near(y0, yawTo(o.at[0], o.at[1]));
        else if (o.yaw != null) ty = near(y0, o.yaw);
        p.yaw = y0 + (ty - y0) * e; if (tp != null) p.pitch = p0 + (tp - p0) * e;
      });
    },
    // where the story layer put things (read-only)
    site() { const s = window.__strata.story().model.site; return s ? [s.x, s.y] : null; },
    // the mapped hotspot ring that is best placed in frame (left of the phone), as a frame pixel
    hotspotOnScreen() {
      const G = window.__strata, M = G.story().model, hot = G.G.S.hotspots; let best = null;
      for (const i of M.S.mapped) { const h = hot[i], d = Math.hypot(h[0] - G.P.x, h[1] - G.P.y), r = h[2] * 2.2, k = Math.max(0, (d - r) / d);
        const q = V.project(G.P.x + (h[0] - G.P.x) * k, G.P.y + (h[1] - G.P.y) * k, .06, 'S');     // nearest point of the ring
        if (!q.front || q.x < 60 || q.x > 1150 || q.y < 120 || q.y > 1000) continue;
        if (!best || d < best.d) best = { x: q.x, y: q.y, d, i }; }
      return best;
    },
    // keep the camera on a named scene object (the drone) with a soft lag
    followObject(name, on) {
      if (!on) { follow = null; return; }
      const obj = V.find(name); if (!obj) return;
      follow = () => {
        const p = P(), c = window.__strata.camera, w = new THREE.Vector3(); obj.getWorldPosition(w);
        const dx = w.x - c.position.x, dz = w.z - c.position.z, dy = w.y - c.position.y;
        const yaw = near(p.yaw, Math.atan2(-dx, -dz)), pitch = Math.max(-.2, Math.min(.75, Math.atan2(dy, Math.hypot(dx, dz)) * .8));
        p.yaw += (yaw - p.yaw) * .05; p.pitch += (pitch - p.pitch) * .05;
      };
    },
    find(name) {
      let hit = null; const sc = window.__strata.scene;
      sc.traverse(o => { if (hit) return; if (name === 'drone' && o.userData && o.userData.rotors) hit = o; });
      return hit;
    },
    // screen position (frame pixels) of a point given in game units: (x, y) on the floor plan, h above the floor
    project(x, y, h, level) {
      const G = window.__strata, z0 = G.G[level || G.level].z0, v = new THREE.Vector3(x, z0 + h, -y);
      G.camera.updateMatrixWorld(); v.project(G.camera);
      return { x: Math.round((v.x + 1) / 2 * innerWidth), y: Math.round((1 - v.y) / 2 * innerHeight), front: v.z < 1 };
    },
    projectObject(name) {
      const o = V.find(name); if (!o) return null; const G = window.__strata, v = new THREE.Vector3(); o.getWorldPosition(v);
      G.camera.updateMatrixWorld(); v.project(G.camera); return { x: Math.round((v.x + 1) / 2 * innerWidth), y: Math.round((1 - v.y) / 2 * innerHeight), front: v.z < 1 };
    },
    // App -> Game callout whose ring stays on its object while the camera moves.
    // spec: { ringAt: [x, y, h] } | { ringOn: 'hotspot' | 'probe' | 'beam' } | { ring: { x, y } }
    sync(appText, gameText, spec, ms) {
      const G = window.__strata, M = G.story().model; let track = null, fixed = null;
      if (spec.ringAt) track = () => V.project(spec.ringAt[0], spec.ringAt[1], spec.ringAt[2]);
      else if (spec.ringOn === 'hotspot') track = () => V.hotspotOnScreen();
      else if (spec.ringOn === 'probe') { const s = M.S.probeAt || V.site(); track = () => V.project(s[0], s[1], 1.1); }
      else if (spec.ringOn === 'beam') { const s = M.S.probeAt || V.site(); track = () => V.project(s[0] * .45, (s[1] - 2.6) / 2, .95); }
      else if (spec.ring) fixed = spec.ring;
      const first = track ? track() : fixed;
      window.overlay.sync(appText, gameText, first ? { x: first.x, y: first.y, track } : null, ms ? ms * 1000 : undefined);
      return first ? { x: first.x, y: first.y } : null;
    },
    // phone screen scrolling (the scrolling element is #sp .scr .body)
    body() { return document.querySelector('#sp .scr .body'); },
    scrollTo(target, dur, offset) {
      const b = V.body(); if (!b) return Promise.resolve();
      let y = typeof target === 'number' ? target : null;
      if (y == null) { const el = b.querySelector(target); if (!el) return Promise.resolve(); const s = b.getBoundingClientRect().height / b.clientHeight || 1;
        y = b.scrollTop + (el.getBoundingClientRect().top - b.getBoundingClientRect().top) / s - (offset == null ? 90 : offset); }
      y = Math.max(0, Math.min(b.scrollHeight - b.clientHeight, y));
      const y0 = b.scrollTop;
      return tween(dur || .6, k => { const bb = V.body(); if (bb) bb.scrollTop = y0 + (y - y0) * ease(k); });
    },
    // the app re-renders often; this finds the card whose label contains the text
    card(text) { const b = V.body(); if (!b) return null; return [...b.querySelectorAll('.card, .note')].find(c => c.textContent.toUpperCase().includes(text.toUpperCase())) || null; },
    scrollToText(text, dur, offset) {
      const b = V.body(), el = V.card(text); if (!b || !el) return Promise.resolve(false);
      const s = b.getBoundingClientRect().height / b.clientHeight || 1;
      const y = b.scrollTop + (el.getBoundingClientRect().top - b.getBoundingClientRect().top) / s - (offset == null ? 90 : offset);
      return V.scrollTo(y, dur).then(() => true);
    },
    // Frame-stepped capture: the recorder owns the clock, so CSS transitions and animations (phone slide, toasts,
    // overlay cards) are advanced by hand, one video frame at a time, instead of running on the compositor's clock.
    stepAnims(ms) {
      let n = 0;
      for (const a of document.getAnimations()) { n++;
        if (!a.__held) { a.__held = true; try { a.pause(); a.currentTime = 0; } catch (e) {} continue; }
        try { const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity, t = (Number(a.currentTime) || 0) + ms;
          if (isFinite(end) && t >= end) a.finish(); else a.currentTime = t; } catch (e) {}
      }
      return n;
    },
    // centre of a phone element in frame pixels, and whether a click there would reach it
    hit(sel) {
      const el = document.querySelector('#sp ' + sel); if (!el) return { ok: false, why: 'not found' };
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
      const scr = document.querySelector('#sp .scr').getBoundingClientRect();
      if (y < scr.top || y > scr.bottom) return { ok: false, why: 'scrolled out of the phone screen', x, y };
      if (!top || !(el === top || el.contains(top) || top.contains(el))) return { ok: false, why: 'covered by ' + (top ? top.tagName + '.' + top.className : 'nothing'), x, y };
      return { ok: true, x: Math.round(x), y: Math.round(y) };
    },
    // pause-menu watchdog (see "The pause-menu trap" in the build kit)
    watchdog() {
      setInterval(() => { const m = document.getElementById('menu'), G = window.__strata; if (!m || !G) return;
        if (m.style.display !== 'none' && (G.state === 'play' || G.state === 'paused')) { G.start(); m.style.display = 'none'; V.menuHits = (V.menuHits || 0) + 1; } }, 200);
    },
    menuVisible() { const m = document.getElementById('menu'); return !!m && m.style.display !== 'none'; },
    menuHits: 0,
  };
  window.__vid = V;
})();
