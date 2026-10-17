/*
 * Dashboard view "Presentations": the scenario player, ported from presentation/player.html.
 * Loaded after dashboard/shell.js, and after Character, CharacterSkins, Pres (engine.js) and the
 * scenario files (which register themselves in Pres.scenarios).
 *
 * Query params read on mount:  scenario=<id> selects a scenario,  autoplay=1 starts playing.
 * Keyboard while mounted:      Space = play/pause, ArrowLeft / ArrowRight = previous / next slide.
 */
(function () {
  'use strict';

  const SKIN_IDS = ['penguin', 'frog', 'dog', 'whisker', 'rabbit', 'bear'];   // the surviving characters
  const STYLE_ID = 'v-presentations-css';
  const CSS = `
.v-presentations { color: var(--text); }
.v-presentations .v-pres-hint { margin: 0 0 8px; }
.v-presentations .v-pres-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
.v-presentations .v-pres-card { display: block; width: 100%; margin: 0; padding: 8px 10px; text-align: left; font: inherit; color: var(--text); background: var(--panel); border: 2px solid var(--line); border-radius: 0; box-shadow: none; cursor: pointer; }
.v-presentations .v-pres-card:hover { border-color: var(--accent2); }
.v-presentations .v-pres-card.on { border-color: var(--accent); box-shadow: inset 5px 0 0 var(--accent); }
.v-presentations .v-pres-card b { display: block; font-size: 13px; overflow-wrap: anywhere; }
.v-presentations .v-pres-card small { display: block; margin-top: 2px; color: var(--muted); font-size: 12px; }
.v-presentations .v-pres-card.is-err small { color: #c0262d; }
.v-presentations .v-pres-main { min-width: 0; }
.v-presentations .v-pres-stagebox { display: flex; flex-direction: column; align-items: center; min-width: 0; }
.v-presentations .v-pres-stagebox:fullscreen { justify-content: center; background: #000; }
.v-presentations .v-pres-stage { position: relative; background: #000; image-rendering: pixelated; box-shadow: 0 0 0 1px var(--line); }
.v-presentations .v-pres-stagebox:fullscreen .v-pres-stage { box-shadow: none; }
.v-presentations .v-pres-caption { align-self: stretch; min-height: 22px; margin-top: 8px; color: var(--muted); }
.v-presentations .v-pres-stagebox:fullscreen .v-pres-caption { margin-top: 16px; color: #d7def5; text-align: center; font-size: 18px; }
.v-presentations .v-pres-transport { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
.v-presentations .v-pres-scrub { flex: 1 1 160px; min-width: 120px; }
.v-presentations .v-pres-clock { min-width: 110px; text-align: right; color: var(--muted); font: 12px ui-monospace, Consolas, monospace; }
.v-presentations .v-pres-loop { color: var(--muted); }
.v-presentations .v-pres-slides { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.v-presentations .v-pres-side { min-width: 0; }
.v-presentations .v-pres-select { max-width: 100%; min-width: 0; }
.v-presentations .v-pres-json { display: block; width: 100%; min-height: 300px; box-sizing: border-box; font: 12px/1.5 ui-monospace, Consolas, monospace; resize: vertical; }
.v-presentations .v-pres-msg { margin-top: 8px; white-space: pre-wrap; font: 12px/1.45 ui-monospace, Consolas, monospace; }
.v-presentations .v-pres-file { display: none; }
.v-presentations .v-pres-sound { margin-top: 8px; }
.v-presentations .v-pres-volume { width: 120px; max-width: 100%; }
.v-presentations .v-pres-now { min-width: 0; overflow-wrap: anywhere; }
`;

  // tiny element builder: h('button', { class, onclick, value, ... }, ...children)
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v === null || v === undefined) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (typeof v === 'boolean') { if (k in el) el[k] = v; else if (v) el.setAttribute(k, ''); }
      else if (k in el) el[k] = v;
      else el.setAttribute(k, String(v));
    });
    kids.flat(Infinity).forEach((kid) => {
      if (kid === null || kid === undefined || kid === false) return;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    });
    return el;
  }

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.append(s);
  }

  // built-in sample so the view works before any scenario file exists (same role as in player.html)
  function helloScenario() {
    const skin = SKIN_IDS.find((id) => window.CharacterSkins && window.CharacterSkins[id]) || 'penguin';
    return {
      title: 'Hello',
      defaults: { background: Object.keys(window.Pres.backgrounds)[0], skin },
      slides: [
        { title: { text: 'Hello!', subtitle: 'pixel presentation' }, characters: [{ expression: 'happy', pose: 'wave', say: 'Hi! This is the built-in sample.' }], duration: 4 },
        { characters: [{ expression: 'joy', pose: 'cheer', say: 'Pick a scenario from the library above.' }], duration: 4 },
      ],
    };
  }

  function isValid(sc) {
    try { return window.Pres.validate(sc).errors.length === 0; } catch (e) { return false; }
  }

  function slugOf(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'scenario';
  }

  function mount(ctx) {
    injectCss();
    const P = window.Pres;
    // sound controls exist only when audio.js loaded and the browser can make sound
    const audio = P.audio && P.audio.supported ? P.audio : null;
    let mounted = true;                 // audio.onChange has no unsubscribe: its callback checks this
    const query = ctx.query || new URLSearchParams();
    const rawAutoplay = query.get('autoplay');
    const autoplay = rawAutoplay !== null && !['0', 'false', 'no', 'off'].includes(rawAutoplay.toLowerCase());
    const hello = helloScenario();
    const customs = {};                 // "file:<name>" -> scenario loaded from a .json file
    const statsCache = new WeakMap();   // scenario object -> { ok, slides, duration } | { ok: false, error }
    let registry = {};                  // key -> scenario, for the library cards and the picker
    let cardEls = new Map();
    let currentKey = null;
    let lastStatus = null;
    let alive = true;

    // ---------------------------------------------------------------- DOM
    const stageEl = h('div', { class: 'v-pres-stage' });
    const captionEl = h('div', { class: 'px-caption v-pres-caption' });
    const stagebox = h('div', { class: 'px-stage v-pres-stagebox' }, stageEl, captionEl);
    const clockEl = h('span', { class: 'v-pres-clock', text: '0.0 / 0.0 s' });
    const scrub = h('input', { class: 'v-pres-scrub', type: 'range', min: '0', max: '1000', value: '0', oninput: onScrub });
    const playBtn = h('button', { class: 'px-btn', type: 'button', onclick: togglePlay }, 'Play');
    const prevBtn = h('button', { class: 'px-btn alt', type: 'button', onclick: () => step(-1) }, '< Prev');
    const nextBtn = h('button', { class: 'px-btn alt', type: 'button', onclick: () => step(1) }, 'Next >');
    const fsBtn = h('button', { class: 'px-btn alt', type: 'button', onclick: toggleFullscreen }, 'Fullscreen');
    const loopBox = h('input', { type: 'checkbox', onchange: (e) => { player.loop = e.target.checked; } });
    const slidesEl = h('div', { class: 'v-pres-slides' });
    const transport = h('div', { class: 'px-row v-pres-transport' },
      prevBtn, playBtn, nextBtn, scrub, clockEl,
      h('label', { class: 'v-pres-loop' }, loopBox, ' Loop'), fsBtn);

    // sound controls (only built when Pres.audio is supported)
    const soundBtn = audio ? h('button', { class: 'px-btn', type: 'button', title: 'Mute or unmute the sound (M)', onclick: toggleMute }, 'Sound: on') : null;
    const volEl = audio ? h('input', { class: 'v-pres-volume', type: 'range', min: '0', max: '100', step: '1', title: 'Volume', 'aria-label': 'Volume', oninput: onVolume }) : null;
    const nowEl = audio ? h('span', { class: 'px-muted v-pres-now', text: 'Now playing: none' }) : null;
    const soundRow = audio ? h('div', { class: 'px-row v-pres-sound' },
      soundBtn,
      h('label', { class: 'v-pres-loop' }, 'Volume ', volEl),
      nowEl) : null;
    // shown next to the scenario picker when the loaded scenario has music or sfx fields
    const soundChip = h('span', { class: 'px-chip on', title: 'This scenario has music or sound effects', text: 'Has sound', hidden: true });
    const cardsEl = h('div', { class: 'v-pres-cards' });
    const library = h('section', { class: 'px-panel v-pres-library' },
      h('h2', { text: 'Scenario library' }),
      h('p', { class: 'px-muted v-pres-hint', text: 'Click a scenario to load it. Space = play/pause, Left/Right = previous/next slide' + (audio ? ', M = mute' : '') + '.' }),
      cardsEl);

    const picker = h('select', { class: 'px-select v-pres-select', title: 'Scenario', onchange: () => selectKey(picker.value) });
    const json = h('textarea', { class: 'px-textarea v-pres-json', spellcheck: false });
    const msgEl = h('div', { class: 'px-msg v-pres-msg' });
    const fileInput = h('input', { type: 'file', accept: '.json,application/json', class: 'v-pres-file', onchange: onFileChosen });
    const side = h('aside', { class: 'px-panel v-pres-side' },
      h('h2', { text: 'Scenario' }),
      h('div', { class: 'px-row' },
        picker,
        soundChip,
        h('button', { class: 'px-btn', type: 'button', onclick: loadFromEditor }, 'Load JSON'),
        h('button', { class: 'px-btn alt', type: 'button', onclick: showCatalog }, 'Show catalog')),
      h('div', { class: 'px-row' },
        h('button', { class: 'px-btn alt', type: 'button', onclick: downloadJson }, 'Download .json'),
        h('button', { class: 'px-btn alt', type: 'button', onclick: () => fileInput.click() }, 'Load .json file'),
        fileInput),
      json,
      msgEl);

    const root = h('div', { class: 'v-presentations' },
      library,
      h('div', { class: 'px-layout' },
        h('section', { class: 'v-pres-main' }, stagebox, transport, soundRow, slidesEl),
        side));
    ctx.root.append(root);

    // ---------------------------------------------------------------- player (engine.js)
    const player = new P.Player(stageEl, { loop: false });
    player.on('end', () => { setPlaying(false); updateUi(); });

    // ---------------------------------------------------------------- messages and status
    function showMsg(cls, text) {
      msgEl.className = `px-msg v-pres-msg ${cls}`;
      msgEl.textContent = text;
    }

    function setStatus(text) {
      if (text === lastStatus) return;
      lastStatus = text;
      ctx.setStatus(text);
    }

    function setPlaying(on) {
      const label = on ? 'Pause' : 'Play';
      if (playBtn.textContent !== label) playBtn.textContent = label;
      playBtn.classList.toggle('on', !on);
    }

    // ---------------------------------------------------------------- library
    // Duration and slide count come from the engine itself (a throwaway Player), so they always match
    // what the stage will play, including durations derived from the text.
    function statsOf(sc) {
      if (statsCache.has(sc)) return statsCache.get(sc);
      let out;
      try {
        const probe = new P.Player(document.createElement('div'), { loop: false });
        try {
          probe.load(sc);
          out = { ok: true, slides: probe.sc.slides.length, duration: probe.duration };
        } finally {
          probe.ro.disconnect();
        }
      } catch (e) {
        out = { ok: false, error: e.message };
      }
      statsCache.set(sc, out);
      return out;
    }

    function card(key) {
      const sc = registry[key];
      const st = statsOf(sc);
      const el = h('button', { class: 'px-tile v-pres-card', type: 'button', title: key, onclick: () => selectKey(key) },
        h('b', { text: sc.title || key }),
        h('small', { text: st.ok ? `${st.slides} slides - ${st.duration.toFixed(1)} s` : 'does not validate' }));
      if (!st.ok) el.classList.add('is-err');
      cardEls.set(key, el);
      return el;
    }

    function refreshRegistry() {
      registry = Object.assign({}, P.scenarios || {});
      if (!registry.hello) registry.hello = hello;
      Object.assign(registry, customs);
      picker.textContent = '';
      Object.keys(registry).forEach((k) => picker.append(h('option', { value: k, text: registry[k].title || k })));
      cardEls = new Map();
      cardsEl.textContent = '';
      Object.keys(registry).forEach((k) => cardsEl.append(card(k)));
      markCurrent();
    }

    function markCurrent() {
      cardEls.forEach((el, k) => el.classList.toggle('on', k === currentKey));
      picker.value = currentKey || '';
    }

    // ---------------------------------------------------------------- loading
    function build() {
      slidesEl.textContent = '';
      player.sc.slides.forEach((s, i) => {
        slidesEl.append(h('button', {
          class: 'px-chip', type: 'button', title: s.id, text: String(i + 1),
          onclick: () => { pausePlayback(); player.seek(i); updateUi(); },
        }));
      });
    }

    // returns true when the scenario is on the stage; on failure the previous one stays up
    function loadScenario(sc) {
      pausePlayback();
      const hasSound = hasSoundFields(sc, 0);
      try {
        player.load(sc);
      } catch (e) {
        showMsg('err', e.message);
        updateUi();
        return false;
      }
      const r = player.report;
      showMsg(r.warnings.length ? 'warn' : 'ok',
        r.warnings.length ? 'Loaded with warnings:\n' + r.warnings.join('\n')
          : `OK: ${player.sc.slides.length} slides, ${player.duration.toFixed(1)} s`);
      build();
      soundChip.hidden = !hasSound;
      updateUi();
      return true;
    }

    function selectKey(key, opts = {}) {
      const sc = registry[key];
      if (!sc) return;
      currentKey = key;
      json.value = JSON.stringify(sc, null, 2);
      const ok = loadScenario(sc);
      markCurrent();
      if (ok && opts.play) startPlay();
    }

    function loadFromEditor() {
      let obj;
      try { obj = JSON.parse(json.value); } catch (e) { showMsg('err', 'JSON error: ' + e.message); return; }
      currentKey = null;
      loadScenario(obj);
      markCurrent();
    }

    function showCatalog() {
      json.value = JSON.stringify(P.catalog(), null, 2);
    }

    function onFileChosen() {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (!alive) return;
        let obj;
        try { obj = JSON.parse(String(reader.result)); } catch (e) { showMsg('err', `${file.name}: JSON error: ${e.message}`); return; }
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { showMsg('err', `${file.name}: a scenario must be a JSON object`); return; }
        const key = 'file:' + file.name;
        customs[key] = obj;
        refreshRegistry();
        selectKey(key);
      };
      reader.onerror = () => { if (alive) showMsg('err', `Could not read ${file.name}`); };
      reader.readAsText(file);
    }

    function downloadJson() {
      let obj;
      try { obj = JSON.parse(json.value); } catch (e) { showMsg('err', 'Cannot download, JSON error: ' + e.message); return; }
      const base = (obj && obj.title) || (currentKey || '').replace(/^file:/, '') || 'scenario';
      const name = slugOf(base) + '.json';
      const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2) + '\n'], { type: 'application/json' }));
      const a = h('a', { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showMsg('ok', `Downloaded ${name}`);
    }

    // ---------------------------------------------------------------- playback
    function pausePlayback() {
      player.pause();
      setPlaying(false);
    }

    function startPlay() {
      if (!player.sc) return;
      if (player.time >= player.duration - 0.05) player.seek(0);
      player.play();
      setPlaying(true);
    }

    function togglePlay() {
      if (!player.sc) return;
      if (player.playing) pausePlayback(); else startPlay();
    }

    function step(dir) {
      if (!player.sc) return;
      if (dir < 0) player.prev(); else player.next();
      updateUi();
    }

    function onScrub(e) {
      if (!player.sc) return;
      const t = (e.target.value / 1000) * player.duration;
      const s = player.sc.slides.find((x) => t >= x.start && t < x.start + x.duration) || player.sc.slides[0];
      pausePlayback();
      player.seek(s.index);
      updateUi();
    }

    function updateUi() {
      if (!alive) return;
      if (!player.sc) {
        clockEl.textContent = '0.0 / 0.0 s';
        captionEl.textContent = '';
        setStatus('No scenario loaded');
        return;
      }
      const s = player.state();
      clockEl.textContent = `${s.time.toFixed(1)} / ${s.total.toFixed(1)} s`;
      scrub.value = String(Math.round((s.time / Math.max(0.001, s.total)) * 1000));
      [...slidesEl.children].forEach((b, i) => b.classList.toggle('on', i === s.slide));
      const say = player.slide && player.slide.characters.find((x) => x.say);
      captionEl.textContent = say ? say.say : '';
      setPlaying(player.playing);
      setStatus(`${player.sc.title || 'Untitled'} - slide ${Math.max(0, s.slide) + 1}/${player.sc.slides.length}`);
    }

    // ---------------------------------------------------------------- sound (presentation/audio.js)
    // true when a scenario object has a music or sfx field anywhere (checked on the raw JSON)
    function hasSoundFields(v, depth) {
      if (!v || typeof v !== 'object' || depth > 64) return false;
      if (v.music != null || v.sfx != null) return true;
      return Object.values(v).some((x) => hasSoundFields(x, depth + 1));
    }

    function trackLabel(name) {
      if (!name) return 'none';
      let hit = null;
      try {
        const cat = audio.catalog();
        hit = ((cat && cat.music) || []).find((m) => m.id === name) || null;
      } catch (e) { hit = null; }
      return (hit && hit.label) || name;
    }

    function refreshSound() {
      if (!audio || !mounted) return;
      const muted = audio.isMuted();
      soundBtn.textContent = muted ? 'Sound: off' : 'Sound: on';
      soundBtn.classList.toggle('on', !muted);
      const v = audio.getVolume();
      if (typeof v === 'number' && isFinite(v)) {
        const vol = String(Math.round(v * 100));
        if (volEl.value !== vol) volEl.value = vol;
      }
      nowEl.textContent = `Now playing: ${trackLabel(audio.nowPlaying())}`;
    }

    function toggleMute() {
      if (!audio) return;
      audio.setMuted(!audio.isMuted());
      refreshSound();
    }

    function onVolume() {
      if (!audio) return;
      audio.setVolume(Number(volEl.value) / 100);
      refreshSound();
    }

    // ---------------------------------------------------------------- fullscreen (stage box only)
    function fsElement() {
      return document.fullscreenElement || document.webkitFullscreenElement || null;
    }

    function toggleFullscreen() {
      if (fsElement() === stagebox) { exitFullscreen(); return; }
      const req = stagebox.requestFullscreen || stagebox.webkitRequestFullscreen;
      if (typeof req !== 'function') { showMsg('warn', 'Fullscreen is not supported by this browser.'); return; }
      try {
        const p = req.call(stagebox);
        if (p && typeof p.catch === 'function') p.catch(() => showMsg('warn', 'The browser refused fullscreen.'));
      } catch (e) {
        showMsg('warn', 'Fullscreen failed: ' + e.message);
      }
    }

    function exitFullscreen() {
      const ex = document.exitFullscreen || document.webkitExitFullscreen;
      if (typeof ex !== 'function') return;
      try {
        const p = ex.call(document);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) { /* nothing to exit */ }
    }

    function onFsChange() {
      fsBtn.textContent = fsElement() === stagebox ? 'Exit fullscreen' : 'Fullscreen';
    }

    // ---------------------------------------------------------------- keyboard
    function onKey(e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target || {};
      const tag = t.tagName || '';
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || t.isContentEditable) return;
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (e.repeat) return;
        // a focused button would also turn Space into a click (a second toggle), so drop its focus first
        if (tag === 'BUTTON' || tag === 'A') t.blur();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'm' || e.key === 'M') {
        if (audio && !e.repeat) toggleMute();
      }
    }

    // ---------------------------------------------------------------- start and teardown
    function pickStart() {
      const want = query.get('scenario');
      if (want && registry[want]) return want;
      const keys = Object.keys(registry);
      const order = ['how-claude-works', ...keys];
      const good = order.find((k) => registry[k] && isValid(registry[k]));
      return good || keys[keys.length - 1];
    }

    refreshRegistry();
    const timer = setInterval(updateUi, 200);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    if (audio) audio.onChange(() => { if (mounted) refreshSound(); });
    refreshSound();
    selectKey(pickStart(), { play: autoplay });
    updateUi();

    return function cleanup() {
      alive = false;
      mounted = false;
      clearInterval(timer);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      player.pause();
      if (audio && typeof audio.stopMusic === 'function') audio.stopMusic();
      try { player.ro.disconnect(); } catch (e) { /* already gone */ }
      if (fsElement() === stagebox) exitFullscreen();
    };
  }

  window.Dashboard.register({ id: 'presentations', title: 'Presentations', order: 4, mount });
})();
