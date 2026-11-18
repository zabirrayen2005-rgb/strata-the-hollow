// Strata — story layer: objectives, inventory, characters, notes, beacon, ending, save.
// Loaded before game.js; game.js calls window.StoryInit(ctx) once the world is built.
// World coordinates: (x, y) on the floor plan, three.js position = (x, z0 + height, -y).
(function () {
  'use strict';

  const SAVE_KEY = 'strata_save_v1';
  const TRANSMIT_SECONDS = 6;
  const SHIELD_SCALE = 0.7;                       // rad-shield: radiation drains at 70% speed (~7 min of air)
  const SELF_LIT = { D: .12, R: .22, S: .1 };     // fake bounce light for added props/people (world uses baked lightmaps)

  // ------------------------------------------------------------ objectives
  // stage 0..7. Each stage has the text shown in the objective tracker.
  const STAGES = [
    { text: 'Collect your ration at Food pickup', where: 'D', target: [13.4, 0] },
    { text: 'Trade your ration for a rad-shield at the Clinic', where: 'D', target: [0, 13.4] },
    { text: 'Take the lift up to the Director level (press 2)', where: 'D', target: [0, 0] },
    { text: 'Search the apartments for the surface keycard', where: 'R', target: null },
    { text: 'Ride to the surface (press 3) and find the signal beacon', where: 'S', target: [0, 40.5] },
    { text: 'Hold E at the beacon to transmit the Director’s logs', where: 'S', target: [0, 40.5] },
    { text: 'Get back to the lift and return to the Deep (press 1)', where: 'S', target: [0, 0] },
    { text: 'Free roam — the Hollow knows the truth', where: null, target: null },
  ];

  // ------------------------------------------------------------ notes (collectible lore)
  const NOTES = {
    ticket: { title: 'Queue ticket #4471', level: 'D', at: [-6.4, 2.1], h: 0.05,
      body: 'BATHROOM ACCESS — BLOCK NINE\n\nTicket #4471. Estimated wait: 38 minutes.\nWater rationed. Two minutes per resident.\n\nScrawled on the back in pencil:\n“They say the Directors have a bathroom each. A whole room. For one person.”' },
    gala: { title: 'Gala menu card', level: 'R', at: [-13.6, 4.0], h: 0.5,
      body: 'DIRECTORATE WINTER GALA\n\nChilled orange soup\nRoast vault-grown duck, fresh herbs\nChocolate from the hydroponic reserve\n\nStaff note: Do not mention the orange vault to anyone from below. Rations in the Deep remain unchanged.' },
    memo: { title: 'Air quality memo — CONFIDENTIAL', level: 'R', at: [8.4, 4.0], h: 0.5,
      body: 'TO: The Directorate\nRE: Eastern basin readings\n\nSurface radiation in the eastern basin has fallen below lethal levels for the fourteenth month in a row. With filtration, a settlement there is possible within two years.\n\nRecommendation: say nothing. A frightened Deep is a quiet Deep.\n\n— Office of the Surface Director' },
    log: { title: 'Surface Director’s log', level: 'R', at: null, h: 0,
      body: 'Day 4,112.\n\nThe beacon relay at the end of the old street still works. It is wired to every public screen in the Deep — we built it for evacuation orders, back when we meant to evacuate.\n\nIf anyone reached it and pressed transmit, two billion people would read these logs, the air memo, all of it, in the same minute.\n\nSo: the keycard stays with me. The lift to the surface stays locked.' },
  };
  const NOTE_IDS = ['ticket', 'gala', 'memo', 'log'];

  // ------------------------------------------------------------ dialogue
  // Each speaker returns lines for the current stage; `after` runs once the last line closes.
  const SPEAKERS = {
    clerk: { name: 'Ration clerk', level: 'D', at: [13.4, 0], r: 2.4, label: 'Ration window' },
    medic: { name: 'Medic', level: 'D', at: [0, 13.4], r: 2.4, label: 'Clinic window' },
    ines: { name: 'Ines', level: 'D', at: [-6.6, 0.05], r: 1.7, label: 'Waiting in the bathroom queue' },
    teo: { name: 'Teo', level: 'R', at: [4.6, 0.9], r: 2.0, label: 'Housekeeper' },
  };

  window.StoryInit = function (C) {
    const THREE = C.THREE, $ = C.$;
    let S = load() || fresh();
    const busy = { dlg: null, note: null };

    function fresh() { return { stage: 0, inv: [], notes: [], flags: {}, deaths: 0, played: 0, ended: false }; }
    function load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && typeof s.stage === 'number' ? s : null; } catch (e) { return null; } }
    function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
    const has = it => S.inv.includes(it);
    const give = it => { if (!has(it)) S.inv.push(it); renderInv(); save(); };
    const take = it => { S.inv = S.inv.filter(x => x !== it); renderInv(); save(); };
    function setStage(n) { if (n <= S.stage) return; S.stage = n; save(); renderObj(); C.blip(660, .18, 'triangle', .12); C.blip(990, .3, 'triangle', .1, .12); }

    // ------------------------------------------------------------ HUD
    const ITEM = { ration: 'Ration', shield: 'Rad-shield', keycard: 'Surface keycard' };
    function renderInv() {
      const chips = S.inv.map(i => `<span class="chip">${ITEM[i] || i}</span>`);
      chips.push(`<span class="chip dim">Notes ${S.notes.length}/${NOTE_IDS.length}</span>`);
      $('inv').innerHTML = chips.join('');
    }
    function renderObj() {
      const st = STAGES[Math.min(S.stage, STAGES.length - 1)];
      $('objt').textContent = st.text;
    }
    let toastT = null;
    function toast(who, text, ms = 4200) {
      const el = $('toast'); el.innerHTML = (who ? `<b>${who}</b> ` : '') + text; el.style.opacity = 1;
      clearTimeout(toastT); toastT = setTimeout(() => el.style.opacity = 0, ms);
    }
    function buzz() { C.blip(140, .25, 'square', .08); C.blip(110, .3, 'square', .07, .12); }

    // ------------------------------------------------------------ 3D helpers (low-poly to match the world)
    const pos = (l, x, y, h) => new THREE.Vector3(x, C.G[l].z0 + h, -y);
    function stdMat(l, color, rough = .85, emissive = 0, emI = 0) {
      const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: true });
      m.envMap = C.ENV[l]; m.envMapIntensity = 1.15;
      if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emI; }
      else { m.emissive = new THREE.Color(color); m.emissiveIntensity = SELF_LIT[l]; }
      m.color.convertSRGBToLinear(); m.emissive.convertSRGBToLinear();   // world colours are authored in sRGB
      return m;
    }
    function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
    function halo(color, size, opacity) {
      const m = new THREE.SpriteMaterial({ map: C.GLOW, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, fog: true });
      const s = new THREE.Sprite(m); s.scale.setScalar(size); return s;
    }
    function blobShadow(l) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(.38, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .35, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = .01; return m;
    }
    // A blocky person: jacket colour, trousers colour, skin, hair.
    function person(l, c) {
      const g = new THREE.Group();
      const jacket = stdMat(l, c.jacket), pants = stdMat(l, c.pants), skin = stdMat(l, c.skin, .7), hair = stdMat(l, c.hair, .9);
      g.add(box(.16, .8, .2, pants, -.1, .4, 0), box(.16, .8, .2, pants, .1, .4, 0));
      const torso = box(.48, .62, .28, jacket, 0, 1.12, 0); g.add(torso);
      g.add(box(.13, .58, .16, jacket, -.31, 1.1, 0), box(.13, .58, .16, jacket, .31, 1.1, 0));
      const head = new THREE.Group(); head.position.set(0, 1.56, 0);
      head.add(box(.26, .28, .26, skin, 0, 0, 0), box(.28, .1, .28, hair, 0, .15, 0), box(.28, .2, .06, hair, 0, .04, -.13));
      if (c.cap) head.add(box(.3, .06, .3, stdMat(l, c.cap), 0, .2, 0));
      g.add(head); g.add(blobShadow(l));
      g.userData = { head, torso };
      return g;
    }

    // ------------------------------------------------------------ build the cast
    const npcs = [];
    function addNPC(id, look, x, y, faceYaw, solid = true) {
      const sp = SPEAKERS[id]; const g = person(sp.level, look);
      g.position.copy(pos(sp.level, x, y, 0)); g.rotation.y = faceYaw;
      C.extras[sp.level].add(g);
      if (solid) C.G[sp.level].circles.push([x, y, .3]);
      npcs.push({ id, g, x, y, yaw0: faceYaw, ph: Math.random() * 10 });
    }
    // The medic and the ration clerk are already modelled behind their windows; they speak from there.
    addNPC('ines', { jacket: 0x5a3434, pants: 0x2e2a28, skin: 0xb98a6a, hair: 0x8f8a82 }, -6.25, 0.05, -Math.PI / 2);
    addNPC('teo', { jacket: 0x23262c, pants: 0x1b1d22, skin: 0x8e5b3e, hair: 0x0f0d0c }, 4.6, 0.95, -Math.PI / 2);

    // ------------------------------------------------------------ pickups
    const pickups = [];
    function addPickup(id, l, x, y, h, mesh, glowColor, kind) {
      const g = new THREE.Group(); g.position.copy(pos(l, x, y, h)); g.add(mesh);
      const hl = halo(glowColor, .9, .55); g.add(hl);
      C.extras[l].add(g);
      pickups.push({ id, l, x, y, h, g, mesh, hl, kind, ph: Math.random() * 6 });
    }
    function paper(l) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.26, .34), stdMat(l, 0xf1ead8, .9, 0xf1ead8, .35)); m.rotation.x = -Math.PI / 2; return m; }
    for (const id of NOTE_IDS) { const n = NOTES[id]; if (n.at) addPickup('note_' + id, n.level, n.at[0], n.at[1], n.h + .06, paper(n.level), 0xfff2c8, 'note'); }
    { const card = new THREE.Group(); card.add(box(.3, .02, .19, stdMat('R', 0xd9a557, .4, 0xf2b45a, .9), 0, 0, 0), box(.08, .025, .06, stdMat('R', 0x222222, .4), -.07, 0, 0));
      addPickup('keycard', 'R', 12.45, -9.32, .72, card, 0xf2b45a, 'keycard'); }

    // ------------------------------------------------------------ the beacon (surface)
    const BEACON = [0, 40.5];
    const beacon = new THREE.Group(); beacon.position.copy(pos('S', BEACON[0], BEACON[1], 0));
    const rust = stdMat('S', 0x6d5a48, .8), dark = stdMat('S', 0x2b2d2c, .6);
    beacon.add(box(1.4, .3, 1.4, dark, 0, .15, 0), box(.22, 4.4, .22, rust, 0, 2.5, 0), box(.9, .7, .5, rust, 0, 1.25, .3), box(.6, .35, .05, stdMat('S', 0x101410, .3, 0x3cff6a, .6), 0, 1.35, .56));
    beacon.add(box(1.6, .08, .08, rust, 0, 4.2, 0), box(.08, .08, 1.6, rust, 0, 4.0, 0));
    const lampMat = stdMat('S', 0x501010, .4, 0xff2a1a, 2.2); beacon.add(box(.24, .24, .24, lampMat, 0, 4.85, 0));
    const beaconHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: C.GLOW, color: 0xff3020, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .9, fog: false }));
    beaconHalo.scale.setScalar(5); beaconHalo.position.y = 4.85; beacon.add(beaconHalo);
    C.extras.S.add(beacon); C.G.S.circles.push([BEACON[0], BEACON[1] + .2, .75]);
    let transmit = 0;

    // ------------------------------------------------------------ dialogue scripts
    function linesFor(id) {
      const st = S.stage, end = S.ended;
      if (id === 'clerk') {
        if (end) return { lines: ['You’re the one from the broadcast? ...Take an extra ration. Nobody’s counting anymore.'] };
        if (st === 0) return { lines: ['Name and block?', '...Block nine. One ration. Don’t lose it — there won’t be another until the bell.'], after: () => { give('ration'); setStage(1); toast('', 'Ration added to inventory'); } };
        return { lines: ['One per resident. Next.'] };
      }
      if (id === 'medic') {
        if (end) return { lines: ['Every screen down here is showing that memo. Fourteen months of clean air in the east...', 'Whatever happens next — thank you.'] };
        if (st === 0) return { lines: ['Clinic’s for paying residents. Pick up your ration first, then come back.'] };
        if (st === 1 && has('ration')) return { lines: ['You want to ride the lift? The lift scans everyone for a rad-shield before it moves.', 'Shots cost a ration. The rules aren’t mine.', '...Hold still. There. That’s your clearance — and it slows the burn if you ever go up top.'], after: () => { take('ration'); give('shield'); setStage(2); toast('', 'Rad-shield: surface radiation drains you slower'); } };
        return { lines: ['The shield’s in your blood now. Go.'] };
      }
      if (id === 'ines') {
        if (end) return { lines: ['The screens... you did that? My grandmother would have cried.', 'Maybe one day I’ll see the sky without dying of it.'] };
        if (st <= 2) return { lines: ['Forty minutes for the bathroom. Upstairs they have one each, I hear.', 'My grandmother rode that lift once. She said the Director level smells like oranges.', 'If you’re going up, get clinic clearance. The lift won’t move without it.'] };
        return { lines: ['You went up? What’s it like? ...No, don’t tell me. I’ll only want it.'] };
      }
      if (id === 'teo') {
        if (end) return { lines: ['They’re all in Apartment 01 shouting at each other. First time I’ve smiled in years.'] };
        if (st < 3) return { lines: ['You shouldn’t be up here.'] };
        if (!has('keycard') && st === 3) return { lines: ['You’re not on the list. ...Relax. I won’t call anyone.', 'You want the surface keycard? Apartment 07, east wing. The Surface Director keeps it on his nightstand.', 'And if you’re reading things — check the coffee tables. They leave everything lying around.', 'Be quick. They’re all at the gala.'], after: () => { S.flags.teo = 1; save(); } };
        return { lines: ['The beacon is at the far end of the old street. Five minutes of air up there. Less if you stop to look around.'] };
      }
      return { lines: ['...'] };
    }

    function openDialogue(id) {
      const sp = SPEAKERS[id], d = linesFor(id);
      busy.dlg = { id, name: sp.name, lines: d.lines, i: 0, after: d.after };
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
      if (d.i >= d.lines.length) { $('dlg').style.display = 'none'; busy.dlg = null; if (d.after) d.after(); return; }
      showLine();
    }
    function openNote(id) {
      const n = NOTES[id]; busy.note = id;
      $('notet').textContent = n.title; $('noteb').textContent = n.body; $('note').style.display = 'flex';
      C.burst(1800, .8, .25, .12);
    }
    function closeNote() { $('note').style.display = 'none'; const id = busy.note; busy.note = null; if (id === 'log') setStage(4); }
    function collectNote(id) { if (!S.notes.includes(id)) { S.notes.push(id); save(); renderInv(); } openNote(id); }

    // ------------------------------------------------------------ interactions
    function nearestInteractable() {
      const l = C.level, P = C.P; let best = null, bd = 1e9;
      for (const id in SPEAKERS) { const sp = SPEAKERS[id]; if (sp.level !== l) continue;
        const d = Math.hypot(P.x - sp.at[0], P.y - sp.at[1]); if (d < sp.r && d < bd) { bd = d; best = { type: 'talk', id, n: 'E · Talk to ' + sp.name, d: sp.label }; } }
      for (const p of pickups) { if (p.l !== l || S.flags['got_' + p.id]) continue;
        const d = Math.hypot(P.x - p.x, P.y - p.y); const r = p.kind === 'keycard' ? 1.7 : 1.5;
        if (d < r && d < bd + .6) { bd = d; best = { type: 'pick', p, n: p.kind === 'keycard' ? 'E · Take the keycard' : 'E · Read', d: p.kind === 'keycard' ? 'Surface access — Directorate only' : NOTES[p.id.slice(5)].title }; } }
      if (l === 'S' && S.stage >= 4 && S.stage <= 5) {
        const d = Math.hypot(P.x - BEACON[0], P.y - BEACON[1]);
        if (d < 2.6) best = { type: 'beacon', n: 'Hold E · Transmit', d: transmit > 0 ? 'Transmitting ' + Math.round(transmit / TRANSMIT_SECONDS * 100) + '% — keep holding' : 'Beacon relay — wired to every screen in the Deep' };
      }
      return best;
    }
    function interact() {
      if (busy.note) { closeNote(); return; }
      if (busy.dlg) { advanceDialogue(); return; }
      const it = nearestInteractable(); if (!it) return;
      if (it.type === 'talk') openDialogue(it.id);
      else if (it.type === 'pick') {
        const p = it.p; S.flags['got_' + p.id] = 1; p.g.visible = false; save();
        if (p.kind === 'keycard') { give('keycard'); C.ding(); collectNote('log'); }
        else collectNote(p.id.slice(5));
      }
    }

    // ------------------------------------------------------------ lift rules
    function canTravel(to) {
      if (S.ended) return null;
      if (to === 'R' && !has('shield')) return 'Lift locked. Clinic clearance required — get a rad-shield at the Clinic.';
      if (to === 'S' && !has('keycard')) return 'Surface access requires a Directorate keycard.';
      return null;
    }
    function deny(msg) { buzz(); toast('INTERCOM', msg, 4600); }
    function intercomHint() {
      const k = 'ic' + S.stage + C.level; if (S.flags[k]) return; S.flags[k] = 1;
      const H = {
        0: 'Welcome, resident. Lift travel requires clinic clearance.',
        1: 'Lift travel requires clinic clearance. Visit the Clinic.',
        2: 'Clearance confirmed. Director level: press 2.',
        3: 'Director level. Residents are reminded that the gala is by invitation only.',
        4: 'Surface keycard accepted. Surface: press 3. Exposure limit: five minutes.',
        5: 'Surface: press 3. Exposure limit: five minutes.',
        6: 'Broadcast detected on all screens. ...Lift override. Deep: press 1.',
      };
      const h = H[Math.min(S.stage, 6)]; if (h && !S.ended) toast('INTERCOM', h, 5200);
    }

    // ------------------------------------------------------------ ending
    function fmt(s) { s = Math.round(s); const m = s / 60 | 0; return m + ':' + String(s % 60).padStart(2, '0'); }
    async function ending() {
      S.ended = true; setStage(7); save();
      C.setState('end'); C.unlock(); busy.dlg = null; $('dlg').style.display = 'none';
      await C.fade(1, 1400);
      $('endstats').textContent = `Time played ${fmt(S.played)}  ·  Deaths ${S.deaths}  ·  Notes found ${S.notes.length}/${NOTE_IDS.length}`;
      $('end').style.display = 'flex';
      C.blip(523, 2.5, 'sine', .1); C.blip(659, 2.5, 'sine', .08, .4); C.blip(784, 3, 'sine', .07, .8);
    }
    $('endgo').addEventListener('click', async e => {
      e.stopPropagation(); $('end').style.display = 'none'; C.setState('play'); C.lock(); await C.fade(0, 900);
      toast('', 'Free roam. The lift goes anywhere now.');
    });
    $('endnew').addEventListener('click', e => { e.stopPropagation(); $('end').style.display = 'none'; newGame(); C.setState('play'); C.lock(); C.fade(0, 900); });

    function newGame() {
      S = fresh(); save(); transmit = 0;
      for (const p of pickups) p.g.visible = true;
      C.respawn(); C.setLevel('D'); renderInv(); renderObj(); setBeacon(false);
    }
    function setBeacon(done) { lampMat.emissive.setHex(done ? 0x30ff60 : 0xff2a1a); beaconHalo.material.color.setHex(done ? 0x40ff70 : 0xff3020); }

    // ------------------------------------------------------------ per-frame
    let wasCab = false, distT = 0;
    function update(dt, t) {
      if (C.state === 'play') S.played += dt;
      // NPC idle: breathe and turn toward the player when close
      for (const n of npcs) {
        const sp = SPEAKERS[n.id]; if (sp.level !== C.level) continue;
        const ud = n.g.userData; ud.torso.scale.y = 1 + Math.sin(t * 1.6 + n.ph) * .012;
        const dx = C.P.x - n.x, dy = C.P.y - n.y, d = Math.hypot(dx, dy);
        const want = d < 4.5 ? Math.atan2(dx, -dy) : n.yaw0;      // three.js yaw to look toward player
        let diff = want - n.g.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        n.g.rotation.y += diff * Math.min(1, dt * 3);
        ud.head.rotation.x = Math.sin(t * .7 + n.ph) * .04;
      }
      for (const p of pickups) if (p.l === C.level && p.g.visible) {
        p.mesh.position.y = Math.sin(t * 2 + p.ph) * .03; p.mesh.rotation.y += dt * (p.kind === 'keycard' ? 1.2 : .4);
        p.hl.material.opacity = .4 + Math.sin(t * 3 + p.ph) * .15;
      }
      // beacon blink + transmit
      if (C.level === 'S') {
        const on = S.stage >= 6 ? 1 : (Math.sin(t * 5) > 0 ? 1 : .25);
        beaconHalo.material.opacity = .9 * on; lampMat.emissiveIntensity = 2.2 * on;
        if (S.stage === 4 && Math.hypot(C.P.x - BEACON[0], C.P.y - BEACON[1]) < 6) setStage(5);
        const near = Math.hypot(C.P.x - BEACON[0], C.P.y - BEACON[1]) < 2.6;
        if (S.stage >= 4 && S.stage <= 5 && near && C.key.KeyE && C.state === 'play' && !busy.dlg && !busy.note) {
          if (S.stage === 4) setStage(5);
          transmit += dt; if (Math.random() < dt * 14) C.blip(1200 + Math.random() * 900, .05, 'square', .04);
          if (transmit >= TRANSMIT_SECONDS) { transmit = 0; setStage(6); setBeacon(true); C.ding(); toast('BEACON', 'Transmitting on every screen in the Deep. Get back to the lift — now.', 6000); }
        } else if (transmit > 0) transmit = Math.max(0, transmit - dt * 2);
      }
      // objective distance readout
      distT -= dt;
      if (distT <= 0) { distT = .25;
        const st = STAGES[Math.min(S.stage, STAGES.length - 1)]; let extra = '';
        if (st.target && st.where === C.level) extra = Math.round(Math.hypot(C.P.x - st.target[0], C.P.y - st.target[1])) + ' m';
        else if (st.where && st.where !== C.level && S.stage < 7) extra = 'use the lift';
        $('objd').textContent = extra;
      }
      if (C.level === 'D' && S.stage === 6 && !S.ended && C.state === 'play' && !C.travelling) ending();
      // intercom when stepping into the lift
      const cab = C.inCab(); if (cab && !wasCab && C.state === 'play') intercomHint(); wasCab = cab;
    }

    function onLevel(l) {
      if (l === 'S' && S.stage === 4) toast('', 'Follow the road. Look for the red light.', 4000);
      if (l === 'R' && S.stage === 2) setStage(3);
      renderObj();
    }
    function onDeath() { S.deaths++; transmit = 0; save(); }

    // close dialogue / notes with a click as well
    addEventListener('mousedown', e => { if (C.state !== 'play') return; if (busy.note || busy.dlg) { e.preventDefault(); interact(); } });

    renderInv(); renderObj();
    for (const p of pickups) if (S.flags['got_' + p.id]) p.g.visible = false;
    if (S.stage >= 6) setBeacon(true);

    return {
      update, interact, canTravel, deny, onLevel, onDeath, newGame,
      busy: () => !!(busy.dlg || busy.note),
      prompt: () => { if (busy.dlg || busy.note) return { n: '', d: '' }; const it = nearestInteractable(); return it ? { n: it.n, d: it.d } : null; },
      radScale: () => has('shield') ? SHIELD_SCALE : 1,
      hasSave: () => S.stage > 0 || S.notes.length > 0,
    };
  };
})();
