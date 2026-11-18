// Strata — first-person walk through the Hollow (three levels, one lift).
// Engine: renderer, world loading, movement, lift, radiation. Story/gameplay lives in story.js, touch input in touch.js.
// World authored in Blender (z-up): blender (x, y, z) -> three (x, z, -y).
(async function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const G = window.GAME, MATS = window.MATS, LMS = window.LMSCALE || { D: 1, R: 1, S: 1 };
  const LV = ['D', 'R', 'S'];
  const setLoad = (t, f) => { $('loadt').textContent = t; if (f != null) $('loadb').style.width = (f * 100).toFixed(0) + '%'; };

  // ------------------------------------------------------------ look tuning per level
  const LOOK = {
    D: { expo: 1.75, lmK: 1.0, emK: .55, fog: 0x0d0a07, fogD: .028, bloom: [.75, .35, .8], vig: .55, tint: [1.04, .98, .9], env: [0, 1.65, 6], halo: 1.0 },
    R: { expo: 1.2, lmK: 1.0, emK: .55, fog: 0x120d09, fogD: .006, bloom: [.65, .35, .82], vig: .4, tint: [1.03, 1.0, .95], env: [0, 1.65, 2.8], halo: .8 },
    S: { expo: .95, lmK: 1.0, emK: .7, fog: 0x737b69, fogD: .052, bloom: [.5, .4, .85], vig: .5, tint: [.97, 1.02, .93], env: [0, 1.65, 7], halo: 1.0 },
  };
  const Q = { high: { pr: 1.5, msaa: 4, bloom: true }, med: { pr: 1.15, msaa: 2, bloom: true }, low: { pr: .85, msaa: 0, bloom: false } };
  let quality = 'high';
  try { quality = localStorage.getItem('strata_q') || 'high'; } catch (e) {}

  // ------------------------------------------------------------ renderer + post
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.outputEncoding = THREE.LinearEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q[quality].pr));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 260);
  camera.rotation.order = 'YXZ'; scene.add(camera);
  const isGL2 = renderer.capabilities.isWebGL2;
  const halfOK = isGL2 || !!renderer.extensions.get('OES_texture_half_float');
  function makeRT(samples) {
    const o = { type: halfOK ? THREE.HalfFloatType : THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true };
    if (isGL2 && samples > 0 && THREE.WebGLMultisampleRenderTarget) { const rt = new THREE.WebGLMultisampleRenderTarget(innerWidth, innerHeight, o); rt.samples = samples; return rt; }
    return new THREE.WebGLRenderTarget(innerWidth, innerHeight, o);
  }
  const FinalShader = {
    uniforms: { tDiffuse: { value: null }, exposure: { value: 1 }, time: { value: 0 }, rad: { value: 0 }, hurt: { value: 0 },
      vig: { value: .5 }, tint: { value: new THREE.Vector3(1, 1, 1) }, res: { value: new THREE.Vector2(1, 1) }, dim: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float exposure, time, rad, hurt, vig, dim; uniform vec3 tint; uniform vec2 res; varying vec2 vUv;
      vec3 aces(vec3 x){ const float a=2.51,b=.03,c=2.43,d=.59,e=.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.); }
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec2 d = vUv-.5; float r2 = dot(d,d);
        float ca = .0012 + rad*.006 + hurt*.004;
        vec2 wob = rad > .01 ? vec2(sin(vUv.y*40.+time*3.), cos(vUv.x*37.-time*2.))*.0009*rad : vec2(0.);
        vec3 col;
        col.r = texture2D(tDiffuse, vUv + d*ca + wob).r;
        col.g = texture2D(tDiffuse, vUv + wob).g;
        col.b = texture2D(tDiffuse, vUv - d*ca + wob).b;
        col *= exposure * tint;
        col = aces(col);
        float lum = dot(col, vec3(.299,.587,.114));
        col = mix(col, vec3(lum)*vec3(.82,1.08,.7), rad*.45);
        col *= 1. - vig * smoothstep(.12, .75, r2*1.6);
        col = mix(col, vec3(.45,.02,.02), hurt * smoothstep(.05,.6,r2*1.8));
        col = pow(col, vec3(1./2.2));
        float g = h(vUv*res + fract(time*7.1)*311.) - .5;
        col += g * (.025 + rad*.12);
        col *= 1. - dim;
        gl_FragColor = vec4(col, 1.);
      }`
  };
  let composer, bloom, finalPass;
  function buildComposer() {
    const q = Q[quality];
    composer = new THREE.EffectComposer(renderer, makeRT(q.msaa));
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .8, .55, .8);
    bloom.enabled = q.bloom; composer.addPass(bloom);
    finalPass = new THREE.ShaderPass(FinalShader); composer.addPass(finalPass);
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight);
  }
  buildComposer();

  // ------------------------------------------------------------ textures
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const TL = new THREE.TextureLoader();
  let texTotal = 0, texDone = 0;
  const texCache = {};
  function srcOf(name) {
    if (window.TEX && window.TEX[name]) return 'data:image/jpeg;base64,' + window.TEX[name];
    if (window.LMDATA && window.LMDATA[name]) return 'data:image/jpeg;base64,' + window.LMDATA[name];
    return 'tex/' + name + '.jpg';
  }
  const hasTex = n => !!((window.TEX && window.TEX[n]) || (window.LMDATA && window.LMDATA[n]));
  function tex(name, srgb, wrap = true) {
    const key = name + (srgb ? 's' : 'l');
    if (texCache[key]) return texCache[key];
    texTotal++;
    const t = TL.load(srcOf(name), () => { texDone++; }, undefined, () => { texDone++; });
    t.flipY = false; t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
    if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, maxAniso); }
    else { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = Math.min(4, maxAniso); }
    return (texCache[key] = t);
  }
  const LM = {};
  for (const l of LV) LM[l] = tex('lm_' + l, true, false);

  // ------------------------------------------------------------ world
  setLoad('Loading the Hollow', .05);
  const loader = new THREE.GLTFLoader();
  if (window.MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);
  let buf;
  {
    if (!window.WORLD_GZ) throw new Error('The 3D model file did not load. Please reload the page.');
    const bin = atob(window.WORLD_GZ); const n = bin.length; const u8 = new Uint8Array(n);
    for (let i = 0; i < n; i++) u8[i] = bin.charCodeAt(i);
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser is too old to unpack the model. Please use a current Chrome or Safari.');
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
    buf = await new Response(stream).arrayBuffer();
    const dv = new DataView(buf);
    if (buf.byteLength < 12 || dv.getUint32(0, true) !== 0x46546C67 || dv.getUint32(8, true) !== buf.byteLength)
      throw new Error('The 3D model arrived incomplete (' + buf.byteLength + ' bytes). Please reload the page.');
  }
  setLoad('Building the levels', .35);
  const gltf = await new Promise((res, rej) => loader.parse(buf, '', res, rej));
  const root = gltf.scene; scene.add(root);
  const GROUP = {}; for (const l of LV) GROUP[l] = [];
  const DYN = {};
  const MAT = {}; const MATL = { D: [], R: [], S: [] };
  function levelOf(o) { let p = o; while (p) { const n = p.name || ''; if (n.startsWith('LV_')) return n[3]; if (n.startsWith('DYN_')) return n[4]; p = p.parent; } return null; }
  function makeMat(name, l) {
    const key = name + '|' + l; if (MAT[key]) return MAT[key];
    const d = MATS[name] || { tex: null, tint: [.8, .8, .8], rough: .8, metal: 0, nrm: 1, emit: null, emI: 0 };
    const m = new THREE.MeshStandardMaterial({ roughness: d.rough, metalness: d.metal, side: THREE.DoubleSide });
    m.color.setRGB(d.tint[0], d.tint[1], d.tint[2]).convertSRGBToLinear();
    if (d.tex) {
      m.map = tex(d.tex + '_c', true);
      if (hasTex(d.tex + '_n') || !window.TEX) { m.normalMap = tex(d.tex + '_n', false); const k = (d.nrm || 1) * .9; m.normalScale.set(k, -k); }
    }
    m.lightMap = LM[l]; m.lightMapIntensity = (LMS[l] || 1) * LOOK[l].lmK;
    m.envMapIntensity = d.metal > .5 ? 1.0 : .55;
    if (d.emit) {
      m.emissive.setRGB(d.emit[0], d.emit[1], d.emit[2]).convertSRGBToLinear();
      m.emissiveIntensity = d.emI * LOOK[l].emK; m.userData.emI = m.emissiveIntensity;
      if (d.emap) m.emissiveMap = m.map;
    }
    m.name = name; MAT[key] = m; MATL[l].push(m); return m;
  }
  root.traverse(o => {
    const n = o.name || '';
    if (n.startsWith('DYN_')) DYN[n] = o;
    if (n.startsWith('LV_') || n.startsWith('DYN_')) { const l = levelOf(o); if (l && !GROUP[l].includes(o) && (o.parent === root)) GROUP[l].push(o); }
    if (o.isMesh) {
      const l = levelOf(o) || 'D';
      o.material = makeMat(o.material.name, l);
      o.frustumCulled = true; o.matrixAutoUpdate = n.startsWith('DYN_') || (o.parent && (o.parent.name || '').startsWith('DYN_'));
      if (!o.matrixAutoUpdate) o.updateMatrix();
    }
  });
  for (const k in DYN) { DYN[k].userData.base = DYN[k].position.clone(); DYN[k].userData.rot0 = DYN[k].rotation.y; }

  // ------------------------------------------------------------ halos, dust, ash, flashlight
  function glowTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.18, 'rgba(255,255,255,.55)'); g.addColorStop(.45, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t;
  }
  const GLOW = glowTex();
  const HALO = { sodium: [[1, .55, .25], 2.6, .5], chand: [[1, .75, .45], 1.9, .35], sconce: [[1, .75, .45], .8, .35], shade: [[1, .78, .5], .9, .25],
    cool: [[.7, .85, 1], 2.0, .45], fluoro: [[.8, 1, .9], 1.6, .3], warm: [[1, .7, .4], 1.6, .3], rad: [[.4, 1, .15], 5.5, .45] };
  const halos = { D: [], R: [], S: [] };
  const extras = { D: new THREE.Group(), R: new THREE.Group(), S: new THREE.Group() };
  for (const l of LV) { scene.add(extras[l]); GROUP[l].push(extras[l]); }
  for (const l of LV) for (const [x, y, z, kind] of G[l].lamps) {
    const h = HALO[kind]; if (!h) continue;
    const mat = new THREE.SpriteMaterial({ map: GLOW, color: new THREE.Color(...h[0]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: h[2] * LOOK[l].halo, fog: true });
    const s = new THREE.Sprite(mat); s.position.set(x, z + (kind === 'rad' ? .25 : 0), -y); s.scale.setScalar(h[1]);
    s.userData = { base: mat.opacity, ph: Math.random() * 100, flick: kind === 'sodium' && Math.random() < .25 };
    extras[l].add(s); halos[l].push(s);
  }
  function makePoints(n, gen, color, size, opacity) {
    const g = new THREE.BufferGeometry(); const p = new Float32Array(n * 3); const s = new Float32Array(n);
    for (let i = 0; i < n; i++) { const v = gen(i); p[i * 3] = v[0]; p[i * 3 + 1] = v[1]; p[i * 3 + 2] = v[2]; s[i] = Math.random() * 6.28; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.userData.seed = s; g.userData.orig = p.slice();
    const m = new THREE.PointsMaterial({ size, map: GLOW, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: true });
    return new THREE.Points(g, m);
  }
  const dust = makePoints(900, () => { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 17.5; return [r * Math.cos(a), .3 + Math.random() * 7, -r * Math.sin(a)]; }, new THREE.Color(1, .75, .5), .05, .55);
  extras.D.add(dust);
  const ash = makePoints(2200, () => [(Math.random() - .5) * 36, 200 + Math.random() * 14, (Math.random() - .5) * 36], new THREE.Color(.85, .9, .8), .06, .5);
  extras.S.add(ash);
  const flash = new THREE.SpotLight(0xfff1dc, 0, 26, .5, .55, 1.6); flash.position.set(0, 0, 0); camera.add(flash); camera.add(flash.target); flash.target.position.set(0, -.15, -1);
  let flashOn = false;

  // ------------------------------------------------------------ environment reflections per level
  const pmrem = new THREE.PMREMGenerator(renderer);
  const ENV = {};
  function showLevel(l) { for (const k of LV) for (const o of GROUP[k]) o.visible = (k === l); }
  function captureEnv(l) {
    showLevel(l); const e = LOOK[l].env;
    scene.fog = new THREE.FogExp2(LOOK[l].fog, LOOK[l].fogD); scene.background = new THREE.Color(LOOK[l].fog);
    const crt = new THREE.WebGLCubeRenderTarget(256, { type: halfOK ? THREE.HalfFloatType : THREE.UnsignedByteType, generateMipmaps: false });
    const cc = new THREE.CubeCamera(.1, 200, crt); cc.position.set(e[0], G[l].z0 + e[1], e[2]); scene.add(cc);
    cc.update(renderer, scene); scene.remove(cc);
    ENV[l] = pmrem.fromCubemap(crt.texture).texture; crt.dispose();
    for (const m of MATL[l]) { m.envMap = ENV[l]; m.needsUpdate = true; }
  }
  setLoad('Loading textures', .55);
  const t0 = performance.now();
  while (texDone < texTotal && performance.now() - t0 < 60000) { setLoad('Loading textures', .55 + .35 * texDone / Math.max(1, texTotal)); await new Promise(r => setTimeout(r, 60)); }
  setLoad('Capturing reflections', .92);
  for (const l of LV) captureEnv(l);

  // ------------------------------------------------------------ audio (all synthesized)
  let AC = null, master, amb = {}, geigerGain;
  function noiseBuf(sec, kind) {
    const n = AC.sampleRate * sec, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (kind === 'brown') { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return b;
  }
  function loopNoise(kind, filt, f, q, gain) {
    const s = AC.createBufferSource(); s.buffer = noiseBuf(4, kind); s.loop = true;
    const bq = AC.createBiquadFilter(); bq.type = filt; bq.frequency.value = f; bq.Q.value = q;
    const g = AC.createGain(); g.gain.value = 0; s.connect(bq); bq.connect(g); g.connect(master); s.start();
    return { g, bq, gain };
  }
  function initAudio() {
    if (AC) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = AC.createGain(); master.gain.value = .8; master.connect(AC.destination);
    amb.D = [loopNoise('brown', 'lowpass', 420, .7, .55), loopNoise('white', 'bandpass', 900, 3, .025)];
    amb.R = [loopNoise('brown', 'lowpass', 180, .5, .18)];
    const pad = AC.createGain(); pad.gain.value = 0; pad.connect(master);
    for (const f of [130.8, 196, 246.9, 329.6]) { const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = (Math.random() - .5) * 8;
      const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; const g = AC.createGain(); g.gain.value = .035; o.connect(lp); lp.connect(g); g.connect(pad); o.start(); }
    amb.R.push({ g: pad, gain: .5 });
    const wind = loopNoise('white', 'bandpass', 500, .6, .32); amb.S = [wind, loopNoise('brown', 'lowpass', 160, .5, .4)];
    amb.S[0].lfo = true;
    geigerGain = AC.createGain(); geigerGain.gain.value = .5; geigerGain.connect(master);
  }
  function ambTo(l) { if (!AC) return; const t = AC.currentTime; for (const k of LV) for (const a of (amb[k] || [])) a.g.gain.setTargetAtTime(k === l ? a.gain : 0, t, .8); }
  function blip(freq, dur, type = 'sine', gain = .2, when = 0) {
    if (!AC) return; const t = AC.currentTime + when; const o = AC.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
  }
  function burst(f, q, dur, gain, dest) {
    if (!AC) return; const t = AC.currentTime; const s = AC.createBufferSource(); s.buffer = burst.b || (burst.b = noiseBuf(.5, 'white'));
    const bq = AC.createBiquadFilter(); bq.type = 'bandpass'; bq.frequency.value = f; bq.Q.value = q;
    const g = AC.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(bq); bq.connect(g); g.connect(dest || master); s.start(t, Math.random() * .3); s.stop(t + dur + .02);
  }
  const step = l => burst(l === 'R' ? 260 : l === 'S' ? 700 : 520, l === 'R' ? .8 : 1.4, l === 'R' ? .09 : .12, l === 'R' ? .18 : .32);
  const geiger = () => burst(3200 + Math.random() * 1500, 4, .012, .9, geigerGain);
  let humNode = null;
  function hum(on) {
    if (!AC) return; const t = AC.currentTime;
    if (on && !humNode) { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 52; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
      const g = AC.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(.18, t, .3); o.connect(lp); lp.connect(g); g.connect(master); o.start(); humNode = { o, g }; }
    if (!on && humNode) { humNode.g.gain.setTargetAtTime(0, t, .25); const h = humNode; setTimeout(() => h.o.stop(), 1500); humNode = null; }
  }
  const ding = () => { blip(1318, 1.4, 'sine', .14); blip(880, 1.8, 'sine', .12, .28); };
  function cough() { if (!AC) return; const n = 1 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) setTimeout(() => burst(500 + Math.random() * 500, 1.2, .18, .08 + Math.random() * .07), i * 230); }
  function heartbeat() { blip(55, .18, 'sine', .45); blip(48, .2, 'sine', .35, .22); }

  // ------------------------------------------------------------ player + level state
  const P = { l: 'D', x: 0, y: .3, yaw: Math.PI, pitch: 0, bob: 0, speed: 0, eye: 1.65 };
  const key = {};
  let level = 'D', state = 'menu', health = 100, surfT = 0, deathT = 0, travelling = false, flashTarget = 0;
  const liftDoor = { D: 0, R: 0, S: 0 }; // 0 closed .. 1 open
  const aptDoor = {};
  for (const l of LV) for (const d of G[l].doors) aptDoor[d.name] = 0;

  function setLevel(l) {
    level = l; P.l = l; showLevel(l);
    const L = LOOK[l];
    scene.fog = new THREE.FogExp2(L.fog, L.fogD); scene.background = new THREE.Color(L.fog);
    finalPass.uniforms.exposure.value = L.expo; finalPass.uniforms.vig.value = L.vig; finalPass.uniforms.tint.value.set(...L.tint);
    bloom.strength = L.bloom[0]; bloom.radius = L.bloom[1]; bloom.threshold = L.bloom[2];
    $('loc').innerHTML = '<b>' + G[l].name + '</b>';
    $('rad').style.display = l === 'S' ? 'block' : 'none';
    if (l !== 'S') { health = 100; }
    surfT = 0; ambTo(l); banner(G[l].name, G[l].sub);
    if (story) story.onLevel(l);
  }
  let bannerT = null;
  function banner(t, s) {
    const b = $('banner'); b.querySelector('.t').textContent = t; b.querySelector('.s').textContent = s; b.style.opacity = 1;
    clearTimeout(bannerT); bannerT = setTimeout(() => b.style.opacity = 0, 3800);
  }
  const fade = (v, ms = 600) => new Promise(r => { const f = $('fade'); f.style.transitionDuration = ms + 'ms'; f.style.opacity = v; setTimeout(r, ms); });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function inCab() { return Math.abs(P.x) < 1.42 && Math.abs(P.y) < 1.42; }

  let story = null;   // story layer (js/story.js), created once the world is ready
  async function travel(to) {
    if (travelling || to === level || state !== 'play') return;
    const why = story && story.canTravel(to);
    if (why) { story.deny(why); return; }
    travelling = true; ding();
    await wait(900); hum(true);
    await fade(1, 650);
    const rx = P.x, ry = P.y;
    setLevel(to); liftDoor[to] = 0; P.x = rx; P.y = ry;
    await wait(700); hum(false); ding();
    await fade(0, 650);
    travelling = false;
  }
  async function die() {
    state = 'dead'; deathT = 0;
    if (story) story.onDeath();
    $('deaths').textContent = 'Survived ' + fmtT(surfT) + ' on the surface';
    await wait(1600);
    $('death').style.display = 'flex';
    await fade(1, 1200);
    await wait(1400);
    $('deaths').textContent = 'You wake up in the Deep';
    await wait(1600);
    $('death').style.display = 'none';
    P.x = 0; P.y = .3; P.yaw = Math.PI; P.pitch = 0; P.eye = 1.65; camera.rotation.z = 0;
    setLevel('D'); liftDoor.D = 1; health = 100;
    state = 'play';
    await fade(0, 1400);
  }
  const fmtT = s => { s = Math.max(0, Math.round(s)); return (s / 60 | 0) + ':' + String(s % 60).padStart(2, '0'); };

  // ------------------------------------------------------------ collision
  const RAD = .3;
  function collide() {
    const g = G[level];
    for (let it = 0; it < 2; it++) {
      for (const r of g.rects) {
        if (P.x < r[0] - RAD || P.x > r[2] + RAD || P.y < r[1] - RAD || P.y > r[3] + RAD) continue;
        const cx = clamp(P.x, r[0], r[2]), cy = clamp(P.y, r[1], r[3]); const dx = P.x - cx, dy = P.y - cy, d2 = dx * dx + dy * dy;
        if (d2 > 1e-9) { const d = Math.sqrt(d2); if (d < RAD) { P.x += dx / d * (RAD - d); P.y += dy / d * (RAD - d); } }
        else { const a = P.x - r[0], b = r[2] - P.x, c = P.y - r[1], e = r[3] - P.y, m = Math.min(a, b, c, e);
          if (m === a) P.x = r[0] - RAD; else if (m === b) P.x = r[2] + RAD; else if (m === c) P.y = r[1] - RAD; else P.y = r[3] + RAD; }
      }
      for (const c of g.circles) {
        const dx = P.x - c[0], dy = P.y - c[1], rr = c[2] + RAD; if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
        const d = Math.hypot(dx, dy); if (d < rr && d > 1e-6) { P.x = c[0] + dx / d * rr; P.y = c[1] + dy / d * rr; }
      }
      if (liftDoor[level] < .6) {
        const r = g.elevator.door; const inside = P.y > r[3];
        if (P.x > r[0] - .05 && P.x < r[2] + .05 && P.y > r[1] - RAD && P.y < r[3] + RAD) P.y = inside ? r[3] + RAD : r[1] - RAD;
      }
      const b = g.bounds;
      if (b.type === 'circle') { const d = Math.hypot(P.x, P.y); if (d > b.r) { P.x *= b.r / d; P.y *= b.r / d; } }
      else { P.x = clamp(P.x, b.x0 + RAD, b.x1 - RAD); P.y = clamp(P.y, b.y0 + RAD, b.y1 - RAD); }
    }
  }

  // ------------------------------------------------------------ input
  const lockOK = () => document.pointerLockElement === canvas;
  function lock() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
  $('menu').addEventListener('click', e => {
    if (e.target.dataset && e.target.dataset.q) { setQuality(e.target.dataset.q); e.stopPropagation(); return; }
    const fresh = e.target.id === 'newgame';
    if (fresh && story) story.newGame();
    initAudio(); if (AC && AC.state === 'suspended') AC.resume();
    $('menu').style.display = 'none'; if (!dragMode) lock();
    if (state === 'menu') { state = 'play'; setLevel(level); fade(0, 1200); liftDoor.D = 0; } else if (state === 'paused') state = 'play';
    ambTo(level);
  });
  document.addEventListener('pointerlockchange', () => {
    if (!lockOK() && state === 'play' && !dragMode) { state = 'paused'; $('menu').style.display = 'flex'; $('go').textContent = 'Click to resume'; }
  });
  let dragMode = false, drag = null;
  canvas.addEventListener('mousedown', e => { if (state === 'play' && !lockOK() && !dragMode) { drag = [e.clientX, e.clientY]; } });
  addEventListener('mouseup', () => drag = null);
  addEventListener('mousemove', e => {
    if (state !== 'play' || (story && story.busy())) return;
    if (lockOK()) { P.yaw -= e.movementX * .0021; P.pitch = clamp(P.pitch - e.movementY * .0021, -1.4, 1.4); }
    else if (drag) { P.yaw -= (e.clientX - drag[0]) * .004; P.pitch = clamp(P.pitch - (e.clientY - drag[1]) * .004, -1.4, 1.4); drag = [e.clientX, e.clientY]; }
  });
  addEventListener('keydown', e => {
    key[e.code] = true;
    if (state !== 'play') return;
    if (e.code === 'KeyE' && !e.repeat && story) { story.interact(); return; }
    if (story && story.busy()) return;
    if (e.code === 'KeyF') { flashOn = !flashOn; blip(2400, .04, 'square', .05); }
    if (inCab() && !travelling) { if (e.code === 'Digit1') travel('D'); if (e.code === 'Digit2') travel('R'); if (e.code === 'Digit3') travel('S'); }
  });
  addEventListener('keyup', e => key[e.code] = false);
  addEventListener('blur', () => { for (const k in key) key[k] = false; });
  function setQuality(q) {
    quality = q; try { localStorage.setItem('strata_q', q); } catch (e) {}
    renderer.setPixelRatio(Math.min(devicePixelRatio, Q[q].pr)); buildComposer(); setLevel(level);
    document.querySelectorAll('#menu .q button').forEach(b => b.classList.toggle('on', b.dataset.q === q));
  }
  document.querySelectorAll('#menu .q button').forEach(b => b.classList.toggle('on', b.dataset.q === quality));
  // lift panel buttons
  const liftEl = $('lift');
  liftEl.innerHTML = [['D', '1', 'The Deep'], ['R', '2', 'Director level'], ['S', '3', 'Surface']].map(([l, k, n]) => `<button data-l="${l}"><kbd>${k}</kbd>${n}</button>`).join('');
  liftEl.addEventListener('click', e => { const b = e.target.closest('button'); if (b) travel(b.dataset.l); });
  liftEl.style.display = 'none'; liftEl.style.gap = '8px';

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight);
    finalPass.uniforms.res.value.set(innerWidth, innerHeight);
  });
  renderer.setSize(innerWidth, innerHeight, false); finalPass.uniforms.res.value.set(innerWidth, innerHeight);

  // ------------------------------------------------------------ main loop
  let last = performance.now(), tAcc = 0, fpsN = 0, fpsT = 0, lowT = 0, stepPhase = 0, geigerAcc = 0, coughT = 4, beatT = 0;
  let promptKey = '';
  function setPrompt(n, d) {
    const k = n + '|' + d; if (k === promptKey) return; promptKey = k;
    const el = $('prompt'); if (!n) { el.style.opacity = 0; return; }
    el.querySelector('.n').textContent = n; el.querySelector('.d').textContent = d; el.style.opacity = 1;
  }
  function loop(now) { requestAnimationFrame(loop); frame(now); }
  function frame(now) {
    let dt = Math.min(.05, (now - last) / 1000); last = now; tAcc += dt;
    const g = G[level];
    // movement
    if (state === 'play' && !travelling && !(story && story.busy())) {
      const f = clamp((key.KeyW || key.ArrowUp ? 1 : 0) - (key.KeyS || key.ArrowDown ? 1 : 0) + touchIn.f, -1, 1);
      const s = clamp((key.KeyD || key.ArrowRight ? 1 : 0) - (key.KeyA || key.ArrowLeft ? 1 : 0) + touchIn.s, -1, 1);
      const run = key.ShiftLeft || key.ShiftRight || touchIn.run;
      const amt = Math.min(1, Math.hypot(f, s));
      const target = amt > .05 ? (run ? 4.6 : 2.5) * amt : 0;
      P.speed = lerp(P.speed, target, 1 - Math.exp(-dt * 10));
      if (amt > .05) {
        const l = Math.hypot(f, s); const fx = -Math.sin(P.yaw), fy = Math.cos(P.yaw), rx = Math.cos(P.yaw), ry = Math.sin(P.yaw);
        P.x += (fx * f + rx * s) / l * P.speed * dt; P.y += (fy * f + ry * s) / l * P.speed * dt;
      }
      collide();
      if (P.speed > .3) { const prev = stepPhase; stepPhase += dt * P.speed * 2.3; if (Math.floor(prev / Math.PI) !== Math.floor(stepPhase / Math.PI)) step(level); }
    }
    // lift doors
    const near = Math.hypot(P.x, P.y + 1.6) < 2.6 || inCab();
    const want = (state === 'play' && !travelling && near) ? 1 : 0;
    liftDoor[level] = clamp(liftDoor[level] + (want ? 1 : -1) * dt * 1.6, 0, 1);
    const L = DYN[`DYN_${level}_elevL`], R = DYN[`DYN_${level}_elevR`];
    const ease = t => t * t * (3 - 2 * t); const off = ease(liftDoor[level]) * .68;
    if (L) L.position.x = L.userData.base.x - off; if (R) R.position.x = R.userData.base.x + off;
    // apartment doors
    for (const d of g.doors) {
      const o = DYN[d.name]; if (!o) continue;
      const w = Math.hypot(P.x - d.cx, P.y - d.cy) < 2.3 ? 1 : 0;
      aptDoor[d.name] = clamp(aptDoor[d.name] + (w ? 1 : -1) * dt * 1.4, 0, 1);
      o.rotation.y = o.userData.rot0 + ease(aptDoor[d.name]) * d.open;
    }
    // prompts
    const cab = inCab();
    liftEl.style.display = (cab && state === 'play') ? 'flex' : 'none';
    if (cab) { liftEl.querySelectorAll('button').forEach(b => b.classList.toggle('here', b.dataset.l === level)); setPrompt('', ''); }
    else if (story && story.prompt()) { const sp = story.prompt(); setPrompt(sp.n, sp.d); }
    else {
      let best = null, bd = 1e9;
      for (const z of g.zones) { const d = Math.hypot(P.x - z.x, P.y - z.y); if (d < z.r && d < bd) { bd = d; best = z; } }
      if (!best && Math.hypot(P.x, P.y + 1.6) < 2.4) best = { name: 'Lift', sub: 'Step inside, then press 1, 2 or 3' };
      setPrompt(best ? best.name : '', best ? best.sub : '');
    }
    // surface radiation
    const U = finalPass.uniforms;
    let radK = 0;
    if (level === 'S' && (state === 'play' || state === 'dead')) {
      let mult = 1;
      for (const h of g.hotspots) { const d = Math.hypot(P.x - h[0], P.y - h[1]); const r = h[2] * 2.2; if (d < r) mult += 3.2 * h[3] * Math.pow(1 - d / r, 1.5); }
      if (cab && liftDoor.S < .2) mult *= .2;
      const shield = story ? story.radScale() : 1; mult *= shield;
      if (state === 'play' && !travelling) {
        surfT += dt; health -= dt * (100 / 300) * mult;
        if (health <= 0) { health = 0; die(); }
      }
      radK = clamp(.15 + (1 - health / 100) * .55 + (mult - 1) * .12, 0, 1);
      $('radf').style.width = health.toFixed(1) + '%';
      $('radt').textContent = fmtT(health / ((100 / 300) * mult));
      $('dose').textContent = (mult / shield > 1.6 ? 'Hotspot · exposure ×' + (mult / shield).toFixed(1) : 'Background radiation') + (shield < 1 ? ' · rad-shield active' : '');
      geigerAcc += dt * (3 + 26 * (mult - 1) + 6 * (1 - health / 100));
      while (geigerAcc > 1) { geigerAcc -= 1 + Math.log(Math.random() + 1e-4) * .5; geiger(); }
      if (health < 30 && state === 'play') { beatT -= dt; if (beatT <= 0) { heartbeat(); beatT = .55 + health / 60; } }
    }
    U.rad.value = lerp(U.rad.value, radK, 1 - Math.exp(-dt * 3));
    const hurtK = level === 'S' ? clamp((35 - health) / 35, 0, 1) * (.6 + .4 * Math.sin(tAcc * 7)) : 0;
    U.hurt.value = lerp(U.hurt.value, hurtK, .2);
    U.time.value = tAcc;
    // death camera
    if (state === 'dead') { deathT += dt; P.eye = lerp(P.eye, .35, 1 - Math.exp(-dt * 2.2)); camera.rotation.z = lerp(camera.rotation.z, .9, 1 - Math.exp(-dt * 1.8)); P.pitch = lerp(P.pitch, .2, dt); }
    // ambient life
    if (level === 'D' && state === 'play') { coughT -= dt; if (coughT < 0) { cough(); coughT = 3 + Math.random() * 7; } }
    if (AC && amb.S && level === 'S') amb.S[0].bq.frequency.value = 380 + 220 * Math.sin(tAcc * .37) + 90 * Math.sin(tAcc * 1.3);
    // camera
    const moving = P.speed > .2 && state === 'play';
    P.bob += dt * P.speed * 2.3;
    const bobY = moving ? Math.sin(P.bob * 2) * .028 * (P.speed / 2.5) : 0;
    const shake = travelling ? (Math.random() - .5) * .006 : 0;
    camera.position.set(P.x, g.z0 + P.eye + bobY + shake, -P.y);
    camera.rotation.y = P.yaw; camera.rotation.x = P.pitch + (moving ? Math.sin(P.bob) * .004 : 0);
    if (state !== 'dead') camera.rotation.z = moving ? Math.sin(P.bob) * .004 : 0;
    flashTarget = flashOn ? (level === 'S' ? 2.2 : 3.2) : 0; flash.intensity = lerp(flash.intensity, flashTarget, .25);
    // halos flicker + dust drift
    for (const s of halos[level]) {
      if (s.userData.flick) { const n = Math.sin(tAcc * 23 + s.userData.ph) * Math.sin(tAcc * 7.3 + s.userData.ph * 2); s.material.opacity = s.userData.base * (n > .85 ? .35 : 1); }
    }
    if (level === 'D') {
      const p = dust.geometry.attributes.position, o = dust.geometry.userData.orig, sd = dust.geometry.userData.seed;
      for (let i = 0; i < sd.length; i++) { const k = sd[i]; p.array[i * 3] = o[i * 3] + Math.sin(tAcc * .13 + k) * .6; p.array[i * 3 + 1] = o[i * 3 + 1] + Math.sin(tAcc * .09 + k * 2) * .4; p.array[i * 3 + 2] = o[i * 3 + 2] + Math.cos(tAcc * .11 + k) * .6; }
      p.needsUpdate = true;
    }
    if (level === 'S') {
      const p = ash.geometry.attributes.position, sd = ash.geometry.userData.seed;
      for (let i = 0; i < sd.length; i++) {
        let x = p.array[i * 3], y = p.array[i * 3 + 1], z = p.array[i * 3 + 2];
        y -= dt * (.35 + (sd[i] % 1) * .3); x += Math.sin(tAcc * .5 + sd[i]) * dt * .4 + dt * .5; z += Math.cos(tAcc * .4 + sd[i]) * dt * .3;
        if (y < 200) y += 14;
        if (x - P.x > 18) x -= 36; if (x - P.x < -18) x += 36; if (z + P.y > 18) z -= 36; if (z + P.y < -18) z += 36;
        p.array[i * 3] = x; p.array[i * 3 + 1] = y; p.array[i * 3 + 2] = z;
      }
      p.needsUpdate = true;
    }
    if (story) story.update(dt, tAcc);
    composer.render(dt);
    // fps + adaptive quality
    fpsN++; fpsT += dt;
    if (fpsT > 1) { const fps = fpsN / fpsT; $('fps').textContent = fps.toFixed(0) + ' fps'; fpsN = 0; fpsT = 0;
      if (state === 'play' && fps < 34) { lowT++; if (lowT >= 4 && renderer.getPixelRatio() > .7) { renderer.setPixelRatio(renderer.getPixelRatio() * .85); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); lowT = 0; } } else lowT = 0; }
  }
  // ------------------------------------------------------------ story + touch controls
  const touchIn = { f: 0, s: 0, run: false };
  const respawn = () => { P.x = 0; P.y = .3; P.yaw = Math.PI; P.pitch = 0; P.eye = 1.65; camera.rotation.z = 0; health = 100; };
  const ctx = {
    THREE, $, scene, camera, G, P, ENV, GLOW, extras, key, touchIn,
    get level() { return level; }, get state() { return state; }, get travelling() { return travelling; },
    setState: s => { state = s; }, setLevel, inCab, travel, fade, blip, burst, ding, respawn,
    lock: () => { if (!dragMode) lock(); },
    unlock: () => { try { document.exitPointerLock(); } catch (e) {} },
    look: (dx, dy) => { if (state !== 'play' || (story && story.busy())) return; P.yaw -= dx; P.pitch = clamp(P.pitch - dy, -1.4, 1.4); },
    flash: () => { flashOn = !flashOn; blip(2400, .04, 'square', .05); },
    pause: () => { if (state !== 'play') return; state = 'paused'; $('menu').style.display = 'flex'; $('go').textContent = 'Tap to resume'; },
    setDragMode: v => { dragMode = v; },
  };
  story = window.StoryInit ? window.StoryInit(ctx) : null;
  if (window.TouchInit) window.TouchInit(ctx, () => story);
  if (story && story.hasSave()) { $('go').textContent = 'Continue'; $('newgame').style.display = 'inline-block'; }

  setLevel('D'); state = 'menu';
  $('load').style.display = 'none'; $('menu').style.display = 'flex';
  requestAnimationFrame(loop);

  window.__strata = { P, G, setLevel: l => { setLevel(l); }, travel, get level() { return level; }, get health() { return health; }, set health(v) { health = v; },
    start() { state = 'play'; $('menu').style.display = 'none'; $('fade').style.opacity = 0; liftDoor[level] = 1; },
    story: () => story, tick: (n = 1, ms = 16.7) => { for (let i = 0; i < n; i++) frame(last + ms); },
    look: LOOK, finalPass, bloom, renderer, scene, camera, MATL, LM, die, flash: v => flashOn = v };
})().catch(e => { console.error(e); const t = document.getElementById('loadt'); if (t) t.textContent = 'Error: ' + e.message; });
