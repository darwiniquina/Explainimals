/*
 * shell.js - the frame of the Explainimals Studio dashboard. Defines window.Dashboard.
 *
 *   Dashboard.register({ id, title, order, mount(ctx) })   // mount may return a cleanup function
 *   Dashboard.start()                                       // builds header, nav, main and footer; routes by hash
 *
 * Routing: #/<viewId>?key=value. View ids and nav order: home, characters, scenes, presentations, assets.
 * A section whose file did not load (or never registered) shows as a disabled nav button titled "not loaded".
 * Plain classic script, plain DOM: works from file://.
 */
(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const DEFAULT_SKIN = 'penguin';
  const SKIN_ORDER = ['penguin', 'frog', 'dog', 'whisker', 'rabbit', 'bear'];
  const SKIN_NAMES = { penguin: 'Penguin', frog: 'Frog', dog: 'Dog', whisker: 'Cat', rabbit: 'Rabbit', bear: 'Bear' };

  // nav order and fallback labels (a registered view's own title wins)
  const NAV = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'characters', label: 'Characters', icon: 'face' },
    { id: 'scenes', label: 'Scenes', icon: 'play' },
    { id: 'presentations', label: 'Presentations', icon: 'screen' },
    { id: 'assets', label: 'Assets', icon: 'grid' },
  ];

  // 8 x 8 pixel icons; '#' is a lit pixel
  const ICONS = {
    home: ['...##...', '..####..', '.######.', '########', '.##..##.', '.##..##.', '.##..##.', '........'],
    face: ['..####..', '.######.', '##.##.##', '########', '#.#..#.#', '##....##', '.######.', '..####..'],
    play: ['#.......', '##......', '###.....', '####....', '###.....', '##......', '#.......', '........'],
    screen: ['########', '#......#', '#.#....#', '#.##...#', '#.####.#', '#......#', '########', '...##...'],
    grid: ['###..###', '###..###', '........', '........', '###..###', '###..###', '........', '........'],
  };

  const views = new Map();      // id -> { id, title, order, mount }
  const state = { skin: DEFAULT_SKIN };
  const els = {};               // header pieces, built in start()
  let skinSubs = [];            // [{ fn, token }] for ctx.on('skin', fn)
  let current = null;           // { id, token, cleanup } for the mounted view
  let started = false;

  // Tiny DOM helper: el(tag, props, ...children). Props are assigned onto the node; class, style,
  // dataset and attrs get special handling. A missing props object is fine: el('div', null, kid).
  function el(tag, props, ...kids) {
    if (props instanceof Node || Array.isArray(props) || typeof props === 'string' || typeof props === 'number') {
      kids.unshift(props);
      props = null;
    }
    const n = document.createElement(tag);
    if (props) {
      for (const key of Object.keys(props)) {
        const v = props[key];
        if (v === undefined || v === null) continue;
        if (key === 'class') n.className = v;
        else if (key === 'style' && typeof v === 'object') Object.assign(n.style, v);
        else if (key === 'dataset') Object.assign(n.dataset, v);
        else if (key === 'attrs') {
          for (const a of Object.keys(v)) n.setAttribute(a, v[a]);
        } else n[key] = v;
      }
    }
    kids.flat(Infinity).forEach((k) => {
      if (k !== undefined && k !== null && k !== false) n.append(k);
    });
    return n;
  }

  // crisp 16 px nav icon built from 1 x 1 rects
  function icon(name) {
    const rows = ICONS[name] || ICONS.grid;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${rows[0].length} ${rows.length}`);
    svg.setAttribute('class', 'dash-icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('shape-rendering', 'crispEdges');
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== '#') continue;
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', x);
        r.setAttribute('y', y);
        r.setAttribute('width', 1);
        r.setAttribute('height', 1);
        r.setAttribute('fill', 'currentColor');
        svg.append(r);
      }
    });
    return svg;
  }

  // the survivors that are actually loaded, in fixed order
  function loadedSkins() {
    return SKIN_ORDER.filter((id) => !!(global.CharacterSkins && global.CharacterSkins[id]));
  }

  function setStatus(text) {
    if (els.status) els.status.textContent = String(text);
  }

  // ------------------------------------------------------------- chrome
  function buildChrome() {
    els.nav = el('nav', { class: 'dash-nav' });
    els.picker = el('select', { class: 'px-select', title: 'Character used by every section' });
    els.picker.addEventListener('change', () => Dashboard.setSkin(els.picker.value));
    els.status = el('span', { class: 'dash-status' });
    els.main = el('main', { class: 'dash-main' });
    els.header = el('header', { class: 'dash-header' },
      el('div', { class: 'dash-brand', textContent: 'EXPLAINIMALS STUDIO' }),
      els.nav,
      el('label', { class: 'dash-picker' }, el('span', { textContent: 'Character' }), els.picker));
    els.footer = el('footer', { class: 'dash-footer' }, els.status);
    document.body.append(els.header, els.main, els.footer);
    syncPicker(true);
  }

  // rebuild the picker options (start only); afterwards just move the selection
  function syncPicker(rebuild) {
    const p = els.picker;
    if (!p) return;
    if (rebuild) {
      p.textContent = '';
      loadedSkins().forEach((id) => p.append(el('option', { value: id, textContent: Dashboard.skinName(id) })));
      if (!p.options.length) p.append(el('option', { value: '', textContent: 'no characters loaded' }));
    }
    p.disabled = !loadedSkins().length;
    p.value = state.skin;
  }

  function buildNav() {
    if (!els.nav) return;
    const known = NAV.map((n) => n.id);
    const extra = [...views.values()]
      .filter((v) => !known.includes(v.id))
      .sort((a, b) => a.order - b.order)
      .map((v) => ({ id: v.id, label: v.id, icon: 'grid' }));
    els.nav.textContent = '';
    [...NAV, ...extra].forEach((item) => {
      const def = views.get(item.id);
      const active = !!current && current.id === item.id;
      const btn = el('button', { class: 'px-btn dash-nav-btn' + (active ? ' on' : ''), dataset: { view: item.id } },
        icon(item.icon),
        el('span', { textContent: def ? def.title : item.label }));
      if (def) btn.addEventListener('click', () => Dashboard.navigate(item.id));
      else {
        btn.disabled = true;
        btn.title = 'not loaded';
      }
      els.nav.append(btn);
    });
  }

  // ------------------------------------------------------------- routing
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const i = raw.indexOf('?');
    return {
      id: (i < 0 ? raw : raw.slice(0, i)) || 'home',
      query: new URLSearchParams(i < 0 ? '' : raw.slice(i + 1)),
    };
  }

  function route() {
    const { id, query } = parseHash();
    mountView(id, query);
  }

  function unmountCurrent() {
    if (!current) return;
    const c = current;
    current = null;
    skinSubs = skinSubs.filter((s) => s.token !== c.token);
    if (typeof c.cleanup === 'function') {
      try { c.cleanup(); } catch (e) { console.error(e); }
    }
    els.main.textContent = '';
  }

  function mountView(id, query) {
    unmountCurrent();
    const def = views.get(id);
    const token = {};
    const cur = { id, token, cleanup: null };
    current = cur;
    const root = el('div', { class: 'view', id: 'view-' + id });
    els.main.append(root);
    buildNav();

    if (!def) {
      document.title = 'Not loaded | Explainimals Studio';
      root.append(
        el('div', { class: 'px-msg warn', textContent: `Section "${id}" is not loaded or does not exist.` }),
        el('button', { class: 'px-btn', textContent: 'Back to home', onclick: () => Dashboard.navigate('home') }));
      setStatus(`Section "${id}" is not loaded`);
      return;
    }

    document.title = `${def.title} | Explainimals Studio`;
    const ctx = {
      root,
      query,
      state,
      on(event, fn) {
        if (event !== 'skin' || typeof fn !== 'function') {
          console.warn(`ctx.on only supports the "skin" event (got "${event}")`);
          return;
        }
        if (current !== cur) return;          // the view has already left
        skinSubs.push({ fn, token });
      },
      setStatus,
      navigate: Dashboard.navigate,
    };
    try {
      const cleanup = def.mount(ctx);
      if (typeof cleanup === 'function') {
        if (current === cur) cur.cleanup = cleanup;
        else cleanup();                       // mount navigated away while it ran
      }
    } catch (e) {
      console.error(e);
      root.append(el('div', { class: 'px-msg err', textContent: `Section "${id}" failed: ${e && e.message ? e.message : e}` }));
      setStatus(`Section "${id}" failed`);
    }
  }

  // ------------------------------------------------------------- public API
  const Dashboard = {
    state,
    el,

    register(def) {
      if (!def || typeof def.id !== 'string' || typeof def.mount !== 'function') {
        throw new Error('Dashboard.register needs { id, mount }');
      }
      views.set(def.id, {
        id: def.id,
        title: def.title || def.id,
        order: typeof def.order === 'number' ? def.order : 100,
        mount: def.mount,
      });
      // a view that registers after the shell started replaces its "not loaded" page
      if (started && current && current.id === def.id) route();
      else if (started) buildNav();
    },

    has(viewId) {
      return views.has(viewId);
    },

    skins() {
      return loadedSkins();
    },

    skinName(id) {
      return SKIN_NAMES[id] || String(id);
    },

    setSkin(id) {
      if (!loadedSkins().includes(id)) {
        setStatus(`Character "${id}" is not loaded`);
        return false;
      }
      if (state.skin === id) return true;
      state.skin = id;
      syncPicker(false);
      skinSubs.slice().forEach((s) => {
        try { s.fn(id); } catch (e) { console.error(e); }
      });
      return true;
    },

    navigate(viewId, query) {
      const qs = query ? new URLSearchParams(query).toString() : '';
      const hash = '#/' + viewId + (qs ? '?' + qs : '');
      if (location.hash === hash) route();     // no hashchange fires for the same hash
      else location.hash = hash;
    },

    start() {
      if (started) return;
      started = true;
      if (!loadedSkins().includes(state.skin)) state.skin = loadedSkins()[0] || DEFAULT_SKIN;
      buildChrome();
      setStatus(`${loadedSkins().length} of ${SKIN_ORDER.length} characters loaded`);
      window.addEventListener('hashchange', route);
      route();
    },
  };

  global.Dashboard = Dashboard;
})(window);
