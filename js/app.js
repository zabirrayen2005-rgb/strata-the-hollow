// Strata app: the phone screens for Mara's story. Every number on screen comes from js/engines.js,
// and every button calls back into the story (js/story.js), which changes the 3D world.
// Sponsor tech is shown where it is used, with a "Powered by" line. Runs fully offline in the artifact.
(function () {
  'use strict';

  window.StrataApp = function (story, C) {
    const M = story.model, E = M.E, P = window.StrataPhone, ic = P.ui.ic;
    const S = () => M.S;
    const fmt = s => { if (!isFinite(s)) return '—'; s = Math.max(0, Math.round(s)); return (s / 60 | 0) + ':' + String(s % 60).padStart(2, '0'); };
    const pct = x => (x * 100 < 1 && x > 0 ? (x * 100).toFixed(1) : Math.round(x * 100)) + '%';
    const BG = { home: '#0f2236', power: '#2a1c08', life: '#082436', mesh: '#0a2433', share: '#0b2a20', surface: '#1f1236', ret: '#3a2a10' };
    let askDraft = '', askFocus = false, askBusy = null; const askLog = [];   // Ask Strata: draft, focus, pending question, last 3 answers

    const pw = (...items) => `<div class="pw">POWERED BY ${items.map(i => `<b>${i}</b>`).join(' · ')}</div>`;
    const cop = (text, who = 'COPILOT-STYLE ASSISTANT') => `<div class="cop"><div class="who">✦ ${who}</div>${text}</div>`;
    const hd = (kick, color, title, tcolor, sub) => `<div class="hd"><div class="kick" style="color:${color}">${kick}</div><h1 style="color:${tcolor}">${title}</h1><div class="sub">${sub}</div></div>`;
    const steps = (n, of = 5) => `<div class="step" aria-label="Step ${n} of ${of}">${Array.from({ length: of }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;
    const btn = (act, label, color, bg, dis = false, arg = '') => `<button type="button" class="btn" data-act="${act}" ${arg ? `data-arg="${arg}"` : ''} ${dis ? 'disabled' : ''} style="border-color:${color};background:${bg}">${label}</button>`;

    // card anatomy helpers: verdict number + unit, and a before → after chip
    const verdict = (value, unit, color, live) => `<div class="vd"><span class="vn" ${live ? `data-live="${live}"` : ''} style="color:${color}">${value}</span><span class="vu">${unit}</span></div>`;
    const delta = (before, after, unit) => `<span class="dl"><s>${before}</s> → <b>${after}</b> ${unit}</span>`;
    const RED = '#ff5a4d', AMBER = '#ffb020', GREEN = '#3ddc97';
    const n0 = v => Math.round(v).toLocaleString('en-US');
    const d1 = v => isFinite(v) ? v.toFixed(1) : '∞';
    const d0 = v => isFinite(v) ? String(Math.round(v)) : '∞';
    const cardOpen = (color, kick, icon) => `<div class="card" style="border-color:${color}55"><div class="lc" style="color:${color}">${ic(icon, color, 18)}<span class="kick" style="color:${color}">${kick}</span></div>`;
    const lifeBefore = over => E.life(E.allocate(78, 'str'), Object.assign({ leakFixed: S().life.leak, nightLamps: S().life.lamps, triage: S().life.triage }, over));
    const needSplit = 'Apply the fair split first';
    const cutOff = L => Math.max(L.dry, L.hungry);
    // surface: suits/domes from the dose here; "no protection" = the same remaining time the HUD shows
    function protNow(onS) {
      const p = E.surface.protection(onS ? C.rad.mult : 1);
      if (onS) { p[0] = { ...p[0], seconds: C.rad.seconds, label: fmt(C.rad.seconds) }; }
      return p;
    }
    const lastShown = {}, tweening = {};
    function tween(n, k, a, b, final) {
      const dec = (final.split('.')[1] || '').replace(/\D.*/, '').length, comma = final.includes(','), t0 = performance.now();
      tweening[k] = true;
      const show = v => { n.textContent = comma ? Math.round(v).toLocaleString('en-US') : v.toFixed(dec); };
      const step = () => { const t = Math.min(1, (performance.now() - t0) / 600), e = 1 - Math.pow(1 - t, 3); show(a + (b - a) * e); if (t < 1) (document.hidden ? setTimeout : requestAnimationFrame)(step, 16); else { n.textContent = final; tweening[k] = false; } };
      show(a); step();
    }
    let confirmDir = false;                         // one-tap confirm before the Directorate split
    let stripShown = null, chipTip = null, heatDir = false, stagger = null;   // stagger null = default by split                  // last strip state drawn (for the cross-fade), tapped level chip
    // live feed temperatures: feed 3 drifts from 86 °C toward its 100 °C trip as the countdown runs, until it is bypassed
    function liveFeeds() {
      const k = S().bypass || !isFinite(M.cd) ? 0 : 1 - M.cd / M.cd0;
      return E.FEEDS.map((f, i) => i === 2 && !S().bypass ? { ...f, temp: Math.min(f.trip, f.temp + (f.trip - f.temp) * k) } : f);
    }
    function limitsCard(alloc) {
      const L = E.limits(alloc, liveFeeds(), S().bypass ? ['F3'] : []), ok = L.filter(x => x.ok).length;
      return `<div class="card" style="border-color:${ok === 3 ? GREEN : RED}66"><div class="lbl" style="display:flex;justify-content:space-between"><span>LIMITS SET BY RESIDENTS</span><span style="color:${ok === 3 ? GREEN : RED}">${ok} / 3 LIMITS MET</span></div>
        ${L.map(x => `<div style="display:grid;grid-template-columns:22px 1fr;gap:8px;margin-top:9px;align-items:start"><span style="font:700 16px/1 Inter,sans-serif;color:${x.ok ? GREEN : RED}">${x.ok ? '✓' : '✕'}</span>
          <div><div style="font-size:13px;color:#e6eefb">${x.text}</div>${x.ok ? '' : `<div style="font-size:12px;color:${RED};margin-top:2px">${x.why}</div>`}</div></div>`).join('')}
        <div class="why" style="color:#8fa0bb">The AI can only act inside these lines. Residents set them.</div></div>`;
    }
    function feedGauge() {
      const f = liveFeeds()[2], X = t => ((t - 60) / 45 * 300 + 12).toFixed(1);
      return `<div class="card" style="border-color:rgba(255,90,77,.35)"><div class="lbl" style="display:flex;justify-content:space-between"><span>FEED 3 TEMPERATURE</span><span class="mono" data-live="f3t" style="color:${f.temp > 95 ? RED : AMBER}">${f.temp.toFixed(1)} °C</span></div>
        <svg width="326" height="58" viewBox="0 0 326 58" style="display:block;margin-top:8px" role="img" aria-label="Feed 3 temperature against its limits">
        <rect x="12" y="18" width="300" height="12" rx="6" fill="rgba(255,255,255,.06)"/><rect data-live-w="f3" x="12" y="18" width="${(+X(f.temp) - 12).toFixed(1)}" height="12" rx="6" fill="${f.temp > 95 ? RED : AMBER}"/>
        <line x1="${X(95)}" y1="10" x2="${X(95)}" y2="38" stroke="#fff" stroke-dasharray="3 3"/><line x1="${X(100)}" y1="8" x2="${X(100)}" y2="40" stroke="${RED}" stroke-width="2.5"/>
        <text x="${X(95)}" y="52" text-anchor="end" fill="#c8d4e6" font-size="11" font-family="JetBrains Mono,monospace">LIMIT 95</text><text x="${(+X(100) + 2)}" y="52" fill="${RED}" font-size="11" font-family="JetBrains Mono,monospace">TRIP 100</text>
        <text x="${((+X(95) + +X(100)) / 2)}" y="8" text-anchor="middle" fill="#ffcf7a" font-size="11" font-family="JetBrains Mono,monospace">5 °C safety margin</text></svg></div>`;
    }
    function lifeStrip(mode) {
      const L = E.life(E.allocate(78, mode)), from = stripShown || mode;
      const Lf = E.life(E.allocate(78, from));
      const cut = cutOff(L);
      const rows = L.air.map((a, i) => { const was = Lf.air[i].pumps;
        return `<div>${E.LEVELS[i].name}</div>${['drop', 'fan', 'leaf', 'pill'].map(k => `<span class="lsi${was ? '' : ' off'}" data-on="${a.pumps ? 1 : 0}">${ic(k, 'currentColor', 16)}</span>`).join('')}`; }).join('');
      stripShown = mode;
      return `<div class="card" style="border-color:rgba(120,150,200,.25)"><div class="lbl">WHAT THIS SPLIT DOES TO LIFE SUPPORT</div>
        <div class="lsg"><span></span><span class="lbl" style="text-align:center">WATER</span><span class="lbl" style="text-align:center">AIR</span><span class="lbl" style="text-align:center">FOOD</span><span class="lbl" style="text-align:center">CLINIC</span>${rows}</div>
        <div style="margin-top:12px;font:700 20px Rajdhani,sans-serif;letter-spacing:.03em;color:${cut ? RED : GREEN}">${cut ? n0(cut) + ' people lose water and air' : 'Everyone keeps water and air'}</div></div>`;
    }

    // ------------------------------------------------------------ HOME tiles (2 × 3)
    function tilesHtml() {
      const s = S(), fixed = s.applied === 'str', L = M.life, cut = L ? cutOff(L) : 0, lifeDone = s.life.leak && s.life.lamps && s.life.triage;
      const tile = (go, icon, color, name, subTxt, subColor, extra = '') => `<button type="button" class="tile${extra}" ${go ? `data-go="${go}"` : 'aria-disabled="true"'} style="border-color:${color}59">${ic(icon, color)}<b>${name}</b><span style="${subColor ? 'color:' + subColor : ''}">${subTxt}</span></button>`;
      const lifeSub = cut ? [n0(cut) + ' cut off', RED] : L && L.leak ? ['Leak on L5', AMBER] : L ? [`Water ${d1(L.waterDays)} d · Food ${d0(L.foodDays)} d`, GREEN] : ['', ''];
      return [
        tile('power', 'bolt', '#ffb020', 'POWER', fixed ? 'Fair split live' : s.bypass ? 'Bypassed · split needed' : 'Feed 3 overheating'),
        tile('life', 'drop', '#4fc3f7', 'LIFE', lifeSub[0], lifeSub[1], s.flags.supplies && !lifeDone && L && L.leak ? ' hot' : ''),
        tile('mesh', 'mesh', '#5fd0ff', 'MESH', s.ava && s.ava.state === 'replied' ? 'Ava: “I’m safe”' : s.netCut ? 'Network cut · mesh up' : 'Standby'),
        tile('share', 'share', GREEN, 'FAIR SHARE', fixed ? 'Every level above minimum' : s.applied === 'dir' ? 'Directorate split: Deep at 0' : 'Directorate plan: Deep cut', fixed ? '' : RED),
        tile('surface', 'sun', '#c27bff', 'SURFACE', s.sent ? 'Reading signed + sent' : s.stage >= 6 ? 'Hatch override ready' : 'Sealed by Directorate'),
        tile(s.sent ? 'ret' : null, 'apt', '#ffd27a', 'RETURN', s.sent ? 'All up by day ' + M.plan.allUp : 'Locked until the reading is signed'),
      ].join('');
    }

    // ------------------------------------------------------------ HOME
    function home() {
      const s = S(), fixed = s.applied === 'str', dark = M.dark;
      const ring = fixed ? 40 : 578 - 578 * Math.max(0, M.cd / M.cd0);
      const tw = M.twin;
      return `<div class="grid"></div>
      <div class="hd" style="flex-direction:row;align-items:center;justify-content:space-between">
        <div><div style="font:700 28px Rajdhani,sans-serif;letter-spacing:.34em;color:#eaf4ff">STR<span style="color:#5fd0ff">A</span>TA</div>
        <div class="kick" style="color:#8fa0bb;font-size:11px">MARA · ${P.state.level.toUpperCase()}</div></div>
        <div class="mono" style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;border:1px solid ${s.netCut ? 'rgba(255,90,77,.5)' : 'rgba(61,220,151,.45)'};background:${s.netCut ? 'rgba(255,90,77,.1)' : 'rgba(61,220,151,.08)'};font-size:11px;color:${s.netCut ? '#ffb4ab' : '#8ff0c4'};letter-spacing:.08em">
        <span class="${s.netCut ? 'pulse' : ''}" style="width:7px;height:7px;border-radius:50%;background:${s.netCut ? '#ff5a4d' : '#3ddc97'}"></span>${s.netCut ? 'NET CUT · MESH ON' : 'NETWORK UP'}</div></div>
      <div style="position:relative;margin:18px auto 0;width:220px;height:220px">
        <svg width="220" height="220" viewBox="0 0 236 236" aria-hidden="true"><circle cx="118" cy="118" r="104" fill="none" stroke="rgba(95,208,255,.12)" stroke-width="2"/>
        <circle cx="118" cy="118" r="92" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="10"/>
        <circle cx="118" cy="118" r="92" fill="none" stroke="${fixed ? '#3ddc97' : dark ? '#ff5a4d' : '#ffb020'}" stroke-width="10" stroke-linecap="round" stroke-dasharray="578" stroke-dashoffset="${ring}" transform="rotate(-90 118 118)"/></svg>
        <div style="position:absolute;inset:14px;border-radius:50%;background:conic-gradient(from 0deg,rgba(95,208,255,.22),transparent 18%);animation:spSweep 4s linear infinite"></div>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">
          <div class="mono" style="font-size:11px;letter-spacing:.2em;color:${fixed ? '#8ff0c4' : '#ffcf7a'}">${fixed ? 'DEEP POWER SECURED' : dark ? 'THE DEEP IS DARK' : 'DEEP GOES DARK IN'}</div>
          <div data-live="cd" style="font:700 52px/1 Rajdhani,sans-serif;color:#fff4dd">${fixed ? '6 H+' : fmt(M.cd)}</div>
          <div style="font-size:12px;color:#a9b6cc">${M.fc ? (fixed ? pct(M.fcBypassStr.pDark) + ' of 500 forecasts dark' : pct(M.fc.pDark) + ' of 500 forecasts') : ''}</div></div></div>
      <button type="button" class="askbar" data-act="askopen">✦ Ask Strata…</button>
      <div style="position:relative;padding:16px 16px 0;display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${tilesHtml()}</div>
      <div class="card" style="border-color:rgba(120,160,255,.3)"><div class="lbl">DIGITAL TWIN OF THE HOLLOW</div>
        <div class="row3" style="margin:8px 0 0"><div><div class="lbl">TWINS</div><div class="big" style="color:#9fc0ff">${tw.twins.length}</div></div><div><div class="lbl">LINKS</div><div class="big" style="color:#9fc0ff">${tw.rels.length}</div></div><div><div class="lbl">MODELS</div><div class="big" style="color:#9fc0ff">${tw.models.length}</div></div></div>
        <div class="mono" style="margin-top:8px;font-size:11px;color:#9fb3d1;line-height:1.5">dtmi:strata:PowerFeed;1 → powers → Level → feeds → WaterLoop<br>Levels, feeds, water loops, farms, clinics, lamps and the lift, built from the level data.</div></div>
      ${pw('Azure Digital Twins model (DTDL)', 'MetroStar Comet-style UI')}`;
    }

    // ------------------------------------------------------------ LIFE (#4 water, #12 food, #10 medicine)
    function lifeScr() {
      const s = S(), L = M.life, Ld = M.lifeDir, str = s.applied === 'str', cut = cutOff(L);
      let body = hd('PROBLEM #4 WATER · #12 FOOD · #10 MEDICINE', '#4fc3f7', 'Life support', '#e6f6ff', 'One grid feeds the pumps, the farms and the clinic. Strata keeps all three running for everyone.');
      body += `<div class="lvchips">${L.air.map((a, i) => `<button type="button" data-act="chip" data-arg="${i}" style="border-color:${a.pumps ? GREEN : RED};color:${a.pumps ? GREEN : RED}">L${i + 1}</button>`).join('')}</div>`;
      if (chipTip !== null) { const i = chipTip, a = L.air[i], w = L.water[i];
        body += `<div class="tip"><b>${E.LEVELS[i].name}</b> · pumps ${a.pumps ? '<b style="color:' + GREEN + '">on</b>' : '<b style="color:' + RED + '">off</b>'} · water recovery ${Math.round(w.recovery * 100)}% · lung index ${a.lung}</div>`; }
      body += `<div class="card" style="border-color:${cut ? RED : GREEN}66"><div class="lbl">PEOPLE CUT OFF FROM WATER AND AIR</div>${verdict(n0(cut), 'people', cut ? RED : GREEN, 'cut')}
        <div class="why" style="color:#8fa0bb">Directorate split: <b style="color:${RED}">${n0(cutOff(Ld))}</b></div></div>`;
      // water
      const w0 = lifeBefore({ leakFixed: false }).waterDays;
      body += cardOpen('#4fc3f7', 'WATER · #4', 'drop') + verdict(d1(L.waterDays), 'days of water', L.dry ? RED : L.waterDays < 3 ? AMBER : '#e6f6ff', 'water');
      body += `<div class="segbar">${L.water.map(w => `<i title="${w.name}" style="background:${w.on ? GREEN : RED}"></i>`).join('')}</div>`;
      if (L.dry) body += `<div class="why">${n0(L.dry)} people get no pumped water at all. The store only lasts longer because they get none.</div>`;
      else body += `<div class="why">Losing ${n0(L.lostPerDay)} L a day${L.leak ? ` · ${n0(L.leak)} of it a leak on the L5 Warrens main loop` : ' · the L5 leak is isolated'}.</div>`;
      if (s.life.leak) body += delta(d1(w0), d1(L.waterDays), 'days');
      body += '</div>' + (s.life.leak ? '' : btn('fixleak', str ? 'ISOLATE THE LEAK' : needSplit, '#4fc3f7', 'linear-gradient(90deg,#0b3550,#0e2a40)', !str));
      // food
      const f0 = lifeBefore({ nightLamps: false }).foodDays;
      body += cardOpen(GREEN, 'FOOD · #12', 'leaf') + verdict(d0(L.foodDays), 'days of food', L.hungry ? RED : '#eafff5', 'food');
      body += `<div class="why">Farms grow <b>${Math.round(L.farmShare * 100)}%</b> of ${n0(L.need)} kcal a day.${L.hungry ? ` ${n0(L.hungry)} people have no kitchens or cold store.` : ''}</div><div class="why" style="color:#8fa0bb">Rations by need: children, medics and night shifts first.</div>`;
      if (s.life.lamps) body += delta(d1(f0), d0(L.foodDays), 'days');
      body += '</div>' + (s.life.lamps ? '' : btn('lamps', str ? 'SHIFT GROW LAMPS TO NIGHT' : needSplit, GREEN, 'linear-gradient(90deg,#0c3b2a,#0f4d3a)', !str));
      // medicine
      const m0 = lifeBefore({ triage: false }).meds[0].days[5];
      body += cardOpen('#ff8fb1', 'MEDICINE · #10', 'pill') + `<table class="tbl" style="margin-top:8px">${L.meds.map(m => `<tr><td>${m.name}</td><td class="mono" style="text-align:right;color:${m.worst < 3 ? RED : '#e6eefb'}">${m.worst.toFixed(1)} d</td><td style="text-align:right;color:#8fa0bb">worst: ${m.worstAt}</td></tr>`).join('')}
        <tr><td colspan="2">Insulin fridge (L2 clinic)</td><td style="text-align:right;color:${L.meds[1].coldOk ? GREEN : RED}">● ${L.meds[1].coldOk ? 'powered' : 'no power'}</td></tr></table>`;
      if (s.life.triage) body += delta('Deep inhalers ' + m0.toFixed(1), L.meds[0].days[5].toFixed(1), 'days');
      body += '</div>' + (s.life.triage ? '' : btn('triage', str ? 'SEND STOCK BY NEED' : needSplit, '#ff8fb1', 'linear-gradient(90deg,#4a1830,#2a1757)', !str));
      // air and cooling (#3, #9)
      const H = E.heat(E.allocate(78, heatDir ? 'dir' : (str ? 'str' : 'dir'))), on = H.filter(h => h.on).length;
      body += cardOpen('#9fe7ff', 'AIR · #9 · COOLING · #3', 'fan') + verdict(`${on} of 6`, 'levels with air pumps on', on === 6 ? GREEN : RED);
      body += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 10px;margin-top:10px">${H.map(h => {
        const X = i => (i / 6 * 116 + 2).toFixed(1), Y = t => (34 - (t - 22) / 21 * 32).toFixed(1), hot = h.hoursToLimit !== null;
        return `<div><div style="display:flex;justify-content:space-between;font-size:11px;color:#c8d4e6"><span>${h.name}</span><span class="mono" style="color:${hot ? RED : '#c8d4e6'}">${h.in6h} °C${hot ? ' · ' + h.hoursToLimit + ' h' : ''}</span></div>
          <svg width="120" height="36" viewBox="0 0 120 36" style="display:block;width:100%"><line x1="0" y1="${Y(35)}" x2="120" y2="${Y(35)}" stroke="${RED}" stroke-dasharray="3 3" stroke-opacity=".8"/>
          <polyline points="${h.curve.map((t, i) => X(i) + ',' + Y(t)).join(' ')}" fill="none" stroke="${hot ? RED : '#9fe7ff'}" stroke-width="2"/></svg></div>`; }).join('')}</div>
        <div class="why" style="color:#8fa0bb">Next 6 hours · dashed line: 35 °C limit</div>`;
      body += `<div class="seg" style="margin:10px 0 0" role="group"><button type="button" data-act="heat" data-arg="0" style="${!heatDir ? 'background:rgba(61,220,151,.18);color:#8ff0c4' : ''}">${str ? 'STRATA SPLIT' : 'CURRENT PLAN'}</button><button type="button" data-act="heat" data-arg="1" style="${heatDir ? 'background:rgba(255,90,77,.18);color:#ffb4ab' : ''}">SHOW DIRECTORATE SPLIT</button></div>`;
      const Hd = E.heat(E.allocate(78, 'dir')), deepD = Hd[5];
      body += '</div>' + cop(`Strata never lets a level fall below ${Math.round(E.SURVIVAL * 100)}%. That share is what runs air pumps and cooling. Under the Directorate split the Deep passes 35 °C in <b>${deepD.hoursToLimit} hours</b> and reaches <b>${deepD.in6h} °C</b>.`);
      // lungs and sunlight (#9, #11)
      const sunTxt = c => c === null ? 'no power for lamps' : c === 1 ? 'tonight' : 'night ' + c;
      const nights = Math.max(...L.sun.map(x => x.coveredBy || 0));
      body += cardOpen('#ffd36b', 'LUNGS · #9 · SUNLIGHT · #11', 'sun') + verdict(String(L.bays), `sun-lamp bays tonight · ${n0(L.seats)} sessions of 20 minutes`, '#ffd36b');
      body += `<div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">${L.air.map(a => `<div style="display:grid;grid-template-columns:76px 1fr 30px;gap:8px;align-items:center;font-size:12px;color:#c8d4e6"><span>${a.name}</span><div class="bar" style="height:10px"><i style="width:${a.lung}%;background:${a.lung < 70 ? AMBER : '#ffd36b'}"></i></div><span class="mono" style="text-align:right;color:${a.lung < 70 ? AMBER : '#c8d4e6'}">${a.lung}</span></div>`).join('')}</div>
        <div class="lbl" style="margin-top:12px">SUN-LAMP SCHEDULE · WORST LUNGS FIRST · ${nights} NIGHT${nights === 1 ? '' : 'S'}</div>
        <table class="tbl" style="margin-top:4px">${L.sun.map(x => `<tr><td>${x.name}</td><td class="mono" style="color:#8fa0bb">lungs ${x.lung}</td><td style="text-align:right;color:${x.coveredBy === null ? RED : x.coveredBy === 1 ? GREEN : '#c8d4e6'}">${sunTxt(x.coveredBy)}</td></tr>`).join('')}</table>`;
      if (s.life.lamps) body += `<div class="why" style="color:#8fa0bb">Grow lamps take 10 MW of the night spare. Food first, then light.</div>`;
      body += '</div>' + pw('Azure Digital Twins model');
      body += cop(str
        ? `Under the Directorate split <b>${n0(cutOff(Ld))}</b> people in the Warrens and the Deep lose pumped water, air and kitchens. Strata keeps every level above ${Math.round(E.SURVIVAL * 100)}%${s.life.leak ? ', isolated the L5 leak (water now <b>' + d1(L.waterDays) + ' days</b>)' : ', and can isolate the L5 leak (+' + d1(lifeBefore({ leakFixed: true }).waterDays - L.waterDays) + ' days)'}${s.life.lamps ? ', moved grow lamps to the night window (<b>' + d0(L.foodDays) + ' days</b> of food)' : ''}${s.life.triage ? ' and sent inhalers where lungs are worst' : ''}.`
        : `Under the current Directorate plan <b>${n0(cut)}</b> people in the Warrens and the Deep get no pumped water, air or kitchens. The water store looks long only because they get none. Apply Strata's fair split on Fair share first.`);
      body += `<div class="foot">Assumptions: 15 L water and 2,100 kcal per person per day · recyclers recover 60–90% · 3.5 m² per person minimum.</div>`;
      body += pw('Azure Digital Twins model', 'Caelon Prism-style energy model');
      return body;
    }

    // ------------------------------------------------------------ POWER (Act 1: detect, explain, decide)
    function fan(fc, color) {
      if (!fc) return '';
      const W = 326, H = 150, n = fc.mean.length, X = i => (i / (n - 1) * W).toFixed(1), Y = v => (H - 8 - v * (H - 22)).toFixed(1);
      let g = fc.fan.map(c => `<path d="M${c.map((v, i) => X(i) + ',' + Y(v)).join(' L')}" fill="none" stroke="${color}" stroke-opacity=".28"/>`).join('');
      g += `<path d="M${fc.mean.map((v, i) => X(i) + ',' + Y(v)).join(' L')}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2"/>`;
      const yMin = Y(fc.deepMin);
      return `<svg width="326" height="${H + 14}" viewBox="0 0 326 ${H + 14}" style="display:block;margin-top:8px" role="img" aria-label="Forecast: Deep power across ${fc.runs} runs">
        <line x1="0" y1="${yMin}" x2="326" y2="${yMin}" stroke="#ff5a4d" stroke-dasharray="4 4"/><text x="4" y="${yMin - 5}" fill="#ff8a80" font-size="11" font-family="JetBrains Mono,monospace">SURVIVAL MINIMUM</text>
        ${g}<text x="4" y="${H + 12}" fill="#8fa0bb" font-size="11" font-family="JetBrains Mono,monospace">NOW</text><text x="290" y="${H + 12}" fill="#8fa0bb" font-size="11" font-family="JetBrains Mono,monospace">+${fc.horizon / 60} MIN</text></svg>`;
    }
    function power() {
      const s = S(), fc = M.fc, by = s.bypass, fixed = s.applied === 'str';
      const show = fixed ? M.fcBypassStr : fc;
      const F = E.FEEDS;
      let body = hd('PROBLEM #1 · BLACKOUTS', '#ffcf7a', 'Blackout forecast', '#fff4dd', `${fc ? fc.runs : 500} Monte Carlo runs of the geothermal grid, rerun every minute.`);
      body += steps(fixed ? 5 : by ? 3 : 2);
      body += `<div class="card" style="border-color:${fixed ? GREEN : RED}55"><div class="lbl">DEEP GOES DARK IN</div>${verdict(fixed ? pct(show.pDark) : pct(fc.pDark), 'of 500 runs', fixed ? GREEN : RED, 'pdark')}${fixed ? delta(pct(fc.pDark), pct(show.pDark), 'of runs dark') : `<div class="why">Feed 3 overheats. The Directorate cuts the Deep first.</div>`}</div>`;
      body += `<div class="card" style="border-color:rgba(255,176,32,.3)"><div style="display:flex;justify-content:space-between;align-items:baseline"><div class="lbl">DEEP POWER · ${fixed ? 'AFTER FAIR SPLIT' : 'DIRECTORATE PLAN'}</div>
        <div class="big" style="color:${fixed ? '#3ddc97' : '#ffb020'}">${fixed ? pct(show.pDark) + ' DARK' : 'DARK IN ' + fmt(M.cd)}</div></div>${fan(show, fixed ? '#3ddc97' : '#ffb020')}</div>`;
      body += `<div class="row3">${F.map((f, i) => { const bad = i === 2 && !by; const byp = i === 2 && by;
        return `<div style="${bad ? 'border-color:rgba(255,90,77,.55)' : byp ? 'border-color:rgba(95,208,255,.5)' : ''}"><div class="lbl">${f.name.toUpperCase()}</div><div class="big" style="color:${bad ? '#ff5a4d' : byp ? '#5fd0ff' : '#3ddc97'}">${byp ? 'BYPASS' : bad ? f.temp + '°C' : f.cap + ' MW'}</div></div>`; }).join('')}</div>`;
      if (!by) body += cop(`Feed 3 is at ${F[2].temp} °C and climbing toward its ${F[2].trip} °C trip point. In <b>${pct(fc.pDark)}</b> of ${fc.runs} runs it trips within ${fc.horizon / 60} minutes (median <b>${fmt(fc.median)}</b>). When it trips, the Directorate’s priority order cuts the Deep first, below the ${Math.round(E.SURVIVAL * 100)}% it needs for air pumps and the lift.`);
      else if (!fixed) body += cop(`Feed 3 is bypassed, so it can no longer trip. That leaves <b>${F[0].cap + F[1].cap} MW</b> for <b>${E.LEVELS.reduce((a, l) => a + l.demand, 0)} MW</b> of demand. Under the Directorate’s order the Deep is still dark in <b>${pct(M.fcBypassDir.pDark)}</b> of runs.${M.lifeDir && cutOff(M.lifeDir) ? ` If the Directorate split goes ahead, L5 and L6 also lose pumped water and air: <b>${n0(cutOff(M.lifeDir))} people</b>.` : ''} Choose how to share it.`);
      else body += cop(`Verified: re-ran ${show.runs} forecasts with the fair split. The Deep stays above its survival minimum in <b>${pct(1 - show.pDark)}</b> of runs. Lamps in the Deep are steady and the lift has power.`);
      if (!by) body += feedGauge();
      body += limitsCard(E.allocate(by ? 78 : 120, fixed ? 'str' : 'dir'));
      if (!by) body += btn('bypass', 'APPROVE: BYPASS FEED 3 ✓ WITHIN LIMITS', '#ffb020', 'linear-gradient(90deg,#5a3a06,#7a2a10)');
      else if (!fixed) body += btn('go-share', 'CHOOSE THE SPLIT →', '#3ddc97', 'linear-gradient(90deg,#0c3b2a,#0f4d3a)');
      else body += btn('none', 'POWER SECURED ✓', '#3ddc97', 'linear-gradient(90deg,#0c3b2a,#0f4d3a)', true);
      body += pw('Caelon Prism-style energy model', 'Azure Digital Twins model');
      return body;
    }

    // ------------------------------------------------------------ FAIR SHARE (Act 1: decide → world reacts → verify)
    function share() {
      const s = S(), mode = M.preview, total = E.FEEDS[0].cap + E.FEEDS[1].cap, rows = E.allocate(total, mode), fc = mode === 'str' ? M.fcBypassStr : M.fcBypassDir;
      const max = Math.max(...E.LEVELS.map(l => l.demand));
      const list = rows.map(r => { const l = E.LEVELS.find(x => x.id === r.id), minX = l.demand * E.SURVIVAL / max * 100, w = r.mw / max * 100;
        return `<div style="display:grid;grid-template-columns:76px 1fr 54px;gap:10px;align-items:center"><div style="font-size:12px;color:#c9d4e6">${r.name}</div>
        <div class="bar"><i style="width:${w.toFixed(1)}%;background:${mode === 'str' ? 'linear-gradient(90deg,#1f9e6c,#3ddc97)' : r.belowMin ? 'linear-gradient(90deg,#a3261d,#ff5a4d)' : 'linear-gradient(90deg,#41506a,#8fa0bb)'}"></i>
        <div style="position:absolute;left:${minX.toFixed(1)}%;top:-2px;bottom:-2px;width:2px;background:rgba(255,255,255,.55)"></div></div>
        <div class="mono" style="font-size:12px;text-align:right;color:${r.belowMin ? '#ff8a80' : mode === 'str' ? '#8ff0c4' : '#c9d4e6'}">${r.mw.toFixed(1)}</div></div>`; }).join('');
      const below = rows.filter(r => r.belowMin).map(r => r.name);
      let body = hd('PROBLEM #2 · RATIONING', '#8ff0c4', 'Fair share', '#eafff5', `${total} MW to share between six levels that need ${E.LEVELS.reduce((a, l) => a + l.demand, 0)} MW.`);
      { const cutP = cutOff(E.life(rows)); body += `<div class="card" style="border-color:${cutP ? RED : GREEN}55"><div class="lbl">${mode === 'str' ? 'STRATA SPLIT' : 'DIRECTORATE SPLIT'} · PEOPLE WHO LOSE WATER AND AIR</div>${verdict(n0(cutP), 'people', cutP ? RED : GREEN, 'scut')}${s.applied === 'str' ? delta(n0(cutOff(M.lifeDir)), '0', 'people cut off') : ''}</div>`; }
      body += `<div class="seg" role="group" aria-label="Allocation"><button type="button" data-act="preview" data-arg="dir" style="${mode === 'dir' ? 'background:rgba(255,90,77,.18);color:#ffb4ab' : ''}">DIRECTORATE</button><button type="button" data-act="preview" data-arg="str" style="${mode === 'str' ? 'background:rgba(61,220,151,.18);color:#8ff0c4' : ''}">STRATA</button></div>`;
      body += `<div class="card" style="display:flex;flex-direction:column;gap:11px"><div class="lbl" style="display:flex;justify-content:space-between"><span>POWER BY LEVEL</span><span>MW</span></div>${list}
        <div style="font-size:11px;color:#8fa0bb">White tick: survival minimum (${Math.round(E.SURVIVAL * 100)}%) for air pumps, cooling and the lift.</div></div>`;
      body += lifeStrip(mode);
      body += limitsCard(rows);
      body += `<div class="row3"><div><div class="lbl">BELOW MIN</div><div class="big" style="color:${below.length ? '#ff5a4d' : '#3ddc97'}">${below.length}</div></div><div><div class="lbl">DEEP DARK</div><div class="big" style="color:${fc && fc.pDark > .05 ? '#ff5a4d' : '#3ddc97'}">${fc ? pct(fc.pDark) : '—'}</div></div><div><div class="lbl">RUNS</div><div class="big" style="color:#c9d4e6">${fc ? fc.runs : 500}</div></div></div>`;
      body += cop(mode === 'dir' ? `The Directorate serves levels top-down at full demand until power runs out. <b>${below.join(' and ') || 'No level'}</b> fall${below.length === 1 ? 's' : ''} below the survival minimum, and the Deep goes dark in <b>${fc ? pct(fc.pDark) : '—'}</b> of runs.`
        : `Same ${total} MW. Strata gives every level its survival minimum first, then shares the rest by unmet need. No level drops below the line, and the Deep goes dark in only <b>${fc ? pct(fc.pDark) : '—'}</b> of runs.`);
      if (!s.bypass) body += `<div class="note" style="background:rgba(255,176,32,.08);border:1px solid rgba(255,176,32,.35);color:#ffe8c2">First approve the feed 3 bypass on the Power screen.</div>`;
      else if (s.applied !== 'str') {
        const broken = E.limits(rows, liveFeeds(), ['F3']).filter(x => !x.ok).length;
        if (mode === 'dir' && confirmDir) body += `<div class="note" style="background:rgba(255,90,77,.1);border:2px solid ${RED};color:#ffd2cc"><div style="font-size:13px;line-height:1.5">This cuts air and water to <b>${n0(cutOff(E.life(rows)))}</b> people. Strata will not recommend it.</div>
          <div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn" data-act="canceldir" style="margin:0;flex:1;width:auto;border-color:rgba(255,255,255,.3);background:rgba(14,20,31,.9)">CANCEL</button><button type="button" class="btn" data-act="confirmdir" style="margin:0;flex:1;width:auto;border-color:${RED};background:linear-gradient(90deg,#4a1010,#6a1a10)">APPLY ANYWAY</button></div></div>`;
        else body += mode === 'str' ? btn('apply', 'APPLY STRATA SPLIT', GREEN, 'linear-gradient(90deg,#0c3b2a,#0f4d3a)', false, 'str')
          : `<button type="button" class="btn" data-act="apply" data-arg="dir" style="border:2px solid ${RED};background:linear-gradient(90deg,#4a1010,#6a1a10)">APPLY ANYWAY — BREAKS ${broken} LIMIT${broken === 1 ? '' : 'S'}</button>`;
      }
      else body += btn('none', 'FAIR SPLIT LIVE ✓', '#3ddc97', 'linear-gradient(90deg,#0c3b2a,#0f4d3a)', true);
      body += pw('Caelon Prism-style AI · acts only within resident limits');
      return body;
    }

    // ------------------------------------------------------------ MESH (Act 2)
    function meshMap() {
      const g = M.graph; if (!g) return '';
      const X = x => ((x + 18) / 36 * 330).toFixed(1), Y = y => ((18 - y) / 36 * 300).toFixed(1);
      const hop = M.bcHop || null; let o = '';
      o += `<circle cx="${X(0)}" cy="${Y(0)}" r="${(18.4 / 36 * 330).toFixed(1)}" fill="none" stroke="rgba(120,150,200,.12)"/>`;
      for (const [a, b] of g.links) { const A = g.nodes[a], B = g.nodes[b]; const on = hop && hop[a] >= 0 && hop[b] >= 0; o += `<line x1="${X(A.x)}" y1="${Y(A.y)}" x2="${X(B.x)}" y2="${Y(B.y)}" stroke="${on ? 'rgba(95,208,255,.7)' : 'rgba(95,208,255,.2)'}"/>`; }
      if (M.route) o += `<polyline points="${M.route.path.map(i => X(g.nodes[i].x) + ',' + Y(g.nodes[i].y)).join(' ')}" fill="none" stroke="${S().ava && S().ava.state === 'replied' ? '#3ddc97' : '#ffcf7a'}" stroke-width="3" stroke-linejoin="round"/>`;
      g.nodes.forEach((n, i) => { const me = n.kind === 'me', rel = n.kind === 'relay';
        o += `<circle cx="${X(n.x)}" cy="${Y(n.y)}" r="${me ? 6 : rel ? 6 : 3}" fill="${me ? '#ffcf7a' : rel ? '#9fdcff' : hop && hop[i] >= 0 ? '#5fd0ff' : '#33405a'}"${me ? ' stroke="#fff" stroke-width="1.5"' : ''}/>`; });
      o += `<text x="${(+X(0) + 9)}" y="${(+Y(-1.9) + 4)}" fill="#9fdcff" font-size="11" font-family="JetBrains Mono,monospace">LIFT RELAY</text>`;
      return `<svg width="330" height="300" viewBox="0 0 330 300" style="display:block" role="img" aria-label="Map of resident phones in the Deep">${o}</svg>`;
    }
    // ------------------------------------------------------------ ASK STRATA: offline intent router over the live engines
    const appliedMode = () => S().applied === 'str' ? 'str' : 'dir';
    const INTENTS = [
      { id: 'dark', kw: ['dark', 'blackout', 'power', 'lights', 'outage'], src: 'forecast() · allocate()', a: () => S().applied === 'str'
        ? `The Deep is lit. With Strata's split it stays above its minimum in <b>${pct(1 - M.fcBypassStr.pDark)}</b> of 500 forecast runs.`
        : M.dark ? `The Deep is dark. Feed 3 tripped. Approve the bypass and apply the fair split on Power and Fair share.` : `About <b>${fmt(M.cd)}</b> until the Deep goes dark. Feed 3 trips in <b>${pct(M.fc.pDark)}</b> of 500 runs.` },
      { id: 'split', kw: ['fair', 'split', 'share', 'ration'], src: 'allocate()', a: () => { const al = E.allocate(78, appliedMode()), lo = al.reduce((a, b) => a.ofDemand < b.ofDemand ? a : b);
        return `${S().applied === 'str' ? "Strata's fair split" : "The Directorate's split"} gives the lowest share to <b>${lo.name}</b>: <b>${Math.round(lo.ofDemand * 100)}%</b> of its demand. ${lo.belowMin ? 'That is below the 55% survival minimum.' : 'Every level is above the 55% survival minimum.'}`; } },
      { id: 'water', kw: ['water', 'drink', 'leak', 'thirsty'], src: 'life() · allocate()', a: () => { const L = M.life;
        return `<b>${d1(L.waterDays)} days</b> at 15 L per person. ${L.leak ? 'The L5 leak is still open: ' + n0(L.leak) + ' L a day.' : 'The L5 leak is isolated.'} ${L.dry ? '<b>' + n0(L.dry) + '</b> people are cut off from pumped water.' : 'Nobody is cut off from pumped water.'}`; } },
      { id: 'food', kw: ['food', 'eat', 'hungry', 'farm', 'ration', 'bread'], src: 'life()', a: () => `<b>${d0(M.life.foodDays)} days</b> of food. The L3 farms grow <b>${Math.round(M.life.farmShare * 100)}%</b> of what everyone needs${S().life.lamps ? ', with grow lamps on the night window.' : '.'}` },
      { id: 'meds', kw: ['medicine', 'insulin', 'inhaler', 'antibiotic', 'clinic', 'drug'], src: 'life()', a: () => { const m = M.life.meds;
        return m.map(x => `${x.name}: <b>${x.worst.toFixed(1)} days</b> at worst (${x.worstAt})`).join('. ') + `. Insulin fridge ${m[1].coldOk ? 'powered' : '<b>without power</b>'}.`; } },
      { id: 'air', kw: ['air', 'breathe', 'cooling', 'heat', 'hot', 'temperature'], src: 'heat() · allocate()', a: () => { const H = E.heat(E.allocate(78, appliedMode())), on = H.filter(h => h.on).length, d = H[5];
        return `Air pumps on in <b>${on} of 6</b> levels. The Deep is at ${d.now} °C now and <b>${d.in6h} °C</b> in 6 hours${d.hoursToLimit !== null ? ', past the 35 °C limit after ' + d.hoursToLimit + ' hours' : ''}.`; } },
      { id: 'lungs', kw: ['lung', 'cough', 'sun', 'light', 'vitamin', 'lamp'], src: 'life()', a: () => { const sun = M.life.sun.filter(x => x.coveredBy);
        return `Worst lungs: <b>L6 Deep (${M.life.air[5].lung})</b>. Tonight's ${M.life.bays} sun-lamp bays go to ${sun.filter(x => x.coveredBy === 1).map(x => x.name).join(', ') || 'nobody yet'} first.`; } },
      { id: 'space', kw: ['crowded', 'space', 'room', 'cramped', ['why does the deep', 3], ['deep go first', 3]], src: 'life()', a: () => { const sp = M.life.space, lo = sp.reduce((a, b) => a.m2 < b.m2 ? a : b);
        return `<b>${lo.name}</b> has the least room: <b>${lo.m2.toFixed(1)} m²</b> per person, under the 3.5 m² minimum. It also has the worst lungs (${M.life.air[5].lung}). That is why it goes up first.`; } },
      { id: 'tunnels', kw: ['corridor', 'tunnel', 'crowd', 'shift', 'queue'], src: 'tunnels()', a: () => { const T = E.tunnels(true), T0 = E.tunnels(false);
        return `Staggered shift changes cut the peak corridor crowd from <b>${n0(T0.peak)}</b> to <b>${n0(T.peak)}</b>, ${Math.round(T.load * 100)}% of capacity. One level per 20-minute window, the Deep last.`; } },
      { id: 'net', kw: ['network', 'signal', 'internet', 'mesh', 'offline'], src: 'mesh.flood()', a: () => S().netCut ? `The Directorate network is down. <b>${M.inRange}</b> phones are in range of you and <b>${M.reach}</b> are on the mesh.` : 'The Directorate network is still up. The mesh is on standby.' },
      { id: 'ava', kw: ['ava', 'daughter', 'family', 'find'], src: 'mesh.route() · sig.verify()', a: () => S().ava && S().ava.state === 'replied' ? 'L4 Works. Her last message is signed and verified: <b>“I’m safe.”</b>' : 'Last seen on L4 Works, two levels up. Send a check-in over the mesh.' },
      { id: 'surf', kw: ['surface', 'safe', 'radiation', 'outside', 'dose'], src: 'surface.protection()', a: () => { const p = E.surface.protection(M.dose || 1);
        return (S().sent ? 'The signed probe reading says: ' : 'Probe model at background dose: ') + `<b>${p[0].label}</b> unprotected, <b>${p[1].label}</b> in a sealed suit, ${p[2].label} in a dome. Not “lethal everywhere”.`; } },
      { id: 'crew', kw: [['who goes', 2], 'first', 'crew', 'volunteer'], src: 'crew()', a: () => { const c = M.crew || E.crew();
        return `<b>${c.pick.length}</b> of ${c.considered} volunteers: best lungs, age near 32, fewer dependents, with 3 engineers, 2 medics and 4 scouts. Top pick: ${c.pick[0].name} (${c.pick[0].skill}).`; } },
      { id: 'ret', kw: ['when', 'return', 'move up', 'lift', 'everyone'], src: 'returnPlan()', a: () => `Four waves through one lift at ${M.plan.liftPerDay} a day. The Deep and the Warrens are up by day <b>${M.plan.waves[2].end}</b>, everyone by day <b>${M.plan.allUp}</b>.` },
      { id: 'trust', kw: ['trust', 'lie', 'proof', 'verify', 'signed', 'fake'], src: 'sig.verify()', a: () => S().sent ? `The probe reading is signed with ECDSA P-256 (key ${M.fp.probe || '…'}) and <b>${S().sent.ok ? 'verifies' : 'did not verify'}</b>. Change one character and the check fails.` : `Messages on the mesh are signed with ECDSA P-256. ${S().ava && S().ava.ok ? "Ava's reply verified against her key " + (M.fp.ava || '') + '.' : 'Nothing signed has arrived yet.'}` },
    ];
    const FALLBACK = 'I can answer about power, water, food, medicine, air, lungs, space, tunnels, the network, Ava, the surface, the crew and the return. Try: “How long will the water last?”';
    function route(q) {
      const t = q.toLowerCase(); let best = null, bs = 0;
      for (const it of INTENTS) { let sc = 0; for (const k of it.kw) { const [w, wt] = Array.isArray(k) ? k : [k, 1]; if (t.includes(w)) sc += wt; } if (sc > bs) { bs = sc; best = it; } }
      return best ? { a: best.a(), src: best.src } : { a: FALLBACK, src: null };
    }
    function askNow(q) {
      q = (q || '').trim(); if (!q) return;
      askBusy = q; askDraft = ''; P.render();
      setTimeout(() => { const r = route(q); askLog.unshift({ q, a: r.a, src: r.src }); askLog.length = Math.min(askLog.length, 3); askBusy = null; P.render(); }, 400);
    }
    const CHIPS = ['Is the lift running?', 'Where is Ava?', 'How long until dark?', 'Is the surface safe?', 'How long will the water last?', 'Who gets sun-lamp slots?', 'Is there enough insulin?', 'Why does the Deep go first?'];
    function askCard() {
      return `<div class="card" id="askcard" style="border-color:rgba(95,208,255,.25)"><div class="lbl">ASK STRATA · WORKS WITH THE NETWORK DOWN</div>
        <div class="askrow"><input id="askq" type="text" autocomplete="off" placeholder="Ask anything about the Hollow…" value="${askDraft.replace(/"/g, '&quot;')}" aria-label="Ask Strata"><button type="button" data-act="asksend">ASK</button></div>
        <div style="margin-top:10px">${CHIPS.map(c => `<button type="button" class="chipq" data-act="ask" data-arg="${c}">${c}</button>`).join('')}</div>
        ${askBusy ? `<div class="qa"><div class="q">${askBusy}</div><div class="a dots"><i></i><i></i><i></i></div></div>` : ''}
        ${askLog.map(x => `<div class="qa"><div class="q">${x.q.replace(/</g, '&lt;')}</div><div class="a">${x.a}</div>${x.src ? `<span class="src">computed from ${x.src}</span>` : ''}</div>`).join('')}</div>`;
    }
    function mesh() {
      const s = S(); story.act('mesh');
      let body = hd('PROBLEM #7 · NETWORK CUT  +  #8 FAMILIES', '#9fdcff', 'Resident mesh', '#eaf7ff', 'Phones pass messages hand to hand. No towers, no Directorate.');
      if (!s.netCut) body += `<div class="note" style="background:rgba(61,220,151,.08);border:1px solid rgba(61,220,151,.35);color:#c9f5df">Directorate network is up. The mesh stays on standby and wakes the moment the network is cut.</div>`;
      else {
        body += `<div class="note alert" style="margin-top:14px;padding:10px 12px;background:rgba(255,90,77,.08);border:1px solid rgba(255,90,77,.35);font-size:12.5px;color:#ffd2cc"><span class="pulse" style="width:8px;height:8px;border-radius:50%;background:#ff5a4d"></span>Directorate network offline</div>`;
        body += `<div class="card" style="margin-top:10px;padding:8px 6px 6px;border-color:rgba(95,208,255,.25)">${meshMap()}</div>`;
        body += `<div class="card" style="border-color:rgba(95,208,255,.35)"><div class="lbl">PHONES ON THE MESH</div>${verdict(String(M.reach), 'on the mesh', '#5fd0ff', 'reach')}<div class="why"><b data-live="range">${M.inRange}</b> in range of you · ${s.broadcast ? 'warning delivered to every one' : 'no towers, no Directorate'}</div></div>`;
        body += `<div class="row3"><div><div class="lbl">IN RANGE OF YOU</div><div class="big" style="color:#5fd0ff">${M.inRange}</div></div><div><div class="lbl">ON THE MESH</div><div class="big" style="color:#5fd0ff">${M.reach}</div></div><div><div class="lbl">SIGNING</div><div class="big" style="color:#3ddc97">P-256</div></div></div>`;
        if (!s.broadcast) body += btn('broadcast', 'BROADCAST BLACKOUT WARNING', '#5fd0ff', 'linear-gradient(90deg,#0e3b56,#2a1757)');
        else if (!s.ava) body += btn('ava', 'CHECK IN ON AVA · L4 WORKS', '#ffcf7a', 'linear-gradient(90deg,#4a3206,#2a1757)');
        if (s.ava) {
          const r = s.ava.state === 'replied';
          body += `<div class="note mono" style="background:rgba(8,12,20,.92);border:1px solid ${r ? 'rgba(61,220,151,.5)' : 'rgba(255,207,122,.4)'};font-size:11px;line-height:1.6;color:#a9b6cc">
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="letter-spacing:.1em;color:${r ? '#3ddc97' : '#ffcf7a'}">${r ? (s.ava.ok ? 'AVA · SIGNATURE VALID' : 'AVA · UNVERIFIED') : 'ROUTING TO AVA… ' + (M.route ? M.route.path.length - 1 + ' HOPS' : '')}</span>${ic('lock', r ? '#3ddc97' : '#ffcf7a', 18)}</div>
            ${r ? `<div style="font:600 15px Inter,sans-serif;color:#eafff5;margin:6px 0">“${s.ava.text.split(' — ')[0]}”</div><div>key   ECDSA P-256 · ${M.fp.ava || '…'}</div><div>sig   ${s.ava.sig ? s.ava.sig.slice(0, 24) + '…' : '—'}</div>` : `<div>Through ${M.route ? M.route.path.length - 2 : '…'} phones to the lift relay, then up the shaft to L4.</div>`}</div>`;
        }
      }
      body += askCard();
      body += pw('MetroStar HorizonHunt-style offline AI · on-device', 'ECDSA P-256');
      return body;
    }

    // ------------------------------------------------------------ SURFACE (Act 3)
    function surface() {
      const s = S(), mapped = s.mapped.length, HOT = C.G.S.hotspots, onS = P.state.level === 'The surface';
      const prot = protNow(onS);
      const area = s.mapped.reduce((a, i) => a + Math.PI * Math.pow(HOT[i][2] * 2.2, 2), 0) / (92 * 92);
      let body = hd('PROBLEM #13 · IS IT SAFE?  +  #14 WHO FIRST', '#d6b6ff', 'Surface truth', '#f4ecff', 'Probes at the hatch measure the air. A drone maps the hotspots.');
      if (s.stage < 6) return body + `<div class="note" style="background:rgba(255,90,77,.08);border:1px solid rgba(255,90,77,.35);color:#ffd2cc">Hatch sealed by Directorate order. Nobody below can read the probes.</div>`;
      body += `<div class="card" style="border-color:rgba(194,123,255,.45)"><div class="lbl">TIME OUTSIDE IN A SEALED SUIT</div>${verdict(prot[1].label, 'not minutes', '#d6b6ff')}${s.sent ? delta('“lethal in minutes”', prot[1].label, 'signed') : '<div class="why">The Directorate says the air kills in minutes. The probe measures it.</div>'}</div>`;
      body += `<div style="margin:14px 16px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="padding:12px;border-radius:14px;background:rgba(255,90,77,.07);border:1px solid rgba(255,90,77,.35)"><div class="lbl" style="color:#ff8a80">DIRECTORATE SAYS</div><div style="font:700 19px Rajdhani,sans-serif;margin-top:4px;color:#ffd2cc">Lethal in minutes</div><div style="font-size:12px;color:#c9a9a4">No data published</div></div>
        <div style="padding:12px;border-radius:14px;background:rgba(194,123,255,.08);border:1px solid rgba(194,123,255,.4)"><div class="lbl" style="color:#d6b6ff">PROBE AT YOUR SPOT</div><div style="font:700 19px Rajdhani,sans-serif;margin-top:4px;color:#f4ecff" data-live="dose">${onS ? '×' + M.dose.toFixed(2) + ' background' : 'Go up to read'}</div><div style="font-size:12px;color:#b9a9d0" data-live="drone">${M.droneMsg}</div></div></div>`;
      body += `<div class="card" style="border-color:rgba(194,123,255,.3)"><div class="lbl">TIME TO THE DOSE LIMIT · LIVE AT YOUR POSITION</div><table class="tbl" style="margin-top:8px">${prot.map(o => `<tr><td>${o.name}</td><td style="color:#8fa0bb">${o.ready}</td><td class="mono" data-live="t-${o.id}" style="text-align:right;color:${o.id === 'none' ? '#ff8a80' : o.id === 'suit' ? '#d6b6ff' : '#8ff0c4'}">${o.label}</td></tr>`).join('')}</table></div>`;
      body += cop(`At your spot the dose is <b>×${(onS ? M.dose : 1).toFixed(2)}</b> background. Unprotected you reach the limit in <b>${prot[0].label}</b>; a sealed suit stretches that to <b>${prot[1].label}</b>. The drone has mapped <b>${mapped} of ${HOT.length}</b> hotspots, covering about <b>${Math.round(area * 100)}%</b> of the surveyed area. Recommendation: suits for a scout crew now, domes for the next wave.`);
      if (!s.crew) body += btn('crew', mapped < 2 ? 'WAITING FOR THE DRONE · ' + mapped + ' OF 2 HOTSPOTS' : 'PICK THE FIRST CREW', '#c27bff', 'linear-gradient(90deg,#2a1757,#4a1d6b)', mapped < 2);
      if (M.crew) body += `<div class="card" style="border-color:rgba(194,123,255,.3)"><div class="lbl" style="display:flex;justify-content:space-between"><span>FIRST CREW · ${M.crew.pick.length} OF ${M.crew.considered} VOLUNTEERS</span><span>SCORE</span></div><table class="tbl" style="margin-top:6px">${M.crew.pick.slice(0, 8).map(v => `<tr><td>${v.name}</td><td style="color:#8fa0bb">${v.skill} · ${v.level}</td><td class="mono" style="color:#8fa0bb">lungs ${v.lungs}</td><td class="mono" style="text-align:right;color:#d6b6ff">${v.score}</td></tr>`).join('')}</table>
        <div style="font-size:11px;color:#8fa0bb;margin-top:6px">Score: lung health, age near 32, fewer dependents. Quotas: 3 engineers, 2 medics, 4 scouts. +${M.crew.pick.length - 8} more.</div></div>`;
      if (s.crew && !s.planted) body += `<div class="note" style="background:rgba(61,220,151,.08);border:1px solid rgba(61,220,151,.4);color:#c9f5df">Strata picked the probe site: the lowest dose near the hatch, away from every mapped hotspot. Walk to the green marker and press E.</div>`;
      if (s.planted) body += `<div class="note mono" style="background:rgba(8,12,20,.92);border:1px solid ${s.sent ? 'rgba(61,220,151,.5)' : 'rgba(255,176,32,.4)'};font-size:11px;line-height:1.6;color:#a9b6cc">
        <div style="display:flex;justify-content:space-between;align-items:center"><span style="letter-spacing:.1em;color:${s.sent ? '#3ddc97' : '#ffb020'}">${s.sent ? (s.sent.ok ? 'SIGNED · VERIFIED · SENT' : 'SENT · UNVERIFIED') : 'PROBE PLANTED · UNSIGNED'}</span>${ic('lock', s.sent ? '#3ddc97' : '#ffb020', 18)}</div>
        ${s.sent ? `<div style="color:#dbe4f3;margin:4px 0">${s.sent.reading}</div><div>key   ECDSA P-256 · probe-07 · ${M.fp.probe || '…'}</div><div>sig   ${s.sent.sig ? s.sent.sig.slice(0, 24) + '…' : '—'}</div><div style="color:#3ddc97">Down the hatch, through the mesh, to all six levels</div>` : '<div>Sign it so nobody can alter it on the way down.</div>'}</div>`;
      if (s.planted && !s.sent) body += btn('sign', 'SIGN + SEND DOWN THE MESH', '#c27bff', 'linear-gradient(90deg,#2a1757,#4a1d6b)');
      body += `<button type="button" class="btn" data-go="ret" style="border-color:rgba(255,176,32,.5);background:rgba(14,20,31,.9);color:#ffd27a">RETURN PLAN →</button>`;
      body += pw('MetroStar Falcon-style drone', 'ECDSA P-256', 'Azure Digital Twins model');
      return body;
    }

    // ------------------------------------------------------------ RETURN PLAN (#15)
    function ret() {
      const pl = M.plan, s = S();
      let body = hd('PROBLEM #15 · THE WAY UP', '#ffd9a0', 'Return plan', '#fff4e0', `One lift, ${pl.total.toLocaleString()} residents. Strata plans the move in waves.`);
      body += `<div class="card" style="border-color:rgba(255,176,32,.4)"><div class="lbl">EVERYONE UP BY</div>${verdict('Day ' + pl.allUp, `${pl.total.toLocaleString()} people · ${pl.waves.length} waves`, '#ffd27a')}</div>`;
      body += `<div class="row3" style="margin-top:14px"><div><div class="lbl">LIFT / DAY</div><div class="big" style="color:#ffd27a">${pl.liftPerDay}</div></div><div><div class="lbl">WAVES</div><div class="big" style="color:#ffd27a">${pl.waves.length}</div></div><div><div class="lbl">ALL UP BY</div><div class="big" style="color:#ffd27a">Day ${pl.allUp}</div></div></div>`;
      // crowding (#6 SPACE)
      const sp = (M.life || E.life(E.allocate(78, 'str'))).space, maxM = 11, minX = 3.5 / maxM * 100;
      body += `<div id="crowd">` + cardOpen('#c9b6ff', 'SPACE · #6', 'apt') + verdict(sp[5].m2.toFixed(1), 'm² per person in the Deep', sp[5].crowded ? RED : GREEN);
      body += `<div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">${sp.map(x => `<div style="display:grid;grid-template-columns:76px 1fr 64px;gap:8px;align-items:center;font-size:12px;color:#c8d4e6"><span>${x.name}</span>
        <div class="bar" style="height:12px"><i style="width:${(x.m2 / maxM * 100).toFixed(1)}%;background:${x.crowded ? RED : '#8fa0bb'}"></i><div style="position:absolute;left:${minX.toFixed(1)}%;top:-2px;bottom:-2px;border-left:2px dashed rgba(255,255,255,.6)"></div></div>
        <span class="mono" style="text-align:right;color:${x.crowded ? RED : '#c8d4e6'}">${x.m2.toFixed(1)}${x.crowded ? ' ⚠' : ''}</span></div>`).join('')}</div>
        <div class="why" style="color:#8fa0bb">Dashed line: 3.5 m² minimum. ${sp.filter(x => x.crowded).map(x => x.name).join(', ')} OVERCROWDED.</div>
        <div class="why">The Deep has the least room and the worst lungs. That is why it goes up first.</div></div></div>`;
      // corridors (#5 TUNNELS)
      const stg = stagger === null ? s.applied === 'str' : stagger, T = E.tunnels(stg), T0 = E.tunnels(false), T1 = E.tunnels(true);
      const maxP = T0.peak, BH = 120, cap = T.capacity, yCap = (BH - cap / maxP * BH).toFixed(1);
      const bw = stg ? 40 : 120, gap = stg ? 10 : 0;
      body += cardOpen('#ffcf7a', 'TUNNELS · #5', 'mesh') + verdict(n0(T.peak), 'people at peak in the corridors', T.load > 1 ? RED : GREEN);
      body += `<div class="dl" style="${stg ? '' : 'background:rgba(255,90,77,.1);border-color:rgba(255,90,77,.35);color:#ffb4ab'}"><s>${n0(T0.peak)}</s> → <b>${n0(T1.peak)}</b> peak</div>`;
      body += `<div class="seg" style="margin:10px 0 0" role="group"><button type="button" data-act="stagger" data-arg="0" style="${!stg ? 'background:rgba(255,90,77,.18);color:#ffb4ab' : ''}">ALL AT ONCE</button><button type="button" data-act="stagger" data-arg="1" style="${stg ? 'background:rgba(61,220,151,.18);color:#8ff0c4' : ''}">STAGGERED</button></div>`;
      body += `<svg width="326" height="${BH + 18}" viewBox="0 0 326 ${BH + 18}" style="display:block;margin-top:10px" role="img" aria-label="People per 20-minute window">
        ${T.windows.map((w, i) => { const h = w.people / maxP * BH, x = stg ? 8 + i * (bw + gap) : 100; return `<rect x="${x}" y="${(BH - h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="3" fill="${w.people > cap ? RED : GREEN}" fill-opacity=".85"/><text x="${x + bw / 2}" y="${BH + 13}" text-anchor="middle" fill="#8fa0bb" font-size="11" font-family="JetBrains Mono,monospace">${stg ? 'L' + (i + 1) : 'ALL'}</text>`; }).join('')}
        <line x1="0" y1="${yCap}" x2="326" y2="${yCap}" stroke="#fff" stroke-dasharray="4 4" stroke-opacity=".7"/><text x="322" y="${(+yCap - 4)}" text-anchor="end" fill="#c8d4e6" font-size="11" font-family="JetBrains Mono,monospace">CAPACITY ${n0(cap)}</text></svg>`;
      if (stg) body += `<table class="tbl" style="margin-top:6px">${T.windows.map(w => { const m = 360 + w.start; return `<tr><td>${w.who}</td><td class="mono" style="text-align:right;color:#c8d4e6">${String(m / 60 | 0).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}</td><td class="mono" style="text-align:right;color:#8fa0bb">${n0(w.people)}</td></tr>`; }).join('')}</table>
        <div class="why" style="color:#8fa0bb">Strata sends each level its window over the mesh.</div>`;
      body += '</div>' + cop(`Shift changes are staggered by level, so the main corridors never carry more than <b>${Math.round(T1.load * 100)}%</b> of their capacity, down from <b>${(T0.load).toFixed(1)}×</b> when everyone moves at once. The same windows are used for the lift during the return.`);
      body += `<div class="card" style="padding:14px 14px 6px;border-color:rgba(255,176,32,.28)">${pl.waves.map(w => `<div class="wave" style="cursor:default">
        <span class="n" style="border-color:${w.color};color:${w.color}">${w.n}</span><span style="display:flex;flex-direction:column;gap:2px"><span style="font:700 17px Rajdhani,sans-serif;letter-spacing:.03em">${w.name}</span><span style="font-size:12px;color:#a9b6cc;line-height:1.4">${w.who} · ${w.people.toLocaleString()}${w.n === 3 ? ' · <span role="button" data-act="why" style="color:#9fdcff;text-decoration:underline;cursor:pointer">why?</span>' : ''}</span></span>
        <span class="mono" style="font-size:11px;color:${w.color};white-space:nowrap">DAY ${w.start}${w.end > w.start ? '–' + w.end : ''}</span></div>`).join('')}</div>`;
      body += cop(`The levels that suffered most go up first, the opposite of the Directorate’s order. At ${pl.liftPerDay} people a day the Deep and the Warrens are up by day ${pl.waves[2].end}, and everyone by day ${pl.allUp}. Strata keeps rebalancing power below for everyone still waiting.`);
      if (s.stage >= 11 && !s.ended) body += btn('finish', 'STRATA. THE TRUTH, AND THE WAY UP.', '#ffb020', 'linear-gradient(90deg,#5a3a06,#2a1757)');
      body += pw('Azure Digital Twins model', 'Caelon Prism-style energy model');
      return body;
    }

    const R = { home, power, life: lifeScr, share, mesh, surface, ret };
    return {
      bg: BG,
      render: scr => (R[scr] || home)(),
      dots: () => ({ life: !!M.life && (cutOff(M.life) > 0 || !!M.life.leak) }),
      live(el) {
        const inp = el.querySelector('#askq');
        if (inp && !inp.dataset.wired) {
          inp.dataset.wired = 1;
          const stop = e => e.stopPropagation();
          inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); askNow(inp.value); } else if (e.key === 'Escape') { e.preventDefault(); inp.blur(); } });
          inp.addEventListener('keyup', stop); inp.addEventListener('keypress', stop);
          inp.addEventListener('input', () => { askDraft = inp.value; });
          inp.addEventListener('focus', () => { askFocus = true; });
          inp.addEventListener('blur', () => { askFocus = false; });
          inp.addEventListener('click', stop); inp.addEventListener('mousedown', stop);
          if (askFocus) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); const c = el.querySelector('#askcard'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' }); }
        }
        el.querySelectorAll('.lsi[data-on]').forEach(n => { const off = n.dataset.on === '0'; if (n.classList.contains('off') !== off) { void n.offsetWidth; n.classList.toggle('off', off); } });
        const set = (k, v) => { if (tweening[k]) return; const n = el.querySelector(`[data-live="${k}"]`); if (n && n.textContent !== v) n.textContent = v; };
        set('cd', S().applied === 'str' ? '6 H+' : fmt(M.cd));
        { const f = liveFeeds()[2]; set('f3t', f.temp.toFixed(1) + ' °C'); const w = el.querySelector('[data-live-w="f3"]'); if (w) w.setAttribute('width', ((f.temp - 60) / 45 * 300).toFixed(1)); }
        el.querySelectorAll('.vn[data-live]').forEach(n => {
          const k = n.dataset.live, cur = n.textContent, prev = lastShown[k];
          if (prev !== undefined && prev !== cur && !tweening[k]) {
            const a = parseFloat(prev.replace(/,/g, '')), b = parseFloat(cur.replace(/,/g, ''));
            if (isFinite(a) && isFinite(b)) tween(n, k, a, b, cur);
            const card = n.closest('.card'); if (card) { card.classList.add('glow'); setTimeout(() => card.classList.remove('glow'), 1000); }
          }
          lastShown[k] = cur;
        });
        if (M.life) { set('cut', n0(cutOff(M.life))); set('water', d1(M.life.waterDays)); set('food', d0(M.life.foodDays)); }
        set('range', String(M.inRange)); if (S().broadcast) set('reach', String(M.reach));
        if (P.state.level === 'The surface') {
          set('dose', '×' + M.dose.toFixed(2) + ' background'); set('drone', M.droneMsg);
          for (const o of protNow(true)) set('t-' + o.id, o.label);
        }
      },
      act(a, el) {
        const arg = el && el.dataset.arg;
        if (a === 'go-share') { P.go('share'); return; }
        if (a === 'ask') { askNow(arg); return; }
        if (a === 'asksend') { const i = el.closest('#sp').querySelector('#askq'); askNow(i ? i.value : askDraft); return; }
        if (a === 'askopen') { askFocus = true; P.go('mesh'); return; }
        if (a === 'apply' && arg === 'dir' && !confirmDir) { confirmDir = true; P.render(); return; }
        if (a === 'canceldir') { confirmDir = false; P.render(); return; }
        if (a === 'confirmdir') { confirmDir = false; P.buzz(); story.act('apply', 'dir'); return; }
        if (a === 'preview') confirmDir = false;
        if (a === 'stagger') { stagger = arg === '1'; P.render(); return; }
        if (a === 'why') { const c = document.getElementById('crowd'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        if (a === 'heat') { heatDir = arg === '1'; P.render(); return; }
        if (a === 'chip') { chipTip = chipTip === +arg ? null : +arg; P.render(); return; }
        if (a === 'none') return;
        P.buzz();
        story.act(a, arg);
      },
    };
  };
})();
