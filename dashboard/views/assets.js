/*
 * assets.js - the "Assets" view of the dashboard: a browser for the pixel art the presentation uses.
 *
 * Ported from presentation/assets-preview.html:
 *   Backgrounds  3x, with the selected character for scale and the ground line; animated ones tick at 12 fps
 *   Props        5x on a checker; animated ones redraw at 12 fps
 *   Font & UI    pixel font sample, speech bubble, bullet panel, title card, tag label
 *   Sounds       sound effects (Play) and music (Play/Stop, bpm) from presentation/audio.js, when available
 * Added: a filter box (matches id or label in every section), sub-tabs, a count per section,
 * a "Copy name" button per tile, and a background caption with id, label, tone, ground y and animated/static.
 *
 * The shell loads pixel.js, registry.js, font.js, ui.js, backgrounds.js, props.js, parts.js, the skins and
 * character.js before this file. Globals used: Dashboard, Pres, Character, CharacterSkins.
 */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const BG_SCALE = 3;                 // backgrounds: 240 x 135 grid shown at 3x
  const PROP_SCALE = 5;
  const UI_SCALE = 4;
  const FPS = 12;
  const STEP = 1 / FPS;
  const CHAR_LEFT = 8;                // x of the reference character on the stage, as in assets-preview.html
  const FLASH_MS = 1500;
  const FALLBACK_GRID = { w: 61, h: 76 };
  const SECTIONS = [
    { key: 'backgrounds', title: 'Backgrounds' },
    { key: 'props', title: 'Props' },
    { key: 'ui', title: 'Font & UI' },
    { key: 'sounds', title: 'Sounds' },
  ];
  const TABS = [
    { key: 'backgrounds', label: 'Backgrounds' },
    { key: 'props', label: 'Props' },
    { key: 'ui', label: 'Font & UI' },
    { key: 'sounds', label: 'Sounds' },
    { key: 'all', label: 'All' },
  ];
  const FONT_LINES = [
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    'abcdefghijklmnopqrstuvwxyz',
    `0123456789 .,!?:;'"-+()/%&#*=<>[]@_`,
    'The quick brown fox jumps over the lazy dog.',
  ];

  const CSS_ID = 'v-assets-css';
  const CSS = `
.v-assets { color: var(--text); }
.v-assets [hidden] { display: none !important; }
.v-assets .v-assets-intro { margin: 0 0 12px; }
.v-assets .v-assets-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.v-assets .v-assets-search { flex: 1 1 260px; max-width: 420px; }
.v-assets .v-assets-grid { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; overflow-x: auto; padding: 0 6px 8px 0; }
.v-assets .v-assets-tile { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-width: 0; text-align: left; }
.v-assets .v-assets-tile svg { display: block; }
.v-assets .v-assets-bg { position: relative; flex: 0 0 auto; width: 720px; height: 405px; overflow: hidden; background: #ffffff; }
.v-assets .v-assets-scene { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: block; }
.v-assets .v-assets-ground { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed #ff00ff; pointer-events: none; }
.v-assets .v-assets-who { position: absolute; }
.v-assets .v-assets-cap { margin: 0; font-size: 12px; line-height: 1.4; overflow-wrap: anywhere; }
.v-assets .v-assets-empty { margin: 4px 0 0; }
.v-assets .v-assets-group { flex: 1 1 100%; min-width: 0; }
.v-assets .v-assets-group h3 { margin: 0 0 8px; font-size: 14px; }
.v-assets .v-assets-subgrid { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; padding: 0 6px 8px 0; }
.v-assets .v-assets-subgrid > .v-assets-tile { width: 200px; }
`;

  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    const s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = CSS;
    document.head.append(s);
  }

  // Dashboard.el with a class and optional text; children are appended by the caller.
  const el = (tag, className, text) => {
    const n = Dashboard.el(tag, className ? { className } : {});
    if (text != null) n.textContent = text;
    return n;
  };

  const svgEl = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
    return n;
  };

  const errText = (e) => (e && e.message) || String(e);
  const errMsg = (text) => el('div', 'px-msg err', text);
  const show = (node, on) => { node.style.display = on ? '' : 'none'; };

  // Feet sit about 70 px down a 76 px tall character (CONTRACT.md); keep that gap for other heights.
  const feetFromTop = (h) => h - 6;

  // The reference character's size comes from its skin's pixelGrid.
  function gridOf(skin) {
    const s = window.CharacterSkins && window.CharacterSkins[skin];
    const g = s && s.pixelGrid;
    return g && g.w && g.h ? g : FALLBACK_GRID;
  }

  // Transparency checker behind props and UI samples: 2 px cells in SVG user units (art pixels).
  let patternSeq = 0;
  function checkerMarkup(x, y, w, h) {
    const id = 'v-assets-chk-' + (++patternSeq);
    return '<defs><pattern id="' + id + '" width="4" height="4" patternUnits="userSpaceOnUse">' +
      '<rect width="4" height="4" fill="#ffffff"/><rect width="2" height="2" fill="#f1f1f1"/>' +
      '<rect x="2" y="2" width="2" height="2" fill="#f1f1f1"/></pattern></defs>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="url(#' + id + ')"/>';
  }

  function setCaption(cap, head, detail) {
    cap.textContent = '';
    cap.append(el('b', null, head));
    if (detail) cap.append(document.createElement('br'), detail);
  }

  Dashboard.register({
    id: 'assets',
    title: 'Assets',
    order: 5,
    mount(ctx) {
      injectCss();
      const top = el('div', 'v-assets');
      ctx.root.append(top);

      const P = window.Pres;
      if (!P || !P.GRID || !P.Buf) {
        top.append(errMsg('Pixel toolkit not loaded (presentation/pixel.js and registry.js).'));
        return function cleanup() { top.remove(); };
      }

      // ------------------------------------------------------------ state
      let alive = true;
      let mounted = true;                           // cleared in cleanup; guards the audio callbacks
      let raf = 0;
      let flashTimer = 0;
      let flashing = false;
      let animate = true;
      let showChar = true;
      let showGround = true;
      let filter = '';
      let tab = 'all';
      let t = 0;                                    // animation time in seconds, advances in 1/12 s steps
      const wanted = ctx.query && ctx.query.get ? ctx.query.get('tab') : null;
      if (TABS.some((x) => x.key === wanted)) tab = wanted;

      const offs = [];                              // undo functions for everything we subscribe to
      const listen = (target, type, fn) => {
        target.addEventListener(type, fn);
        offs.push(() => target.removeEventListener(type, fn));
      };
      const tiles = [];                             // { key, el, hay }
      const sections = {};                          // key -> { sec, grid, count, empty }
      const tabBtns = {};
      const refs = [];                              // { who, ground } one reference character per background
      const grounds = [];                           // ground lines, for the toggle
      const steppers = [];                          // { tile, fn } redrawn at 12 fps
      const onSkin = [];                            // redraws that depend on the skin (bubble text)

      // ------------------------------------------------------------ helpers
      function failOnce(node, e) {
        if (node.dataset.failed) return;
        node.dataset.failed = '1';
        node.append(errMsg(errText(e)));
      }

      function runStepper(s) {
        // skip tiles that are filtered out or in a hidden tab (offsetParent is null for those)
        if (!s.tile.isConnected || s.tile.offsetParent === null) return;
        try { s.fn(); } catch (e) { failOnce(s.tile, e); }
      }

      function makeTile(key, id, label) {
        const node = el('div', 'px-tile v-assets-tile');
        tiles.push({ key, el: node, hay: (id + ' ' + label).toLowerCase() });
        return node;
      }

      function copyButton(id) {
        const b = el('button', 'px-btn alt', 'Copy name');
        b.type = 'button';
        b.title = 'Copy the id ' + id + ' to the clipboard';
        listen(b, 'click', () => copyName(id));
        return b;
      }

      async function copyName(id) {
        let ok = false;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(id);
            ok = true;
          }
        } catch (e) {
          ok = false;
        }
        if (!alive) return;
        if (!ok) { ctx.setStatus('copy failed, the name is: ' + id); return; }
        ctx.setStatus('copied: ' + id);
        flashing = true;
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => {
          flashTimer = 0;
          if (alive && flashing) { flashing = false; ctx.setStatus(''); }
        }, FLASH_MS);
      }

      // Reference character for a background, built from the globally selected skin.
      function placeCharacter(ref) {
        const skin = ctx.state.skin;
        const g = gridOf(skin);
        const who = ref.who;
        who.textContent = '';
        Object.assign(who.style, {
          left: CHAR_LEFT * BG_SCALE + 'px',
          top: (ref.ground - feetFromTop(g.h)) * BG_SCALE + 'px',
          width: g.w * BG_SCALE + 'px',
          height: g.h * BG_SCALE + 'px',
        });
        show(who, showChar);
        try {
          const c = new window.Character(who, { skin, idle: false, blink: false });
          c.svg.setAttribute('shape-rendering', 'crispEdges');
          c.apply({ expression: 'happy', pose: 'idle' }, { snap: true });
        } catch (e) {
          who.textContent = '';
          who.append(errMsg('character: ' + errText(e)));
        }
      }

      // ------------------------------------------------------------ backgrounds
      function buildBackgrounds(grid) {
        for (const [id, bg] of Object.entries(P.backgrounds || {})) {
          const node = makeTile('backgrounds', id, bg.label);
          const box = el('div', 'v-assets-bg');
          const svg = svgEl('svg', {
            class: 'v-assets-scene',
            viewBox: `0 0 ${P.GRID.w} ${P.GRID.h}`,
            preserveAspectRatio: 'none',
            'shape-rendering': 'crispEdges',
          });
          let drawn = false;
          try {
            const stat = new P.Buf();
            bg.draw(stat);
            svg.innerHTML = `<g>${stat.svg()}</g><g class="live"></g>`;
            drawn = true;
          } catch (e) {
            node.append(errMsg('draw failed: ' + errText(e)));
          }
          if (drawn) box.append(svg);

          const ground = el('div', 'v-assets-ground');
          ground.style.top = bg.ground * BG_SCALE + 'px';
          show(ground, showGround);
          box.append(ground);
          grounds.push(ground);

          if (window.Character) {
            const who = el('div', 'v-assets-who');
            box.append(who);
            const ref = { who, ground: bg.ground };
            refs.push(ref);
            placeCharacter(ref);
          }

          const live = drawn ? svg.querySelector('.live') : null;
          if (bg.tick && live) {
            steppers.push({
              tile: node,
              fn: () => { const b = new P.Buf(); bg.tick(b, t); live.innerHTML = b.svg(); },
            });
          }

          const cap = el('div', 'px-caption v-assets-cap');
          setCaption(cap, id, `${bg.label} | tone: ${bg.tone} | ground y=${bg.ground} | ${bg.tick ? 'animated' : 'static'}`);
          node.prepend(box);
          node.append(cap, copyButton(id));
          grid.append(node);
        }
      }

      // ------------------------------------------------------------ props
      function buildProps(grid) {
        for (const [id, p] of Object.entries(P.props || {})) {
          const node = makeTile('props', id, p.label);
          const pad = 2;
          const vw = p.w + pad * 2;
          const vh = p.h + pad * 2;
          const svg = svgEl('svg', {
            viewBox: `${-pad} ${-pad} ${vw} ${vh}`,
            width: vw * PROP_SCALE,
            height: vh * PROP_SCALE,
            'shape-rendering': 'crispEdges',
          });
          const chk = checkerMarkup(-pad, -pad, vw, vh);
          const draw = () => { const b = new P.Buf(); p.draw(b, t); svg.innerHTML = chk + b.svg(); };
          node.append(svg);
          try { draw(); } catch (e) { node.append(errMsg('draw failed: ' + errText(e))); }
          if (p.animated) steppers.push({ tile: node, fn: draw });

          const cap = el('div', 'px-caption v-assets-cap');
          setCaption(cap, id, `${p.label} | ${p.w}x${p.h}${p.animated ? ' | animated' : ''}`);
          node.append(cap, copyButton(id));
          grid.append(node);
        }
      }

      // ------------------------------------------------------------ font + UI
      function buildFont(grid) {
        if (!P.font) return;
        const node = makeTile('ui', 'font', 'pixel font sample');
        try {
          const b = new P.Buf();
          let y = 2;
          let w = 0;
          for (const l of FONT_LINES) {
            P.font.draw(b, l, 2, y, '#2d2540');
            y += (P.font.glyphHeight || 7) + 3;
            w = Math.max(w, P.font.measure(l).w + 4);
          }
          const svg = svgEl('svg', {
            viewBox: `0 0 ${w} ${y + 2}`,
            width: w * 3,
            height: (y + 2) * 3,
            'shape-rendering': 'crispEdges',
          });
          svg.innerHTML = `<rect width="${w}" height="${y + 2}" fill="#ffffff"/>` + b.svg();
          node.append(svg);
        } catch (e) {
          node.append(errMsg('font: ' + errText(e)));
        }
        const cap = el('div', 'px-caption v-assets-cap');
        setCaption(cap, 'font', 'Pixel font: capitals, lowercase, digits, symbols, sample sentence');
        node.append(cap, copyButton('font'));
        grid.append(node);
      }

      function buildUi(grid) {
        if (!P.ui) return;
        const samples = [
          {
            name: 'bubble', label: 'speech bubble', redraw: true,
            make: () => P.ui.bubble({
              text: `Hi! I am ${Dashboard.skinName(ctx.state.skin)}. Today we learn how a website loads!`,
              maxWidth: 110,
              tail: 'left',
            }),
          },
          {
            name: 'panel', label: 'bullet panel',
            make: () => P.ui.panel({
              title: 'Steps',
              bullets: ['Browser asks DNS', 'DNS finds the server', 'Server sends the page'],
              maxWidth: 110,
              reveal: 3,
            }),
          },
          {
            name: 'titleCard', label: 'title card',
            make: () => P.ui.titleCard({ title: 'How a website loads', subtitle: 'A pixel explainer', w: 150 }),
          },
          { name: 'label', label: 'tag label', make: () => P.ui.label('Server') },
        ];
        for (const s of samples) {
          const id = 'ui.' + s.name;
          const node = makeTile('ui', id, s.label);
          const svg = svgEl('svg', { 'shape-rendering': 'crispEdges' });
          const cap = el('div', 'px-caption v-assets-cap');
          node.append(svg);
          const paint = () => {
            const r = s.make();
            const pad = 2;
            const vw = r.w + pad * 2;
            const vh = r.h + pad * 2;
            svg.setAttribute('viewBox', `${-pad} ${-pad} ${vw} ${vh}`);
            svg.setAttribute('width', vw * UI_SCALE);
            svg.setAttribute('height', vh * UI_SCALE);
            svg.innerHTML = checkerMarkup(-pad, -pad, vw, vh) + r.buf.svg();
            setCaption(cap, id, `${s.label} | ${r.w}x${r.h}`);
          };
          const safePaint = () => {
            try { paint(); } catch (e) { failOnce(node, e); }
          };
          safePaint();
          if (s.redraw) onSkin.push(safePaint);
          node.append(cap, copyButton(id));
          grid.append(node);
        }
      }

      // ------------------------------------------------------------ sounds
      // Sound effects and music from Pres.audio (presentation/audio.js). Optional: without the module or
      // without AudioContext the section shows one line and no cards. Nothing here throws.
      const soundGroups = [];                       // { wrap, grid } one per group, hidden when the filter empties it

      function soundGroup(grid, title) {
        const wrap = el('div', 'v-assets-group');
        const sub = el('div', 'v-assets-subgrid');
        wrap.append(el('h3', null, title), sub);
        grid.append(wrap);
        soundGroups.push({ wrap, grid: sub });
        return sub;
      }

      // Returns false (and builds nothing) when sound is unavailable.
      function buildSounds(grid) {
        const A = P.audio;
        if (!A || !A.supported) return false;
        let cat = {};
        try { cat = A.catalog() || {}; } catch (e) { cat = {}; }
        const sfxLabel = {};
        for (const x of cat.sfx || []) sfxLabel[x.id] = x.label;
        const musicBtns = [];                       // { id, btn } one Play/Stop button per track

        function refreshMusic() {
          if (!mounted) return;
          let playing = null;
          try { playing = A.nowPlaying() || null; } catch (e) { playing = null; }
          for (const m of musicBtns) {
            const on = m.id === playing;
            m.btn.textContent = on ? 'Stop' : 'Play';
            m.btn.setAttribute('aria-pressed', String(on));
          }
        }

        function toggleMusic(id) {
          if (!mounted) return;
          try {
            if (A.nowPlaying() === id) A.stopMusic();
            else { A.unlock(); A.music(id); }
          } catch (e) {
            ctx.setStatus('sound: ' + errText(e));
          }
          refreshMusic();
        }

        const fx = soundGroup(grid, 'Sound effects');
        for (const id of A.sfxNames || []) {
          const label = sfxLabel[id] || id;
          const node = makeTile('sounds', id, label);
          const play = el('button', 'px-btn', 'Play');
          play.type = 'button';
          play.title = 'Play the sound effect ' + id;
          listen(play, 'click', () => {
            try { A.unlock(); A.sfx(id); } catch (e) { ctx.setStatus('sound: ' + errText(e)); }
          });
          const cap = el('div', 'px-caption v-assets-cap');
          setCaption(cap, id, label !== id ? label : '');
          node.append(play, cap, copyButton(id));
          fx.append(node);
        }

        const mu = soundGroup(grid, 'Music');
        for (const m of cat.music || []) {
          const id = m.id;
          const label = m.label || id;
          const node = makeTile('sounds', id, label);
          const btn = el('button', 'px-btn', 'Play');
          btn.type = 'button';
          btn.title = 'Play or stop the track ' + id;
          btn.setAttribute('aria-pressed', 'false');
          listen(btn, 'click', () => toggleMusic(id));
          musicBtns.push({ id, btn });
          const cap = el('div', 'px-caption v-assets-cap');
          setCaption(cap, id, m.bpm != null ? label + ' | ' + m.bpm + ' bpm' : label);
          node.append(btn, cap, copyButton(id));
          mu.append(node);
        }

        // Character voices: one card per voice, Play babbles a short sentence. Optional: no group without voice().
        if (typeof A.voice === 'function') {
          const BABBLE_TEXT = 'Hello there, friend!';
          const BABBLE_GAP_MS = 70;
          const voiceTimers = new Set();        // pending blips of the running babble
          const cancelBabble = () => { voiceTimers.forEach((h) => clearTimeout(h)); voiceTimers.clear(); };
          offs.push(cancelBabble);              // cleanup runs the offs, so nothing keeps sounding after the view
          let cancelDemo = null;
          offs.push(() => { if (cancelDemo) { try { cancelDemo(); } catch (e) { /* already stopped */ } cancelDemo = null; } });
          const demo = (id, text, opts) => {
            if (cancelDemo) { try { cancelDemo(); } catch (e) { /* already stopped */ } cancelDemo = null; }
            cancelBabble();
            if (!mounted) return;
            try {
              A.unlock();
              cancelDemo = A.voiceDemo(id, text, opts);
            } catch (e) {
              ctx.setStatus('sound: ' + errText(e));
            }
          };
          const babble = (id) => {
            cancelBabble();                     // a new Play replaces the running babble
            if (typeof A.voiceDemo === 'function') { demo(id, BABBLE_TEXT, { expression: 'neutral' }); return; }
            if (!mounted) return;
            try {
              A.unlock();
              const chars = BABBLE_TEXT.split('').filter((c) => /[A-Za-z0-9]/.test(c));
              chars.forEach((ch, i) => {
                const h = setTimeout(() => {
                  voiceTimers.delete(h);
                  if (!mounted) return;
                  try { A.voice(id, ch); } catch (e) { ctx.setStatus('sound: ' + errText(e)); }
                }, i * BABBLE_GAP_MS);
                voiceTimers.add(h);
              });
            } catch (e) {
              ctx.setStatus('sound: ' + errText(e));
            }
          };
          const voiceList = Array.isArray(cat.voices)
            ? cat.voices
            : (Array.isArray(A.voiceNames) ? A.voiceNames : []).map((id) => ({ id, label: id }));
          const vo = soundGroup(grid, 'Character voices');
          for (const v of voiceList) {
            if (!v || v.id == null) continue;
            const id = v.id;
            const label = v.label || id;
            const node = makeTile('sounds', id, label);
            const play = el('button', 'px-btn', 'Play');
            play.type = 'button';
            play.title = 'Play the voice ' + id + ' saying ' + BABBLE_TEXT;
            listen(play, 'click', () => babble(id));
            const cap = el('div', 'px-caption v-assets-cap');
            setCaption(cap, id, label !== id ? label : '');
            node.append(play, cap);
            if (typeof A.voiceDemo === 'function') {
              // the same voice in other moods: expression changes pitch and speed, a question rises at the end
              for (const [name, text, opts] of [['Joy', 'We shipped it, hooray!', { expression: 'joy' }], ['Sad', 'Oh no, the tests failed.', { expression: 'sad' }], ['Ask', 'Is this the right one?', { expression: 'curious' }]]) {
                const b = el('button', 'px-btn alt', name);
                b.type = 'button';
                b.title = 'Play the voice ' + id + ' saying: ' + text;
                listen(b, 'click', () => demo(id, text, opts));
                node.append(b);
              }
            }
            node.append(copyButton(id));
            vo.append(node);
          }
        }
        refreshMusic();
        try {
          const off = A.onChange(refreshMusic);
          if (typeof off === 'function') offs.push(off);
        } catch (e) {
          // no change events: the buttons still update on click
        }
        return true;
      }

      function buildSoundsSection() {
        const info = sections.sounds;
        try {
          if (buildSounds(info.grid)) return;
        } catch (e) {
          info.grid.textContent = '';
          for (let i = tiles.length - 1; i >= 0; i--) if (tiles[i].key === 'sounds') tiles.splice(i, 1);
          soundGroups.length = 0;
        }
        info.silent = true;
        info.sec.append(el('p', 'px-muted v-assets-empty', 'Sound is not available in this browser.'));
      }

      // ------------------------------------------------------------ toolbar
      const toggle = (label, initial, onChange) => {
        let on = initial;
        const b = el('button', on ? 'px-chip on' : 'px-chip', label);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(on));
        listen(b, 'click', () => {
          on = !on;
          b.className = on ? 'px-chip on' : 'px-chip';
          b.setAttribute('aria-pressed', String(on));
          onChange(on);
        });
        return b;
      };

      const intro = el('p', 'px-muted v-assets-intro', 'Pixel art used by the presentation. Filter by id or label; Copy name copies the id.');

      const bar = el('div', 'v-assets-bar');
      const search = el('input', 'px-input v-assets-search');
      search.type = 'search';
      search.placeholder = 'Filter by id or label';
      search.setAttribute('aria-label', 'Filter assets by id or label');
      listen(search, 'input', () => { filter = search.value; applyView(); });
      bar.append(
        search,
        toggle('Show character for scale', showChar, (v) => { showChar = v; refs.forEach((r) => show(r.who, v)); }),
        toggle('Show ground line', showGround, (v) => { showGround = v; grounds.forEach((g) => show(g, v)); }),
        toggle('Animate (12 fps)', animate, (v) => { animate = v; }),
      );

      const tabBar = el('div', 'px-tabs');
      for (const tb of TABS) {
        const b = el('button', null, tb.label);
        b.type = 'button';
        listen(b, 'click', () => { tab = tb.key; applyView(); });
        tabBtns[tb.key] = b;
        tabBar.append(b);
      }

      // ------------------------------------------------------------ sections
      const wrap = el('div', 'v-assets-sections');
      for (const s of SECTIONS) {
        const sec = el('section', 'px-panel');
        const h = el('h2', null, s.title);
        const count = el('span', 'px-muted v-assets-count');
        h.append(' ', count);
        const grid = el('div', 'v-assets-grid');
        const empty = el('p', 'px-muted v-assets-empty');
        empty.hidden = true;
        sec.append(h, grid, empty);
        wrap.append(sec);
        sections[s.key] = { sec, grid, count, empty };
      }

      buildBackgrounds(sections.backgrounds.grid);
      buildProps(sections.props.grid);
      buildFont(sections.ui.grid);
      buildUi(sections.ui.grid);
      buildSoundsSection();

      // Applies the active tab and filter: section and tile visibility, counts, empty notes.
      function applyView() {
        const q = filter.trim().toLowerCase();
        for (const tb of TABS) {
          const on = tb.key === tab;
          tabBtns[tb.key].className = on ? 'on' : '';
          tabBtns[tb.key].setAttribute('aria-pressed', String(on));
        }
        for (const s of SECTIONS) {
          const info = sections[s.key];
          const mine = tiles.filter((x) => x.key === s.key);
          let shown = 0;
          for (const x of mine) {
            const ok = !q || x.hay.includes(q);
            x.el.hidden = !ok;
            if (ok) shown++;
          }
          info.sec.hidden = !(tab === 'all' || tab === s.key);
          info.count.textContent = q ? `(${shown} of ${mine.length})` : `(${mine.length})`;
          info.empty.textContent = mine.length ? 'No matches for this filter.' : 'Nothing to show.';
          info.empty.hidden = shown > 0 || !!info.silent;
        }
        soundGroups.forEach((g) => { g.wrap.hidden = !Array.from(g.grid.children).some((n) => !n.hidden); });
        steppers.forEach(runStepper);
      }

      applyView();

      // ------------------------------------------------------------ skin + animation loop
      const offSkin = ctx.on('skin', () => {
        if (!alive) return;
        refs.forEach(placeCharacter);
        onSkin.forEach((fn) => fn());
      });
      if (typeof offSkin === 'function') offs.push(offSkin);

      let last = performance.now();
      let acc = 0;
      const frame = (now) => {
        if (!alive) return;
        if (animate) {
          acc += Math.min(0.1, (now - last) / 1000);
          while (acc >= STEP) {
            acc -= STEP;
            t += STEP;
            steppers.forEach(runStepper);
          }
        }
        last = now;
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      top.append(intro, bar, tabBar, wrap);

      return function cleanup() {
        alive = false;
        mounted = false;
        // music must never keep playing after the view is left
        try { if (P.audio && P.audio.stopMusic) P.audio.stopMusic(); } catch (e) { /* audio is optional */ }
        cancelAnimationFrame(raf);
        clearTimeout(flashTimer);
        if (flashing) ctx.setStatus('');
        offs.splice(0).forEach((off) => off());
        top.remove();
      };
    },
  });
})();
