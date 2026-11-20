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
    let ask = null;                                  // offline AI: selected question

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

    // ------------------------------------------------------------ HOME
    function home() {
      const s = S(), fixed = s.applied === 'str', dark = M.dark;
      const ring = fixed ? 40 : 578 - 578 * Math.max(0, M.cd / M.cd0);
      const tw = M.twin;
      return `<div class="grid"></div>
      <div class="hd" style="flex-direction:row;align-items:center;justify-content:space-between">
        <div><div style="font:700 28px Rajdhani,sans-serif;letter-spacing:.34em;color:#eaf4ff">STR<span style="color:#5fd0ff">A</span>TA</div>
        <div class="kick" style="color:#8fa0bb;font-size:11px">MARA · ${P.state.level.toUpperCase()}</div></div>
        <div class="mono" style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;border:1px solid ${s.netCut ? 'rgba(255,90,77,.5)' : 'rgba(61,220,151,.45)'};background:${s.netCut ? 'rgba(255,90,77,.1)' : 'rgba(61,220,151,.08)'};font-size:10.5px;color:${s.netCut ? '#ffb4ab' : '#8ff0c4'};letter-spacing:.08em">
        <span class="${s.netCut ? 'pulse' : ''}" style="width:7px;height:7px;border-radius:50%;background:${s.netCut ? '#ff5a4d' : '#3ddc97'}"></span>${s.netCut ? 'NET CUT · MESH ON' : 'NETWORK UP'}</div></div>
      <div style="position:relative;margin:18px auto 0;width:220px;height:220px">
        <svg width="220" height="220" viewBox="0 0 236 236" aria-hidden="true"><circle cx="118" cy="118" r="104" fill="none" stroke="rgba(95,208,255,.12)" stroke-width="2"/>
        <circle cx="118" cy="118" r="92" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="10"/>
        <circle cx="118" cy="118" r="92" fill="none" stroke="${fixed ? '#3ddc97' : dark ? '#ff5a4d' : '#ffb020'}" stroke-width="10" stroke-linecap="round" stroke-dasharray="578" stroke-dashoffset="${ring}" transform="rotate(-90 118 118)"/></svg>
        <div style="position:absolute;inset:14px;border-radius:50%;background:conic-gradient(from 0deg,rgba(95,208,255,.22),transparent 18%);animation:spSweep 4s linear infinite"></div>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">
          <div class="mono" style="font-size:10.5px;letter-spacing:.2em;color:${fixed ? '#8ff0c4' : '#ffcf7a'}">${fixed ? 'DEEP POWER SECURED' : dark ? 'THE DEEP IS DARK' : 'DEEP GOES DARK IN'}</div>
          <div data-live="cd" style="font:700 52px/1 Rajdhani,sans-serif;color:#fff4dd">${fixed ? '6 H+' : fmt(M.cd)}</div>
          <div style="font-size:12px;color:#a9b6cc">${M.fc ? (fixed ? pct(M.fcBypassStr.pDark) + ' of 500 forecasts dark' : pct(M.fc.pDark) + ' of 500 forecasts') : ''}</div></div></div>
      <div style="position:relative;padding:16px 16px 0;display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button type="button" class="tile" data-go="power" style="border-color:rgba(255,176,32,.35)">${ic('bolt', '#ffb020')}<b>POWER</b><span>${fixed ? 'Fair split live' : s.bypass ? 'Bypassed · split needed' : 'Feed 3 overheating'}</span></button>
        <button type="button" class="tile" data-go="mesh" style="border-color:rgba(95,208,255,.35)">${ic('mesh', '#5fd0ff')}<b>MESH</b><span>${s.ava && s.ava.state === 'replied' ? 'Ava: “I’m safe”' : s.netCut ? 'Network cut · mesh up' : 'Standby'}</span></button>
        <button type="button" class="tile" data-go="share" style="border-color:rgba(61,220,151,.35)">${ic('share', '#3ddc97')}<b>FAIR SHARE</b><span>${fixed ? 'Every level above minimum' : s.applied === 'dir' ? 'Directorate split: Deep at 0' : 'Directorate plan: Deep cut'}</span></button>
        <button type="button" class="tile" data-go="surface" style="border-color:rgba(194,123,255,.4)">${ic('sun', '#c27bff')}<b>SURFACE</b><span>${s.sent ? 'Reading signed + sent' : s.stage >= 6 ? 'Hatch override ready' : 'Sealed by Directorate'}</span></button></div>
      <div class="card" style="border-color:rgba(120,160,255,.3)"><div class="lbl">DIGITAL TWIN OF THE HOLLOW</div>
        <div class="row3" style="margin:8px 0 0"><div><div class="lbl">TWINS</div><div class="big" style="color:#9fc0ff">${tw.twins.length}</div></div><div><div class="lbl">LINKS</div><div class="big" style="color:#9fc0ff">${tw.rels.length}</div></div><div><div class="lbl">MODELS</div><div class="big" style="color:#9fc0ff">${tw.models.length}</div></div></div>
        <div class="mono" style="margin-top:8px;font-size:10px;color:#7f93b5;line-height:1.5">dtmi:strata:PowerFeed;1 → powers → dtmi:strata:Level;1<br>Levels, feeds, rooms, lamps and the lift, built from the level data.</div></div>
      ${pw('Azure Digital Twins model (DTDL)', 'MetroStar Comet-style UI')}`;
    }

    // ------------------------------------------------------------ LIFE (#4 water, #12 food, #10 medicine)
    function lifeScr() {
      const s = S(), L = M.life, Ld = M.lifeDir, str = s.applied === 'str', cut = cutOff(L);
      let body = hd('PROBLEM #4 WATER · #12 FOOD · #10 MEDICINE', '#4fc3f7', 'Life support', '#e6f6ff', 'One grid feeds the pumps, the farms and the clinic. Strata keeps all three running for everyone.');
      body += '<!--LIFESTRIP-->';
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
      body += '<!--LIFEMORE-->';
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
        <line x1="0" y1="${yMin}" x2="326" y2="${yMin}" stroke="#ff5a4d" stroke-dasharray="4 4"/><text x="4" y="${yMin - 5}" fill="#ff8a80" font-size="10" font-family="JetBrains Mono,monospace">SURVIVAL MINIMUM</text>
        ${g}<text x="4" y="${H + 12}" fill="#8fa0bb" font-size="10" font-family="JetBrains Mono,monospace">NOW</text><text x="290" y="${H + 12}" fill="#8fa0bb" font-size="10" font-family="JetBrains Mono,monospace">+${fc.horizon / 60} MIN</text></svg>`;
    }
    function power() {
      const s = S(), fc = M.fc, by = s.bypass, fixed = s.applied === 'str';
      const show = fixed ? M.fcBypassStr : fc;
      const F = E.FEEDS;
      let body = hd('PROBLEM #1 · BLACKOUTS', '#ffcf7a', 'Blackout forecast', '#fff4dd', `${fc ? fc.runs : 500} Monte Carlo runs of the geothermal grid, rerun every minute.`);
      body += steps(fixed ? 5 : by ? 3 : 2);
      body += `<div class="card" style="border-color:rgba(255,176,32,.3)"><div style="display:flex;justify-content:space-between;align-items:baseline"><div class="lbl">DEEP POWER · ${fixed ? 'AFTER FAIR SPLIT' : 'DIRECTORATE PLAN'}</div>
        <div class="big" style="color:${fixed ? '#3ddc97' : '#ffb020'}">${fixed ? pct(show.pDark) + ' DARK' : 'DARK IN ' + fmt(M.cd)}</div></div>${fan(show, fixed ? '#3ddc97' : '#ffb020')}</div>`;
      body += `<div class="row3">${F.map((f, i) => { const bad = i === 2 && !by; const byp = i === 2 && by;
        return `<div style="${bad ? 'border-color:rgba(255,90,77,.55)' : byp ? 'border-color:rgba(95,208,255,.5)' : ''}"><div class="lbl">${f.name.toUpperCase()}</div><div class="big" style="color:${bad ? '#ff5a4d' : byp ? '#5fd0ff' : '#3ddc97'}">${byp ? 'BYPASS' : bad ? f.temp + '°C' : f.cap + ' MW'}</div></div>`; }).join('')}</div>`;
      if (!by) body += cop(`Feed 3 is at ${F[2].temp} °C and climbing toward its ${F[2].trip} °C trip point. In <b>${pct(fc.pDark)}</b> of ${fc.runs} runs it trips within ${fc.horizon / 60} minutes (median <b>${fmt(fc.median)}</b>). When it trips, the Directorate’s priority order cuts the Deep first, below the ${Math.round(E.SURVIVAL * 100)}% it needs for air pumps and the lift.`);
      else if (!fixed) body += cop(`Feed 3 is bypassed, so it can no longer trip. That leaves <b>${F[0].cap + F[1].cap} MW</b> for <b>${E.LEVELS.reduce((a, l) => a + l.demand, 0)} MW</b> of demand. Under the Directorate’s order the Deep is still dark in <b>${pct(M.fcBypassDir.pDark)}</b> of runs. Choose how to share it.`);
      else body += cop(`Verified: re-ran ${show.runs} forecasts with the fair split. The Deep stays above its survival minimum in <b>${pct(1 - show.pDark)}</b> of runs. Lamps in the Deep are steady and the lift has power.`);
      body += `<div class="card" style="border-color:rgba(255,176,32,.25)"><div class="lbl">LIMITS SET BY RESIDENTS · THE AI CAN’T CROSS THEM</div><div class="kv" style="margin-top:8px">
        <span>Every level ≥ survival minimum</span><b>${Math.round(E.SURVIVAL * 100)}% of demand</b><span>Air pumps and cooling</span><b>never cut</b><span>Feed temperature</span><b>≤ 95 °C</b></div></div>`;
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
      body += `<div class="seg" role="group" aria-label="Allocation"><button type="button" data-act="preview" data-arg="dir" style="${mode === 'dir' ? 'background:rgba(255,90,77,.18);color:#ffb4ab' : ''}">DIRECTORATE</button><button type="button" data-act="preview" data-arg="str" style="${mode === 'str' ? 'background:rgba(61,220,151,.18);color:#8ff0c4' : ''}">STRATA</button></div>`;
      body += `<div class="card" style="display:flex;flex-direction:column;gap:11px"><div class="lbl" style="display:flex;justify-content:space-between"><span>POWER BY LEVEL</span><span>MW</span></div>${list}
        <div style="font-size:11px;color:#8fa0bb">White tick: survival minimum (${Math.round(E.SURVIVAL * 100)}%) for air pumps, cooling and the lift.</div></div>`;
      body += `<div class="row3"><div><div class="lbl">BELOW MIN</div><div class="big" style="color:${below.length ? '#ff5a4d' : '#3ddc97'}">${below.length}</div></div><div><div class="lbl">DEEP DARK</div><div class="big" style="color:${fc && fc.pDark > .05 ? '#ff5a4d' : '#3ddc97'}">${fc ? pct(fc.pDark) : '—'}</div></div><div><div class="lbl">RUNS</div><div class="big" style="color:#c9d4e6">${fc ? fc.runs : 500}</div></div></div>`;
      body += cop(mode === 'dir' ? `The Directorate serves levels top-down at full demand until power runs out. <b>${below.join(' and ') || 'No level'}</b> fall${below.length === 1 ? 's' : ''} below the survival minimum, and the Deep goes dark in <b>${fc ? pct(fc.pDark) : '—'}</b> of runs.`
        : `Same ${total} MW. Strata gives every level its survival minimum first, then shares the rest by unmet need. No level drops below the line, and the Deep goes dark in only <b>${fc ? pct(fc.pDark) : '—'}</b> of runs.`);
      if (!s.bypass) body += `<div class="note" style="background:rgba(255,176,32,.08);border:1px solid rgba(255,176,32,.35);color:#ffe8c2">First approve the feed 3 bypass on the Power screen.</div>`;
      else if (s.applied !== 'str') body += btn('apply', mode === 'str' ? 'APPLY STRATA SPLIT' : 'APPLY DIRECTORATE SPLIT', mode === 'str' ? '#3ddc97' : '#ff5a4d', mode === 'str' ? 'linear-gradient(90deg,#0c3b2a,#0f4d3a)' : 'linear-gradient(90deg,#4a1010,#6a1a10)', false, mode);
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
      o += `<text x="${(+X(0) + 9)}" y="${(+Y(-1.9) + 4)}" fill="#9fdcff" font-size="10" font-family="JetBrains Mono,monospace">LIFT RELAY</text>`;
      return `<svg width="330" height="300" viewBox="0 0 330 300" style="display:block" role="img" aria-label="Map of resident phones in the Deep">${o}</svg>`;
    }
    const QA = {
      lift: ['Is the lift running?', () => S().stage >= 3 ? 'Yes. The fair split keeps the lift motors above their minimum. It serves every level and, with an override, the hatch.' : 'Not yet. The Deep is on reserve power and the lift motors are cut first.'],
      ava: ['Where is Ava?', () => S().ava && S().ava.state === 'replied' ? 'L4 Works. Her last message is signed and verified: “I’m safe.”' : 'Last seen on L4 Works, two levels up. Send a check-in over the mesh.'],
      dark: ['How long until dark?', () => S().applied === 'str' ? 'The Deep is lit. In ' + pct(1 - M.fcBypassStr.pDark) + ' of forecast runs it stays lit for the next 6 minutes and beyond.' : 'About ' + fmt(M.cd) + ', unless power is rebalanced.'],
      surf: ['Is the surface safe?', () => S().sent ? 'The signed probe reading says: hours in a sealed suit, minutes without one. Not “lethal everywhere”.' : 'Unknown. Nobody below can read the hatch probes yet.'],
    };
    function mesh() {
      const s = S(); story.act('mesh');
      let body = hd('PROBLEM #7 · NETWORK CUT  +  #8 FAMILIES', '#9fdcff', 'Resident mesh', '#eaf7ff', 'Phones pass messages hand to hand. No towers, no Directorate.');
      if (!s.netCut) body += `<div class="note" style="background:rgba(61,220,151,.08);border:1px solid rgba(61,220,151,.35);color:#c9f5df">Directorate network is up. The mesh stays on standby and wakes the moment the network is cut.</div>`;
      else {
        body += `<div class="note alert" style="margin-top:14px;padding:10px 12px;background:rgba(255,90,77,.08);border:1px solid rgba(255,90,77,.35);font-size:12.5px;color:#ffd2cc"><span class="pulse" style="width:8px;height:8px;border-radius:50%;background:#ff5a4d"></span>Directorate network offline</div>`;
        body += `<div class="card" style="margin-top:10px;padding:8px 6px 6px;border-color:rgba(95,208,255,.25)">${meshMap()}</div>`;
        body += `<div class="row3"><div><div class="lbl">IN RANGE</div><div class="big" data-live="range" style="color:#5fd0ff">${M.inRange}</div></div><div><div class="lbl">REACHED</div><div class="big" data-live="reach" style="color:#5fd0ff">${s.broadcast ? M.reach : '—'}</div></div><div><div class="lbl">SIGNING</div><div class="big" style="color:#3ddc97">P-256</div></div></div>`;
        if (!s.broadcast) body += btn('broadcast', 'BROADCAST BLACKOUT WARNING', '#5fd0ff', 'linear-gradient(90deg,#0e3b56,#2a1757)');
        else if (!s.ava) body += btn('ava', 'CHECK IN ON AVA · L4 WORKS', '#ffcf7a', 'linear-gradient(90deg,#4a3206,#2a1757)');
        if (s.ava) {
          const r = s.ava.state === 'replied';
          body += `<div class="note mono" style="background:rgba(8,12,20,.92);border:1px solid ${r ? 'rgba(61,220,151,.5)' : 'rgba(255,207,122,.4)'};font-size:11px;line-height:1.6;color:#a9b6cc">
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="letter-spacing:.1em;color:${r ? '#3ddc97' : '#ffcf7a'}">${r ? (s.ava.ok ? 'AVA · SIGNATURE VALID' : 'AVA · UNVERIFIED') : 'ROUTING TO AVA… ' + (M.route ? M.route.path.length - 1 + ' HOPS' : '')}</span>${ic('lock', r ? '#3ddc97' : '#ffcf7a', 18)}</div>
            ${r ? `<div style="font:600 15px Inter,sans-serif;color:#eafff5;margin:6px 0">“${s.ava.text.split(' — ')[0]}”</div><div>key   ECDSA P-256 · ${M.fp.ava || '…'}</div><div>sig   ${s.ava.sig ? s.ava.sig.slice(0, 24) + '…' : '—'}</div>` : `<div>Through ${M.route ? M.route.path.length - 2 : '…'} phones to the lift relay, then up the shaft to L4.</div>`}</div>`;
        }
        body += `<div class="card" style="border-color:rgba(95,208,255,.25)"><div class="lbl">ASK STRATA · WORKS WITH THE NETWORK DOWN</div><div style="margin-top:10px">${Object.entries(QA).map(([k, q]) => `<button type="button" class="chipq" data-act="ask" data-arg="${k}">${q[0]}</button>`).join('')}</div>
          ${ask ? `<div style="font-size:12.5px;line-height:1.5;color:#dbe6ff;margin-top:4px">${QA[ask][1]()}</div>` : ''}</div>`;
        body += pw('MetroStar HorizonHunt-style offline AI · on-device', 'ECDSA P-256');
      }
      return body;
    }

    // ------------------------------------------------------------ SURFACE (Act 3)
    function surface() {
      const s = S(), mapped = s.mapped.length, HOT = C.G.S.hotspots, onS = P.state.level === 'The surface';
      const prot = E.surface.protection(onS ? M.dose : 1);
      const area = s.mapped.reduce((a, i) => a + Math.PI * Math.pow(HOT[i][2] * 2.2, 2), 0) / (92 * 92);
      let body = hd('PROBLEM #13 · IS IT SAFE?  +  #14 WHO FIRST', '#d6b6ff', 'Surface truth', '#f4ecff', 'Probes at the hatch measure the air. A drone maps the hotspots.');
      if (s.stage < 6) return body + `<div class="note" style="background:rgba(255,90,77,.08);border:1px solid rgba(255,90,77,.35);color:#ffd2cc">Hatch sealed by Directorate order. Nobody below can read the probes.</div>`;
      body += `<div style="margin:14px 16px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="padding:12px;border-radius:14px;background:rgba(255,90,77,.07);border:1px solid rgba(255,90,77,.35)"><div class="lbl" style="color:#ff8a80">DIRECTORATE SAYS</div><div style="font:700 19px Rajdhani,sans-serif;margin-top:4px;color:#ffd2cc">Lethal in minutes</div><div style="font-size:11.5px;color:#c9a9a4">No data published</div></div>
        <div style="padding:12px;border-radius:14px;background:rgba(194,123,255,.08);border:1px solid rgba(194,123,255,.4)"><div class="lbl" style="color:#d6b6ff">PROBE AT YOUR SPOT</div><div style="font:700 19px Rajdhani,sans-serif;margin-top:4px;color:#f4ecff" data-live="dose">${onS ? '×' + M.dose.toFixed(2) + ' background' : 'Go up to read'}</div><div style="font-size:11.5px;color:#b9a9d0" data-live="drone">${M.droneMsg}</div></div></div>`;
      body += `<div class="card" style="border-color:rgba(194,123,255,.3)"><div class="lbl">TIME TO THE DOSE LIMIT · LIVE AT YOUR POSITION</div><table class="tbl" style="margin-top:8px">${prot.map(o => `<tr><td>${o.name}</td><td style="color:#8fa0bb">${o.ready}</td><td class="mono" data-live="t-${o.id}" style="text-align:right;color:${o.id === 'none' ? '#ff8a80' : o.id === 'suit' ? '#d6b6ff' : '#8ff0c4'}">${o.label}</td></tr>`).join('')}</table></div>`;
      body += cop(`At your spot the dose is <b>×${(onS ? M.dose : 1).toFixed(2)}</b> background. Unprotected you reach the limit in <b>${prot[0].label}</b>; a sealed suit stretches that to <b>${prot[1].label}</b>. The drone has mapped <b>${mapped} of ${HOT.length}</b> hotspots, covering about <b>${Math.round(area * 100)}%</b> of the surveyed area. Recommendation: suits for a scout crew now, domes for the next wave.`);
      if (!s.crew) body += btn('crew', 'PICK THE FIRST CREW', '#c27bff', 'linear-gradient(90deg,#2a1757,#4a1d6b)', mapped < 2);
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
      body += `<div class="row3" style="margin-top:14px"><div><div class="lbl">LIFT / DAY</div><div class="big" style="color:#ffd27a">${pl.liftPerDay}</div></div><div><div class="lbl">WAVES</div><div class="big" style="color:#ffd27a">${pl.waves.length}</div></div><div><div class="lbl">ALL UP BY</div><div class="big" style="color:#ffd27a">Day ${pl.allUp}</div></div></div>`;
      body += `<div class="card" style="padding:14px 14px 6px;border-color:rgba(255,176,32,.28)">${pl.waves.map(w => `<div class="wave" style="cursor:default">
        <span class="n" style="border-color:${w.color};color:${w.color}">${w.n}</span><span style="display:flex;flex-direction:column;gap:2px"><span style="font:700 17px Rajdhani,sans-serif;letter-spacing:.03em">${w.name}</span><span style="font-size:12px;color:#a9b6cc;line-height:1.4">${w.who} · ${w.people.toLocaleString()}</span></span>
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
        const set = (k, v) => { const n = el.querySelector(`[data-live="${k}"]`); if (n && n.textContent !== v) n.textContent = v; };
        set('cd', S().applied === 'str' ? '6 H+' : fmt(M.cd));
        if (M.life) { set('cut', n0(cutOff(M.life))); set('water', d1(M.life.waterDays)); set('food', d0(M.life.foodDays)); }
        set('range', String(M.inRange)); if (S().broadcast) set('reach', String(M.reach));
        if (P.state.level === 'The surface') {
          set('dose', '×' + M.dose.toFixed(2) + ' background'); set('drone', M.droneMsg);
          for (const o of E.surface.protection(M.dose)) set('t-' + o.id, o.label);
        }
      },
      act(a, el) {
        const arg = el && el.dataset.arg;
        if (a === 'go-share') { P.go('share'); return; }
        if (a === 'ask') { ask = arg; P.render(); return; }
        if (a === 'none') return;
        P.buzz();
        story.act(a, arg);
      },
    };
  };
})();
