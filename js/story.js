// Strata — story layer: Mara's night in three acts, driven by the Strata phone (js/app.js) and the engines (js/engines.js).
//   Act 1 POWER    (#1 blackouts, #2 rationing)   forecast → AI bypass within resident limits → fair split → lamps steady, lift unlocks
//   Act 2 NETWORK  (#7 network cut, #8 families)  network cut → mesh links appear → broadcast → Ava's signed "I'm safe"
//   Act 3 SURFACE  (#13 is it safe?, #14 who first) drone scouts hotspots → probe vs Directorate → first crew → plant, sign, send
//   Close          (#15 the way up)              return plan in waves → ending
// Side content kept from the first story: notes to find, Ines, Teo, the clerk and the medic.
// World coordinates: (x, y) on the floor plan, three.js position = (x, z0 + height, -y).
(function () {
  'use strict';

  const SAVE_KEY = 'strata_save_v2';
  const SELF_LIT = { D: .12, R: .22, S: .1 };     // fake bounce light for added props/people (world uses baked lightmaps)
  const NET_CUT_DELAY = 14;                       // seconds after the power fix before the Directorate cuts the network
  const LIFE_HOLD = 40;                           // the cut waits while the player is on the Life screen, up to this long
  const HATCH = [0, -2.6];

  // ------------------------------------------------------------ objectives
  const STAGES = [
    { act: 1, text: 'Strata is buzzing. Raise your phone (Tab)', where: null },
    { act: 1, text: 'Power: approve Strata’s fix for feed 3', where: null },
    { act: 1, text: 'Fair share: compare the two splits and apply one', where: null },
    { act: 2, text: 'The network is down. Walk into the crowd and open Mesh', where: 'D', target: [-7.5, 0] },
    { act: 2, text: 'Mesh: broadcast the blackout warning', where: 'D' },
    { act: 2, text: 'Mesh: check in on Ava (L4 Works)', where: 'D' },
    { act: 3, text: 'Take the lift to the surface (press 3)', where: 'D', target: [0, 0] },
    { act: 3, text: 'Surface: read the probe while the drone scouts', where: 'S' },
    { act: 3, text: 'Surface: let Strata pick the first crew', where: 'S' },
    { act: 3, text: 'Plant the probe at the green marker (E)', where: 'S', target: 'probe' },
    { act: 3, text: 'Surface: sign the reading and send it down the mesh', where: 'S' },
    { act: 3, text: 'Open the Return plan', where: null },
    { act: 4, text: 'Free roam. The Hollow knows the truth', where: null },
  ];
  const ACT_NAME = { 1: 'Act 1 · Power', 2: 'Act 2 · Network', 3: 'Act 3 · Surface', 4: 'After the broadcast' };

  // ------------------------------------------------------------ notes (collectible lore)
  const NOTES = {
    ticket: { title: 'Queue ticket #4471', level: 'D', at: [-6.4, 2.1], h: 0.05,
      body: 'BATHROOM ACCESS — BLOCK NINE\n\nTicket #4471. Estimated wait: 38 minutes.\nWater rationed. Two minutes per resident.\n\nScrawled on the back in pencil:\n“They say the Directors have a bathroom each. A whole room. For one person.”' },
    gala: { title: 'Gala menu card', level: 'R', at: [-13.6, 4.0], h: 0.5,
      body: 'DIRECTORATE WINTER GALA\n\nChilled orange soup\nRoast vault-grown duck, fresh herbs\nChocolate from the hydroponic reserve\n\nStaff note: Power to the residences is guaranteed tonight. Lower levels may experience “scheduled maintenance”.' },
    memo: { title: 'Air quality memo — CONFIDENTIAL', level: 'R', at: [8.4, 4.0], h: 0.5,
      body: 'TO: The Directorate\nRE: Eastern basin readings\n\nSurface radiation in the eastern basin has fallen below lethal levels for the fourteenth month in a row. Sealed suits would allow hours outside; domes, indefinitely.\n\nRecommendation: say nothing. A frightened Deep is a quiet Deep.\n\n— Office of the Surface Director' },
    log: { title: 'Surface Director’s log', level: 'R', at: [12.45, -9.32], h: 0.72,
      body: 'Day 4,112.\n\nFeed 3 is running hot again. Engineering wants to warn the lower levels. I said no — if the Deep goes dark for a night, the Deep goes quiet for a night.\n\nTonight we cut the network too. No rumours, no panic, no questions about the surface.\n\nThe probes at the hatch still report. Nobody below has a key to read them.' },
  };
  const NOTE_IDS = ['ticket', 'gala', 'memo', 'log'];

  // ------------------------------------------------------------ dialogue
  const SPEAKERS = {
    clerk: { name: 'Ration clerk', level: 'D', at: [13.4, 0], r: 2.4, label: 'Ration window' },
    medic: { name: 'Medic', level: 'D', at: [0, 13.4], r: 2.4, label: 'Clinic window' },
    ines: { name: 'Ines', level: 'D', at: [-6.6, 0.05], r: 1.7, label: 'Your neighbour, in the bathroom queue' },
    teo: { name: 'Teo', level: 'R', at: [4.6, 0.9], r: 2.0, label: 'Housekeeper' },
  };

  window.StoryInit = function (C) {
    const THREE = C.THREE, $ = C.$, E = window.StrataEngines;
    let S = load() || fresh();
    const busy = { dlg: null, note: null };

    function fresh() { return { stage: 0, notes: [], flags: {}, deaths: 0, played: 0, ended: false, mode: null, bypass: false, applied: null, netCut: false, broadcast: false, ava: null, mapped: [], crew: false, planted: false, sent: null, life: { leak: false, lamps: false, triage: false } }; }
    function load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && typeof s.stage === 'number' ? Object.assign(fresh(), s) : null; } catch (e) { return null; } }
    function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }

    // ------------------------------------------------------------ model the app reads (live, not saved)
    const M = {
      get S() { return S; }, E,
      cd0: 112, cd: 112, dark: false,
      fc: null, fcBypassDir: null, fcBypassStr: null, preview: 'str',
      twin: E.twin(C.G), plan: E.returnPlan(), crew: null,
      graph: null, hop: null, reach: 0, inRange: 0, bcT: -1, route: null, routeT: -1, replyT: -1,
      keys: {}, fp: {}, probe: null, site: null, dose: 1, droneI: 0, droneMsg: 'Waiting at the hatch',
      busy: false, life: null, lifeDir: null, lifePrev: null,
    };

    // ------------------------------------------------------------ HUD
    function renderInv() {
      const chips = [`<span class="chip">${ACT_NAME[STAGES[Math.min(S.stage, STAGES.length - 1)].act]}</span>`];
      chips.push(`<span class="chip dim">Notes ${S.notes.length}/${NOTE_IDS.length}</span>`);
      $('inv').innerHTML = chips.join('');
    }
    function renderObj() {
      $('objt').textContent = STAGES[Math.min(S.stage, STAGES.length - 1)].text;
      const lifeDone = S.life.leak && S.life.lamps && S.life.triage;
      $('objo').textContent = S.flags.supplies && !lifeDone && !S.ended ? 'Optional: Life — water, food, medicine' : '';
    }
    let toastT = null;
    const VIDEO = /[?&]video=1/.test(location.search);
    function toast(who, text, ms = 4200) {
      if (VIDEO) ms *= 1.4;
      const el = $('toast'); el.innerHTML = (who ? `<b>${who}</b> ` : '') + text; el.style.opacity = 1;
      clearTimeout(toastT); toastT = setTimeout(() => el.style.opacity = 0, ms);
    }
    function buzz() { C.blip(140, .25, 'square', .08); C.blip(110, .3, 'square', .07, .12); }
    function chime() { C.blip(660, .18, 'triangle', .12); C.blip(990, .3, 'triangle', .1, .12); }
    const phone = () => window.StrataPhone;
    function phoneAlert(text, hot = true) { const p = phone(); if (!p) return; p.badge(text, hot); p.buzz(); buzz(); }
    function rerender() { const p = phone(); if (p) p.render(); }
    function setStage(n) {
      if (n <= S.stage) return; S.stage = n; save(); renderObj(); renderInv(); chime(); rerender();
      const a = STAGES[n].act; if (STAGES[n - 1] && STAGES[n - 1].act !== a && a <= 3) C.banner && C.banner(ACT_NAME[a], STAGES[n].text);
    }

    // ------------------------------------------------------------ 3D helpers (low-poly to match the world)
    const pos = (l, x, y, h) => new THREE.Vector3(x, C.G[l].z0 + h, -y);
    function stdMat(l, color, rough = .85, emissive = 0, emI = 0) {
      const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: true });
      m.envMap = C.ENV[l]; m.envMapIntensity = 1.15;
      if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emI; }
      else { m.emissive = new THREE.Color(color); m.emissiveIntensity = SELF_LIT[l]; }
      m.color.convertSRGBToLinear(); m.emissive.convertSRGBToLinear();
      return m;
    }
    function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
    function halo(color, size, opacity, fog = true) {
      const m = new THREE.SpriteMaterial({ map: C.GLOW, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, fog });
      const s = new THREE.Sprite(m); s.scale.setScalar(size); return s;
    }
    function blobShadow() {
      const m = new THREE.Mesh(new THREE.CircleGeometry(.38, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .35, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = .01; return m;
    }
    function person(l, c) {
      const g = new THREE.Group();
      const jacket = stdMat(l, c.jacket), pants = stdMat(l, c.pants), skin = stdMat(l, c.skin, .7), hair = stdMat(l, c.hair, .9);
      g.add(box(.16, .8, .2, pants, -.1, .4, 0), box(.16, .8, .2, pants, .1, .4, 0));
      const torso = box(.48, .62, .28, jacket, 0, 1.12, 0); g.add(torso);
      g.add(box(.13, .58, .16, jacket, -.31, 1.1, 0), box(.13, .58, .16, jacket, .31, 1.1, 0));
      const head = new THREE.Group(); head.position.set(0, 1.56, 0);
      head.add(box(.26, .28, .26, skin, 0, 0, 0), box(.28, .1, .28, hair, 0, .15, 0), box(.28, .2, .06, hair, 0, .04, -.13));
      g.add(head); g.add(blobShadow());
      g.userData = { head, torso };
      return g;
    }
    function ring(l, r, color, opacity) {
      const m = new THREE.Mesh(new THREE.RingGeometry(r * .92, r, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.rotation.x = -Math.PI / 2; return m;
    }

    // ------------------------------------------------------------ cast
    const npcs = [];
    function addNPC(id, look, x, y, faceYaw) {
      const sp = SPEAKERS[id]; const g = person(sp.level, look);
      g.position.copy(pos(sp.level, x, y, 0)); g.rotation.y = faceYaw;
      C.extras[sp.level].add(g); C.G[sp.level].circles.push([x, y, .3]);
      npcs.push({ id, g, x, y, yaw0: faceYaw, ph: Math.random() * 10 });
    }
    addNPC('ines', { jacket: 0x5a3434, pants: 0x2e2a28, skin: 0xb98a6a, hair: 0x8f8a82 }, -6.25, 0.05, -Math.PI / 2);
    addNPC('teo', { jacket: 0x23262c, pants: 0x1b1d22, skin: 0x8e5b3e, hair: 0x0f0d0c }, 4.6, 0.95, -Math.PI / 2);

    // ------------------------------------------------------------ notes
    const pickups = [];
    function paper(l) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.26, .34), stdMat(l, 0xf1ead8, .9, 0xf1ead8, .35)); m.rotation.x = -Math.PI / 2; return m; }
    for (const id of NOTE_IDS) {
      const n = NOTES[id], g = new THREE.Group(), mesh = paper(n.level), hl = halo(0xfff2c8, .9, .55);
      g.position.copy(pos(n.level, n.at[0], n.at[1], n.h + .06)); g.add(mesh, hl); C.extras[n.level].add(g);
      pickups.push({ id, l: n.level, x: n.at[0], y: n.at[1], g, mesh, hl, ph: Math.random() * 6 });
    }

    // ------------------------------------------------------------ Act 1 world: lift lock light
    const liftLamp = halo(0xff3020, 1.4, .8); liftLamp.position.copy(pos('D', 0, -1.75, 2.55)); C.extras.D.add(liftLamp);

    // ------------------------------------------------------------ Act 2 world: resident phones + mesh links
    const MESH_R = [.25, .27, .35, .4], MESH_RANGE = 3.6;
    const residents = C.G.D.circles.filter(c => MESH_R.some(r => Math.abs(c[2] - r) < .006) && Math.hypot(c[0], c[1]) > 1.8)
      .map(c => ({ x: c[0], y: c[1], h: c[2] >= .35 ? .85 : 1.2, kind: 'phone' }));
    const RELAY = { x: 0, y: -1.9, h: 2.3, kind: 'relay' };            // lift-shaft relay: carries the mesh up the shaft
    const baseNodes = residents.concat([RELAY]);
    const RELAY_I = baseNodes.length - 1;
    const meshGroup = new THREE.Group(); meshGroup.visible = false; C.extras.D.add(meshGroup);
    const phoneSprites = baseNodes.map(n => { const s = halo(n.kind === 'relay' ? 0x9fdcff : 0x5fd0ff, n.kind === 'relay' ? 1.1 : .32, .85); s.position.copy(pos('D', n.x, n.y, n.h)); meshGroup.add(s); return s; });
    const g0 = E.mesh.build(baseNodes, MESH_RANGE);
    const linkPos = new Float32Array(g0.links.length * 6), linkCol = new Float32Array(g0.links.length * 6);
    g0.links.forEach(([a, b], k) => { const A = baseNodes[a], B = baseNodes[b]; linkPos.set([A.x, A.h, -A.y, B.x, B.h, -B.y], k * 6); });
    const linkGeo = new THREE.BufferGeometry(); linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPos, 3)); linkGeo.setAttribute('color', new THREE.BufferAttribute(linkCol, 3));
    const linkLines = new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    meshGroup.add(linkLines);
    // player's own links + the active route (rebuilt when needed)
    const dynPos = new Float32Array(64 * 6), dynCol = new Float32Array(64 * 6);
    const dynGeo = new THREE.BufferGeometry(); dynGeo.setAttribute('position', new THREE.BufferAttribute(dynPos, 3)); dynGeo.setAttribute('color', new THREE.BufferAttribute(dynCol, 3));
    const dynLines = new THREE.LineSegments(dynGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    dynLines.frustumCulled = false; meshGroup.add(dynLines);
    const shaftBeam = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 30, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    shaftBeam.position.copy(pos('D', RELAY.x, RELAY.y, 16)); meshGroup.add(shaftBeam);
    function playerGraph() {
      const nodes = baseNodes.concat([{ x: C.P.x, y: C.P.y, h: 1.3, kind: 'me' }]);
      return E.mesh.build(nodes, MESH_RANGE);
    }

    // ------------------------------------------------------------ Act 3 world: drone, hotspot rings, probe
    const HOT = C.G.S.hotspots;
    const tour = E.surface.droneTour(HOT, HATCH);
    const hotRings = HOT.map(h => { const r = ring('S', h[2] * 2.2, 0xff3a2a, .0); r.position.copy(pos('S', h[0], h[1], .06)); C.extras.S.add(r); return r; });
    const drone = new THREE.Group();
    { const body = stdMat('S', 0x2a2e33, .5), lite = stdMat('S', 0x101010, .4, 0x5fd0ff, 2.5);
      drone.add(box(.5, .14, .5, body, 0, 0, 0), box(1.3, .04, .08, body, 0, .02, 0), box(.08, .04, 1.3, body, 0, .02, 0), box(.12, .06, .12, lite, 0, -.09, 0));
      drone.userData.rotors = [[.62, 0], [-.62, 0], [0, .62], [0, -.62]].map(([x, z]) => { const r = box(.5, .01, .06, stdMat('S', 0x111111, .5), x, .07, z); drone.add(r); return r; });
      const dl = halo(0x5fd0ff, 1.2, .9, false); dl.position.y = -.1; drone.add(dl); drone.userData.light = dl; }
    drone.position.copy(pos('S', HATCH[0] + 1.5, HATCH[1] + 1.5, 2.2)); C.extras.S.add(drone);
    const siteMark = new THREE.Group(); siteMark.visible = false; C.extras.S.add(siteMark);
    { const rr = ring('S', .9, 0x3ddc97, .85); rr.position.y = .05; siteMark.add(rr); const col = halo(0x3ddc97, 2.2, .6, false); col.position.y = 1.2; siteMark.add(col); siteMark.userData.col = col; }
    const probe = new THREE.Group(); probe.visible = false; C.extras.S.add(probe);
    { const m = stdMat('S', 0x6b6f74, .5), d = stdMat('S', 0x1b1e22, .5);
      probe.add(box(.5, .12, .5, d, 0, .06, 0), box(.1, 1.5, .1, m, 0, .8, 0), box(.36, .26, .2, m, 0, 1.1, .12), box(.24, .14, .03, stdMat('S', 0x101410, .3, 0x3cff6a, .8), 0, 1.12, .23));
      const tip = halo(0xc27bff, 1.4, .9, false); tip.position.y = 1.62; probe.add(tip); probe.userData.tip = tip; }
    const upBeam = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xc27bff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    C.extras.S.add(upBeam);

    function surfaceBlocked(x, y) {
      for (const r of C.G.S.rects) if (x > r[0] - .6 && x < r[2] + .6 && y > r[1] - .6 && y < r[3] + .6) return true;
      for (const c of C.G.S.circles) if (Math.hypot(x - c[0], y - c[1]) < c[2] + .7) return true;
      return false;
    }
    function updateSite() {
      const mapped = S.mapped.map(i => HOT[i]);
      M.site = E.surface.probeSite(mapped.length ? mapped : [], HATCH, 16, surfaceBlocked);
      siteMark.position.copy(pos('S', M.site.x, M.site.y, 0));
    }
    updateSite();

    // ------------------------------------------------------------ Deep water point: ration sign + leaking pipe (react to the leak fix)
    const SIGN_AT = [-11.9, 2.7];
    const signCanvas = document.createElement('canvas'); signCanvas.width = 256; signCanvas.height = 128;
    const signTex = new THREE.CanvasTexture(signCanvas);
    function drawSign() {
      const x = signCanvas.getContext('2d'), ok = S.life.leak;
      x.fillStyle = '#14110e'; x.fillRect(0, 0, 256, 128); x.strokeStyle = ok ? '#3ddc97' : '#ff5a4d'; x.lineWidth = 6; x.strokeRect(6, 6, 244, 116);
      x.fillStyle = '#c8c0b0'; x.font = '600 20px sans-serif'; x.textAlign = 'center'; x.fillText('WATER RATION', 128, 40);
      x.fillStyle = ok ? '#3ddc97' : '#ff5a4d'; x.font = '700 40px sans-serif'; x.fillText(ok ? '15 L PER PERSON' : 'RATION 8 L', 128, 92);
      signTex.needsUpdate = true;
    }
    const sign = new THREE.Group(); sign.position.copy(pos('D', SIGN_AT[0], SIGN_AT[1], 0)); sign.rotation.y = -Math.PI / 2 + .35;
    { const post = stdMat('D', 0x3a3530, .7); sign.add(box(.08, 1.8, .08, post, 0, .9, 0));
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .55), new THREE.MeshBasicMaterial({ map: signTex, fog: true })); board.position.set(0, 2.0, .05); sign.add(board);
      sign.add(box(1.16, .6, .04, post, 0, 2.0, 0));
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 1.8, 10), stdMat('D', 0x5b6168, .45)); pipe.rotation.z = Math.PI / 2; pipe.position.set(0, 2.75, .1); sign.add(pipe); }
    C.extras.D.add(sign); C.G.D.circles.push([SIGN_AT[0], SIGN_AT[1], .25]);
    const dripN = 40, dripPos = new Float32Array(dripN * 3), dripGeo = new THREE.BufferGeometry(); dripGeo.setAttribute('position', new THREE.BufferAttribute(dripPos, 3));
    const drip = new THREE.Points(dripGeo, new THREE.PointsMaterial({ size: .05, color: 0x9fdcff, transparent: true, opacity: .85, depthWrite: false, fog: true }));
    drip.frustumCulled = false; sign.add(drip);
    const dripY = Array.from({ length: dripN }, (_, i) => i / dripN);
    function leakWorld() { drawSign(); drip.visible = !S.life.leak; }
    leakWorld();

    // ------------------------------------------------------------ keys (ECDSA P-256)
    (async () => {
      if (!E.sig.ok) return;
      for (const k of ['mara', 'ava', 'probe']) { M.keys[k] = await E.sig.keypair(); M.fp[k] = await E.sig.fingerprint(M.keys[k]); }
      rerender();
    })();

    // ------------------------------------------------------------ Act 1: power
    function runForecasts() {
      const seed = 2087 + Math.floor(Date.now() / 60000) % 1000;
      M.fc = E.forecast({ seed });
      M.fcBypassDir = E.forecast({ seed: seed + 1, bypass3: true, mode: 'dir', keep: 24 });
      M.fcBypassStr = E.forecast({ seed: seed + 2, bypass3: true, mode: 'str', keep: 24 });
      if (S.stage === 0 && M.fc.median) { M.cd0 = M.cd = M.fc.median; }
    }
    function actBypass() {
      if (S.bypass) return; S.bypass = true; save();
      toast('STRATA', 'Feed 3 bypassed before it trips. But feeds 1 and 2 only give 78 of 120 MW. Somebody has to get less.', 6000);
      setStage(2); phone().go('share');
    }
    function actApply(mode) {
      S.applied = mode; save();
      recomputeLife();
      if (mode === 'dir') { M.dark = true; toast('STRATA', 'Directorate split applied: L5 and the Deep fall to zero. Every lamp down here goes out.', 5600); C.blip(90, 1.2, 'sawtooth', .08); rerender(); return; }
      M.dark = false; M.cd = Infinity;
      toast('STRATA', 'Fair split applied. Every level above its survival minimum. The Deep stays lit and the lift has power.', 6000);
      C.ding(); setStage(3); S.flags.powerAt = S.played; save(); recomputeLife();
    }

    // ------------------------------------------------------------ life support (water, food, medicine, air, sunlight, space)
    const POWER_MW = E.FEEDS[0].cap + E.FEEDS[1].cap;          // 78 MW once feed 3 is bypassed
    function lifeFlags(over = {}) { return Object.assign({ leakFixed: S.life.leak, nightLamps: S.life.lamps, triage: S.life.triage }, over); }
    function recomputeLife() {
      M.lifeDir = E.life(E.allocate(POWER_MW, 'dir'));
      M.life = E.life(E.allocate(POWER_MW, S.applied === 'str' ? 'str' : 'dir'), lifeFlags());
    }
    const LIFE_TOAST = {
      leak: ['WATER', () => `Leak on L5 Warrens main loop isolated. +${(M.life.waterDays - M.lifePrev.waterDays).toFixed(1)} days of water.`],
      lamps: ['FOOD', () => `Grow lamps moved to the night window. Farms now cover ${Math.round(M.life.farmShare * 100)}% of need.`],
      triage: ['MEDICINE', () => `Inhalers re-sent by need over the mesh. The Deep now has ${M.life.meds[0].days[5].toFixed(1)} days of cover.`],
    };
    function actLife(kind) {
      if (S.applied !== 'str' || S.life[kind]) return;
      M.lifePrev = M.life; S.life[kind] = true; save(); recomputeLife();
      const t = LIFE_TOAST[kind]; toast(t[0], t[1](), 5200); C.ding(); renderObj(); rerender(); leakWorld();
    }

    // ------------------------------------------------------------ Act 2: network
    function netCut() {
      if (S.netCut) return; S.netCut = true; save();
      phoneAlert('NET CUT · STRATA', true);
      toast('DIRECTORATE', 'Network suspended for maintenance. Remain in your sector.', 5200);
      meshGroup.visible = true; rerender();
    }
    function meshStatus() {
      const g = playerGraph(), me = g.nodes.length - 1;
      const hop = E.mesh.flood(g, me);
      M.graph = g; M.inRange = g.adj[me].length; M.reach = hop.filter(h => h > 0).length; M.hop = hop;
      return { g, me, hop };
    }
    function actBroadcast() {
      const { me } = meshStatus();
      if (!M.inRange) { phone().buzz(); toast('STRATA', 'No phones in range. Walk into the crowd: the queues and the tables.', 4200); return; }
      M.bcT = 0; M.bcHop = M.hop.slice(); S.broadcast = true; save();
      toast('MESH', `Warning passed hand to hand: ${M.reach} phones in ${Math.max(...M.hop)} hops. No towers, no Directorate.`, 5200);
      if (S.stage === 4) setStage(5); else rerender();
      void me;
    }
    async function actAva() {
      const { g, me } = meshStatus();
      const r = E.mesh.route(g, me, RELAY_I);
      if (!r) { phone().buzz(); toast('STRATA', 'No route to the lift relay yet. Get closer to the crowd.', 4200); return; }
      M.route = r; M.routeT = 0; M.replyT = -1; S.ava = { state: 'sent' }; save(); rerender();
      const msg = 'Mara → Ava: Are you safe? Power is back in the Deep.';
      const myS = M.keys.mara ? await E.sig.sign(M.keys.mara, msg) : '';
      S.ava = { state: 'sent', msg, sig: myS }; save();
    }
    async function avaReply() {
      const text = 'I’m safe. — Ava, L4 Works · hatch override in your Strata';
      let sigHex = '', ok = false;
      if (M.keys.ava) { sigHex = await E.sig.sign(M.keys.ava, text); ok = await E.sig.verify(M.keys.ava, text, sigHex); }
      S.ava = { state: 'replied', text, sig: sigHex, ok }; save();
      phoneAlert('AVA · SAFE', false);
      toast('AVA', '“I’m safe.” Signature checked against Ava’s key: ' + (ok ? 'valid' : 'not verified') + '. She sent the hatch override.', 6000);
      setStage(6);
    }

    // ------------------------------------------------------------ Act 3: surface
    function actCrew() { M.crew = E.crew(); S.crew = true; save(); toast('STRATA', `First crew picked from ${M.crew.considered} volunteers: best lungs, no small children, every skill covered.`, 5200); if (S.stage === 8) setStage(9); else rerender(); siteMark.visible = true; }
    function plantProbe() {
      S.planted = true; S.probeAt = [M.site.x, M.site.y]; save();
      probe.position.copy(pos('S', M.site.x, M.site.y, 0)); probe.visible = true; siteMark.visible = false;
      C.ding(); toast('PROBE', 'Probe planted. Reading the air.', 3600); setStage(10);
    }
    async function actSign() {
      if (!S.planted || S.sent) return;
      const m = E.surface.doseMult(HOT, S.probeAt[0], S.probeAt[1]);
      const p = E.surface.protection(m);
      const reading = `probe-07 · ${new Date().toISOString().slice(0, 19)}Z · dose ×${m.toFixed(2)} background · unprotected ${p[0].label} · sealed suit ${p[1].label}`;
      let sigHex = '', ok = false;
      if (M.keys.probe) { sigHex = await E.sig.sign(M.keys.probe, reading); ok = await E.sig.verify(M.keys.probe, reading, sigHex); }
      S.sent = { reading, sig: sigHex, ok }; save(); M.sendT = 0;
      toast('MESH', 'Signed reading sent down the hatch and through the mesh to all six levels. Anyone can check it against the probe’s key.', 6000);
      setStage(11); phone().go('ret');
    }

    // ------------------------------------------------------------ dialogue
    function linesFor(id) {
      const st = S.stage, end = S.ended;
      if (id === 'clerk') {
        if (end) return ['You saw the probe numbers? Six hours in a suit... my son wants to sign up for the next crew.'];
        if (S.life.leak) return ['Ration board says 15 litres again. First time this month.'];
        if (st < 3) return ['Lights keep dipping. If the Deep goes dark, the window closes. Rules.', 'One ration per resident. Next.'];
        return ['Lamps steady for once. Whatever you did on that phone — thanks.'];
      }
      if (id === 'medic') {
        if (end) return ['Every screen down here is showing the probe’s reading. Signed. Nobody can say it’s fake.'];
        if (S.life.triage) return ['The inhalers came down the mesh this morning. First time in months the Deep got first pick.'];
        if (st < 3) return ['If the air pumps lose power, the cough ward fills in an hour. Keep the Deep lit, whoever you are.'];
        return ['Pumps are running. Go check on your daughter.'];
      }
      if (id === 'ines') {
        if (end) return ['The screens... you did that? My grandmother would have cried.', 'Maybe one day I’ll see the sky without dying of it.'];
        if (S.flags.retOpened) return ['The Deep goes up first? They never put us first for anything.'];
        if (st < 3) return ['Mara! The lamps keep dipping. Your phone is going off, look at it.'];
        if (st < 6) return ['The network’s gone. But my phone is talking to yours, look — they pass messages along.', 'Is Ava all right? She works up on L4, doesn’t she?'];
        return ['Ava’s safe? Thank god. Go — the lift is yours.'];
      }
      if (id === 'teo') {
        if (end) return ['They’re all in Apartment 01 shouting at each other about a probe. First time I’ve smiled in years.'];
        if (S.life.lamps) return ['The farm crews are on nights now. Bread’s back on the Warrens list.', 'The Surface Director keeps his log in Apartment 07. I never told you that.'];
        return ['You shouldn’t be up here. ...The Surface Director keeps his log in Apartment 07. I never told you that.'];
      }
      return ['...'];
    }
    function openDialogue(id) {
      const sp = SPEAKERS[id];
      busy.dlg = { id, name: sp.name, lines: linesFor(id), i: 0 };
      showLine(); C.blip(520, .06, 'square', .05);
    }
    function showLine() {
      const d = busy.dlg; $('dlgn').textContent = d.name; $('dlgt').textContent = d.lines[d.i];
      $('dlgh').textContent = d.i < d.lines.length - 1 ? 'E / click — continue' : 'E / click — close';
      $('dlg').style.display = 'block';
    }
    function advanceDialogue() {
      const d = busy.dlg; if (!d) return;
      d.i++; C.blip(440, .04, 'square', .04);
      if (d.i >= d.lines.length) { $('dlg').style.display = 'none'; busy.dlg = null; return; }
      showLine();
    }
    function openNote(id) {
      const n = NOTES[id]; busy.note = id;
      $('notet').textContent = n.title; $('noteb').textContent = n.body; $('note').style.display = 'flex';
      C.burst(1800, .8, .25, .12);
    }
    function closeNote() { $('note').style.display = 'none'; busy.note = null; }

    // ------------------------------------------------------------ interactions
    function nearestInteractable() {
      const l = C.level, P = C.P; let best = null, bd = 1e9;
      for (const id in SPEAKERS) { const sp = SPEAKERS[id]; if (sp.level !== l) continue;
        const d = Math.hypot(P.x - sp.at[0], P.y - sp.at[1]); if (d < sp.r && d < bd) { bd = d; best = { type: 'talk', id, n: 'E · Talk to ' + sp.name, d: sp.label }; } }
      for (const p of pickups) { if (p.l !== l || S.flags['got_' + p.id]) continue;
        const d = Math.hypot(P.x - p.x, P.y - p.y);
        if (d < 1.5 && d < bd + .6) { bd = d; best = { type: 'pick', p, n: 'E · Read', d: NOTES[p.id].title }; } }
      if (l === 'S' && S.stage === 9 && M.site && Math.hypot(P.x - M.site.x, P.y - M.site.y) < 2) best = { type: 'plant', n: 'E · Plant the probe', d: 'Strata’s pick: lowest dose near the hatch' };
      return best;
    }
    function interact() {
      if (busy.note) { closeNote(); return; }
      if (busy.dlg) { advanceDialogue(); return; }
      const it = nearestInteractable(); if (!it) return;
      if (it.type === 'talk') openDialogue(it.id);
      else if (it.type === 'pick') { const p = it.p; S.flags['got_' + p.id] = 1; p.g.visible = false; if (!S.notes.includes(p.id)) S.notes.push(p.id); save(); renderInv(); openNote(p.id); }
      else if (it.type === 'plant') plantProbe();
    }

    // ------------------------------------------------------------ lift rules
    function canTravel(to) {
      if (S.ended) return null;
      if (S.stage < 3) return 'Lift offline. The Deep is on reserve power: lift motors are the first thing cut.';
      if (to === 'S' && S.stage < 6) return 'Surface hatch sealed by Directorate order.';
      return null;
    }
    function deny(msg) { buzz(); toast('INTERCOM', msg, 4600); }
    function intercomHint() {
      const k = 'ic' + S.stage + C.level; if (S.flags[k] || S.ended) return; S.flags[k] = 1;
      const H = { 0: 'Power fluctuation in progress. Lift service suspended.', 3: 'Lift power restored. Network services suspended.',
        6: 'Hatch override accepted. Surface: press 3. Exposure limit: five minutes.' };
      const h = H[S.stage]; if (h) toast('INTERCOM', h, 5200);
    }

    // ------------------------------------------------------------ ending
    function fmt(s) { s = Math.round(s); const m = s / 60 | 0; return m + ':' + String(s % 60).padStart(2, '0'); }
    async function ending() {
      if (S.ended) return;
      S.ended = true; S.stage = 12; save(); renderObj(); renderInv();
      phone().close();
      C.setState('end'); C.unlock(); busy.dlg = null; $('dlg').style.display = 'none';
      await C.fade(1, 1400);
      const parts = [];
      if (S.life.leak) parts.push(`Water for ${Math.round(M.life.waterDays)} days`);
      if (S.life.lamps) parts.push(`food for ${isFinite(M.life.foodDays) ? Math.round(M.life.foodDays) : 'as long as the farms run'}`);
      if (S.life.triage) parts.push('the inhalers went to the Deep first');
      let p3 = parts.length ? parts.map((p, i) => i === 0 ? p[0].toUpperCase() + p.slice(1) : p).join(parts.length > 2 ? ', ' : ' and ').replace(/, ([^,]*)$/, ', and $1') + '.' : '';
      if (S.flags.retOpened) p3 += (p3 ? ' ' : '') + 'The corridors run on staggered shifts and the Deep goes up first.';
      $('endp3').textContent = p3; $('endp3').style.display = p3 ? '' : 'none';
      $('endstats').textContent = `TIME ${fmt(S.played)} · DEEP KEPT LIT · ${M.reach || '—'} PHONES ON THE MESH · READING ${S.sent && S.sent.ok ? 'VERIFIED' : 'SENT'} · NOTES ${S.notes.length}/${NOTE_IDS.length}`;
      $('end').style.display = 'flex';
      C.blip(523, 2.5, 'sine', .1); C.blip(659, 2.5, 'sine', .08, .4); C.blip(784, 3, 'sine', .07, .8);
    }
    $('endgo').addEventListener('click', async e => {
      e.stopPropagation(); $('end').style.display = 'none'; C.setState('play'); C.lock(); await C.fade(0, 900);
      toast('', 'Free roam. The lift goes anywhere now.');
    });
    $('endnew').addEventListener('click', e => { e.stopPropagation(); $('end').style.display = 'none'; newGame(); C.setState('play'); C.lock(); C.fade(0, 900); });

    function newGame() {
      S = fresh(); save();
      for (const p of pickups) p.g.visible = true;
      recomputeLife(); leakWorld(); M.dark = false; M.crew = null; M.route = null; M.routeT = M.replyT = M.bcT = -1; M.droneI = 0;
      runForecasts(); M.cd = M.cd0;
      meshGroup.visible = false; probe.visible = false; siteMark.visible = false; upBeam.material.opacity = 0;
      hotRings.forEach(r => r.material.opacity = 0); drone.position.copy(pos('S', HATCH[0] + 1.5, HATCH[1] + 1.5, 2.2)); updateSite();
      phone().badge(); phone().go('home');
      C.respawn(); C.setLevel('D'); renderInv(); renderObj();
    }

    // ------------------------------------------------------------ per-frame
    let wasCab = false, distT = 0, liveT = 0, introT = 0;
    const tmpA = new THREE.Color(), tmpB = new THREE.Color();
    function setLink(arr, k, c1, c2) { arr[k * 6] = c1.r; arr[k * 6 + 1] = c1.g; arr[k * 6 + 2] = c1.b; arr[k * 6 + 3] = c2.r; arr[k * 6 + 4] = c2.g; arr[k * 6 + 5] = c2.b; }
    function update(dt, t) {
      const playing = C.state === 'play' || C.state === 'phone';
      if (playing) S.played += dt;

      // --- Act 1: countdown + brownout
      if (S.stage < 3 && playing && !C.travelling) {
        introT += dt;
        if (introT > .3 && !S.flags.introBuzz) { S.flags.introBuzz = 1; phoneAlert('1:52 · STRATA', true); toast('STRATA', 'Forecast: the Deep goes dark in ' + fmt(M.cd) + '. Raise your phone (Tab).', 6000); }
        if (S.applied !== 'str') { M.cd = Math.max(0, M.cd - dt); if (M.cd === 0 && !M.dark) { M.dark = true; toast('STRATA', 'Feed 3 tripped. The Deep is dark. Strata can still reroute and rebalance.', 6000); C.blip(80, 1.4, 'sawtooth', .09); rerender(); } }
      }
      if (S.stage === 0 && C.state === 'phone') setStage(1);
      const w = C.world;
      if (S.stage >= 3 || S.applied === 'str') { w.brown = Math.max(0, w.brown - dt * .8); w.dark = Math.max(0, w.dark - dt * .8); }
      else { const k = 1 - M.cd / M.cd0; w.brown = Math.min(1, .3 + k * .7); w.dark += ((M.dark ? 1 : 0) - w.dark) * Math.min(1, dt * 3); }
      liftLamp.material.color.setHex(S.stage >= 3 ? 0x40ff70 : 0xff3020); liftLamp.material.opacity = S.stage >= 3 ? .7 : (.45 + .4 * (Math.sin(t * 4) > 0 ? 1 : 0));

      // --- Act 2: network cut + mesh animation
      if (S.stage >= 3 && !S.netCut) {
        const since = S.played - (S.flags.powerAt || 0), onLife = C.state === 'phone' && phone().state.scr === 'life';
        if (!S.flags.supplies && since > 2 && S.applied === 'str') { S.flags.supplies = 1; save(); phoneAlert('WATER · LEAK', true); toast('STRATA', 'Leak on the L5 water loop. Life support needs a look: open Life.', 5200); renderObj(); rerender(); }
        if ((since > NET_CUT_DELAY && !onLife) || since > LIFE_HOLD) netCut();
      }
      if (C.state === 'phone' && phone().state.scr === 'ret' && !S.flags.retOpened) { S.flags.retOpened = 1; save(); }
      if (S.netCut) meshGroup.visible = C.level === 'D';
      if (S.stage === 3 && C.state === 'phone' && phone().state.scr === 'mesh') setStage(4);
      if (meshGroup.visible) {
        const live = S.netCut;
        if (M.bcT >= 0) M.bcT += dt;
        const layer = M.bcT >= 0 ? M.bcT / .32 : -1;
        const gHop = M.bcHop || null;
        g0.links.forEach(([a, b], k) => {
          let i = live ? .16 + .05 * Math.sin(t * 2 + k) : 0;
          tmpA.setRGB(.22 * i * 4, .75 * i * 4, 1 * i * 4);
          if (gHop && layer >= 0) { const L = Math.max(gHop[a], gHop[b]); if (L >= 0 && layer >= L) { const age = layer - L; const f = Math.max(.5, 2.2 * Math.exp(-age * .6)); tmpA.setRGB(.25 * f, .85 * f, 1 * f); } }
          setLink(linkCol, k, tmpA, tmpA);
        });
        linkGeo.attributes.color.needsUpdate = true;
        phoneSprites.forEach((s, i) => { const lit = gHop && layer >= gHop[i] && gHop[i] >= 0; s.material.opacity = (lit ? 1 : .55) * (.75 + .25 * Math.sin(t * 3 + i)); });
        // dynamic: my links to phones in range, and the route to the relay
        let n = 0;
        const me = { x: C.P.x, y: C.P.y, h: 1.3 };
        tmpB.setRGB(.6, .95, 1);
        for (const r of baseNodes) { if (n >= 24) break; const d = Math.hypot(r.x - me.x, r.y - me.y); if (d <= MESH_RANGE) { dynPos.set([me.x, me.h, -me.y, r.x, r.h, -r.y], n * 6); tmpA.setRGB(.3, .9, 1).multiplyScalar(1.4 - d / MESH_RANGE); setLink(dynCol, n, tmpA, tmpA); n++; } }
        if (M.route && M.routeT >= 0) {
          M.routeT += dt; const p = M.route.path, gN = M.graph.nodes;
          const lit = M.routeT / .28;
          for (let k = 0; k < p.length - 1 && n < 64; k++) {
            const A = gN[p[k]], B = gN[p[k + 1]];
            dynPos.set([A.x, A.h, -A.y, B.x, B.h, -B.y], n * 6);
            const back = M.replyT >= 0 ? (p.length - 2 - k) <= M.replyT / .22 : false;
            if (back) tmpA.setRGB(.5, 2.2, 1.1); else if (k < lit) tmpA.setRGB(2.4, 1.6, .4); else tmpA.setRGB(.2, .2, .2);
            setLink(dynCol, n, tmpA, tmpA); n++;
          }
          const up = lit >= p.length - 1;
          shaftBeam.material.opacity = up ? Math.min(.9, (M.routeT - (p.length - 1) * .28) * 1.5) * (M.replyT >= 0 ? .4 : 1) : 0;
          if (up && M.replyT < 0 && S.ava && S.ava.state === 'sent' && M.routeT > (p.length - 1) * .28 + 2.2) { M.replyT = 0; avaReply(); }
          if (M.replyT >= 0) M.replyT += dt;
        } else shaftBeam.material.opacity = 0;
        dynGeo.setDrawRange(0, n * 2); dynGeo.attributes.position.needsUpdate = true; dynGeo.attributes.color.needsUpdate = true;
      }

      // --- Act 3: drone scouting, probe, signed reading going down
      if (C.level === 'S') {
        if (S.stage === 6) setStage(7);
        drone.userData.rotors.forEach((r, i) => r.rotation.y += dt * (40 + i));
        drone.userData.light.material.opacity = Math.sin(t * 9) > 0 ? .95 : .25;
        if (S.stage >= 7 && S.mapped.length < HOT.length) {
          const h = HOT[tour[S.mapped.length]], target = pos('S', h[0], h[1], 6);
          const d = target.clone().sub(drone.position), len = d.length();
          if (len < .3) { S.mapped.push(tour[S.mapped.length]); save(); updateSite(); C.blip(1500, .08, 'sine', .06); rerender(); }
          else drone.position.add(d.multiplyScalar(Math.min(1, 6.5 * dt / len)));
          M.droneMsg = `Scouting hotspot ${S.mapped.length + 1} of ${HOT.length}`;
        } else if (S.mapped.length >= HOT.length) { M.droneMsg = `All ${HOT.length} hotspots mapped`; drone.position.y += (C.G.S.z0 + 9 - drone.position.y) * Math.min(1, dt); }
        S.mapped.forEach(i => { hotRings[i].material.opacity = .45 + .15 * Math.sin(t * 3 + i); });
        if (S.stage === 7 && S.mapped.length >= 2 && C.state === 'phone' && phone().state.scr === 'surface') setStage(8);
        if (siteMark.visible) siteMark.userData.col.material.opacity = .45 + .25 * Math.sin(t * 4);
        if (probe.visible) probe.userData.tip.material.opacity = S.sent ? .95 : (Math.sin(t * 6) > 0 ? .95 : .3);
        if (S.sent && probe.visible) {
          M.sendT = (M.sendT || 0) + dt;
          const a = probe.position.clone().setY(C.G.S.z0 + 1.6), b = pos('S', HATCH[0], HATCH[1], .2), mid = a.clone().lerp(b, .5);
          upBeam.position.copy(mid); upBeam.scale.set(1, a.distanceTo(b), 1); upBeam.lookAt(b); upBeam.rotateX(Math.PI / 2);
          upBeam.material.opacity = Math.max(.25, .9 * Math.exp(-M.sendT * .4)) * (.8 + .2 * Math.sin(t * 8));
        }
        M.dose = E.surface.doseMult(HOT, C.P.x, C.P.y);
      }

      // NPC idle: breathe and turn toward the player when close
      for (const n of npcs) {
        const sp = SPEAKERS[n.id]; if (sp.level !== C.level) continue;
        const ud = n.g.userData; ud.torso.scale.y = 1 + Math.sin(t * 1.6 + n.ph) * .012;
        const dx = C.P.x - n.x, dy = C.P.y - n.y, d = Math.hypot(dx, dy);
        const want = d < 4.5 ? Math.atan2(dx, -dy) : n.yaw0;
        let diff = want - n.g.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        n.g.rotation.y += diff * Math.min(1, dt * 3);
        ud.head.rotation.x = Math.sin(t * .7 + n.ph) * .04;
      }
      if (C.level === 'D' && drip.visible) { for (let i = 0; i < dripN; i++) { dripY[i] = (dripY[i] + dt * .9) % 1; dripPos[i * 3] = .55 + Math.sin(i * 7.1) * .02; dripPos[i * 3 + 1] = 2.7 - dripY[i] * dripY[i] * 2.7; dripPos[i * 3 + 2] = .1; } dripGeo.attributes.position.needsUpdate = true; }
      for (const p of pickups) if (p.l === C.level && p.g.visible) { p.mesh.position.y = Math.sin(t * 2 + p.ph) * .03; p.mesh.rotation.y += dt * .4; p.hl.material.opacity = .4 + Math.sin(t * 3 + p.ph) * .15; }

      // objective distance + live phone numbers
      distT -= dt;
      if (distT <= 0) { distT = .25;
        const st = STAGES[Math.min(S.stage, STAGES.length - 1)]; let extra = '';
        const tg = st.target === 'probe' ? (M.site && [M.site.x, M.site.y]) : st.target;
        if (S.stage < 3 && S.applied !== 'str') extra = (M.dark ? 'The Deep is dark' : 'Dark in ' + fmt(M.cd));
        else if (tg && st.where === C.level) extra = Math.round(Math.hypot(C.P.x - tg[0], C.P.y - tg[1])) + ' m';
        else if (st.where && st.where !== C.level) extra = 'use the lift';
        if (S.stage >= 3 && S.stage <= 5 && C.level === 'D') { meshStatus(); extra = (extra ? extra + ' · ' : '') + M.inRange + ' phones in range'; }
        $('objd').textContent = extra;
      }
      liveT -= dt; if (liveT <= 0) { liveT = .25; const p = phone(); if (p) p.refresh(); }

      const cab = C.inCab(); if (cab && !wasCab && C.state === 'play') intercomHint(); wasCab = cab;
    }

    function onLevel(l) {
      if (l === 'S' && S.stage === 6) { toast('STRATA', 'Surface. The Directorate says the air kills in minutes. The probe will say how many.', 5200); }
      if (l === 'S') M.dose = E.surface.doseMult(HOT, C.P.x, C.P.y);
      renderObj(); rerender();
    }
    function onDeath() { S.deaths++; save(); }

    addEventListener('mousedown', e => { if (C.state !== 'play') return; if (busy.note || busy.dlg) { e.preventDefault(); interact(); } });

    // restore world state from a save
    runForecasts(); recomputeLife();
    if (S.stage >= 3) { M.cd = Infinity; }
    if (S.netCut) meshGroup.visible = true;
    if (S.planted && S.probeAt) { probe.position.copy(pos('S', S.probeAt[0], S.probeAt[1], 0)); probe.visible = true; }
    if (S.crew) { M.crew = E.crew(); if (!S.planted) siteMark.visible = true; }
    for (const p of pickups) if (S.flags['got_' + p.id]) p.g.visible = false;
    renderInv(); renderObj();

    // ------------------------------------------------------------ filming hook: jump straight to any stage in a consistent state
    async function jump(n, opts = {}) {
      n = Math.max(0, Math.min(12, n | 0));
      const keep = { notes: S.notes, flags: Object.fromEntries(Object.entries(S.flags).filter(([k]) => k.startsWith('got_'))), played: S.played, deaths: S.deaths };
      S = Object.assign(fresh(), keep);
      S.flags.introBuzz = 1;
      if (n >= 2) S.bypass = true;
      if (n >= 3) { S.applied = 'str'; S.flags.powerAt = S.played - 60; S.flags.supplies = 1; }
      if (n >= 4) S.netCut = true;
      if (n >= 5) S.broadcast = true;
      if (opts.life) S.life = { leak: true, lamps: true, triage: true };
      S.stage = n; M.preview = 'str'; M.dark = false; M.cd = n >= 3 ? Infinity : M.cd0;
      recomputeLife(); leakWorld();
      meshGroup.visible = S.netCut; M.route = null; M.routeT = M.replyT = -1;
      if (n >= 6) {
        const text = 'I’m safe. — Ava, L4 Works · hatch override in your Strata';
        let sigHex = '', ok = false; if (M.keys.ava) { sigHex = await E.sig.sign(M.keys.ava, text); ok = await E.sig.verify(M.keys.ava, text, sigHex); }
        S.ava = { state: 'replied', text, sig: sigHex, ok };
      }
      if (n >= 8) { S.mapped = tour.slice(); updateSite(); }
      if (n >= 9) { S.crew = true; M.crew = E.crew(); }
      if (n >= 10) { S.planted = true; S.probeAt = [M.site.x, M.site.y]; probe.position.copy(pos('S', M.site.x, M.site.y, 0)); probe.visible = true; }
      else probe.visible = false;
      siteMark.visible = n === 9;
      hotRings.forEach((r, i) => r.material.opacity = S.mapped.includes(i) ? .5 : 0);
      if (n >= 11) {
        const m = E.surface.doseMult(HOT, S.probeAt[0], S.probeAt[1]), p = E.surface.protection(m);
        const reading = `probe-07 · ${new Date().toISOString().slice(0, 19)}Z · dose ×${m.toFixed(2)} background · unprotected ${p[0].label} · sealed suit ${p[1].label}`;
        let sigHex = '', ok = false; if (M.keys.probe) { sigHex = await E.sig.sign(M.keys.probe, reading); ok = await E.sig.verify(M.keys.probe, reading, sigHex); }
        S.sent = { reading, sig: sigHex, ok }; M.sendT = 0;
      } else upBeam.material.opacity = 0;
      if (n >= 12) S.ended = true;
      drone.position.copy(pos('S', HATCH[0] + 1.5, HATCH[1] + 1.5, 2.2));
      save();
      const lvl = n >= 7 && n <= 11 ? 'S' : 'D';
      C.respawn(); C.setLevel(lvl);
      if (lvl === 'S') { C.P.x = 0; C.P.y = 1.5; C.P.yaw = Math.PI; }
      if (n >= 3 && n <= 5 && lvl === 'D') { C.P.x = -9; C.P.y = .9; }
      meshStatus(); if (S.broadcast) { M.bcHop = M.hop.slice(); M.bcT = 99; }
      const p = phone(); p.badge(n >= 6 ? 'AVA · SAFE' : n >= 4 ? 'NET CUT · STRATA' : 'STRATA · TAB', n >= 4 && n < 6); p.go(n >= 11 ? 'ret' : n >= 7 ? 'surface' : n >= 4 ? 'mesh' : n >= 2 ? 'share' : 'home');
      renderObj(); renderInv();
      return { stage: S.stage, level: lvl };
    }

    const api = {
      update, interact, canTravel, deny, onLevel, onDeath, newGame, jump,
      busy: () => !!(busy.dlg || busy.note),
      prompt: () => { if (busy.dlg || busy.note) return { n: '', d: '' }; const it = nearestInteractable(); return it ? { n: it.n, d: it.d } : null; },
      radScale: () => 1,
      hasSave: () => S.stage > 0 || S.notes.length > 0,
      model: M,
      act(a, arg) {
        if (a === 'bypass') actBypass();
        else if (a === 'preview') { M.preview = arg; rerender(); }
        else if (a === 'apply') actApply(arg);
        else if (a === 'broadcast') actBroadcast();
        else if (a === 'ava') actAva();
        else if (a === 'crew') actCrew();
        else if (a === 'sign') actSign();
        else if (a === 'finish') { if (S.stage >= 11 && !S.ended) ending(); }
        else if (a === 'mesh') meshStatus();
        else if (a === 'fixleak') actLife('leak');
        else if (a === 'lamps') actLife('lamps');
        else if (a === 'triage') actLife('triage');
      },
    };
    if (window.StrataApp && phone()) phone().use(window.StrataApp(api, C));
    return api;
  };
})();
