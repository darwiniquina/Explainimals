/*
 * dashboard/views/scenes.js - the "Scenes" view: a scene player and a scene list builder for ONE
 * character (ctx.state.skin). Ported from the "Scene player" tab of test-runner.html.
 *
 * Pixel art only: every surviving skin is native pixel art (skin.pixelGrid), so it is shown at a
 * whole-number scale with no smoothing, and the rig is advanced in fixed steps (12 fps default).
 *
 * Two-way sync: a row edit rewrites the JSON textarea; valid JSON typed in the textarea (debounced)
 * rebuilds the rows. Playback reads the live list, so text edits apply to the next scene.
 */
(() => {
  'use strict';

  const SKINS = ['penguin', 'frog', 'dog', 'whisker', 'rabbit', 'bear'];
  const FPS_CHOICES = [6, 8, 12, 16, 24];
  const DEFAULT_FPS = 12;
  const DEFAULT_SECONDS = 3;
  const BACKGROUNDS = ['grid', 'light', 'dark', 'green'];
  const LIST_KEY = 'scenes';   // the list key when the JSON is an object: { "music": "calm", "scenes": [...] }
  const CUSTOM = '__custom';   // disabled option for a music/sfx value that is not a plain name
  const JSON_DEBOUNCE_MS = 400;
  const CSS_ID = 'v-scenes-css';

  const CSS = `
.v-scenes .v-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.v-scenes .v-stage { position: relative; overflow: hidden; height: 460px; }
.v-scenes .v-stage > svg { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); image-rendering: pixelated; }
.v-scenes .v-skin { font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.v-scenes .v-transport { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.v-scenes .v-inline { display: inline-flex; align-items: center; gap: 6px; }
.v-scenes .v-rows { display: flex; flex-direction: column; gap: 8px; }
.v-scenes .v-row { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 8px; padding: 8px; border: 2px solid var(--line); background: var(--panel); }
.v-scenes .v-row.now { border-color: var(--accent); box-shadow: inset 6px 0 0 var(--accent); }
.v-scenes .v-idx { border: 2px solid var(--line); text-align: center; font-weight: 700; height: 32px; line-height: 28px; }
.v-scenes .v-row.now .v-idx { background: var(--accent); border-color: var(--accent); color: #fff; }
.v-scenes .v-fields { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
.v-scenes .v-narr { flex: 1 1 100%; min-width: 0; }
.v-scenes .v-fields .px-select { max-width: 160px; }
.v-scenes .v-dur { width: 84px; }
.v-scenes .v-btns { display: inline-flex; gap: 4px; margin-left: auto; flex-wrap: wrap; }
.v-scenes .v-mini { padding: 4px 8px; font-size: 12px; }
.v-scenes .v-mini:disabled { opacity: .4; cursor: default; }
.v-scenes .v-bad { outline: 2px solid #c0262d; }
.v-scenes .v-empty { padding: 12px; border: 2px dashed var(--line); }
.v-scenes .v-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
.v-scenes .v-file { display: none; }
.v-scenes .v-json { min-height: 240px; font: 12px/1.5 ui-monospace, Consolas, monospace; }
.v-scenes .v-err { margin-top: 10px; color: #c0262d; font-weight: 600; white-space: pre-wrap; }
.v-scenes .v-err:empty { display: none; }
.v-scenes .v-add { margin-top: 10px; }
`;

  // Built-in starter scenes (restored by the Starter button).
  const SAMPLE = [
    { narration: "Hi! Today we'll see what happens when you open a website.", expression: 'happy', pose: 'wave', talking: true, duration: 3.2 },
    { narration: 'First, your browser asks a server for the page.', expression: 'curious', pose: 'point_right', talking: true, duration: 3.4 },
    { narration: 'Hmm, but how does it know where the server lives?', expression: 'thinking', pose: 'think', talking: true, duration: 3.4 },
    { narration: 'Great question: DNS looks up the address for us.', expression: 'joy', pose: 'present', talking: true, duration: 3.4 },
    { narration: 'Wait, what if the server is down?', expression: 'surprised', pose: 'shrug', talking: true, duration: 3 },
    { narration: "Then you'd see an error. Don't worry, it usually comes back!", expression: 'sad', pose: 'idle', talking: true, duration: 3.2 },
    { narration: 'And that is the whole trip!', expression: 'joy', pose: 'cheer', talking: true, duration: 2.6 },
    { expression: 'happy', pose: 'idle', talking: false, duration: 1.2 }
  ];

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const orEmpty = (v) => (v == null ? '' : String(v));

  // Only the surviving characters; anything else falls back to the first one that is loaded.
  function pickSkin(id) {
    const loaded = (s) => !!(window.CharacterSkins && window.CharacterSkins[s]);
    if (SKINS.includes(id) && loaded(id)) return id;
    return SKINS.find(loaded) || 'penguin';
  }

  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    const style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = CSS;
    document.head.append(style);
  }

  // Expression / pose picker. '' means "keep the previous value": the rig ignores absent fields.
  function picker(names, current, keepLabel, title) {
    const D = window.Dashboard;
    const sel = D.el('select', { className: 'px-select', title });
    sel.append(D.el('option', { value: '', textContent: keepLabel }));
    const options = names.slice();
    if (current != null && current !== '' && !options.includes(current)) options.push(current);
    options.forEach((n) => {
      const label = names.includes(n) ? String(n) : `${n} (unknown)`;
      sel.append(D.el('option', { value: String(n), textContent: label }));
    });
    sel.value = orEmpty(current);
    return sel;
  }

  // Select for a named value (music or sfx): "None" first, then the catalog list. A name that is not in
  // the catalog is kept as "(unknown)"; a non-string value (array, object) shows as a disabled "custom"
  // option and the data is left untouched.
  function trackSelect(sel, list, current, noneLabel) {
    const D = window.Dashboard;
    sel.textContent = '';
    sel.append(D.el('option', { value: '', textContent: noneLabel }));
    const named = typeof current === 'string' && current !== '';
    const custom = current != null && current !== '' && !named;
    list.forEach((t) => sel.append(D.el('option', { value: String(t.id), textContent: String(t.label || t.id) })));
    if (named && !list.some((t) => t.id === current)) sel.append(D.el('option', { value: current, textContent: `${current} (unknown)` }));
    if (custom) sel.append(D.el('option', { value: CUSTOM, textContent: 'custom', disabled: true }));
    sel.value = custom ? CUSTOM : orEmpty(current);
    return sel;
  }

  function mountScenes(ctx) {
    const D = window.Dashboard;
    const E = (tag, props, ...kids) => D.el(tag, props || {}, ...kids);
    injectCss();
    ctx.root.classList.add('v-scenes');

    let disposed = false;
    let skinId = pickSkin(ctx.state && ctx.state.skin);
    let char = null;
    let validator = null;
    let model = clone(SAMPLE);   // the scene list: the last valid parse of the JSON text
    let wrap = null;             // the parsed object when the JSON is { "scenes": [...], ... }; null for a bare array
    let appliedText = '';        // the JSON text that `model` was parsed from / written as
    let jsonBroken = false;      // the textarea currently holds JSON that does not parse
    let rowEls = [];
    let playing = false;
    let playIdx = -1;
    let playTimer = 0;
    let jsonTimer = 0;
    let fps = DEFAULT_FPS;
    let rafId = 0;
    let acc = 0;
    let last = performance.now();
    let reader = null;
    const timers = new Set();
    const blobUrls = new Set();

    // every timeout goes through here so cleanup can cancel all of them
    const later = (fn, ms) => {
      const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
      timers.add(t);
      return t;
    };
    const cancel = (t) => { if (t) { clearTimeout(t); timers.delete(t); } };
    const clearPlayTimer = () => { cancel(playTimer); playTimer = 0; };
    const clearJsonTimer = () => { cancel(jsonTimer); jsonTimer = 0; };

    // ------------------------------------------------------------ DOM
    const statusEl = E('span', { className: 'px-muted' });
    const setStatus = (text) => { statusEl.textContent = text; ctx.setStatus(text); };
    const errBox = E('div', { className: 'px-msg err v-err' });
    const setError = (msg) => { errBox.textContent = msg || ''; };

    const skinLabel = E('div', { className: 'v-skin' });
    const stage = E('div', { className: 'px-stage grid v-stage' });
    const caption = E('div', { className: 'px-caption', textContent: 'Press Play.' });

    const playBtn = E('button', { className: 'px-btn', type: 'button', textContent: 'Play' });
    const stopBtn = E('button', { className: 'px-btn alt', type: 'button', textContent: 'Stop' });
    const loopCb = E('input', { type: 'checkbox' });
    loopCb.checked = true;
    const fpsSel = E('select', { className: 'px-select', title: 'Animation frame rate (fixed steps)' },
      ...FPS_CHOICES.map((f) => E('option', { value: String(f), textContent: `${f} fps` })));
    fpsSel.value = String(DEFAULT_FPS);
    const bgSel = E('select', { className: 'px-select', title: 'Stage background' },
      ...BACKGROUNDS.map((b) => E('option', { value: b, textContent: b })));
    // sound: only when audio.js is loaded and the browser has AudioContext; otherwise these controls are not built
    const audio = window.Pres && window.Pres.audio && window.Pres.audio.supported ? window.Pres.audio : null;
    const cat = (audio && typeof audio.catalog === 'function' && audio.catalog()) || {};
    const sfxList = Array.isArray(cat.sfx) ? cat.sfx : [];
    const musicList = Array.isArray(cat.music) ? cat.music : [];
    const musicSel = E('select', { className: 'px-select', title: 'Background music for the whole list (top-level "music")' });

    const transport = E('div', { className: 'v-transport' },
      playBtn, stopBtn,
      E('label', { className: 'v-inline' }, loopCb, E('span', { textContent: 'Loop' })),
      E('label', { className: 'v-inline' }, E('span', { textContent: 'Frame rate' }), fpsSel),
      E('label', { className: 'v-inline' }, E('span', { textContent: 'Background' }), bgSel),
      ...(audio ? [E('label', { className: 'v-inline' }, E('span', { textContent: 'Music' }), musicSel)] : []));

    const left = E('div', { className: 'v-col' }, skinLabel, stage, caption, transport,
      E('div', { className: 'v-transport' }, statusEl));

    // scene list builder (above the JSON editor)
    const rowsBox = E('div', { className: 'v-rows' });
    const addBtn = E('button', { className: 'px-btn', type: 'button', textContent: 'Add scene' });
    const builder = E('div', { className: 'px-panel' },
      E('h2', { textContent: 'Scene list builder' }),
      E('p', { className: 'px-muted', textContent: 'One row per scene. Edits rewrite the JSON below; valid JSON typed below rebuilds these rows.' }),
      rowsBox,
      E('div', { className: 'v-add' }, addBtn));

    // JSON editor (below the builder)
    const ta = E('textarea', { className: 'px-textarea v-json' });
    ta.spellcheck = false;
    const starterBtn = E('button', { className: 'px-btn alt', type: 'button', textContent: 'Starter', title: 'Restore the built-in starter scenes' });
    const loadBtn = E('button', { className: 'px-btn alt', type: 'button', textContent: 'Load .json file' });
    const dlBtn = E('button', { className: 'px-btn alt', type: 'button', textContent: 'Download .json' });
    const fileInp = E('input', { type: 'file', accept: '.json,application/json', className: 'v-file' });
    const jsonPanel = E('div', { className: 'px-panel' },
      E('h2', { textContent: 'Scene JSON (what the AI will write)' }),
      ta,
      E('div', { className: 'v-foot' }, starterBtn, loadBtn, dlBtn, fileInp),
      errBox,
      E('p', { className: 'px-muted', textContent: 'Other fields (look, eyes, brows, mouth) are kept in the JSON and not shown as row controls.' }));

    ctx.root.append(E('div', { className: 'px-layout' }, left, E('div', { className: 'v-col' }, builder, jsonPanel)));

    // ------------------------------------------------------- character
    const ro = new ResizeObserver(() => layoutChar());
    ro.observe(stage);

    // whole-number scale so every pixel is the same size on screen
    function layoutChar() {
      if (!char) return;
      const vb = (char.svg.getAttribute('viewBox') || '0 0 61 76').split(/\s+/).map(Number);
      const g = char.skin.pixelGrid || { w: vb[2], h: vb[3] };
      const k = Math.max(1, Math.floor(Math.min(stage.clientWidth / g.w, stage.clientHeight / g.h)));
      char.svg.style.width = g.w * k + 'px';
      char.svg.style.height = g.h * k + 'px';
    }

    function buildChar() {
      stage.textContent = '';
      char = new window.Character(stage, { skin: skinId });
      layoutChar();
      skinLabel.textContent = D.skinName(skinId);
    }

    function ensureValidator() {
      if (!validator) validator = new window.Character(document.createElement('div'), { skin: skinId });
      return validator;
    }

    // ------------------------------------------------------ validation
    // Returns an error message, or '' when the list is fine. strict = also require a non-empty list.
    function validateList(list, strict) {
      if (!Array.isArray(list)) return 'Scene list must be a JSON array.';
      if (strict && !list.length) return 'Scene list must be a non-empty array.';
      const v = ensureValidator();
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const n = `Scene ${i + 1}`;
        if (!isObj(s)) return `${n}: must be an object in braces.`;
        if (s.narration !== undefined && typeof s.narration !== 'string') return `${n}: narration must be text.`;
        if (s.duration !== undefined && !(typeof s.duration === 'number' && s.duration > 0)) return `${n}: duration must be a positive number of seconds.`;
        if (s.look !== undefined && s.look !== null && !(isObj(s.look) && typeof s.look.x === 'number')) return `${n}: look must be {"x": -1..1, "y": -1..1} or null.`;
        try { v.apply(s); } catch (e) { return `${n}: ${e.message}`; }
      }
      return '';
    }

    function revalidate() {
      if (!jsonBroken) setError(validateList(model, false));
    }

    // --------------------------------------------------- JSON <-> model
    // the document: the bare list, or the wrapper object with the current list under LIST_KEY
    // (every other top-level key of the wrapper is kept as it was loaded)
    function docValue() {
      if (!wrap) return model;
      wrap[LIST_KEY] = model;
      return wrap;
    }

    function writeJson() {
      appliedText = JSON.stringify(docValue(), null, 2);
      ta.value = appliedText;
      jsonBroken = false;
    }

    // Parse the textarea into the model and rebuild the rows. Returns false if it cannot be used.
    function commitText() {
      const text = ta.value;
      if (text === appliedText) return true;
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) {
        jsonBroken = true;
        setError(`JSON is not valid yet, so the rows show the last valid list.\n${e.message}`);
        return false;
      }
      const nextWrap = isObj(parsed) && Array.isArray(parsed[LIST_KEY]) ? parsed : null;
      const list = nextWrap ? parsed[LIST_KEY] : parsed;
      if (!Array.isArray(list)) {
        jsonBroken = true;
        setError('Scene list must be a JSON array, e.g. [ { "narration": "...", "expression": "happy" } ], or an object with a "scenes" array.');
        return false;
      }
      if (!list.every(isObj)) {
        jsonBroken = true;
        setError('Every scene must be an object in braces { ... }.');
        return false;
      }
      jsonBroken = false;
      wrap = nextWrap;
      model = list;
      appliedText = text;
      renderRows();
      setError(validateList(model, false));
      return true;
    }

    // a structural change (add, copy, move, delete): playback indices would no longer match, so stop
    function edit(mutate) {
      if (playing) stopPlayback('list changed');
      mutate();
      writeJson();
      renderRows();
      revalidate();
    }

    // ------------------------------------------------------------ rows
    function renderRows() {
      rowsBox.textContent = '';
      rowEls = [];
      if (!model.length) {
        rowsBox.append(E('div', { className: 'v-empty px-muted', textContent: 'No scenes yet. Add one, or load a JSON file.' }));
      }
      model.forEach((_, i) => {
        const row = makeRow(i);
        rowEls.push(row);
        rowsBox.append(row);
      });
      markPlaying(playIdx);
      syncMusicSel();
    }

    function syncMusicSel() {
      if (audio) trackSelect(musicSel, musicList, wrap ? wrap.music : undefined, 'None');
    }

    function makeRow(i) {
      const s = model[i];
      const C = window.Character;

      const narr = E('input', {
        type: 'text', className: 'px-input v-narr',
        placeholder: 'Narration (what the character says)',
        value: orEmpty(s.narration),
      });
      narr.addEventListener('input', () => {
        if (narr.value) model[i].narration = narr.value;
        else delete model[i].narration;
        writeJson();
      });

      const expr = picker(C.expressions, s.expression, '(keep previous)', 'Expression');
      expr.addEventListener('change', () => {
        if (expr.value) model[i].expression = expr.value;
        else delete model[i].expression;
        writeJson();
        revalidate();
      });

      const pose = picker(C.poses, s.pose, '(keep previous)', 'Pose');
      pose.addEventListener('change', () => {
        if (pose.value) model[i].pose = pose.value;
        else delete model[i].pose;
        writeJson();
        revalidate();
      });

      const dur = E('input', {
        type: 'number', min: '0', step: '0.1', className: 'px-input v-dur',
        placeholder: String(DEFAULT_SECONDS), title: 'Seconds on screen (default 3)',
        value: s.duration == null ? '' : String(s.duration),
      });
      dur.addEventListener('input', () => {
        const txt = dur.value.trim();
        if (txt === '') {
          delete model[i].duration;
          dur.classList.remove('v-bad');
        } else {
          const n = Number(txt);
          if (!(n > 0) || !isFinite(n)) { dur.classList.add('v-bad'); return; }
          model[i].duration = n;
          dur.classList.remove('v-bad');
        }
        writeJson();
      });

      const talk = E('input', { type: 'checkbox' });
      talk.checked = s.talking === true;
      talk.addEventListener('change', () => {
        model[i].talking = talk.checked;
        writeJson();
      });

      const sfxSel = E('select', { className: 'px-select', title: 'Sound effect for this scene (played when the scene starts)' });
      trackSelect(sfxSel, sfxList, s.sfx, 'None');
      sfxSel.addEventListener('change', () => {
        if (sfxSel.value === CUSTOM) return;
        if (sfxSel.value) model[i].sfx = sfxSel.value;
        else delete model[i].sfx;
        writeJson();
      });

      const up = E('button', { className: 'px-btn alt v-mini', type: 'button', textContent: 'Up', title: 'Move up' });
      up.disabled = i === 0;
      const down = E('button', { className: 'px-btn alt v-mini', type: 'button', textContent: 'Down', title: 'Move down' });
      down.disabled = i === model.length - 1;
      const dup = E('button', { className: 'px-btn alt v-mini', type: 'button', textContent: 'Duplicate', title: 'Insert a copy below' });
      const del = E('button', { className: 'px-btn alt v-mini', type: 'button', textContent: 'Delete', title: 'Remove this scene' });
      up.addEventListener('click', () => moveScene(i, -1));
      down.addEventListener('click', () => moveScene(i, 1));
      dup.addEventListener('click', () => edit(() => model.splice(i + 1, 0, clone(model[i]))));
      del.addEventListener('click', () => edit(() => model.splice(i, 1)));

      const fields = E('div', { className: 'v-fields' },
        narr,
        expr,
        pose,
        E('label', { className: 'v-inline' }, dur, E('span', { className: 'px-muted', textContent: 'sec' })),
        E('label', { className: 'v-inline' }, talk, E('span', { textContent: 'talking' })),
        ...(audio ? [E('label', { className: 'v-inline' }, E('span', { textContent: 'sound' }), sfxSel)] : []),
        E('span', { className: 'v-btns' }, up, down, dup, del));

      return E('div', { className: 'v-row' }, E('div', { className: 'v-idx', textContent: String(i + 1) }), fields);
    }

    function moveScene(i, d) {
      const j = i + d;
      if (j < 0 || j >= model.length) return;
      edit(() => { [model[i], model[j]] = [model[j], model[i]]; });
    }

    // highlight the scene currently playing (toggles only; no scrolling)
    function markPlaying(i) {
      rowEls.forEach((r, j) => r.classList.toggle('now', j === i));
    }

    // --------------------------------------------------------- playback
    function syncPlayBtn() { playBtn.classList.toggle('on', playing); }

    function stopPlayback(reason) {
      clearPlayTimer();
      playing = false;
      playIdx = -1;
      syncPlayBtn();
      markPlaying(-1);
      if (audio) audio.stopMusic();
      setStatus(reason ? `Stopped (${reason})` : 'Stopped');
    }

    function finish(msg) {
      clearPlayTimer();
      playing = false;
      playIdx = -1;
      syncPlayBtn();
      markPlaying(-1);
      if (audio) audio.stopMusic();
      setStatus(msg);
    }

    function fail(msg) {
      setError(msg);
      finish('Stopped on error');
    }

    function play() {
      clearPlayTimer();
      if (!commitText()) { setStatus('Not played: fix the JSON first'); return; }
      const err = validateList(model, true);
      setError(err);
      if (err) { setStatus('Not played: see the error below'); return; }
      playing = true;
      playIdx = 0;
      syncPlayBtn();
      if (audio) { audio.unlock(); audio.music(wrap && typeof wrap.music === 'string' ? wrap.music : null); }
      step();
    }

    // Shows scene playIdx, then schedules the next one. Reads the live list each time.
    function step() {
      playTimer = 0;
      if (!playing) return;
      if (!model.length) { finish('No scenes'); return; }
      if (playIdx >= model.length) {
        if (!loopCb.checked) { finish('Finished'); return; }
        playIdx = 0;
      }
      const s = model[playIdx];
      try {
        char.apply(s);
      } catch (e) {
        fail(`Scene ${playIdx + 1}: ${e.message}`);
        return;
      }
      if (audio && typeof s.sfx === 'string') audio.sfx(s.sfx);
      caption.textContent = orEmpty(s.narration);
      markPlaying(playIdx);
      const row = rowEls[playIdx];
      if (row) row.scrollIntoView({ block: 'nearest' });
      setStatus(`Playing scene ${playIdx + 1} / ${model.length}`);
      const secs = Number(s.duration);
      playTimer = later(() => { playTimer = 0; playIdx += 1; step(); }, (secs > 0 ? secs : DEFAULT_SECONDS) * 1000);
    }

    // ------------------------------------------------------ animation
    // fixed-step rig advance (12 fps default); runs only while this view is mounted
    function frame(now) {
      const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
      last = now;
      acc = Math.min(acc + dt, 0.25);
      const interval = 1 / fps;
      while (acc >= interval) {
        acc -= interval;
        if (char) char.tick(interval);
      }
      rafId = requestAnimationFrame(frame);
    }

    // ------------------------------------------------------ controls
    playBtn.addEventListener('click', play);
    stopBtn.addEventListener('click', () => stopPlayback());
    fpsSel.addEventListener('change', () => { fps = Number(fpsSel.value) || DEFAULT_FPS; });
    bgSel.addEventListener('change', () => { stage.className = `px-stage v-stage ${bgSel.value}`; });
    musicSel.addEventListener('change', () => {
      if (musicSel.value === CUSTOM) return;
      if (musicSel.value) {
        if (!wrap) wrap = {};
        wrap.music = musicSel.value;
      } else if (wrap) {
        delete wrap.music;
        if (Object.keys(wrap).every((k) => k === LIST_KEY)) wrap = null;   // nothing else: back to a bare array
      }
      writeJson();
    });
    addBtn.addEventListener('click', () => {
      edit(() => model.push({ narration: '', expression: 'neutral', pose: 'idle', talking: false, duration: DEFAULT_SECONDS }));
      const fresh = rowsBox.querySelector('.v-row:last-child .v-narr');
      if (fresh) fresh.focus();
    });

    ta.addEventListener('input', () => {
      clearJsonTimer();
      jsonTimer = later(() => { jsonTimer = 0; commitText(); }, JSON_DEBOUNCE_MS);
    });

    starterBtn.addEventListener('click', () => {
      const starter = JSON.stringify(SAMPLE, null, 2);
      if (ta.value.trim() !== starter.trim() && !window.confirm('Replace the scene list with the starter scenes?')) return;
      clearJsonTimer();
      if (playing) stopPlayback('starter restored');
      model = clone(SAMPLE);
      writeJson();
      renderRows();
      revalidate();
    });

    loadBtn.addEventListener('click', () => fileInp.click());
    fileInp.addEventListener('change', () => {
      const f = fileInp.files && fileInp.files[0];
      fileInp.value = '';
      if (!f) return;
      if (reader && reader.readyState === 1) reader.abort();
      const rd = new FileReader();
      reader = rd;
      rd.onload = () => {
        if (disposed || reader !== rd) return;
        reader = null;
        clearJsonTimer();
        ta.value = String(rd.result);
        if (playing) stopPlayback('new list loaded');
        commitText();
      };
      rd.onerror = () => {
        if (reader === rd) reader = null;
        setError(`Could not read ${f.name}.`);
      };
      rd.readAsText(f);
    });

    dlBtn.addEventListener('click', () => {
      clearJsonTimer();
      if (!commitText()) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(docValue(), null, 2) + '\n'], { type: 'application/json' }));
      blobUrls.add(url);
      const a = E('a', { href: url, download: 'scenes.json' });
      ctx.root.append(a);
      a.click();
      a.remove();
      later(() => { URL.revokeObjectURL(url); blobUrls.delete(url); }, 4000);
    });

    // ------------------------------------------------- shell subscriptions
    const offSkin = ctx.on('skin', (id) => {
      if (disposed) return;
      const next = pickSkin(id);
      if (next === skinId) return;
      skinId = next;
      validator = null;
      buildChar();
      if (playing && model[playIdx]) {
        try { char.apply(model[playIdx], { snap: true }); } catch (e) { fail(`Scene ${playIdx + 1}: ${e.message}`); }
      }
      revalidate();
    });

    // ------------------------------------------------------------ start
    writeJson();
    renderRows();
    buildChar();
    setError('');
    setStatus('Ready');
    rafId = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      clearJsonTimer();
      clearPlayTimer();
      playing = false;
      if (audio) audio.stopMusic();
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      cancelAnimationFrame(rafId);
      ro.disconnect();
      if (reader && reader.readyState === 1) reader.abort();
      reader = null;
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
      blobUrls.clear();
      if (typeof offSkin === 'function') offSkin();
      ctx.setStatus('');
    };
  }

  window.Dashboard.register({
    id: 'scenes',
    title: 'Scenes',
    order: 3,
    mount(ctx) { return mountScenes(ctx); },
  });
})();
