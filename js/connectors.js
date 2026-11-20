// Strata connectors: what the in-phone assistant may read besides its own onboard brain.
//   Memory cards  signed data cards (data/cards.js, or a .json file the player inserts)
//   Phone memory  the conversation, kept in this browser
//   Surface Relay a live AI over the Claude API: off by default, allowlisted host, player's own key, asks before connecting
// Security model: a card is read only if its ECDSA P-256 signature verifies against a key the phone trusts
// AND Mara has allowed it. Unsigned or unknown-key cards are listed as UNVERIFIED · BLOCKED and never read.
(function () {
  'use strict';
  const LS = { conn: 'strata_conn_v1', chat: 'strata_chat_v1', key: 'strata_relay_key' };
  const RELAY = {
    name: 'Surface Relay', provider: 'Anthropic Claude', model: 'claude-opus-5-5',
    allow: ['api.anthropic.com'],                       // the only hosts the relay may ever talk to
    sdk: 'vendor/anthropic/sdk-1.5.0.mjs',               // official SDK, vendored (pinned)
  };
  const MEMORY_MAX = 40;
  const enc = new TextEncoder();
  const unhex = h => new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16)));
  const canonical = c => JSON.stringify({ id: c.id, title: c.title, issuer: c.issuer, key: c.key, body: c.body });
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  window.StrataConnectors = function (opts) {
    const SRC = window.STRATA_CARDS || { keys: {}, cards: [] };
    const st = Object.assign({ allowed: {}, custom: [], relay: { enabled: false, allowed: false } }, read(LS.conn, {}));
    const save = () => write(LS.conn, st);
    const keys = {};                                    // id -> { name, role, pub: CryptoKey, fp }
    let cards = [];                                     // { ...card, status: 'verified'|'blocked'|'checking', why, custom }
    let leaked = false;

    async function importKey(jwk) { return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); }
    async function fp(jwk) { const d = await crypto.subtle.digest('SHA-256', enc.encode(jwk.x + '.' + jwk.y)); return Array.from(new Uint8Array(d).slice(0, 6), b => b.toString(16).padStart(2, '0')).join(':'); }
    const trusted = id => keys[id] && (keys[id].role === 'trusted' || keys[id].role === 'contact' || (id === 'directorate' && leaked));

    async function verify(c) {
      if (!c.sig || !c.key) return { status: 'blocked', why: 'Unsigned card' };
      if (!keys[c.key]) return { status: 'blocked', why: 'Signed by an unknown key' };
      let ok = false;
      try { ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, keys[c.key].pub, unhex(c.sig), enc.encode(canonical(c))); } catch (e) { ok = false; }
      if (!ok) return { status: 'blocked', why: 'Signature does not match: the card was altered' };
      if (!trusted(c.key)) return { status: 'blocked', why: `Signed by the ${keys[c.key].name} key, which this phone does not trust` };
      return { status: 'verified', why: c.key === 'directorate' ? 'Verified with the leaked Directorate key' : `Signed by ${keys[c.key].name}` };
    }
    async function refresh() {
      const all = SRC.cards.map(c => ({ ...c, custom: false })).concat(st.custom.map(c => ({ ...c, custom: true })));
      cards = await Promise.all(all.map(async c => ({ ...c, ...(await verify(c)) })));
      if (opts && opts.onChange) opts.onChange();
    }
    const ready = (async () => {
      if (!(window.crypto && crypto.subtle)) return;
      for (const [id, k] of Object.entries(SRC.keys)) keys[id] = { name: k.name, role: k.role, pub: await importKey(k.jwk), fp: await fp(k.jwk) };
      await refresh();
    })();

    // ---------------- memory cards
    const state = c => c.status !== 'verified' ? 'blocked' : st.allowed[c.id] ? 'allowed' : 'ask';
    function search(q) {
      const t = q.toLowerCase(); let best = null;
      for (const c of cards) for (const f of c.body.facts || []) {
        let sc = 0; for (const k of f.kw) if (t.includes(k)) sc += (f.w || 1) * (k.includes(' ') ? 2 : 1);
        if (t.includes(c.title.toLowerCase())) sc += 3;
        const explicit = t.includes(c.title.toLowerCase().replace('’', "'")) || t.includes(c.title.toLowerCase()) || f.kw.some(k => k.includes(' ') && t.includes(k)) || (c.id === 'archive' && t.includes('archive'));
        if (sc > 0 && (!best || sc > best.score)) best = { card: c, fact: f, score: sc, state: state(c), explicit };
      }
      return best;
    }
    async function insert(text) {
      let c; try { c = JSON.parse(text); } catch (e) { return { ok: false, why: 'Not a memory card file (invalid JSON)' }; }
      if (!c || !c.id || !c.title || !c.body || !Array.isArray(c.body.facts)) return { ok: false, why: 'Not a memory card file (needs id, title and body.facts)' };
      c.id = 'x-' + String(c.id).replace(/[^\w-]/g, '').slice(0, 40);
      st.custom = st.custom.filter(x => x.id !== c.id).concat([{ id: c.id, title: String(c.title).slice(0, 60), issuer: String(c.issuer || 'Unknown').slice(0, 60), key: c.key, color: '#9fb3d1', body: c.body, sig: c.sig }]);
      save(); await refresh();
      const now = cards.find(x => x.id === c.id);
      return { ok: true, card: now };
    }
    function eject(id) { st.custom = st.custom.filter(x => x.id !== id); delete st.allowed[id]; save(); refresh(); }
    function allow(id, v) { if (v) st.allowed[id] = true; else delete st.allowed[id]; save(); if (opts && opts.onChange) opts.onChange(); }
    async function setLeaked(v) { if (leaked === v) return; leaked = v; await refresh(); }

    // ---------------- phone memory
    const memory = {
      all: () => read(LS.chat, []),
      add(entry) { const m = read(LS.chat, []); m.push(Object.assign({ t: Date.now() }, entry)); while (m.length > MEMORY_MAX) m.shift(); write(LS.chat, m); },
      clear() { write(LS.chat, []); },
    };

    // ---------------- Surface Relay (Claude API)
    const relay = {
      info: RELAY,
      get enabled() { return !!st.relay.enabled; },
      get allowedByMara() { return !!st.relay.allowed; },
      get hasKey() { try { return !!localStorage.getItem(LS.key); } catch (e) { return false; } },
      setKey(k) { try { if (k) localStorage.setItem(LS.key, k.trim()); else localStorage.removeItem(LS.key); } catch (e) {} },
      enable(v) { st.relay.enabled = !!v; if (!v) st.relay.allowed = false; save(); },
      permit(v) { st.relay.allowed = !!v; save(); },
      hostAllowed(url) { try { return RELAY.allow.includes(new URL(url).hostname); } catch (e) { return false; } },
      // Ask the relay. `context` is the live state of the Hollow, so answers stay grounded in the game.
      async ask(question, context, history) {
        if (!st.relay.enabled) return { ok: false, why: 'The Surface Relay is switched off.' };
        if (!st.relay.allowed) return { ok: false, why: 'Mara has not allowed the relay yet.' };
        let key = null; try { key = localStorage.getItem(LS.key); } catch (e) {}
        if (!key) return { ok: false, why: 'No relay key on this phone. Add one in Connections.' };
        if (!relay.hostAllowed('https://' + RELAY.allow[0])) return { ok: false, why: 'Relay host is not on the allowlist · BLOCKED' };
        let Anthropic;
        try { Anthropic = (await import(new URL(RELAY.sdk, location.href).href)).default; }
        catch (e) { return { ok: false, why: 'Could not load the relay software.' }; }
        const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 });
        const messages = [];
        for (const h of (history || []).slice(-6)) { messages.push({ role: 'user', content: h.q }); messages.push({ role: 'assistant', content: h.plain || h.a }); }
        messages.push({ role: 'user', content: `Live readings from Mara's Strata phone:\n${context}\n\nMara asks: ${question}` });
        try {
          const response = await client.beta.messages.create({
            model: RELAY.model,
            max_tokens: 16000,
            output_config: { effort: 'low' },                 // short in-game chat answers
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',                              // if the model declines, the API re-runs on a fallback model
            system: 'You are the Surface Relay, an authorized uplink inside Strata, a resident-run phone app in the Hollow (2087, two billion people underground, ruled by the Directorate). You answer Mara, a resident of the Deep. Ground every answer in the live readings you are given; if they do not cover the question, say so plainly. Answer in 1 to 3 short sentences, plain words, no markdown. Stay in the world of the story.',
            messages,
          });
          if (response.stop_reason === 'refusal') return { ok: false, why: 'The relay declined to answer that.' };
          const text = response.content.filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
          return text ? { ok: true, text, model: response.model } : { ok: false, why: 'The relay sent an empty answer.' };
        } catch (error) {
          if (error instanceof Anthropic.AuthenticationError) return { ok: false, why: 'The relay rejected this key.' };
          if (error instanceof Anthropic.PermissionDeniedError) return { ok: false, why: 'This key is not allowed to use the relay.' };
          if (error instanceof Anthropic.RateLimitError) return { ok: false, why: 'The relay is busy. Try again in a moment.' };
          if (error instanceof Anthropic.APIConnectionError) return { ok: false, why: 'Relay unreachable: no network, or outside calls are blocked here (the Claude artifact blocks them; use the GitHub or local version).' };
          if (error instanceof Anthropic.APIError) return { ok: false, why: `Relay error ${error.status}.` };
          return { ok: false, why: 'Relay unreachable.' };
        }
      },
    };

    return {
      ready, refresh, search, insert, eject, allow, setLeaked, state,
      get cards() { return cards; }, get keys() { return keys; }, get leaked() { return leaked; },
      memory, relay,
    };
  };
})();
