// Strata engines: the real computation behind every phone screen.
//   forecast()   Monte Carlo blackout forecast (500 runs of the geothermal grid)
//   allocate()   fair allocation with a survival minimum, vs. the Directorate's top-down split
//   mesh         resident phone mesh: graph, flood broadcast (BFS), best route (Dijkstra)
//   sig          ECDSA P-256 signing and verification (WebCrypto)
//   surface      dose model, protection options, safest probe site
//   crew()       who goes first: scored, skill-balanced crew selection
//   returnPlan() waves through the single lift
//   twin()       Azure Digital Twins-style graph (DTDL) of the Hollow, built from the level data
// No network calls: everything runs in the browser.
(function () {
  'use strict';

  // ------------------------------------------------------------ seeded RNG + normal samples
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  // ------------------------------------------------------------ the grid
  // Six levels of the Hollow (top to bottom). Demand in MW, population in residents.
  const LEVELS = [
    { id: 'L1', name: 'L1 Ring', demand: 22, pop: 6200 },
    { id: 'L2', name: 'L2 Market', demand: 20, pop: 7400 },
    { id: 'L3', name: 'L3 Farms', demand: 21, pop: 6900 },
    { id: 'L4', name: 'L4 Works', demand: 19, pop: 8100 },
    { id: 'L5', name: 'L5 Warrens', demand: 18, pop: 9300 },
    { id: 'L6', name: 'L6 Deep', demand: 20, pop: 10100 },
  ];
  const FEEDS = [
    { id: 'F1', name: 'Feed 1', cap: 40, temp: 71, trip: 100 },
    { id: 'F2', name: 'Feed 2', cap: 38, temp: 74, trip: 100 },
    { id: 'F3', name: 'Feed 3', cap: 42, temp: 86, trip: 100 },
  ];
  const SURVIVAL = 0.55;          // share of a level's demand that keeps air pumps, cooling and the lift alive
  const DEEP = 5;                 // index of the Deep in LEVELS

  // ------------------------------------------------------------ allocation
  // Strata: every level gets its survival minimum first (scaled down evenly if even that can't be met),
  // then the remainder is water-filled by unmet need. Directorate: top level first, full demand, until it runs out.
  function allocate(total, mode, levels = LEVELS) {
    const n = levels.length, out = new Array(n).fill(0);
    if (mode === 'dir') {
      let left = total;
      for (let i = 0; i < n; i++) { out[i] = Math.min(levels[i].demand, left); left -= out[i]; }
    } else {
      const mins = levels.map(l => l.demand * SURVIVAL), sumMin = mins.reduce((a, b) => a + b, 0);
      if (total <= sumMin) { for (let i = 0; i < n; i++) out[i] = mins[i] * total / sumMin; }
      else {
        for (let i = 0; i < n; i++) out[i] = mins[i];
        let left = total - sumMin;
        for (let guard = 0; guard < 12 && left > 1e-6; guard++) {          // water-fill the remaining need
          const open = []; for (let i = 0; i < n; i++) if (levels[i].demand - out[i] > 1e-6) open.push(i);
          if (!open.length) break;
          const need = open.reduce((a, i) => a + levels[i].demand - out[i], 0);
          let used = 0;
          for (const i of open) { const give = Math.min(levels[i].demand - out[i], left * (levels[i].demand - out[i]) / need); out[i] += give; used += give; }
          left -= used;
        }
      }
    }
    return levels.map((l, i) => ({ id: l.id, name: l.name, mw: out[i], share: out[i] / total, ofDemand: out[i] / l.demand, belowMin: out[i] < l.demand * SURVIVAL - 1e-6 }));
  }

  // ------------------------------------------------------------ Monte Carlo blackout forecast
  // Each run walks the three feeds forward second by second for `horizon` seconds.
  // Feed 3's temperature drifts with a per-run trend; at 100 °C it trips. Feeds 1 and 2 wobble and can sag.
  // The Deep "goes dark" when its allocated power falls below its survival minimum.
  function forecast({ runs = 500, horizon = 360, seed = 1, bypass3 = false, mode = 'dir', dt = 2, keep = 40 } = {}) {
    const r = rng(seed), deepMin = LEVELS[DEEP].demand * SURVIVAL;
    let dark = 0; const darkT = []; const fan = []; const sumCurve = new Float64Array(Math.floor(horizon / dt) + 1);
    for (let k = 0; k < runs; k++) {
      let t3 = FEEDS[2].temp, trip3 = bypass3;
      const drift = .12 + gauss(r) * .048;                       // °C per second for feed 3
      let s1 = FEEDS[0].cap, s2 = FEEDS[1].cap, wentDark = -1;
      const curve = k < keep ? [] : null;
      for (let step = 0, t = 0; t <= horizon; step++, t += dt) {
        if (!trip3) { t3 += drift * dt + gauss(r) * .22; if (t3 >= FEEDS[2].trip) trip3 = true; }
        s1 = Math.max(0, Math.min(FEEDS[0].cap, s1 + gauss(r) * .5 + (FEEDS[0].cap - s1) * .08));
        s2 = Math.max(0, Math.min(FEEDS[1].cap, s2 + gauss(r) * .5 + (FEEDS[1].cap - s2) * .08));
        if (r() < .000018 * dt) s1 *= .7;                        // rare sag on feed 1/2
        if (r() < .000018 * dt) s2 *= .7;
        const total = s1 + s2 + (trip3 ? 0 : FEEDS[2].cap);
        const deep = allocate(total, mode)[DEEP].mw;
        const pct = Math.min(1, deep / LEVELS[DEEP].demand);
        sumCurve[step] += pct;
        if (curve) curve.push(pct);
        if (wentDark < 0 && deep < deepMin - 1e-6) wentDark = t;
      }
      if (wentDark >= 0) { dark++; darkT.push(wentDark); }
      if (curve) fan.push(curve);
    }
    darkT.sort((a, b) => a - b);
    const median = darkT.length ? darkT[Math.floor(darkT.length / 2)] : null;
    return { runs, horizon, dt, dark, pDark: dark / runs, median, p10: darkT.length ? darkT[Math.floor(darkT.length * .1)] : null,
      fan, mean: Array.from(sumCurve, v => v / runs), deepMin: SURVIVAL, bypass3, mode };
  }

  // ------------------------------------------------------------ resident mesh
  // nodes: [{x, y, kind}] ; links between phones within `range` metres.
  function meshBuild(nodes, range = 3.4) {
    const adj = nodes.map(() => []), links = [];
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (d <= range) { adj[i].push([j, d]); adj[j].push([i, d]); links.push([i, j, d]); }
    }
    return { nodes, adj, links, range };
  }
  // Flood broadcast: every phone forwards once. Returns the hop layer of each node (-1 = unreachable).
  function meshFlood(g, src) {
    const hop = new Array(g.nodes.length).fill(-1); hop[src] = 0; const q = [src];
    while (q.length) { const a = q.shift(); for (const [b] of g.adj[a]) if (hop[b] < 0) { hop[b] = hop[a] + 1; q.push(b); } }
    return hop;
  }
  // Best route: Dijkstra, cost grows faster than distance (weak long links are expensive).
  function meshRoute(g, src, dst) {
    const n = g.nodes.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
    dist[src] = 0;
    for (;;) {
      let a = -1, best = Infinity; for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; a = i; }
      if (a < 0 || a === dst) break; done[a] = true;
      for (const [b, d] of g.adj[a]) { const c = dist[a] + .4 + Math.pow(d / g.range, 2) * 2; if (c < dist[b]) { dist[b] = c; prev[b] = a; } }
    }
    if (!isFinite(dist[dst])) return null;
    const path = []; for (let v = dst; v >= 0; v = prev[v]) path.unshift(v);
    return { path, cost: dist[dst] };
  }

  // ------------------------------------------------------------ ECDSA P-256
  const enc = new TextEncoder();
  const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  const sig = {
    ok: !!(window.crypto && crypto.subtle),
    async keypair() { return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']); },
    async sign(key, text) { return hex(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key.privateKey, enc.encode(text))); },
    async verify(key, text, sigHex) {
      const b = new Uint8Array(sigHex.match(/../g).map(h => parseInt(h, 16)));
      return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key.publicKey, b, enc.encode(text));
    },
    async fingerprint(key) { const raw = await crypto.subtle.exportKey('raw', key.publicKey); return hex(await crypto.subtle.digest('SHA-256', raw)).slice(0, 16); },
  };

  // ------------------------------------------------------------ surface
  // Exposure multiplier at a point (same model the game uses to drain health). 1 = background.
  function doseMult(hotspots, x, y) {
    let m = 1; for (const h of hotspots) { const d = Math.hypot(x - h[0], y - h[1]), r = h[2] * 2.2; if (d < r) m += 3.2 * h[3] * Math.pow(1 - d / r, 1.5); }
    return m;
  }
  const BASE_SECONDS = 300;          // unprotected at background radiation: 5 minutes to the limit
  const OPTIONS = [
    { id: 'none', name: 'No protection', factor: 1, ready: 'now', cap: '—' },
    { id: 'suit', name: 'Sealed suit', factor: 72, ready: 'now · 40 suits', cap: '1 person' },
    { id: 'dome', name: 'Sealed dome', factor: 3000, ready: '8 days to build', cap: '120 people' },
    { id: 'outpost', name: 'Buried outpost', factor: 20000, ready: '30 days to dig', cap: '1,000 people' },
  ];
  function fmtDur(s) {
    if (s < 90) return Math.round(s) + ' s'; if (s < 5400) return Math.round(s / 60) + ' min';
    if (s < 172800) return (s / 3600).toFixed(s < 36000 ? 1 : 0).replace(/\.0$/, '') + ' h'; return Math.round(s / 86400) + ' days';
  }
  function protection(mult) { return OPTIONS.map(o => ({ ...o, seconds: BASE_SECONDS * o.factor / mult, label: fmtDur(BASE_SECONDS * o.factor / mult) })); }
  // Safest site for the probe: lowest exposure within `radius` of the hatch, among the hotspots mapped so far.
  function probeSite(mapped, hatch = [0, -2.6], radius = 16, blocked = () => false) {
    let best = null;
    for (let a = 0; a < 48; a++) for (let rr = 6; rr <= radius; rr += 2) {
      const x = hatch[0] + Math.cos(a / 48 * Math.PI * 2) * rr, y = hatch[1] + Math.sin(a / 48 * Math.PI * 2) * rr;
      if (blocked(x, y)) continue;
      const m = doseMult(mapped, x, y) + rr * .002;
      if (!best || m < best.m) best = { x, y, m };
    }
    return best;
  }
  // Drone tour: nearest neighbour from the hatch.
  function droneTour(hotspots, start = [0, -2.6]) {
    const left = hotspots.map((h, i) => i), tour = []; let cur = start;
    while (left.length) { left.sort((a, b) => Math.hypot(hotspots[a][0] - cur[0], hotspots[a][1] - cur[1]) - Math.hypot(hotspots[b][0] - cur[0], hotspots[b][1] - cur[1])); const i = left.shift(); tour.push(i); cur = hotspots[i]; }
    return tour;
  }

  // ------------------------------------------------------------ who goes first (#14)
  const FIRST = ['Mara', 'Ava', 'Teo', 'Ines', 'Rui', 'Noor', 'Sana', 'Jonah', 'Lea', 'Omar', 'Kit', 'Yara', 'Bo', 'Femi', 'Ilse', 'Dov', 'Mina', 'Caz', 'Lev', 'Tova', 'Ama', 'Ren', 'Zia', 'Hal'];
  const SKILLS = ['engineer', 'medic', 'scout'];
  function volunteers(seed = 2087, n = 60) {
    const r = rng(seed), out = [];
    for (let i = 0; i < n; i++) out.push({
      id: 'V' + String(i + 1).padStart(3, '0'), name: FIRST[Math.floor(r() * FIRST.length)] + ' ' + String.fromCharCode(65 + Math.floor(r() * 26)) + '.',
      level: 'L' + (1 + Math.floor(r() * 6)), lungs: Math.round(55 + r() * 45), age: Math.round(19 + r() * 40),
      skill: SKILLS[Math.floor(r() * 3)], dependents: Math.floor(r() * r() * 4),
    });
    return out;
  }
  // Greedy, skill-balanced: fill the quotas with the best-scoring people first, then the best of the rest.
  function crew(vols = volunteers(), size = 12, quota = { engineer: 3, medic: 2, scout: 4 }) {
    const score = v => .5 * v.lungs + 18 * Math.exp(-Math.pow((v.age - 32) / 11, 2)) - 7 * v.dependents;
    const ranked = vols.map(v => ({ ...v, score: Math.round(score(v)) })).sort((a, b) => b.score - a.score);
    const pick = [], need = { ...quota };
    for (const v of ranked) if (need[v.skill] > 0 && pick.length < size) { pick.push(v); need[v.skill]--; }
    for (const v of ranked) if (pick.length < size && !pick.includes(v)) pick.push(v);
    return { pick: pick.sort((a, b) => b.score - a.score), considered: vols.length, quota };
  }

  // ------------------------------------------------------------ return plan (#15)
  // Waves through one lift. Order by need: scouts, builders, then the Deep upwards (the opposite of the Directorate).
  function returnPlan(liftPerDay = 960, levels = LEVELS) {
    const waves = [{ n: 1, name: 'Scout crew', who: '12 volunteers in sealed suits', people: 12, color: '#c27bff' },
      { n: 2, name: 'Outpost builders', who: '120 people raise the first sealed domes', people: 120, color: '#5fd0ff' }];
    const lower = levels.slice(4).reverse(), upper = levels.slice(0, 4).reverse();
    waves.push({ n: 3, name: 'The Deep goes first', who: lower.map(l => l.name).join(' and ') + ', the worst off', people: lower.reduce((a, l) => a + l.pop, 0), color: '#3ddc97' });
    waves.push({ n: 4, name: 'Everyone else', who: upper.map(l => l.id).join(', ') + ', level by level', people: upper.reduce((a, l) => a + l.pop, 0), color: '#ffb020' });
    let day = 1;
    for (const w of waves) { const days = Math.max(1, Math.ceil(w.people / liftPerDay)); w.start = day; w.end = day + days - 1; day = w.end + 1 + (w.n === 2 ? 2 : 0); }
    waves[1].start = 3; waves[1].end = Math.max(waves[1].end, 10);       // domes take a week to raise
    waves[2].start = 14; waves[2].end = waves[2].start + Math.ceil(waves[2].people / liftPerDay) - 1;
    waves[3].start = waves[2].end + 1; waves[3].end = waves[3].start + Math.ceil(waves[3].people / liftPerDay) - 1;
    return { liftPerDay, total: levels.reduce((a, l) => a + l.pop, 0), waves, allUp: waves[3].end };
  }

  // ------------------------------------------------------------ digital twin (DTDL)
  // Builds an Azure Digital Twins-style graph from the level data: twins + relationships.
  function twin(GAME) {
    const twins = [], rels = [];
    const add = (id, model, props = {}) => { twins.push({ $dtId: id, $metadata: { $model: model }, ...props }); return id; };
    const rel = (src, name, dst) => rels.push({ $sourceId: src, $relationshipName: name, $targetId: dst });
    const hollow = add('hollow', 'dtmi:strata:Hollow;1', { population: LEVELS.reduce((a, l) => a + l.pop, 0) });
    for (const f of FEEDS) rel(hollow, 'hasFeed', add(f.id, 'dtmi:strata:PowerFeed;1', { capacityMW: f.cap, temperatureC: f.temp }));
    for (const l of LEVELS) { const id = add(l.id, 'dtmi:strata:Level;1', { demandMW: l.demand, population: l.pop }); rel(hollow, 'hasLevel', id); for (const f of FEEDS) rel(f.id, 'powers', id); }
    const map = { D: 'L6', R: 'L1', S: 'surface' };
    add('surface', 'dtmi:strata:Surface;1', {}); rel(hollow, 'hasSurface', 'surface');
    for (const k of ['D', 'R', 'S']) {
      const g = GAME[k]; if (!g) continue;
      for (const z of g.zones) { const id = add(k + ':' + z.name, 'dtmi:strata:Room;1', { name: z.name }); rel(map[k], 'contains', id); }
      g.lamps.forEach((lp, i) => { const id = add(k + ':lamp' + i, 'dtmi:strata:Lamp;1', { kind: lp[3] }); rel(map[k], 'contains', id); });
    }
    const lift = add('lift', 'dtmi:strata:Lift;1', { perDay: 960 }); for (const l of LEVELS) rel(lift, 'serves', l.id); rel(lift, 'serves', 'surface');
    return { twins, rels, models: [...new Set(twins.map(t => t.$metadata.$model))] };
  }

  window.StrataEngines = { rng, gauss, LEVELS, FEEDS, SURVIVAL, DEEP, allocate, forecast,
    mesh: { build: meshBuild, flood: meshFlood, route: meshRoute }, sig,
    surface: { doseMult, protection, probeSite, droneTour, BASE_SECONDS, fmtDur }, volunteers, crew, returnPlan, twin };
})();
