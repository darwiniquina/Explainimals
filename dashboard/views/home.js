/*
 * home.js - the Home view: stat tiles, the live crew, the scenario cards and the section launchers.
 * Degrades quietly: a missing Pres, Character or skin shows '--' or a warning, never a throw.
 */
(function (global) {
  'use strict';

  const D = global.Dashboard;
  if (!D) return;                       // shell.js did not load: nothing to register on

  const el = D.el;
  const SKIN_TOTAL = 6;
  const STEP = 1 / 12;                  // the rig advances in fixed 12 Hz steps, like a sprite sheet
  const MAX_CATCHUP = 0.25;             // after a stall, never run more than this much time at once

  const SECTIONS = [
    { id: 'characters', name: 'Characters', text: 'Playground and gallery: pose any character and try every expression, pose and part.' },
    { id: 'scenes', name: 'Scenes', text: 'Scene player and scene maker: write timed beats and play them on one character.' },
    { id: 'presentations', name: 'Presentations', text: 'Scenario player: play whole pixel explainers, slide by slide.' },
    { id: 'assets', name: 'Assets', text: 'Backgrounds, props, font and UI: browse and preview every drawn asset.' },
  ];

  const msg = (cls, text) => el('div', { class: 'px-msg ' + cls, textContent: text });
  const safe = (fn, fallback) => {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  };

  // dialogue blocks become one slide per line, so slide counts, timings and cast match what the player plays
  function expanded(sc) {
    try { return window.Pres && typeof window.Pres.expandDialogue === 'function' ? window.Pres.expandDialogue(sc) || sc : sc; } catch (e) { return sc; }
  }

  // Same rule as normalize() in presentation/engine.js: a slide without a duration gets one from its text.
  function estimateSeconds(sc) {
    const slides = Array.isArray(sc.slides) ? sc.slides : [];
    let total = 0;
    slides.forEach((s) => {
      if (s.duration) { total += s.duration; return; }
      const cs = Array.isArray(s.characters) ? s.characters : (s.character ? [s.character] : []);
      const chars = cs.reduce((n, c) => n + String((c && c.say) || '').length, 0);
      const bullets = s.panel && Array.isArray(s.panel.bullets) ? s.panel.bullets.length : 0;
      total += Math.max(3, Math.min(12, 1.4 + chars * 0.07 + (s.panel ? bullets * 0.8 : 0)));
    });
    return Math.round(total);
  }

  // skins a scenario uses (slide characters, falling back to defaults.skin, then the engine's 'penguin')
  function usedSkins(sc) {
    const fallback = (sc.defaults && sc.defaults.skin) || 'penguin';
    const out = [];
    (Array.isArray(sc.slides) ? sc.slides : []).forEach((s) => {
      const cs = Array.isArray(s.characters) ? s.characters : (s.character ? [s.character] : []);
      cs.forEach((c) => {
        const sid = (c && c.skin) || fallback;
        if (!out.includes(sid)) out.push(sid);
      });
    });
    return out;
  }

  // ------------------------------------------------------------- blocks
  function welcomeBlock() {
    const notes = [];
    if (!global.Pres) notes.push('presentation engine not loaded');
    if (!global.Character) notes.push('character rig not loaded');
    const n = safe(() => D.skins().length, 0);
    if (n < SKIN_TOTAL) notes.push(`${n} of ${SKIN_TOTAL} characters loaded`);
    return el('section', { class: 'px-panel' },
      el('h2', { textContent: 'Overview' }),
      el('p', { class: 'home-lede', textContent: 'One place for the character rig, the scene and presentation players and the asset library. The character picked in the header is used by every section.' }),
      notes.length ? msg('warn', 'Incomplete: ' + notes.join('; ') + '.') : null);
  }

  function statsBlock() {
    const P = global.Pres;
    const C = global.Character;
    const stats = [
      { label: 'Characters', n: safe(() => D.skins().length, null) },
      { label: 'Backgrounds', n: safe(() => Object.keys(P.backgrounds).length, null) },
      { label: 'Props', n: safe(() => Object.keys(P.props).length, null) },
      { label: 'Scenarios', n: safe(() => Object.keys(P.scenarios).length, null) },
      { label: 'Expressions', n: safe(() => C.expressions.length, null) },
      { label: 'Poses', n: safe(() => C.poses.length, null) },
    ];
    return el('section', null,
      el('h3', { class: 'px-sec', textContent: 'At a glance' }),
      el('div', { class: 'px-grid' }, stats.map((s) =>
        el('div', { class: 'px-tile home-stat', title: s.n === null ? 'not loaded' : '' },
          el('div', { class: 'home-stat-num', textContent: s.n === null ? '--' : String(s.n) }),
          el('div', { class: 'home-stat-label', textContent: s.label })))));
  }

  // Native pixel skins are drawn at a whole-number scale, so every art pixel is the same size on screen.
  function fitSprite(entry) {
    const grid = entry.c && entry.c.skin && entry.c.skin.pixelGrid;
    if (!grid) return;                  // not a native pixel skin: keep the rig's own viewBox scaling
    const k = Math.max(1, Math.floor(Math.min(entry.stage.clientWidth / grid.w, entry.stage.clientHeight / grid.h)));
    Object.assign(entry.c.svg.style, {
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
      width: grid.w * k + 'px', height: grid.h * k + 'px',
    });
  }

  // one tile per loaded character; each stage holds a live Character
  function crewBlock(entries, live) {
    const grid = el('div', { class: 'home-crew' });
    const ids = safe(() => D.skins(), []);
    if (!ids.length) grid.append(msg('warn', 'No characters are loaded. Check the character/skin-*.js tags in dashboard.html.'));
    ids.forEach((id) => {
      const name = D.skinName(id);
      const stage = el('div', { class: 'px-stage grid home-crew-stage' });
      const tile = el('div', { class: 'px-tile home-crew-tile', attrs: { role: 'button', tabindex: '0' }, title: `Open ${name} in Characters` },
        stage,
        el('div', { class: 'home-crew-name', textContent: name }),
        el('div', { class: 'home-crew-sub', textContent: id }));
      const pick = () => {
        D.setSkin(id);
        D.navigate('characters');
      };
      tile.addEventListener('click', pick);
      tile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick();
        }
      });
      grid.append(tile);

      const entry = { id, tile, stage, c: null, ro: null };
      entries.push(entry);
      try {
        entry.c = new global.Character(stage, { skin: id, idle: true, blink: true });
        entry.c.svg.setAttribute('shape-rendering', 'crispEdges');
        entry.c.apply({ expression: 'happy', pose: 'idle' }, { snap: true });
        if (typeof ResizeObserver !== 'undefined') {
          entry.ro = new ResizeObserver(() => fitSprite(entry));
          entry.ro.observe(stage);
        }
        fitSprite(entry);
        live.push(entry);
      } catch (e) {
        console.error(e);
        stage.append(msg('err', `Could not draw ${name}: ${e && e.message ? e.message : e}`));
      }
    });
    return el('section', null, el('h3', { class: 'px-sec', textContent: 'The crew' }), grid);
  }

  function scenarioCard(id, sc) {
    sc = expanded(sc);
    const slides = Array.isArray(sc.slides) ? sc.slides : [];
    const names = usedSkins(sc).map((sid) => (D.skins().includes(sid) ? D.skinName(sid) : `${sid} (not loaded)`));
    const canPlay = D.has('presentations');
    return el('div', { class: 'px-panel home-card' },
      el('h3', { textContent: sc.title || id }),
      el('div', { class: 'px-muted', textContent: `${slides.length} slides - about ${estimateSeconds(sc)} s` }),
      el('div', { class: 'px-muted', textContent: 'With: ' + (names.join(', ') || 'no characters') }),
      el('button', {
        class: 'px-btn on',
        textContent: 'Play',
        disabled: !canPlay,
        title: canPlay ? '' : 'not loaded',
        onclick: () => D.navigate('presentations', { scenario: id, autoplay: 1 }),
      }));
  }

  function scenariosBlock() {
    const section = el('section', null, el('h3', { class: 'px-sec', textContent: 'Scenarios' }));
    const P = global.Pres;
    const scenarios = (P && P.scenarios) || {};
    const ids = Object.keys(scenarios);
    if (!ids.length) {
      section.append(msg('warn', P ? 'No scenarios registered yet (presentation/scenarios/*.js).' : 'Presentation engine not loaded.'));
      return section;
    }
    section.append(el('div', { class: 'home-cards' }, ids.map((id) => scenarioCard(id, scenarios[id] || {}))));
    return section;
  }

  function sectionsBlock() {
    return el('section', null,
      el('h3', { class: 'px-sec', textContent: 'Sections' }),
      el('div', { class: 'home-cards' }, SECTIONS.map((s) => {
        const ok = D.has(s.id);
        return el('div', { class: 'px-panel home-card' },
          el('h3', { textContent: s.name }),
          el('div', { class: 'px-muted', textContent: s.text }),
          el('button', {
            class: 'px-btn',
            textContent: 'Open',
            disabled: !ok,
            title: ok ? '' : 'not loaded',
            onclick: () => D.navigate(s.id),
          }));
      })));
  }

  // ------------------------------------------------------------- mount
  function homeMount(ctx) {
    const root = ctx.root;
    const entries = [];                 // crew tiles
    const live = [];                    // the crew entries that animate
    let alive = true;
    let raf = 0;
    let acc = 0;
    let last = 0;

    root.append(
      welcomeBlock(),
      statsBlock(),
      crewBlock(entries, live),
      scenariosBlock(),
      sectionsBlock());

    // highlight the character picked in the header
    const syncOn = () => entries.forEach((e) => e.tile.classList.toggle('on', e.id === ctx.state.skin));
    ctx.on('skin', syncOn);
    syncOn();

    // one loop drives the whole crew, in fixed 1/12 s steps
    const frame = (now) => {
      if (!alive) return;
      if (!last) last = now;
      acc += Math.min(MAX_CATCHUP, (now - last) / 1000);
      last = now;
      while (acc >= STEP) {
        acc -= STEP;
        for (let i = live.length - 1; i >= 0; i--) {
          try {
            live[i].c.tick(STEP);
          } catch (e) {
            console.error(e);
            live.splice(i, 1);          // drop a character that keeps failing, keep the rest running
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    if (live.length) raf = requestAnimationFrame(frame);

    const nScen = safe(() => Object.keys(global.Pres.scenarios).length, 0);
    ctx.setStatus(`Home - ${safe(() => D.skins().length, 0)} characters, ${nScen} scenarios`);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      entries.forEach((e) => { if (e.ro) e.ro.disconnect(); });
    };
  }

  D.register({ id: 'home', title: 'Home', order: 0, mount: homeMount });
})(window);
