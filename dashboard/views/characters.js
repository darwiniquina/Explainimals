/*
 * dashboard/views/characters.js - the "Characters" view.
 *
 * Ported from test-runner.html (its Playground and Gallery tabs). Native pixel-art skins only: every skin
 * here has skin.pixelGrid, so the SVG is shown at a whole-number scale and the rig advances in fixed steps
 * (the Frame rate control). No smooth-vector mode, no pixel filter, no palettes.
 *
 * The skin comes from ctx.state.skin (the shell header picks it). There is no local skin selector.
 * Registers itself with Dashboard; all globals (Character, CharacterSkins) come from script tags.
 */
(function () {
  'use strict';

  const SKINS = ['penguin', 'frog', 'dog', 'whisker', 'rabbit', 'bear'];
  const DEFAULT_SKIN = 'penguin';
  const PARTS = ['eyes', 'brows', 'mouth'];
  const BG_NAMES = ['grid', 'light', 'dark', 'green'];
  const FPS = { min: 4, max: 24, def: 12 };
  const SCALE = { max: 12, def: 6 };
  const SPEED = { min: 2, max: 24, def: 9 };
  const STAGE_H = 560;                        // px: the stage height; the integer scale is capped so the art fits
  // gallery crops (viewBox strings). All six skins draw on the same 61 x 76 grid.
  const FACE_BOX = {
    penguin: '2 0 56 42', frog: '1 2 58 40', dog: '2 0 56 42',
    whisker: '0 0 61 42', rabbit: '2 0 56 42', bear: '2 0 56 42',
  };
  const BODY_BOX = '-6 -4 72 84';

  const CSS = `
.v-characters .v-stage { position: relative; height: ${STAGE_H}px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.v-characters .v-stage > svg, .v-characters .v-art > svg { flex: none; }
.v-characters .v-col { min-width: 0; }
.v-characters .v-skin { margin: 0 0 8px; font-size: 12px; }
.v-characters .v-field { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
.v-characters .v-k { min-width: 84px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.v-characters .v-val { min-width: 120px; font: 12px/1.4 ui-monospace, Consolas, monospace; color: var(--muted); }
.v-characters .v-check { display: inline-flex; align-items: center; gap: 6px; }
.v-characters input[type=range] { flex: 1 1 140px; min-width: 120px; accent-color: var(--accent); }
.v-characters input[type=checkbox] { accent-color: var(--accent); margin: 0; }
.v-characters input[type=color] { width: 34px; height: 26px; padding: 0; border: 1px solid var(--line); background: none; }
.v-characters .v-json { margin: 0; padding: 10px 12px; max-height: 320px; overflow: auto; white-space: pre; font: 12px/1.5 ui-monospace, Consolas, monospace; background: #0f1320; color: #d7def5; }
.v-characters .v-gallery { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
.v-characters .v-art { display: flex; align-items: center; justify-content: center; overflow: hidden; width: 100%; }
.v-characters .v-art.face { height: 110px; }
.v-characters .v-art.body { height: 230px; }
.v-characters .v-tile-name { display: block; margin-top: 6px; font-size: 12px; font-weight: 600; }
`;

  function injectCss() {
    if (document.getElementById('v-characters-css')) return;
    const style = document.createElement('style');
    style.id = 'v-characters-css';
    style.textContent = CSS;
    document.head.append(style);
  }

  // small DOM helper: props are assigned (style takes an object), null/undefined kids are skipped
  const h = (tag, props, ...kids) => {
    const n = document.createElement(tag);
    if (props) {
      for (const key of Object.keys(props)) {
        if (key === 'style') Object.assign(n.style, props.style);
        else n[key] = props[key];
      }
    }
    for (const k of kids) if (k !== null && k !== undefined) n.append(k);
    return n;
  };
  const panel = (title, ...kids) => h('section', { className: 'px-panel' }, h('h2', { textContent: title }), ...kids);
  const field = (label, ...kids) => h('div', { className: 'v-field' }, h('span', { className: 'v-k', textContent: label }), ...kids);
  const check = (input, text) => h('label', { className: 'v-check' }, input, text);

  // a row of chips; set(name) marks one as on
  function chipGroup(names, onPick) {
    const box = h('div', { className: 'px-row' });
    const buttons = names.map((n) => {
      const b = h('button', { type: 'button', className: 'px-chip', textContent: n });
      b.addEventListener('click', () => { set(n); onPick(n); });
      return b;
    });
    const set = (cur) => buttons.forEach((b) => b.classList.toggle('on', b.textContent === cur));
    box.append(...buttons);
    return { el: box, set };
  }

  const usable = (id) => SKINS.includes(id) && !!CharacterSkins[id];
  const resolveSkin = (id) => (usable(id) ? id : DEFAULT_SKIN);

  Dashboard.register({
    id: 'characters',
    title: 'Characters',
    order: 2,
    mount(ctx) {
      injectCss();
      ctx.root.classList.add('v-characters');

      const startTab = ctx.query && ctx.query.get ? ctx.query.get('tab') : null;
      let dead = false;
      let raf = 0;
      let skinId = resolveSkin(ctx.state && ctx.state.skin);
      let sub = startTab === 'gallery' ? 'gallery' : 'play';
      const cfg = { fps: FPS.def, scale: SCALE.def, bg: 'grid', speed: SPEED.def };
      let pc = null;                 // the playground character
      let live = [];                 // characters the frame loop advances
      let tiles = null;              // gallery tiles for the current skin: { c, art, crop, live }
      const accum = new WeakMap();   // fixed-step time left over, per character

      const skinLabel = () => Dashboard.skinName(skinId);

      // ------------------------------------------------------------ playground widgets
      const stage = h('div', { className: 'px-stage v-stage ' + cfg.bg });
      const skinLine = h('p', { className: 'px-muted v-skin' });
      const exprChips = chipGroup(Character.expressions, (n) => { pc.setExpression(n); refresh(); });
      const poseChips = chipGroup(Character.poses, (n) => { pc.setPose(n); refresh(); });
      const bgChips = chipGroup(BG_NAMES, (n) => { cfg.bg = n; stage.className = 'px-stage v-stage ' + n; });

      const talkingCb = h('input', { type: 'checkbox' });
      const blinkCb = h('input', { type: 'checkbox' });
      const idleCb = h('input', { type: 'checkbox' });
      const speedIn = h('input', { type: 'range', min: SPEED.min, max: SPEED.max, step: 1, value: cfg.speed });
      const speedVal = h('span', { className: 'v-val' });
      const lookCb = h('input', { type: 'checkbox' });
      const lookX = h('input', { type: 'range', min: -1, max: 1, step: 0.05, value: 0 });
      const lookY = h('input', { type: 'range', min: -1, max: 1, step: 0.05, value: 0 });

      const partSel = {
        eyes: h('select', { className: 'px-select' }),
        brows: h('select', { className: 'px-select' }),
        mouth: h('select', { className: 'px-select' }),
      };
      const colorRow = h('div', { className: 'px-row' });
      let colorInputs = {};

      const fpsIn = h('input', { type: 'range', min: FPS.min, max: FPS.max, step: 1, value: cfg.fps });
      const fpsVal = h('span', { className: 'v-val', textContent: cfg.fps + ' fps' });
      const scaleIn = h('input', { type: 'range', min: 1, max: SCALE.max, step: 1, value: cfg.scale });
      const scaleVal = h('span', { className: 'v-val' });
      const specBox = h('pre', { className: 'px-pre v-json' });

      // ------------------------------------------------------------ helpers
      const refresh = () => { if (pc && !dead) specBox.textContent = JSON.stringify(pc.getSpec(), null, 2); };

      function applySpeed() {
        speedVal.textContent = String(cfg.speed);
        if (pc) pc.speed = cfg.speed;
      }

      // whole-number scale: every art pixel is the same size on screen
      function applyScale() {
        const g = CharacterSkins[skinId].pixelGrid;
        const max = Math.max(1, Math.min(SCALE.max, Math.floor(STAGE_H / g.h)));
        cfg.scale = Math.max(1, Math.min(max, cfg.scale));
        scaleIn.max = max;
        scaleIn.value = cfg.scale;
        scaleVal.textContent = `${cfg.scale}x (${g.w * cfg.scale} x ${g.h * cfg.scale} px)`;
        if (pc) {
          pc.svg.style.width = g.w * cfg.scale + 'px';
          pc.svg.style.height = g.h * cfg.scale + 'px';
        }
      }

      // (Re)build the playground character. carry = { spec, flags } from the previous character, or null.
      function buildPlayground(carry) {
        stage.textContent = '';
        pc = new Character(stage, { skin: skinId });
        const spec = carry ? carry.spec : { expression: 'neutral', pose: 'idle', talking: false };
        if (carry) {
          // part overrides only carry over when the new skin has that variant
          const names = Character.partNames(skinId);
          PARTS.forEach((p) => { if (spec[p] && !names[p].includes(spec[p])) delete spec[p]; });
        }
        pc.apply(spec, { snap: true });
        if (carry) pc.setBlink(carry.flags.blink).setIdle(carry.flags.idle);
        pc.speed = cfg.speed;
        applyScale();
      }

      // colour pickers come from the skin's colour roles
      function buildColors() {
        const skin = CharacterSkins[skinId];
        colorRow.textContent = '';
        colorInputs = {};
        skin.colorControls.forEach(({ key, label }) => {
          const inp = h('input', { type: 'color', value: skin.colors[key] });
          inp.addEventListener('input', () => pc.setColors({ [key]: inp.value }));
          colorInputs[key] = inp;
          colorRow.append(h('span', { className: 'v-k', textContent: label }), inp);
        });
        const reset = h('button', { type: 'button', className: 'px-btn alt', textContent: 'Reset colours' });
        reset.addEventListener('click', () => { pc.setColors({ ...skin.colors }); syncColors(); });
        colorRow.append(reset);
      }
      const syncColors = () => Object.keys(colorInputs).forEach((k) => { colorInputs[k].value = pc.colors[k]; });

      function buildParts() {
        const names = Character.partNames(skinId);
        PARTS.forEach((p) => {
          const sel = partSel[p];
          sel.textContent = '';
          sel.append(h('option', { value: '', textContent: 'auto (from expression)' }));
          names[p].forEach((n) => sel.append(h('option', { value: n, textContent: n })));
        });
      }
      const syncParts = () => PARTS.forEach((p) => { partSel[p].value = pc.state.override[p] || ''; });

      function syncBehaviour() {
        const s = pc.state;
        talkingCb.checked = s.talking;
        blinkCb.checked = s.blink;
        idleCb.checked = s.idle;
        lookCb.checked = !!s.manualLook;
        if (s.manualLook) { lookX.value = s.manualLook.x; lookY.value = s.manualLook.y; }
        speedIn.value = cfg.speed;
        applySpeed();
        exprChips.set(s.expression);
        poseChips.set(s.pose);
        syncParts();
        syncColors();
        refresh();
      }

      // ------------------------------------------------------------ gallery
      const galleryHost = h('div');

      function layoutGallery() {
        if (!tiles) return;
        tiles.forEach(({ c, art, crop }) => {
          const [, , cw, ch] = crop.split(/\s+/).map(Number);
          const aw = art.clientWidth, ah = art.clientHeight;
          if (!aw || !ah) return;               // hidden: the ResizeObserver lays it out later
          const k = Math.max(1, Math.min(Math.floor(aw / cw), Math.floor(ah / ch)));
          c.svg.style.width = cw * k + 'px';
          c.svg.style.height = ch * k + 'px';
        });
      }

      function buildGallery() {
        galleryHost.textContent = '';
        tiles = [];
        const names = Character.partNames(skinId);
        const faceBox = { viewBox: FACE_BOX[skinId], idle: false, blink: false };
        const section = (title) => {
          const grid = h('div', { className: 'px-grid v-gallery' });
          galleryHost.append(h('h3', { className: 'px-sec', textContent: title }), grid);
          return grid;
        };
        const tile = (grid, label, artCls, opts, spec, isLive) => {
          const art = h('div', { className: 'v-art ' + artCls });
          grid.append(h('div', { className: 'px-tile' }, art, h('b', { className: 'v-tile-name', textContent: label })));
          const c = new Character(art, { skin: skinId, ...opts });
          c.apply(spec, { snap: true });
          tiles.push({ c, art, crop: opts.viewBox || CharacterSkins[skinId].viewBox, live: isLive });
        };

        const exprGrid = section('Expressions');
        Character.expressions.forEach((n) => tile(exprGrid, n, 'face', faceBox, { expression: n, pose: 'idle' }, false));
        const poseGrid = section('Poses (live)');
        Character.poses.forEach((n) => tile(poseGrid, n, 'body', { viewBox: BODY_BOX }, { expression: 'happy', pose: n }, true));
        const eyeGrid = section('Eyes');
        names.eyes.forEach((n) => tile(eyeGrid, n, 'face', faceBox, { eyes: n }, false));
        const browGrid = section('Brows');
        names.brows.forEach((n) => tile(browGrid, n, 'face', faceBox, { brows: n }, false));
        const mouthGrid = section('Mouths');
        names.mouth.forEach((n) => tile(mouthGrid, n, 'face', faceBox, { mouth: n }, false));
        layoutGallery();
      }

      // ------------------------------------------------------------ layout
      const playPane = h('div', { className: 'px-layout' },
        h('div', { className: 'v-col' }, skinLine, stage),
        h('div', { className: 'v-col' },
          panel('Expression', exprChips.el),
          panel('Pose', poseChips.el),
          panel('Behaviour',
            h('div', { className: 'v-field' }, check(talkingCb, 'Talking'), check(blinkCb, 'Blinking'), check(idleCb, 'Idle motion')),
            field('Glide speed', speedIn, speedVal),
            h('div', { className: 'v-field' }, check(lookCb, 'Manual look')),
            field('Look X', lookX),
            field('Look Y', lookY)),
          panel('Override single parts',
            field('Eyes', partSel.eyes),
            field('Brows', partSel.brows),
            field('Mouth', partSel.mouth)),
          panel('Look & stage', colorRow, field('Background', bgChips.el)),
          panel('Pixel stage',
            field('Frame rate', fpsIn, fpsVal),
            field('Scale', scaleIn, scaleVal),
            h('p', { className: 'px-muted', textContent: 'Scale is a whole number, so every art pixel is the same size on screen. Frame rate is the fixed step the rig advances at.' })),
          panel('Current state (scene JSON)', specBox)));
      const galleryPane = h('div', {}, galleryHost);
      const tabBtns = {
        play: h('button', { type: 'button', textContent: 'Playground' }),
        gallery: h('button', { type: 'button', textContent: 'Gallery' }),
      };
      ctx.root.append(h('div', { className: 'px-tabs' }, tabBtns.play, tabBtns.gallery), playPane, galleryPane);

      function showSub(name) {
        sub = name;
        playPane.style.display = name === 'play' ? '' : 'none';
        galleryPane.style.display = name === 'gallery' ? '' : 'none';
        tabBtns.play.classList.toggle('on', name === 'play');
        tabBtns.gallery.classList.toggle('on', name === 'gallery');
        if (name === 'gallery') {
          if (!tiles) buildGallery();
          live = tiles.filter((t) => t.live).map((t) => t.c);
        } else {
          live = pc ? [pc] : [];
          refresh();
        }
      }
      tabBtns.play.addEventListener('click', () => showSub('play'));
      tabBtns.gallery.addEventListener('click', () => showSub('gallery'));

      // ------------------------------------------------------------ wiring
      talkingCb.addEventListener('change', () => { pc.setTalking(talkingCb.checked); refresh(); });
      blinkCb.addEventListener('change', () => pc.setBlink(blinkCb.checked));
      idleCb.addEventListener('change', () => pc.setIdle(idleCb.checked));
      speedIn.addEventListener('input', () => { cfg.speed = +speedIn.value; applySpeed(); });
      const applyLook = () => {
        if (lookCb.checked) pc.setLook(+lookX.value, +lookY.value);
        else pc.setLook(null);
        refresh();
      };
      lookCb.addEventListener('change', applyLook);
      lookX.addEventListener('input', applyLook);
      lookY.addEventListener('input', applyLook);
      PARTS.forEach((p) => partSel[p].addEventListener('change', () => {
        pc.override(p, partSel[p].value || null);
        refresh();
      }));
      fpsIn.addEventListener('input', () => { cfg.fps = +fpsIn.value; fpsVal.textContent = cfg.fps + ' fps'; });
      scaleIn.addEventListener('input', () => { cfg.scale = +scaleIn.value; applyScale(); });

      // the shell skin picker: rebuild the playground and the gallery for the new skin
      const onSkin = (id) => {
        if (dead || id === skinId || !usable(id)) return;
        const carry = pc ? { spec: pc.getSpec(), flags: { blink: pc.state.blink, idle: pc.state.idle } } : null;
        skinId = id;
        buildPlayground(carry);
        buildColors();
        buildParts();
        syncBehaviour();
        skinLine.textContent = skinLabel();
        tiles = null;
        galleryHost.textContent = '';
        showSub(sub);
        ctx.setStatus(skinLabel());
      };

      // ------------------------------------------------------------ start
      buildPlayground(null);
      buildColors();
      buildParts();
      syncBehaviour();
      bgChips.set(cfg.bg);
      skinLine.textContent = skinLabel();
      const ro = new ResizeObserver(() => layoutGallery());
      ro.observe(galleryHost);
      ctx.on('skin', onSkin);
      showSub(sub);

      // fixed-step animation: the rig advances in steps of 1 / fps, never by wall-clock time
      let last = performance.now();
      const frame = (now) => {
        if (dead) return;
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
        last = now;
        const interval = 1 / cfg.fps;
        for (const c of live) {
          let rest = Math.min((accum.get(c) || 0) + dt, 0.25);
          while (rest >= interval) { rest -= interval; c.tick(interval); }
          accum.set(c, rest);
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      return () => {
        dead = true;
        cancelAnimationFrame(raf);
        ro.disconnect();
        live = [];
      };
    },
  });
})();
