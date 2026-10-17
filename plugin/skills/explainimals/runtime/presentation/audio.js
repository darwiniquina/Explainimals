/*
 * audio.js - retro sound effects and looping music, generated with the Web Audio API (no files).
 * Exposes Pres.audio. The contract is presentation/AUDIO.md.
 */
(function (global) {
  'use strict';

  const Pres = (global.Pres = global.Pres || {});
  const KEY = 'pxe.audio';
  const AC = global.AudioContext || global.webkitAudioContext;
  const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const SFX_LABELS = { blip: 'Blip', pop: 'Pop', jump: 'Jump', coin: 'Coin', confirm: 'Confirm', error: 'Error', whoosh: 'Whoosh', typing: 'Typing', talk: 'Talk', appear: 'Appear' };
  const MUSIC_LABELS = { calm: 'Calm', upbeat: 'Upbeat', tense: 'Tense', playful: 'Playful' };

  const MOODS = {
    calm: { bpm: 78, lead: 'triangle', lv: 0.22, bv: 0.3, root: 60, mel: [0, 4, 7, 12, 7, 4, 9, 12, 7, 11, 14, 11, 9, 7, 4, 2], bass: [-12, -5, -3, -8], pulse: false },
    upbeat: { bpm: 150, lead: 'square', lv: 0.09, bv: 0.22, root: 60, mel: [0, 4, 7, 4, 9, 7, 4, 7, 5, 9, 12, 9, 7, 4, 2, 4], bass: [-12, -12, -7, -5], pulse: false },
    tense: { bpm: 118, lead: 'sawtooth', lv: 0.07, bv: 0.2, root: 57, mel: [0, null, 3, null, 0, null, 6, null, 5, null, 3, null, 0, -1, 0, null], bass: [-24, -24, -22, -24], pulse: true },
    playful: { bpm: 132, lead: 'square', lv: 0.08, bv: 0.22, root: 62, mel: [0, 2, 4, 7, 4, 2, 0, null, 5, 7, 9, 12, 9, 7, 5, null], bass: [-12, -7, -5, -7], pulse: false }
  };

  const VOICE_LABELS = { penguin: 'Penguin', frog: 'Frog', dog: 'Dog', whisker: 'Cat', rabbit: 'Rabbit', bear: 'Bear' };

  // Speech blip voices (contract: presentation/AUDIO.md). spread = max semitones above base,
  // glide = end pitch factor of the blip (optional).
  // Voice v2 extras (used only by voice() when it gets an opts object): att = attack seconds,
  // peak = blip volume, layer = quiet second oscillator (oct: octave up, else detuned by cents;
  // vol = fraction of peak), vib = LFO on the main oscillator's detune (rate Hz, cents depth).
  const VOICES = {
    penguin: { type: 'square', base: 300, spread: 7, len: 0.05, att: 0.008, peak: 0.16, layer: { cents: 14, vol: 0.3 } },
    frog: { type: 'sawtooth', base: 150, spread: 5, len: 0.06, glide: 0.8, att: 0.004, peak: 0.13, layer: { cents: -18, vol: 0.3 } },
    dog: { type: 'square', base: 200, spread: 6, len: 0.05, att: 0.006, peak: 0.16, layer: { oct: true, vol: 0.25 } },
    whisker: { type: 'triangle', base: 520, spread: 8, len: 0.05, glide: 1.15, att: 0.012, peak: 0.16, layer: { oct: true, vol: 0.25 }, vib: { rate: 5.5, cents: 15 } },
    rabbit: { type: 'square', base: 620, spread: 8, len: 0.04, att: 0.003, peak: 0.16 },
    bear: { type: 'triangle', base: 110, spread: 4, len: 0.07, att: 0.025, peak: 0.2, layer: { cents: 8, vol: 0.3 }, vib: { rate: 4.5, cents: 20 } }
  };

  // Voice v2 expressions: pitch multiplier and blip length multiplier. confused adds a +-1.5 semitone
  // wobble that depends on the character. Unknown expression = neutral.
  const EXPRESSIONS = {
    neutral: { pitch: 1, len: 1 },
    happy: { pitch: 1.06, len: 1 },
    joy: { pitch: 1.12, len: 0.9 },
    surprised: { pitch: 1.15, len: 0.85 },
    curious: { pitch: 1.04, len: 1 },
    thinking: { pitch: 0.97, len: 1.1 },
    confused: { pitch: 1, len: 1, wobble: true },
    sad: { pitch: 0.88, len: 1.2 },
    determined: { pitch: 0.95, len: 0.95 },
    sleepy: { pitch: 0.85, len: 1.35 }
  };

  let ctx = null;
  let master = null;
  let volume = 0.6;
  let muted = false;
  let current = null;
  let hasPending = false;
  let pendingName = null;
  const listeners = [];

  try {
    const raw = global.localStorage.getItem(KEY);
    const d = raw ? JSON.parse(raw) : null;
    if (d && typeof d.volume === 'number' && isFinite(d.volume)) volume = clamp01(d.volume);
    if (d && typeof d.muted === 'boolean') muted = d.muted;
  } catch (e) { /* storage unavailable: keep defaults */ }

  function save() {
    try { global.localStorage.setItem(KEY, JSON.stringify({ volume: volume, muted: muted })); } catch (e) { /* ignore */ }
  }

  function effGain() { return muted ? 0 : volume * 0.6; }

  function applyGain() {
    if (master) master.gain.setTargetAtTime(effGain(), ctx.currentTime, 0.02);
  }

  function notify() {
    listeners.slice().forEach((fn) => { try { fn(); } catch (e) { /* a broken listener must not stop audio */ } });
  }

  function tone(f, d, type, v, to, at, dest) {
    const t = (at === undefined ? ctx.currentTime : at);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + d + 0.02);
  }

  // Voice v2 blip: main oscillator, optional quiet second layer, optional LFO vibrato on detune.
  // Every node stops at t + len (+0.02 s), so nothing keeps running after the blip.
  function speak(v, f, len, glide) {
    const t = ctx.currentTime, end = t + len + 0.02;
    const att = Math.min(v.att || 0.01, len * 0.5);
    const env = (g, level) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level, t + att);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    };
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = v.type; o.frequency.setValueAtTime(f, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(f * glide, t + len);
    env(g, v.peak || 0.16);
    o.connect(g); g.connect(master); o.start(t); o.stop(end);
    if (v.layer) {
      const mul = v.layer.oct ? 2 : 1;
      const o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o2.type = v.type; o2.frequency.setValueAtTime(f * mul, t);
      if (v.layer.cents) o2.detune.setValueAtTime(v.layer.cents, t);
      if (glide) o2.frequency.exponentialRampToValueAtTime(f * glide * mul, t + len);
      env(g2, (v.peak || 0.16) * v.layer.vol);
      o2.connect(g2); g2.connect(master); o2.start(t); o2.stop(end);
    }
    if (v.vib) {
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.type = 'sine'; lfo.frequency.setValueAtTime(v.vib.rate, t);
      depth.gain.setValueAtTime(v.vib.cents, t);
      lfo.connect(depth); depth.connect(o.detune);
      lfo.start(t); lfo.stop(end);
    }
  }

  // Letters and digits make a blip (ASCII, plus any other cased letter such as accented ones).
  function isSpeechChar(ch) {
    return /[0-9A-Za-z]/.test(ch) || ch.toLowerCase() !== ch.toUpperCase();
  }

  function noise(d, v, f0, f1, at) {
    const t = (at === undefined ? ctx.currentTime : at);
    const n = Math.floor(ctx.sampleRate * d), b = ctx.createBuffer(1, n, ctx.sampleRate), a = b.getChannelData(0);
    for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b;
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t);
  }

  const SFX = {
    blip() { tone(880, 0.07, 'square', 0.3); },
    pop() { tone(700, 0.12, 'sine', 0.5, 120); },
    jump() { tone(220, 0.18, 'square', 0.3, 700); },
    coin() { const t = ctx.currentTime; tone(988, 0.07, 'square', 0.25, 0, t); tone(1319, 0.2, 'square', 0.25, 0, t + 0.07); },
    confirm() { const t = ctx.currentTime; [523, 659, 784].forEach((f, i) => tone(f, 0.09, 'square', 0.25, 0, t + i * 0.08)); },
    error() { const t = ctx.currentTime; tone(200, 0.14, 'sawtooth', 0.3, 0, t); tone(140, 0.26, 'sawtooth', 0.3, 0, t + 0.15); },
    whoosh() { noise(0.45, 0.6, 300, 3500); },
    typing() { const t = ctx.currentTime; for (let i = 0; i < 6; i++) noise(0.03, 0.5, 2500 + Math.random() * 2500, 1500, t + i * 0.075 + Math.random() * 0.02); },
    talk() { const t = ctx.currentTime; for (let i = 0; i < 7; i++) tone(280 + Math.random() * 260, 0.06, 'square', 0.2, 0, t + i * 0.065); },
    appear() { tone(250, 0.28, 'triangle', 0.5, 1000); }
  };

  function tick(tr) {
    const d = tr.def;
    while (tr.next < ctx.currentTime + 0.2) {
      const i = tr.i, n = d.mel[i % 16];
      if (n !== null) tone(mtof(d.root + n), tr.step * 0.9, d.lead, d.lv, 0, tr.next, tr.bus);
      const b = d.bass[Math.floor(i / 4) % 4];
      if (d.pulse) tone(mtof(d.root + b), tr.step * 0.7, 'triangle', d.bv, 0, tr.next, tr.bus);
      else if (i % 4 === 0) tone(mtof(d.root + b), tr.step * 3.6, 'triangle', d.bv, 0, tr.next, tr.bus);
      tr.next += tr.step;
      tr.i++;
    }
  }

  function startTrack(name) {
    const def = MOODS[name];
    const now = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(1, now + 0.05);
    bus.connect(master);
    const tr = { name: name, def: def, bus: bus, i: 0, next: now + 0.05, step: 60 / def.bpm / 2, timer: null };
    tr.timer = setInterval(() => tick(tr), 40);
    tick(tr);
    return tr;
  }

  function fadeOut(tr, secs) {
    clearInterval(tr.timer);
    const now = ctx.currentTime;
    tr.bus.gain.cancelScheduledValues(now);
    tr.bus.gain.setTargetAtTime(0, now, secs / 4);
    setTimeout(() => { try { tr.bus.disconnect(); } catch (e) { /* already gone */ } }, 300);
  }

  function music(name) {
    if (name === null || name === undefined || name === '' || name === 'none') return audio.stopMusic();
    if (!hasOwn(MOODS, name)) return;
    if (!ctx) { hasPending = true; pendingName = name; return; }
    if (current && current.name === name) return;
    const prev = current;
    current = startTrack(name);
    if (prev) fadeOut(prev, 0.15);
    notify();
  }

  const audio = {
    supported: !!AC,
    sfxNames: Object.keys(SFX),
    musicNames: Object.keys(MOODS),
    voiceNames: Object.keys(VOICES),
    expressions: Object.keys(EXPRESSIONS),

    catalog() {
      return {
        sfx: Object.keys(SFX).map((id) => ({ id: id, label: SFX_LABELS[id] || id })),
        music: Object.keys(MOODS).map((id) => ({ id: id, label: MUSIC_LABELS[id] || id, bpm: MOODS[id].bpm })),
        voices: Object.keys(VOICES).map((id) => ({ id: id, label: VOICE_LABELS[id] || id }))
      };
    },

    unlock() {
      if (!audio.supported) return;
      if (!ctx) {
        try {
          ctx = new AC();
          master = ctx.createGain();
          master.gain.value = effGain();
          master.connect(ctx.destination);
        } catch (e) {
          ctx = null; master = null; audio.supported = false;
          return;
        }
      }
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
      }
      if (hasPending) {
        const n = pendingName;
        hasPending = false; pendingName = null;
        music(n);
      }
    },

    sfx(name) {
      if (!ctx || muted || !hasOwn(SFX, name)) return;
      try { SFX[name](); } catch (e) { /* audio must never break the presentation */ }
    },

    music: music,

    stopMusic() {
      hasPending = false; pendingName = null;
      if (!current) return;
      fadeOut(current, 0.12);
      current = null;
      notify();
    },

    nowPlaying() { return current ? current.name : null; },

    // One short speech blip in a character voice. Silent no-op when unsupported, muted or not unlocked
    // (never queued). Pitch depends only on the character, so the same text always sounds the same.
    // Optional opts { expression, progress (0..1), question (bool) } = Voice v2 delivery (see AUDIO.md).
    // Without opts (or with a non-object opts) the blip is exactly the original one.
    voice(skinId, ch, opts) {
      if (!ctx || muted) return;
      try {
        const v = (typeof skinId === 'string' && hasOwn(VOICES, skinId)) ? VOICES[skinId] : VOICES.penguin;
        const s = (ch === undefined || ch === null) ? '' : String(ch);
        const code = s.length ? s.charCodeAt(0) : 0;
        const f = v.base * Math.pow(2, ((code % 8) * v.spread / 7) / 12);
        if (opts === null || typeof opts !== 'object') {
          tone(f, v.len, v.type, 0.16, v.glide ? f * v.glide : 0);
          return;
        }
        const ex = (typeof opts.expression === 'string' && hasOwn(EXPRESSIONS, opts.expression)) ? EXPRESSIONS[opts.expression] : EXPRESSIONS.neutral;
        const pr = Number(opts.progress);
        const p = isFinite(pr) ? clamp01(pr) : 0;
        let semi = (code % 8) * v.spread / 7;
        if (opts.question === true) semi += 3 * clamp01((p - 0.7) / 0.3);   // question: rise over the last 30 percent
        else semi -= 1.5 * clamp01((p - 0.8) / 0.2);                        // statement: fall over the last 20 percent
        if (ex.wobble) semi += 1.5 * Math.sin(code * 1.3);                  // confused: +-1.5 semitone wobble
        speak(v, v.base * Math.pow(2, semi / 12) * ex.pitch, v.len * ex.len, v.glide);
      } catch (e) { /* speech must never break the presentation */ }
    },

    // Babble of `text` in a voice: one blip per letter or digit, 70 ms apart; `,;:` pause 3 blip slots,
    // `.!?` pause 5, any other character (space) takes one silent slot. Progress = index / (length - 1),
    // question = text ends with '?'. Returns a cancel() that clears the pending blips. Muted, not unlocked
    // or unsupported = a no-op function and nothing scheduled. Never throws.
    voiceDemo(skinId, text, opts) {
      const noop = function () {};
      try {
        if (!ctx || muted) return noop;
        const s = (text === undefined || text === null) ? '' : String(text);
        const expression = (opts !== null && typeof opts === 'object') ? opts.expression : undefined;
        const question = /\?\s*$/.test(s);
        const span = Math.max(1, s.length - 1);
        const timers = [];
        let slot = 0;
        for (let i = 0; i < s.length; i++) {
          const ch = s.charAt(i);
          if (isSpeechChar(ch)) {
            const progress = i / span;
            timers.push(setTimeout(() => {
              audio.voice(skinId, ch, { expression: expression, progress: progress, question: question });
            }, slot * 70));
            slot += 1;
          } else if (ch === ',' || ch === ';' || ch === ':') slot += 3;
          else if (ch === '.' || ch === '!' || ch === '?') slot += 5;
          else slot += 1;
        }
        return function cancel() {
          timers.forEach((h) => clearTimeout(h));
          timers.length = 0;
        };
      } catch (e) { return noop; }
    },

    setVolume(v) {
      const n = Number(v);
      if (!isFinite(n)) return;
      volume = clamp01(n);
      save(); applyGain(); notify();
    },

    setMuted(b) {
      muted = !!b;
      save(); applyGain(); notify();
    },

    getVolume() { return volume; },
    isMuted() { return muted; },

    onChange(fn) {
      if (typeof fn === 'function') listeners.push(fn);
    }
  };

  Pres.audio = audio;
})(window);
