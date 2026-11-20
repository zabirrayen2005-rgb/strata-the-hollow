// Strata in-game phone: mini phone bottom-right -> raise to center over a dimmed backdrop.
(function () {
  'use strict';
  const css = `
  #spDim{position:fixed;inset:0;z-index:20;background:rgba(0,0,0,0);pointer-events:none;transition:background .55s ease, backdrop-filter .55s ease;}
  #spDim.on{background:rgba(2,4,8,.66);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);pointer-events:auto;}
  #sp{position:fixed;left:0;top:0;width:390px;height:844px;z-index:21;transform-origin:0 0;border-radius:48px;
      box-shadow:0 0 0 9px #0e1116,0 0 0 11px #2b3039,0 24px 70px rgba(0,0,0,.65);overflow:hidden;cursor:pointer;
      transition:transform .62s cubic-bezier(.2,.85,.25,1), box-shadow .4s;will-change:transform;user-select:none;-webkit-user-select:none}
  #sp.open{cursor:default}
  #sp.mini:hover{box-shadow:0 0 0 9px #0e1116,0 0 0 11px #5fd0ff,0 0 30px rgba(95,208,255,.45)}
  #spBadge{position:fixed;z-index:22;font:600 11px/1 'JetBrains Mono',ui-monospace,monospace;color:#9fdcff;letter-spacing:.12em;background:rgba(8,12,20,.8);
      border:1px solid rgba(95,208,255,.35);border-radius:6px;padding:5px 7px;pointer-events:none;transition:opacity .3s;white-space:nowrap}
  #sp *{box-sizing:border-box}
  #sp .scr{position:absolute;inset:0;display:none;flex-direction:column;font-family:Inter,system-ui,sans-serif;color:#dbe4f3;overflow:hidden}
  #sp .scr.on{display:flex}
  #sp .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(95,208,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(95,208,255,.05) 1px,transparent 1px);background-size:26px 26px;pointer-events:none}
  #sp .hd{position:relative;padding:58px 22px 0;display:flex;flex-direction:column;gap:4px}
  #sp .kick{font:500 11px 'JetBrains Mono',monospace;letter-spacing:.16em}
  #sp h1{margin:0;font:700 30px Rajdhani,sans-serif;letter-spacing:.04em}
  #sp .sub{font-size:13px;color:#a9b6cc}
  #sp .card{position:relative;margin:12px 16px 0;padding:14px;border-radius:18px;background:rgba(14,20,31,.86);border:1px solid rgba(120,150,200,.16)}
  #sp .mono{font-family:'JetBrains Mono',monospace}
  #sp .lbl{font:500 10.5px 'JetBrains Mono',monospace;color:#8fa0bb;letter-spacing:.1em}
  #sp .big{font:700 22px Rajdhani,sans-serif}
  #sp .row3{margin:12px 16px 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  #sp .row3>div{padding:10px;border-radius:14px;background:rgba(14,20,31,.86);border:1px solid rgba(120,150,200,.16)}
  #sp .btn{display:flex;align-items:center;justify-content:center;width:calc(100% - 32px);margin:14px 16px 0;min-height:54px;border-radius:16px;color:#fff;
      font:700 17px Rajdhani,sans-serif;letter-spacing:.1em;cursor:pointer;border:1px solid}
  #sp .note{margin:12px 16px 0;padding:12px 14px;border-radius:14px;font-size:13px;line-height:1.5}
  #sp nav{position:absolute;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));padding:10px 4px 30px;background:rgba(8,11,17,.94);border-top:1px solid rgba(120,150,200,.16)}
  #sp nav button{background:none;border:0;display:flex;flex-direction:column;align-items:center;gap:4px;min-height:44px;font:600 11px Inter,sans-serif;color:#8fa0bb;cursor:pointer;position:relative}
  #sp nav button .dot{position:absolute;top:2px;right:calc(50% - 16px);width:8px;height:8px;border-radius:50%;background:#ff5a4d;box-shadow:0 0 6px #ff5a4d}
  #sp .homebar{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);width:134px;height:5px;border-radius:3px;background:rgba(255,255,255,.55);z-index:5;cursor:pointer;border:0;padding:0}
  #sp .island{position:absolute;top:11px;left:50%;transform:translateX(-50%);width:120px;height:34px;border-radius:20px;background:#000;z-index:5}
  #sp .tile{display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:16px;background:rgba(14,20,31,.84);border:1px solid;color:#dbe4f3;cursor:pointer;text-align:left;font-family:Inter,sans-serif}
  #sp .tile b{font:700 17px Rajdhani,sans-serif;letter-spacing:.06em}
  #sp .tile span{font-size:12px;color:#a9b6cc}
  #sp .seg{margin:16px 16px 0;padding:4px;border-radius:14px;background:rgba(14,20,31,.9);border:1px solid rgba(120,150,200,.18);display:grid;grid-template-columns:1fr 1fr;gap:4px}
  #sp .seg button{min-height:44px;border-radius:10px;border:0;cursor:pointer;font:700 15px Rajdhani,sans-serif;letter-spacing:.08em;background:transparent;color:#8fa0bb}
  #sp .bar{position:relative;height:16px;border-radius:6px;background:rgba(255,255,255,.05);overflow:hidden}
  #sp .bar i{position:absolute;left:0;top:0;bottom:0;border-radius:6px;transition:width .6s cubic-bezier(.2,.8,.2,1)}
  #sp .wave{display:grid;grid-template-columns:34px 1fr auto;gap:12px;align-items:start;text-align:left;padding:10px 6px;border:0;border-radius:12px;background:transparent;color:#dbe4f3;cursor:pointer;width:100%;font-family:Inter,sans-serif}
  #sp .wave .n{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 17px Rajdhani,sans-serif;border:2px solid}
  @keyframes spPulse{0%,100%{opacity:1}50%{opacity:.35}} @keyframes spSweep{to{transform:rotate(360deg)}}
  #sp .pulse{animation:spPulse 1.4s infinite}
  /* ---- live app (js/app.js) ---- */
  #sp .body{position:absolute;left:0;right:0;top:0;bottom:84px;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;padding-bottom:18px}
  #sp .body::-webkit-scrollbar{display:none}
  #sp .body.in{animation:spIn .32s cubic-bezier(.2,.8,.2,1)}
  @keyframes spIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  @keyframes spBuzz{0%,100%{translate:0 0}20%{translate:-3px 0}40%{translate:3px 0}60%{translate:-2px 0}80%{translate:2px 0}}
  #sp.buzz .scr{animation:spBuzz .28s linear}
  #sp .btn:active,#sp .tile:active,#sp .chipq:active{transform:scale(.97)}
  #sp .btn[disabled]{opacity:.45;cursor:default}
  #sp .pw{margin:10px 16px 0;font:500 10px 'JetBrains Mono',monospace;letter-spacing:.08em;color:#6f7f99;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  #sp .pw b{color:#9fb3d1;font-weight:700}
  #sp .cop{margin:12px 16px 0;padding:12px 14px;border-radius:14px;background:linear-gradient(135deg,rgba(40,90,200,.16),rgba(120,60,200,.12));border:1px solid rgba(120,160,255,.35);font-size:12.5px;line-height:1.5;color:#dbe6ff}
  #sp .cop .who{font:600 10.5px 'JetBrains Mono',monospace;letter-spacing:.12em;color:#9fc0ff;margin-bottom:4px;display:flex;align-items:center;gap:6px}
  #sp .step{margin:12px 16px 0;display:flex;gap:6px}
  #sp .step i{flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.1)} #sp .step i.on{background:#5fd0ff}
  #sp .chipq{display:inline-flex;margin:0 6px 6px 0;padding:8px 10px;border-radius:12px;border:1px solid rgba(95,208,255,.35);background:rgba(14,20,31,.9);color:#cfe9ff;font:500 12px Inter,sans-serif;cursor:pointer}
  #sp .kv{display:grid;grid-template-columns:1fr auto;gap:4px 10px;font-size:12px;color:#a9b6cc} #sp .kv b{color:#e6eefb;font-weight:600;text-align:right}
  #sp .tbl{width:100%;border-collapse:collapse;font-size:11.5px} #sp .tbl td{padding:5px 2px;border-top:1px solid rgba(120,150,200,.12)} #sp .tbl tr:first-child td{border-top:0}
  #sp .alert{display:flex;gap:10px;align-items:center}
  #sp .vd{display:flex;align-items:baseline;gap:6px;margin-top:6px} #sp .vn{font:700 38px/1 Rajdhani,sans-serif} #sp .vu{font-size:13px;color:#a9b6cc}
  #sp .dl{display:inline-flex;gap:6px;align-items:center;margin-top:8px;padding:4px 10px;border-radius:999px;background:rgba(61,220,151,.1);border:1px solid rgba(61,220,151,.35);font:600 12px 'JetBrains Mono',monospace;color:#8ff0c4}
  #sp .dl s{color:#8fa0bb;text-decoration:line-through}
  #sp .why{font-size:13px;line-height:1.45;color:#c8d4e6;margin-top:8px}
  #sp .segbar{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-top:10px} #sp .segbar i{height:10px;border-radius:3px}
  #sp .foot{margin:10px 16px 0;font-size:11px;line-height:1.5;color:#8fa0bb}
  #sp .lsg{display:grid;grid-template-columns:70px repeat(4,1fr);gap:6px 4px;align-items:center;margin-top:10px;font-size:12px;color:#c8d4e6}
  #sp .lsi{position:relative;display:flex;justify-content:center;transition:color .25s,opacity .25s;color:#3ddc97}
  #sp .lsi::after{content:'';position:absolute;left:30%;right:30%;top:50%;height:2px;background:#ff5a4d;transform:rotate(-35deg);opacity:0;transition:opacity .25s}
  #sp .lsi.off{color:#ff5a4d;opacity:.9} #sp .lsi.off::after{opacity:1}
  #sp .lvchips{margin:12px 16px 0;display:grid;grid-template-columns:repeat(6,1fr);gap:5px}
  #sp .lvchips button{min-height:34px;border-radius:10px;border:1px solid;font:700 13px Rajdhani,sans-serif;letter-spacing:.06em;cursor:pointer;background:rgba(14,20,31,.9)}
  #sp .tip{margin:8px 16px 0;padding:10px 12px;border-radius:12px;background:rgba(8,12,20,.95);border:1px solid rgba(120,150,200,.3);font-size:12px;color:#c8d4e6;line-height:1.5}
  #sp .askrow{display:flex;gap:8px;margin-top:10px}
  #sp .askrow input{flex:1;min-width:0;min-height:44px;border-radius:12px;border:1px solid rgba(95,208,255,.45);background:rgba(4,8,14,.9);color:#eaf4ff;padding:0 12px;font:500 14px Inter,sans-serif;outline:none}
  #sp .askrow input:focus{border-color:#5fd0ff;box-shadow:0 0 0 3px rgba(95,208,255,.18)}
  #sp .askrow button{min-height:44px;padding:0 14px;border-radius:12px;border:1px solid #5fd0ff;background:linear-gradient(90deg,#0e3b56,#2a1757);color:#fff;font:700 14px Rajdhani,sans-serif;letter-spacing:.1em;cursor:pointer}
  #sp .qa{margin-top:10px;padding-top:10px;border-top:1px solid rgba(120,150,200,.14)}
  #sp .qa .q{font-size:12px;color:#8fa0bb} #sp .qa .a{font-size:13px;line-height:1.5;color:#dbe6ff;margin-top:4px} #sp .qa .a b{color:#fff}
  #sp .qa .src{display:inline-block;margin-top:6px;padding:2px 8px;border-radius:999px;border:1px solid rgba(120,150,200,.3);font:500 11px 'JetBrains Mono',monospace;color:#9fb3d1}
  @keyframes spDots{0%,80%,100%{opacity:.25}40%{opacity:1}} #sp .dots i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#9fdcff;margin-right:4px;animation:spDots 1s infinite} #sp .dots i:nth-child(2){animation-delay:.15s} #sp .dots i:nth-child(3){animation-delay:.3s}
  #sp .askbar{display:flex;align-items:center;gap:10px;width:calc(100% - 32px);margin:14px 16px 0;min-height:46px;padding:0 14px;border-radius:14px;border:1px solid rgba(95,208,255,.4);background:rgba(4,8,14,.85);color:#9fb3d1;font:500 14px Inter,sans-serif;cursor:text;text-align:left}
  #sp .lc{display:flex;align-items:center;gap:8px;font:700 13px Rajdhani,sans-serif;letter-spacing:.12em}
  #spBadge.hot{color:#ffd2cc;border-color:rgba(255,90,77,.6);background:rgba(40,8,8,.85)}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const fl = document.createElement('link'); fl.rel = 'stylesheet';
  fl.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap';
  document.head.appendChild(fl);

  const I = {
    home: '<path d="M3 11 12 4l9 7v9H3z"/>', bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    mesh: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6 8l5 8M18 8l-5 8"/>',
    share: '<path d="M12 3v18M5 7h14M5 7l-3 7h6zM19 7l-3 7h6z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    warn: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    drop: '<path d="M12 3c3.5 4.5 6 7.8 6 11a6 6 0 0 1-12 0c0-3.2 2.5-6.5 6-11z"/>', leaf: '<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19 13 11"/>',
    pill: '<rect x="3" y="9" width="18" height="7" rx="3.5" transform="rotate(-35 12 12.5)"/><path d="m9.5 8.2 5 8.6"/>', fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c-1-4 1-7 4-6 2 1 0 4-4 6zM14 12c4-1 7 1 6 4-1 2-4 0-6-4zM12 14c1 4-1 7-4 6-2-1 0-4 4-6zM10 12c-4 1-7-1-6-4 1-2 4 0 6 4z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', apt: '<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/>',
  };
  const ic = (k, c, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
  const TABS = [['home', 'Home', 'home', '#5fd0ff'], ['power', 'Power', 'bolt', '#ffb020'], ['life', 'Life', 'drop', '#4fc3f7'], ['mesh', 'Mesh', 'mesh', '#5fd0ff'], ['share', 'Share', 'share', '#3ddc97'], ['surface', 'Surface', 'sun', '#c27bff']];
  const BG = { home: '#0f2236', power: '#2a1c08', life: '#082436', mesh: '#0a2433', share: '#0b2a20', surface: '#1f1236', ret: '#3a2a10' };
  const S = { scr: 'home', fixed: false, hop: 6, mode: 'dir', signed: false, wave: 0, level: 'The Deep' };
  let tmr = null;

  const nav = active => `<nav aria-label="Strata sections">${TABS.map(([id, n, k, c]) =>
    `<button type="button" data-go="${id}" style="color:${active === id || (active === 'ret' && id === 'surface') ? c : '#8fa0bb'}">${app && app.dots && app.dots()[id] ? '<span class="dot"></span>' : ''}${ic(k, 'currentColor')}${n}</button>`).join('')}</nav>`;

  function home() {
    return `<div class="grid"></div>
    <div class="hd" style="flex-direction:row;align-items:center;justify-content:space-between">
      <div><div style="font:700 28px Rajdhani,sans-serif;letter-spacing:.34em;color:#eaf4ff">STR<span style="color:#5fd0ff">A</span>TA</div>
      <div class="kick" style="color:#8fa0bb;font-size:11px">${S.level.toUpperCase()} · SECTOR 7</div></div>
      <div class="mono" style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,90,77,.5);background:rgba(255,90,77,.1);font-size:10.5px;color:#ffb4ab;letter-spacing:.08em">
      <span class="pulse" style="width:7px;height:7px;border-radius:50%;background:#ff5a4d"></span>NET CUT</div></div>
    <div style="position:relative;margin:20px auto 0;width:230px;height:230px">
      <svg width="230" height="230" viewBox="0 0 236 236" aria-hidden="true"><circle cx="118" cy="118" r="104" fill="none" stroke="rgba(95,208,255,.12)" stroke-width="2"/>
      <circle cx="118" cy="118" r="92" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="10"/>
      <circle cx="118" cy="118" r="92" fill="none" stroke="${S.fixed ? '#3ddc97' : '#ffb020'}" stroke-width="10" stroke-linecap="round" stroke-dasharray="578" stroke-dashoffset="${S.fixed ? 40 : 398}" transform="rotate(-90 118 118)"/>
      <circle cx="118" cy="118" r="74" fill="none" stroke="rgba(95,208,255,.25)" stroke-width="1" stroke-dasharray="2 6"/></svg>
      <div style="position:absolute;inset:14px;border-radius:50%;background:conic-gradient(from 0deg,rgba(95,208,255,.22),transparent 18%);animation:spSweep 4s linear infinite"></div>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">
        <div class="mono" style="font-size:10.5px;letter-spacing:.2em;color:${S.fixed ? '#8ff0c4' : '#ffcf7a'}">${S.fixed ? 'POWER SECURED' : 'NEXT BLACKOUT'}</div>
        <div style="font:700 54px/1 Rajdhani,sans-serif;color:#fff4dd;text-shadow:0 0 24px ${S.fixed ? 'rgba(61,220,151,.45)' : 'rgba(255,176,32,.45)'}">${S.fixed ? '6 H+' : '1:52'}</div>
        <div style="font-size:12px;color:#a9b6cc">${S.fixed ? '3 of 500 forecasts dark' : '94% of 500 forecasts'}</div></div></div>
    <div style="position:relative;padding:18px 16px 0;display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <button type="button" class="tile" data-go="power" style="border-color:rgba(255,176,32,.35)">${ic('bolt', '#ffb020')}<b>POWER</b><span>${S.fixed ? 'Feed 3 bypassed' : 'Feed 3 failing · lift at risk'}</span></button>
      <button type="button" class="tile" data-go="mesh" style="border-color:rgba(95,208,255,.35)">${ic('mesh', '#5fd0ff')}<b>MESH</b><span>214 phones linked nearby</span></button>
      <button type="button" class="tile" data-go="share" style="border-color:rgba(61,220,151,.35)">${ic('share', '#3ddc97')}<b>FAIR SHARE</b><span>${S.mode === 'str' ? 'Every level above minimum' : 'The Deep gets 9% today'}</span></button>
      <button type="button" class="tile" data-go="surface" style="border-color:rgba(194,123,255,.4)">${ic('sun', '#c27bff')}<b>SURFACE</b><span>${S.signed ? 'Verified · broadcast' : 'Unverified · probe ready'}</span></button></div>
    <div class="note" style="position:relative;background:rgba(255,90,77,.08);border:1px solid rgba(255,90,77,.35);display:flex;gap:10px;align-items:center;color:#ffd2cc;font-size:12.5px">
      ${ic('warn', '#ff8a80', 20)}<div>Directorate network shut down at 18:04. Strata is running on the resident mesh.</div></div>
    ${nav('home')}`;
  }
  function power() {
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const curve = drop => { let y = 30, p = []; for (let i = 0; i <= 24; i++) { y += drop * (.6 + rnd() * .8) + (rnd() - .5) * 6; y = Math.max(14, Math.min(150, y)); p.push((i / 24 * 326).toFixed(1) + ',' + y.toFixed(1)); } return 'M' + p.join(' L'); };
    let paths = ''; for (let k = 0; k < 40; k++) paths += `<path d="${curve(S.fixed ? 1.2 + rnd() * 1.6 : 3.6 + rnd() * 2.2)}" fill="none" stroke="${S.fixed ? '#3ddc97' : (k % 7 ? '#ffb020' : '#5fd0ff')}" stroke-opacity=".5"/>`;
    seed = 99; const med = curve(S.fixed ? 1.9 : 4.6);
    const f = S.fixed;
    return `<div class="hd"><div class="kick" style="color:#ffcf7a">PROBLEM #1 · BLACKOUTS</div><h1 style="color:#fff4dd">Blackout forecast</h1><div class="sub">500 simulations of the geothermal grid, rerun every minute.</div></div>
    <div class="card" style="border-color:rgba(255,176,32,.3)"><div style="display:flex;justify-content:space-between;align-items:baseline"><div class="lbl">DEEP POWER · NEXT 6 H</div>
      <div class="big" style="color:${f ? '#3ddc97' : '#ffb020'}">${f ? 'SAFE 6 H+' : 'DARK IN 1:52'}</div></div>
      <svg width="326" height="170" viewBox="0 0 326 170" style="display:block;margin-top:8px" role="img" aria-label="Forecast fan chart">
      <line x1="0" y1="128" x2="326" y2="128" stroke="#ff5a4d" stroke-dasharray="4 4"/><text x="4" y="122" fill="#ff8a80" font-size="10" font-family="JetBrains Mono,monospace">LIGHTS-OUT LINE</text>
      ${paths}<path d="${med}" fill="none" stroke="${f ? '#7dffc4' : '#ffd27a'}" stroke-width="2.5"/>
      <text x="4" y="164" fill="#8fa0bb" font-size="10" font-family="JetBrains Mono,monospace">NOW</text><text x="290" y="164" fill="#8fa0bb" font-size="10" font-family="JetBrains Mono,monospace">+6 H</text></svg></div>
    <div class="row3"><div><div class="lbl">FEED 1</div><div class="big" style="color:#3ddc97">OK</div></div><div><div class="lbl">FEED 2</div><div class="big" style="color:#3ddc97">OK</div></div>
      <div style="border-color:${f ? 'rgba(95,208,255,.5)' : 'rgba(255,90,77,.55)'}"><div class="lbl">FEED 3</div><div class="big" style="color:${f ? '#5fd0ff' : '#ff5a4d'}">${f ? 'BYPASS' : 'FAILING'}</div></div></div>
    <div class="note" style="background:rgba(14,20,31,.86);border:1px solid rgba(120,150,200,.16);color:#c9d4e6">${f ? 'Feed 3 is bypassed. The lift and the Deep’s air pumps now run on feeds 1 and 2. Only 3 of 500 forecasts still go dark in the next 6 hours.' : 'Feed 3 is overheating. In 94% of forecasts the Deep loses power within 2 hours, and the lift stops with it. The Directorate has issued no warning.'}</div>
    <button type="button" class="btn" data-act="reroute" style="border-color:${f ? '#3ddc97' : '#ffb020'};background:${f ? 'linear-gradient(90deg,#0c3b2a,#0f4d3a)' : 'linear-gradient(90deg,#5a3a06,#7a2a10)'}">${f ? 'POWER REROUTED ✓' : 'REROUTE FEED 3 → LIFT'}</button>
    ${nav('power')}`;
  }
  function mesh() {
    const reached = S.hop >= 6 ? 0 : 5 - S.hop;
    let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const names = ['L1 RING', 'L2 MARKET', 'L3 FARMS', 'L4 WORKS', 'L5 WARRENS', 'L6 DEEP'];
    const nodes = []; for (let b = 0; b < 6; b++) for (let k = 0; k < 7; k++) nodes.push({ b, x: 48 + k * 42 + (rnd() - .5) * 18, y: 28 + b * 54 + (rnd() - .5) * 26 });
    let g = names.map((n, i) => `<line x1="34" y1="${28 + i * 54}" x2="342" y2="${28 + i * 54}" stroke="rgba(120,150,200,.12)"/><text x="4" y="${32 + i * 54}" fill="${i >= reached ? '#9fdcff' : '#5d6b82'}" font-size="10" font-family="JetBrains Mono,monospace">${n}</text>`).join('');
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const a = nodes[i], c = nodes[j]; if (Math.hypot(a.x - c.x, a.y - c.y) < 62) { const on = a.b >= reached && c.b >= reached; g += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${c.x.toFixed(1)}" y2="${c.y.toFixed(1)}" stroke="${on ? 'rgba(95,208,255,.75)' : 'rgba(120,150,200,.14)'}" stroke-width="${on ? 1.6 : 1}"/>`; } }
    g += nodes.map(n => `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.b >= reached ? 5 : 3.5}" fill="${n.b >= reached ? '#5fd0ff' : '#33405a'}"/>`).join('');
    const lv = 6 - reached;
    return `<div class="hd"><div class="kick" style="color:#9fdcff">PROBLEM #7 · NETWORK CUT</div><h1 style="color:#eaf7ff">Resident mesh</h1><div class="sub">Phones pass messages hand to hand. No towers, no Directorate.</div></div>
    <div class="note" style="margin-top:14px;padding:10px 12px;background:rgba(255,90,77,.08);border:1px solid rgba(255,90,77,.35);display:flex;gap:8px;align-items:center;font-size:12.5px;color:#ffd2cc">
      <span class="pulse" style="width:8px;height:8px;border-radius:50%;background:#ff5a4d"></span>Directorate network offline since 18:04</div>
    <div class="card" style="margin-top:10px;padding:8px 6px 6px;border-color:rgba(95,208,255,.25)"><svg width="346" height="330" viewBox="0 0 346 330" style="display:block" role="img" aria-label="Mesh of resident phones">${g}</svg></div>
    <div class="row3"><div><div class="lbl">HOPS</div><div class="big" style="color:#5fd0ff">${S.hop >= 6 ? 17 : (S.hop + 1) * 3}</div></div><div><div class="lbl">LEVELS</div><div class="big" style="color:#5fd0ff">${lv}/6</div></div><div><div class="lbl">SIGNED</div><div class="big" style="color:#3ddc97">P-256</div></div></div>
    <button type="button" class="btn" data-act="broadcast" style="margin-top:12px;border-color:#5fd0ff;background:linear-gradient(90deg,#0e3b56,#2a1757)">${S.hop >= 6 ? 'BROADCAST BLACKOUT WARNING' : 'RELAYING… ' + lv + ' OF 6 LEVELS'}</button>
    ${nav('mesh')}`;
  }
  function share() {
    const s = S.mode === 'str'; const names = ['L1 Ring', 'L2 Market', 'L3 Farms', 'L4 Works', 'L5 Warrens', 'L6 Deep'];
    const v = s ? [12, 14, 16, 17, 19, 22] : [34, 22, 16, 12, 7, 9];
    const rows = names.map((n, i) => { const lo = v[i] < 12; return `<div style="display:grid;grid-template-columns:76px 1fr 44px;gap:10px;align-items:center"><div style="font-size:12px;color:#c9d4e6">${n}</div>
      <div class="bar"><i style="width:${Math.round(v[i] / 36 * 100)}%;background:${s ? 'linear-gradient(90deg,#1f9e6c,#3ddc97)' : lo ? 'linear-gradient(90deg,#a3261d,#ff5a4d)' : 'linear-gradient(90deg,#41506a,#8fa0bb)'}"></i>
      <div style="position:absolute;left:33%;top:-2px;bottom:-2px;width:1px;background:rgba(255,255,255,.35)"></div></div>
      <div class="mono" style="font-size:12px;text-align:right;color:${s ? '#8ff0c4' : lo ? '#ff8a80' : '#c9d4e6'}">${v[i]}%</div></div>`; }).join('');
    return `<div class="hd"><div class="kick" style="color:#8ff0c4">PROBLEM #2 · RATIONING</div><h1 style="color:#eafff5">Fair share</h1><div class="sub">Every level gets a survival minimum first, then the rest by need.</div></div>
    <div class="seg" role="group" aria-label="Allocation"><button type="button" data-act="dir" style="${!s ? 'background:rgba(255,90,77,.18);color:#ffb4ab' : ''}">DIRECTORATE</button><button type="button" data-act="str" style="${s ? 'background:rgba(61,220,151,.18);color:#8ff0c4' : ''}">STRATA</button></div>
    <div class="card" style="display:flex;flex-direction:column;gap:11px"><div class="lbl" style="display:flex;justify-content:space-between"><span>POWER BY LEVEL</span><span>SHARE</span></div>${rows}
      <div style="font-size:11px;color:#8fa0bb">White tick: the survival minimum for air pumps and cooling.</div></div>
    <div class="note" style="background:${s ? 'rgba(61,220,151,.08)' : 'rgba(255,90,77,.08)'};border:1px solid ${s ? 'rgba(61,220,151,.4)' : 'rgba(255,90,77,.4)'}">${s ? 'Same total power. No level drops below the minimum, so the Deep keeps its air pumps and the lift stays on.' : 'The Directorate keeps 56% for the top two levels. The Deep and the Warrens fall below the survival minimum.'}</div>
    <div class="note" style="background:rgba(14,20,31,.86);border:1px solid rgba(194,123,255,.35);display:flex;gap:12px;align-items:center">${ic('apt', '#c27bff', 26)}
      <div><div style="font:700 16px Rajdhani,sans-serif;letter-spacing:.04em">Director level: 5 of 8 apartments empty</div><div style="font-size:12px;color:#a9b6cc">Room for 40 people from the Deep tonight</div></div></div>
    ${nav('share')}`;
  }
  function surface() {
    const s = S.signed, gear = [['No protection', '5 min', '6%', 'linear-gradient(90deg,#a3261d,#ff5a4d)', '#ff8a80'], ['Sealed suit', '6 h', '46%', 'linear-gradient(90deg,#6b3bb0,#c27bff)', '#d6b6ff'], ['Sealed dome', 'Days', '100%', 'linear-gradient(90deg,#1f9e6c,#3ddc97)', '#8ff0c4']];
    const sc = s ? '#3ddc97' : '#ffb020';
    return `<div class="hd"><div class="kick" style="color:#d6b6ff">PROBLEM #13 · IS THE SURFACE SAFE?</div><h1 style="color:#f4ecff">Surface truth</h1><div class="sub">A probe at the hatch measures the air and signs every reading.</div></div>
    <div style="margin:14px 16px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="padding:12px;border-radius:14px;background:rgba(255,90,77,.07);border:1px solid rgba(255,90,77,.35)"><div class="lbl" style="color:#ff8a80">DIRECTORATE SAYS</div><div style="font:700 19px Rajdhani,sans-serif;margin-top:4px;color:#ffd2cc">Lethal everywhere</div><div style="font-size:11.5px;color:#c9a9a4">No data published</div></div>
      <div style="padding:12px;border-radius:14px;background:rgba(194,123,255,.08);border:1px solid rgba(194,123,255,.4)"><div class="lbl" style="color:#d6b6ff">PROBE MEASURES</div><div style="font:700 19px Rajdhani,sans-serif;margin-top:4px;color:#f4ecff">Survivable with gear</div><div style="font-size:11.5px;color:#b9a9d0">Hotspots: 5 mapped</div></div></div>
    <div class="card" style="border-color:rgba(194,123,255,.3)"><div class="lbl">TIME YOU CAN SPEND OUTSIDE</div><div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
      ${gear.map(g => `<div style="display:grid;grid-template-columns:96px 1fr 54px;gap:10px;align-items:center"><div style="font-size:12.5px">${g[0]}</div><div class="bar" style="height:12px"><i style="width:${g[2]};background:${g[3]}"></i></div><div class="mono" style="font-size:12px;text-align:right;color:${g[4]}">${g[1]}</div></div>`).join('')}</div></div>
    <div class="note mono" style="background:rgba(8,12,20,.92);border:1px solid ${s ? 'rgba(61,220,151,.5)' : 'rgba(255,176,32,.4)'};font-size:11px;line-height:1.6;color:#a9b6cc">
      <div style="display:flex;justify-content:space-between;align-items:center"><span style="letter-spacing:.1em;color:${sc}">${s ? 'VERIFIED · 3 PROBES AGREE' : 'UNSIGNED READING'}</span>${ic('lock', sc, 18)}</div>
      <div>reading  dose=0.42 · air=OK · t=19:31</div><div>key      ECDSA P-256 · probe-07</div><div>sig      ${s ? '3045 0221 00c4 9e1a … 7b2f' : '— not signed yet —'}</div>
      <div style="color:${sc}">${s ? 'Sent over the mesh to all 6 levels' : 'Sign it so nobody can alter it'}</div></div>
    <div style="margin:12px 16px 0;display:flex;gap:8px"><button type="button" class="btn" data-act="sign" style="margin:0;flex:1;width:auto;font-size:16px;border-color:#c27bff;background:linear-gradient(90deg,#2a1757,#4a1d6b)">${s ? 'SIGNED + BROADCAST ✓' : 'SIGN + BROADCAST'}</button>
      <button type="button" class="btn" data-go="ret" style="margin:0;width:112px;font-size:15px;border-color:rgba(95,208,255,.5);background:rgba(14,20,31,.9);color:#9fdcff">RETURN PLAN</button></div>
    ${nav('surface')}`;
  }
  function ret() {
    const W = [[1, 'Scout crew', '12 volunteers in sealed suits', 'DAY 1', '#c27bff', 'Wave 1: the 12 healthiest volunteers go up in sealed suits, map the hotspots and set the probe network. Suit air lasts 6 hours.'],
      [2, 'Outpost builders', '120 people raise the first sealed domes', 'DAY 3–10', '#5fd0ff', 'Wave 2: builders raise sealed domes near the hatch, away from the 5 hotspots the scouts mapped.'],
      [3, 'The Deep goes first', 'Families from L6 and L5, the worst off', 'DAY 14–30', '#3ddc97', 'Wave 3: the levels that suffered most move first, the opposite of the Directorate’s order. 960 people a day through the single lift.'],
      [4, 'Everyone else', 'L4 up to L1, level by level', 'DAY 31–58', '#ffb020', 'Wave 4: the remaining levels follow as domes open. Strata keeps rebalancing power below for everyone still waiting.']];
    return `<div class="hd"><div class="kick" style="color:#ffd9a0">PROBLEM #15 · THE WAY UP</div><h1 style="color:#fff4e0">Return plan</h1><div class="sub">One lift, 48,000 residents. Strata plans the move in waves.</div></div>
    <div class="row3" style="margin-top:14px"><div><div class="lbl">LIFT / DAY</div><div class="big" style="color:#ffd27a">960</div></div><div><div class="lbl">WAVES</div><div class="big" style="color:#ffd27a">4</div></div><div><div class="lbl">ALL UP BY</div><div class="big" style="color:#ffd27a">Day 58</div></div></div>
    <div class="card" style="padding:14px 14px 6px;border-color:rgba(255,176,32,.28)">${W.map((w, i) => `<button type="button" class="wave" data-wave="${i}" style="background:${i === S.wave ? 'rgba(255,255,255,.06)' : 'transparent'}">
      <span class="n" style="border-color:${w[4]};color:${w[4]}">${w[0]}</span><span style="display:flex;flex-direction:column;gap:2px"><span style="font:700 17px Rajdhani,sans-serif;letter-spacing:.03em">${w[1]}</span><span style="font-size:12px;color:#a9b6cc;line-height:1.4">${w[2]}</span></span>
      <span class="mono" style="font-size:11px;color:${w[4]};white-space:nowrap">${w[3]}</span></button>`).join('')}</div>
    <div class="note" style="background:rgba(255,176,32,.07);border:1px solid rgba(255,176,32,.35);color:#ffe8c2">${W[S.wave][5]}</div>
    ${nav('ret')}`;
  }
  const R = { home, power, mesh, share, surface, ret };

  // ---- DOM
  const dim = document.createElement('div'); dim.id = 'spDim';
  const ph = document.createElement('div'); ph.id = 'sp'; ph.className = 'mini'; ph.setAttribute('role', 'button'); ph.setAttribute('aria-label', 'Open Strata phone');
  const badge = document.createElement('div'); badge.id = 'spBadge'; badge.textContent = 'STRATA · TAB';
  const scr = document.createElement('div'); scr.className = 'scr on';
  const island = document.createElement('div'); island.className = 'island';
  const hb = document.createElement('button'); hb.className = 'homebar'; hb.type = 'button'; hb.setAttribute('aria-label', 'Put the phone away');
  ph.append(scr, island, hb); document.body.append(dim, ph, badge);
  let app = null, lastScr = null;
  function render() {
    const bg = (app && app.bg && app.bg[S.scr]) || BG[S.scr] || '#0f2236';
    scr.style.background = `radial-gradient(120% 60% at 50% -10%, ${bg} 0%, #05070b 58%)`;
    if (!app) { scr.innerHTML = R[S.scr](); return; }
    const old = scr.querySelector('.body'), keep = old && lastScr === S.scr ? old.scrollTop : 0;
    scr.innerHTML = `<div class="body${lastScr !== S.scr ? ' in' : ''}">${app.render(S.scr)}</div>${app.nav ? app.nav(S.scr) : nav(S.scr)}`;
    scr.querySelector('.body').scrollTop = keep; lastScr = S.scr;
    if (app.live) app.live(scr);
  }
  render();

  let open = false, hooks = {};
  function layout() {
    const W = innerWidth, H = innerHeight;
    if (open) { const s = Math.min(1.05, (H * .9) / 844, (W * .92) / 390); ph.style.transform = `translate(${(W - 390 * s) / 2}px, ${(H - 844 * s) / 2}px) scale(${s})`; }
    else { const s = Math.max(.16, Math.min(.22, H / 4200)); ph.style.transform = `translate(${W - 390 * s - 26}px, ${H - 844 * s - 26}px) scale(${s}) rotate(-0deg)`;
      badge.style.left = (W - 390 * s - 26) + 'px'; badge.style.top = (H - 844 * s - 26 - 30) + 'px'; }
  }
  addEventListener('resize', layout); layout();
  function show(v) { ph.style.visibility = badge.style.visibility = v ? 'visible' : 'hidden'; }
  function setOpen(v) {
    if (v === open) return; open = v;
    ph.classList.toggle('open', v); ph.classList.toggle('mini', !v); dim.classList.toggle('on', v);
    badge.style.opacity = v ? 0 : 1; ph.setAttribute('aria-label', v ? 'Strata phone' : 'Open Strata phone');
    ph.style.transitionDelay = '0s';
    layout();
    (v ? hooks.onOpen : hooks.onClose) && (v ? hooks.onOpen : hooks.onClose)();
  }
  ph.addEventListener('click', e => {
    if (!open) { e.stopPropagation(); if (!hooks.canOpen || hooks.canOpen()) setOpen(true); return; }
    const go = e.target.closest('[data-go]'), act = e.target.closest('[data-act]'), wv = e.target.closest('[data-wave]');
    if (e.target.closest('.homebar')) { setOpen(false); return; }
    if (go) { S.scr = go.dataset.go; render(); hooks.onTap && hooks.onTap(); return; }
    if (wv) { S.wave = +wv.dataset.wave; render(); hooks.onTap && hooks.onTap(); return; }
    if (act && app) { if (!act.disabled) { app.act(act.dataset.act, act); hooks.onTap && hooks.onTap(); } return; }
    if (act) {
      const a = act.dataset.act;
      if (a === 'reroute') S.fixed = !S.fixed;
      if (a === 'dir' || a === 'str') S.mode = a;
      if (a === 'sign') S.signed = !S.signed;
      if (a === 'broadcast') { clearInterval(tmr); S.hop = 0; tmr = setInterval(() => { S.hop++; if (S.hop >= 6) clearInterval(tmr); if (S.scr === 'mesh') render(); hooks.onTap && hooks.onTap(); }, 550); }
      render(); hooks.onAct && hooks.onAct(a, S);
    }
  });
  dim.addEventListener('click', () => setOpen(false));
  window.StrataPhone = {
    open: () => setOpen(true), close: () => setOpen(false), toggle: () => setOpen(!open), get isOpen() { return open; },
    setLevel(name) { S.level = name; if (S.scr === 'home' || app) render(); }, show, hooks(h) { hooks = h; }, state: S,
    // live app API (js/app.js)
    use(a) { app = a; render(); }, render, go(scr) { S.scr = scr; render(); },
    refresh() { if (app && app.live && open) app.live(scr); },
    buzz() { ph.classList.remove('buzz'); void ph.offsetWidth; ph.classList.add('buzz'); },
    badge(text, hot) { badge.textContent = text || 'STRATA · TAB'; badge.classList.toggle('hot', !!hot); },
    ui: { ic, nav, I },
  };
})();
