/*
 * engine.js - plays a pixel-art presentation scenario on the 240 x 135 stage.
 *
 *   const player = new Pres.Player(containerEl);
 *   const report = Pres.validate(scenario);          // { errors: [], warnings: [] }
 *   player.load(scenario);  player.play();
 *
 * The engine only ever advances in fixed steps (1 / fps seconds), and every frame is a pure function
 * of (scenario, slide, local time), so the same scenario always produces the same frames. That makes
 * it safe to drive from a video renderer later: call player.step(1 / fps) per frame.
 *
 * Scenario format: see presentation/SCENARIO.md.
 */
(function (global) {
  'use strict';

  const Pres = global.Pres;
  const G = Pres.GRID;
  const CHAR = { w: 61, h: 76, top: 70 };                       // feet are `top` px below the box top
  const AT = { left: 4, center: 90, right: 175 };               // character box x for the named positions
  const ENTERS = ['none', 'pop', 'drop', 'slide-left', 'slide-right', 'dissolve'];
  const TRANSITIONS = ['cut', 'dissolve', 'wipe'];
  const RIGHT = { x0: 76, x1: 236 };                            // the area right of a left-standing character
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];   // 4x4 ordered dither

  // the six surviving characters; anything else is rejected even if its skin file is still loaded
  const SKINS = ['penguin', 'frog', 'dog', 'whisker', 'rabbit', 'bear'];
  const DEFAULT_SKIN = 'penguin';
  const pixelSkins = () => SKINS.filter((id) => global.CharacterSkins && global.CharacterSkins[id] && global.CharacterSkins[id].pixelGrid);

  // -------------------------------------------------------------- catalog
  const baseCatalog = Pres.catalog;
  Pres.catalog = () => Object.assign(baseCatalog(), {
    skins: pixelSkins(),
    expressions: global.Character ? global.Character.expressions : [],
    poses: global.Character ? global.Character.poses : [],
    positions: Object.keys(AT),
    enters: ENTERS,
    transitions: TRANSITIONS,
    sfx: Pres.audio ? Pres.audio.catalog().sfx : [],
    music: Pres.audio ? Pres.audio.catalog().music : [],
  });

  // -------------------------------------------------------------- validation
  const one = (list) => list.join(', ');

  // -------------------------------------------------------------- dialogue blocks (AUDIO.md: Dialogue blocks)
  // A slide with a `dialogue` key is a block. Before validation and playback it becomes one ordinary slide
  // per line; `_from` on each new slide names the source line for messages.
  const hasDialogue = (s) => !!s && typeof s === 'object' && s.dialogue !== undefined;
  const plainObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

  // structure check of the block on raw slide i (before any expansion); returns { errors, warnings }
  function dialogueCheck(s, i) {
    const cat = Pres.catalog(), errors = [], warnings = [];
    const p = `slides[${i}]`, dp = p + '.dialogue';
    const err = (path, msg) => errors.push(`${path}: ${msg}`);
    if (s.characters !== undefined || s.character !== undefined || s.say !== undefined) err(p, 'a dialogue slide cannot also have characters, character or say');
    if (s.props !== undefined && !Array.isArray(s.props)) err(p + '.props', 'must be an array');
    if (!plainObj(s.dialogue)) { err(dp, 'must be an object with "cast" and "lines"'); return { errors, warnings }; }
    const cast = s.dialogue.cast;
    let keys = null;
    if (!plainObj(cast)) err(dp + '.cast', 'must be an object like {"left": "penguin", "right": "rabbit"}');
    else {
      keys = Object.keys(cast);
      if (keys.length < 1 || keys.length > 2) err(dp + '.cast', `needs 1 or 2 characters, got ${keys.length}`);
      keys.forEach((pos) => {
        if (!cat.positions.includes(pos)) err(`${dp}.cast.${pos}`, `unknown position "${pos}". Valid: ${one(cat.positions)}`);
        if (!cat.skins.includes(cast[pos])) err(`${dp}.cast.${pos}`, `unknown skin "${cast[pos]}". Valid: ${one(cat.skins)}`);
      });
    }
    const lines = s.dialogue.lines;
    if (!Array.isArray(lines) || !lines.length) { err(dp + '.lines', 'must be a non-empty array'); return { errors, warnings }; }
    const speakers = new Set();
    lines.forEach((ln, j) => {
      const q = `${dp}.lines[${j}]`;
      if (!plainObj(ln)) { err(q, 'must be an object with "who" and "say"'); return; }
      if (keys && !keys.includes(ln.who)) err(q + '.who', `"${ln.who}" is not a cast position. Cast: ${keys.join(', ') || 'none'}`);
      speakers.add(ln.who);
      if (typeof ln.say !== 'string' || !ln.say.trim()) err(q + '.say', 'must be a non-empty string');
      if (ln.expression !== undefined && !cat.expressions.includes(ln.expression)) err(q + '.expression', `unknown expression "${ln.expression}". Valid: ${one(cat.expressions)}`);
      if (ln.react !== undefined && !cat.expressions.includes(ln.react)) err(q + '.react', `unknown expression "${ln.react}". Valid: ${one(cat.expressions)}`);
      if (ln.pose !== undefined && !cat.poses.includes(ln.pose)) err(q + '.pose', `unknown pose "${ln.pose}". Valid: ${one(cat.poses)}`);
      if (ln.props !== undefined && !Array.isArray(ln.props)) err(q + '.props', 'must be an array');
    });
    if (!errors.length && keys && keys.length === 2) keys.forEach((pos) => { if (!speakers.has(pos)) warnings.push(`${dp}.cast.${pos}: this character never speaks in the block`); });
    return { errors, warnings };
  }

  // the expanded slides of a valid block: each line is a normal slide with the cast as its characters
  function expandBlock(s, i) {
    const cast = s.dialogue.cast, keys = Object.keys(cast);
    return s.dialogue.lines.map((ln, j) => {
      const head = j === 0, slide = {};
      if (head && s.background !== undefined) slide.background = s.background;   // later slides inherit it
      if (ln.music !== undefined) slide.music = ln.music;
      else if (head && s.music !== undefined) slide.music = s.music;
      const tr = ln.transition !== undefined ? ln.transition : head ? s.transition : 'cut';
      if (tr !== undefined) slide.transition = tr;
      const props = ln.props !== undefined ? ln.props : head ? s.props : undefined;   // block props: first slide only
      if (props !== undefined) slide.props = props.slice();
      ['duration', 'sfx', 'panel', 'title'].forEach((k) => { if (ln[k] !== undefined) slide[k] = ln[k]; });
      slide.characters = keys.map((pos) => {
        if (pos === ln.who) return { at: pos, skin: cast[pos], say: ln.say, expression: ln.expression || 'happy', pose: ln.pose || 'idle', look: null };
        return { at: pos, skin: cast[pos], expression: ln.react || 'curious', pose: 'idle', look: null };
      });
      slide._from = `slides[${i}].dialogue.lines[${j}]`;
      return slide;
    });
  }

  // a new scenario with every valid block expanded (the input is not mutated); the same object when no slide has dialogue
  function expandScenario(sc) {
    if (!plainObj(sc) || !Array.isArray(sc.slides) || !sc.slides.some(hasDialogue)) return sc;
    const slides = [];
    sc.slides.forEach((s, i) => {
      // an invalid block stays as it is; validate reports it and skips it as a slide
      if (hasDialogue(s) && !dialogueCheck(s, i).errors.length) slides.push(...expandBlock(s, i));
      else slides.push(s);
    });
    return Object.assign({}, sc, { slides });
  }
  Pres.expandDialogue = (sc) => expandScenario(sc);
  Pres.validate = (sc) => {
    const errors = [], warnings = [];
    const cat = Pres.catalog();
    const bgIds = cat.backgrounds.map((b) => b.id), propIds = cat.props.map((p) => p.id);
    const bad = (path, msg) => errors.push(`${path}: ${msg}`);
    const check = (path, val, list, what) => { if (!list.includes(val)) bad(path, `unknown ${what} "${val}". Valid: ${one(list)}`); };

    if (!sc || typeof sc !== 'object') return { errors: ['scenario must be an object'], warnings };
    if (!Array.isArray(sc.slides) || !sc.slides.length) return { errors: ['slides must be a non-empty array'], warnings };
    // dialogue blocks: check each block's structure before expanding; the expanded slides are what gets validated
    sc.slides.forEach((s, i) => { if (hasDialogue(s)) { const r = dialogueCheck(s, i); errors.push(...r.errors); warnings.push(...r.warnings); } });
    const slides = expandScenario(sc).slides;
    const d = sc.defaults || {};
    if (d.background) check('defaults.background', d.background, bgIds, 'background');
    if (d.skin) check('defaults.skin', d.skin, cat.skins, 'skin');
    const au = !!Pres.audio;                                          // audio checks only when audio.js is loaded
    const sfxIds = au ? cat.sfx.map((x) => x.id) : [], musicIds = au ? cat.music.map((x) => x.id) : [];
    if (au && sc.music !== undefined) check('music', sc.music, musicIds, 'music track');
    ['typewriter', 'voice'].forEach((k) => { if (sc[k] !== undefined && typeof sc[k] !== 'boolean') bad(k, 'must be true or false'); });

    slides.forEach((s, i) => {
      if (s.dialogue !== undefined) return;                             // invalid block: already reported above
      const p = s._from || `slides[${i}]`;
      if (s.background) check(p + '.background', s.background, bgIds, 'background');
      if (s.duration !== undefined && !(s.duration >= 1 && s.duration <= 30)) bad(p + '.duration', 'must be a number between 1 and 30 seconds');
      if (s.transition) check(p + '.transition', s.transition, TRANSITIONS, 'transition');
      const chars = s.characters || (s.character ? [s.character] : []);
      if (chars.length > 2) bad(p + '.characters', 'at most 2 characters per slide');
      if (chars.filter((c) => c.say).length > 1) bad(p + '.characters', 'only one character can speak per slide (put each line on its own slide)');
      const used = new Set();
      chars.forEach((c, j) => {
        const q = `${p}.characters[${j}]`;
        if (c.skin) check(q + '.skin', c.skin, cat.skins, 'skin');
        if (c.at !== undefined) check(q + '.at', c.at, cat.positions, 'position');
        if (c.expression) check(q + '.expression', c.expression, cat.expressions, 'expression');
        if (c.pose) check(q + '.pose', c.pose, cat.poses, 'pose');
        if (c.look && !(typeof c.look.x === 'number')) bad(q + '.look', 'must look like {"x": -1..1, "y": -1..1}');
        const slot = c.at || 'left';
        if (used.has(slot)) bad(q + '.at', `two characters at "${slot}"`);
        used.add(slot);
        if (c.say && c.say.length > 160) warnings.push(`${q}.say: ${c.say.length} characters is long; aim for under 110`);
      });
      (s.props || []).forEach((pr, j) => {
        const q = `${p}.props[${j}]`;
        const id = typeof pr === 'string' ? pr : pr && pr.id;
        check(q + (typeof pr === 'string' ? '' : '.id'), id, propIds, 'prop');
        if (pr && typeof pr === 'object') {
          if (pr.enter) check(q + '.enter', pr.enter, ENTERS, 'enter animation');
          if (pr.at && !(Array.isArray(pr.at) && pr.at.length === 2)) bad(q + '.at', 'must be [x, y] in stage pixels');
          if (pr.flip !== undefined && typeof pr.flip !== 'boolean') bad(q + '.flip', 'must be true or false');
        }
      });
      if ((s.props || []).length > 6) warnings.push(`${p}.props: more than 6 props will not fit in one row`);
      if (s.panel) {
        if (!Array.isArray(s.panel.bullets) || !s.panel.bullets.length) bad(p + '.panel.bullets', 'needs a non-empty array of short strings');
        else if (s.panel.bullets.length > 4) warnings.push(`${p}.panel.bullets: more than 4 bullets may overflow`);
        (s.panel.bullets || []).forEach((b, j) => { if (String(b).length > 22) warnings.push(`${p}.panel.bullets[${j}]: ${String(b).length} characters will wrap; aim for 22 or fewer`); });
      }
      if (s.panel && s.title) warnings.push(`${p}: a title card and a panel on the same slide will overlap`);
      if (s.title && chars.some((c) => c.say)) warnings.push(`${p}: a speech bubble on a title slide goes below the title card and may not fit; keep the greeting for the next slide`);
      if (s.title && s.title.w !== undefined && !(s.title.w >= 60 && s.title.w <= 230)) bad(p + '.title.w', 'must be between 60 and 230');
      if (s.panel && chars.some((c) => c.say)) warnings.push(`${p}: a panel and a speech bubble share the right side; keep the bubble text short`);
      if (au && s.music !== undefined && s.music !== 'none') check(p + '.music', s.music, musicIds, 'music track');
      if (au && s.sfx !== undefined) {
        const list = [].concat(s.sfx);
        if (list.length > 6) warnings.push(`${p}.sfx: more than 6 sound effects on one slide`);
        list.forEach((e, j) => {
          const q = Array.isArray(s.sfx) ? `${p}.sfx[${j}]` : `${p}.sfx`;
          const str = typeof e === 'string', obj = !str && !!e && typeof e === 'object';
          check(q + (obj ? '.id' : ''), str ? e : e && e.id, sfxIds, 'sound effect');
          if (obj) {
            if (!(typeof e.at === 'number' && e.at >= 0)) bad(q + '.at', 'must be a number of seconds, 0 or more');
            else if (s.duration !== undefined && e.at >= s.duration) warnings.push(`${q}.at: ${e.at}s is at or after the slide's ${s.duration}s duration, so it will not be heard`);
          }
        });
      }
      if (!chars.length && !s.title && !s.panel && !(s.props || []).length) warnings.push(`${p}: empty slide`);
    });
    return { errors, warnings };
  };

  // -------------------------------------------------------------- normalisation
  function normalize(scenario) {
    const sc = Pres.expandDialogue(scenario);                         // dialogue blocks become slides first
    const d = Object.assign({ background: Object.keys(Pres.backgrounds)[0], skin: DEFAULT_SKIN, fps: 12 }, sc.defaults);
    let prevBg = d.background;
    let music = sc.music || null;                                     // effective loop, carried slide to slide
    let t = 0;
    const slides = sc.slides.map((s, i) => {
      const background = s.background || prevBg;
      prevBg = background;
      if (s.music !== undefined) music = s.music === 'none' ? null : s.music;
      let si = 0;                                                     // plain strings get 0.15 s, 0.55 s, ...
      const cues = [].concat(s.sfx === undefined ? [] : s.sfx)
        .map((e) => (typeof e === 'string' ? { id: e, at: 0.15 + 0.4 * si++ } : { id: e && e.id, at: e && e.at }))
        .sort((a, b) => a.at - b.at);
      const characters = (s.characters || (s.character ? [s.character] : [])).map((c) => ({
        skin: c.skin || d.skin, at: c.at || 'left', expression: c.expression || 'happy', pose: c.pose || 'idle',
        look: c.look || null, say: c.say || '', talking: c.talking,
      }));
      const textLen = characters.reduce((n, c) => n + c.say.length, 0);
      const duration = s.duration || Math.max(3, Math.min(12, 1.4 + textLen * 0.07 + (s.panel ? s.panel.bullets.length * 0.8 : 0)));
      const props = (s.props || []).map((p, j) => {
        const o = typeof p === 'string' ? { id: p } : p;
        return { id: o.id, at: o.at || null, label: o.label || '', flip: !!o.flip, enter: o.enter || 'drop', delay: o.delay !== undefined ? o.delay : 0.5 + j * 0.45 };
      });
      const slide = {
        index: i, id: s.id || 'slide-' + (i + 1), background, characters, props, duration, start: t,
        title: s.title || null, panel: s.panel || null, transition: s.transition || (i === 0 ? 'cut' : 'dissolve'), music, cues,
      };
      t += duration;
      return slide;
    });
    return { title: sc.title || '', fps: d.fps || 12, slides, total: t, typewriter: sc.typewriter !== false, voice: sc.voice !== false };
  }

  // ordered-dither mask: true when pixel (x, y) is visible at progress p (0..1)
  const dither = (x, y, p) => BAYER[(y & 3) * 4 + (x & 3)] < p * 16;

  function maskBuf(buf, p) {                 // returns a new Buf with only the dither-visible pixels
    const out = new Pres.Buf();
    for (const [k, c] of buf.m) {
      const x = (k % 4096) - 1024, y = Math.floor(k / 4096) - 1024;
      if (dither(x, y, p)) out.set(x, y, c);
    }
    return out;
  }

  // typewriter: how many characters of a speech bubble are drawn at slide-local time lt. A character
  // appears once progress * totalW reaches its cumulative start weight (contract: AUDIO.md, Speech).
  function typedCount(ty, lt) {
    if (lt <= ty.T0) return 0;                                        // nothing typed before the bubble appears
    const target = Math.min(1, (lt - ty.T0) / ty.typeDur) * ty.totalW;
    let n = 0;
    while (n < ty.cum.length && ty.cum[n] <= target) n++;
    return n;
  }

  // =============================================================== Player
  class Player {
    constructor(container, opts = {}) {
      this.container = container;
      this.opts = opts;
      this.time = 0;
      this.playing = false;
      this.loop = !!opts.loop;
      this.slideIndex = -1;
      this.handlers = { slide: [], end: [] };
      this.chars = new Map();               // "skin@at" -> { c: Character, el }
      this.cache = { back: '', front: '', bgStatic: new Map() };
      this.acc = 0;
      this._build();
      this.ro = new ResizeObserver(() => this._layout());
      this.ro.observe(container.parentElement || container);
    }

    on(evt, fn) { this.handlers[evt].push(fn); return this; }
    _emit(evt, ...a) { this.handlers[evt].forEach((f) => f(...a)); }

    _build() {
      const c = this.container;
      c.textContent = '';
      c.style.position = 'relative';
      c.style.overflow = 'hidden';
      c.style.imageRendering = 'pixelated';
      const mk = (cls) => { const d = document.createElement('div'); d.className = cls; d.style.cssText = 'position:absolute;left:0;top:0;'; c.append(d); return d; };
      this.stage = mk('pres-stage');
      this.stage.style.overflow = 'hidden';
      const svg = (cls) => {
        const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        s.setAttribute('viewBox', `0 0 ${G.w} ${G.h}`);
        s.setAttribute('shape-rendering', 'crispEdges');
        s.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;';
        s.classList.add(cls);
        this.stage.append(s);
        return s;
      };
      this.backSvg = svg('pres-back');
      this.charLayer = document.createElement('div');
      this.charLayer.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;';
      this.stage.append(this.charLayer);
      this.frontSvg = svg('pres-front');
      this._layout();
    }

    // integer scale: every stage pixel becomes k x k screen pixels
    // The container is shrunk to exactly the scaled stage size (and centred), so there are no spare
    // bars; the space available is measured on its parent so it can still grow with the window.
    _layout() {
      const parent = this.container.parentElement;
      const w = (parent ? parent.clientWidth : this.container.clientWidth) || G.w * 4;
      this.k = Math.max(1, Math.floor(w / G.w));
      this.stage.style.width = G.w * this.k + 'px';
      this.stage.style.height = G.h * this.k + 'px';
      this.container.style.width = G.w * this.k + 'px';
      this.container.style.height = G.h * this.k + 'px';
      this.container.style.marginLeft = this.container.style.marginRight = 'auto';
      this.chars.forEach((o) => this._placeChar(o));
    }

    _placeChar(o) {
      // `visible` is part of the style so a re-layout never brings back a character who left the slide
      o.el.style.cssText = `position:absolute;left:${o.x * this.k}px;top:${o.y * this.k}px;width:${CHAR.w * this.k}px;height:${CHAR.h * this.k}px;` + (o.visible === false ? 'display:none;' : '');
    }

    // ---------------------------------------------------------------- loading
    load(scenario) {
      const report = Pres.validate(scenario);
      if (report.errors.length) { const e = new Error('Invalid scenario:\n' + report.errors.join('\n')); e.report = report; throw e; }
      this.report = report;
      this.sc = normalize(scenario);
      this.fps = this.sc.fps;
      this.chars.forEach((o) => o.el.remove());
      this.chars.clear();
      this.seek(0);
      return this;
    }

    get duration() { return this.sc ? this.sc.total : 0; }

    seek(slideIndex) {
      const i = Math.max(0, Math.min(this.sc.slides.length - 1, slideIndex));
      this.time = this.sc.slides[i].start;
      this._enterSlide(i);
      this._render();
      return this;
    }
    next() { return this.seek(this.slideIndex + 1); }
    prev() { return this.seek(this.slideIndex - 1); }
    play() {
      this.playing = true; this._lastNow = performance.now();
      if (this._audioOn()) { global.Pres.audio.unlock(); if (this.slide) global.Pres.audio.music(this.slide.music); }
      this._raf(); return this;
    }
    pause() { this.playing = false; if (this._audioOn()) global.Pres.audio.stopMusic(); return this; }
    _audioOn() { return this.opts.audio !== false && global.Pres.audio && global.Pres.audio.supported; }

    _raf() {
      if (!this.playing || this._rafOn) return;
      this._rafOn = true;
      requestAnimationFrame((now) => {
        this._rafOn = false;
        if (!this.playing) return;
        this.step(Math.min(0.25, (now - this._lastNow) / 1000));
        this._lastNow = now;
        this._raf();
      });
    }

    // advance by real time, in whole fixed steps; call step(1 / fps) per frame when exporting video
    step(dt) {
      if (!this.sc) return;
      const interval = 1 / this.fps;
      this.acc += dt;
      while (this.acc >= interval - 1e-9) {
        this.acc -= interval;
        this._advance(interval);
      }
    }

    _advance(interval) {
      this.time += interval;
      if (this.time >= this.sc.total) {
        if (this.loop) { this.time = 0; this._enterSlide(0); } else { this.time = this.sc.total - 1e-6; this.playing = false; if (this._audioOn()) global.Pres.audio.stopMusic(); this._emit('end'); }
      }
      const slide = this._slideAt(this.time);
      if (slide.index !== this.slideIndex) this._enterSlide(slide.index);
      // sound cues fire once per entry into the slide, and only while playing (seeking while paused is silent)
      if (this.playing && this._audioOn()) slide.cues.forEach((c, j) => { if (!this._fired.has(j) && c.at <= this.time - slide.start) { this._fired.add(j); global.Pres.audio.sfx(c.id); } });
      if (this.playing && this._audioOn() && this.sc.voice !== false) this._voiceStep();
      this.chars.forEach((o) => o.c.tick(interval));
      this._render();
    }

    // speech: characters of the current bubble typed so far (0 when the slide has no typewriter)
    _typedNow() {
      const ty = this.L && this.L.bubble && this.L.bubble.type;
      return ty ? typedCount(ty, this.time - this.slide.start) : 0;
    }

    // voice: one blip per step at most, for the last letter or digit typed since the previous step
    _voiceStep() {
      const shown = this._typedNow(), from = this._prevShown;
      this._prevShown = shown;
      if (shown <= from || !global.Pres.audio.voice) return;
      const ty = this.L.bubble.type, say = this.slide.characters.find((c) => c.say);
      for (let i = shown - 1; i >= from; i--) {
        if (/[A-Za-z0-9]/.test(ty.chars[i])) {
          const opts = { expression: say.expression, progress: shown / ty.chars.length, question: /\?\s*$/.test(say.say) };
          global.Pres.audio.voice(say.skin, ty.chars[i], opts); return;
        }
      }
    }

    _slideAt(t) {
      const s = this.sc.slides;
      for (let i = s.length - 1; i >= 0; i--) if (t >= s[i].start) return s[i];
      return s[0];
    }

    // ---------------------------------------------------------------- slide setup
    _enterSlide(i) {
      const slide = this.sc.slides[i];
      this.slideIndex = i;
      this.slide = slide;
      this._fired = new Set();                                        // cue indexes already played in this entry
      this._prevShown = 0;                                            // bubble characters already voiced in this entry
      if (this.playing && this._audioOn()) global.Pres.audio.music(slide.music);
      this.bg = Pres.backgrounds[slide.background];
      if (!this.cache.bgStatic.has(slide.background)) {
        const b = new Pres.Buf(); this.bg.draw(b); this.cache.bgStatic.set(slide.background, b.svg());
      }
      this.theme = this.bg.tone === 'dark' ? 'dark' : 'light';
      this._layoutSlide(slide);

      // characters: reuse an instance with the same skin and spot so poses glide between slides
      const keep = new Set();
      slide.characters.forEach((c) => {
        const id = `${c.skin}@${c.at}`;
        keep.add(id);
        let o = this.chars.get(id);
        if (!o) {
          const el = document.createElement('div');
          this.charLayer.append(el);
          o = { c: new global.Character(el, { skin: c.skin }), el };
          this.chars.set(id, o);
        }
        o.x = AT[c.at];
        o.y = this.bg.ground - CHAR.top;
        o.visible = true;
        this._placeChar(o);
        o.c.apply({ expression: c.expression, pose: c.pose, look: c.look }, { snap: false });
        o.spec = c;
      });
      this.chars.forEach((o, id) => { if (!keep.has(id)) { o.visible = false; this._placeChar(o); } });
      this._emit('slide', i, slide);
    }

    // ---------------------------------------------------------------- layout
    // The stage is shared out like this: characters stand in their spots; everything else (title card,
    // panel, props, bubble) goes in the widest free gap between the characters, so nothing lands on top
    // of a character. Speech bubbles sit beside the speaker's head, but below a title card or panel.
    _layoutSlide(slide) {
      const ui = Pres.ui, th = this.theme, L = (this.L = {});
      const ground = this.bg.ground;
      const say = slide.characters.find((c) => c.say);

      // widest free interval between the characters (ties go to the right-hand one)
      const boxes = slide.characters.map((c) => [AT[c.at] - 2, AT[c.at] + CHAR.w + 2]).sort((p, q) => p[0] - q[0]);
      let region = { x0: 4, x1: G.w - 4 }, cursor = 4, best = -1;
      const consider = (x0, x1) => { if (x1 - x0 >= best) { best = x1 - x0; region = { x0, x1 }; } };
      boxes.forEach(([b0, b1]) => { consider(cursor, b0); cursor = Math.max(cursor, b1); });
      consider(cursor, G.w - 4);
      L.region = region;
      const regionW = region.x1 - region.x0;

      if (slide.title && ui) {
        const w = Math.min(slide.title.w || (slide.characters.length ? 164 : 190), regionW);
        const r = ui.titleCard({ title: slide.title.text, subtitle: slide.title.subtitle || '', w, theme: th });
        L.title = { r, x: Math.round((region.x0 + region.x1 - r.w) / 2), y: 6 };
      }
      if (slide.panel && ui) {
        const r = ui.panel({ title: slide.panel.title || '', bullets: slide.panel.bullets, maxWidth: Math.min(150, regionW), theme: th });
        L.panel = { r, x: region.x1 - r.w, y: 6, n: slide.panel.bullets.length, maxW: Math.min(150, regionW) };
      }
      if (say && ui) {
        const leftSide = AT[say.at] < 100;
        // the bubble may not reach another character: stop it short of their box
        const others = slide.characters.filter((c) => c !== say);
        const bx0 = leftSide
          ? AT[say.at] + 50
          : Math.max(4, ...others.filter((o) => AT[o.at] < AT[say.at]).map((o) => AT[o.at] + CHAR.w + 3));
        const bx1 = leftSide
          ? Math.min(G.w - 4, ...others.filter((o) => AT[o.at] > AT[say.at]).map((o) => AT[o.at] - 3))
          : AT[say.at] + 12;
        const bargs = { text: say.say, maxWidth: Math.max(60, Math.min(150, bx1 - bx0)), tail: leftSide ? 'left' : 'right', theme: th };
        const r = ui.bubble(bargs);
        const bx = leftSide ? bx0 : Math.max(4, bx1 - r.w);
        const tipY = ground - CHAR.top + 22;                               // head height
        let by = Math.max(4, Math.min(ground - CHAR.top - 2, tipY - (r.tip ? r.tip.y : r.h)));
        const above = L.title || L.panel;                                  // never cover a title card or panel
        if (above) by = Math.max(by, above.y + above.r.h + 3);
        L.bubble = by + r.h <= ground - 2 ? { r, x: bx, y: by, args: bargs, type: null } : null;    // no room: skip it (validate warns)
        if (L.bubble && this.sc.typewriter && r.total !== undefined && r.lines) {
          // typewriter: the text is typed out; `,;:` pause a little and `.!?` pause longer (AUDIO.md, Speech)
          const chars = r.lines.join(''), T0 = 0.3;
          const cum = [], weights = [];
          let totalW = 0;
          for (let i = 0; i < chars.length; i++) {
            const w = ',;:'.includes(chars[i]) ? 4 : '.!?'.includes(chars[i]) ? 7 : 1;
            cum.push(totalW); weights.push(w); totalW += w;
          }
          const room = slide.duration - 0.5 - T0;                         // time the bubble may use
          const typeDur = Math.max(0.1, Math.min(Math.max(r.total / 22, 0.5), room - 0.6));
          L.bubble.type = { chars, weights, cum, totalW, total: r.total, typeDur, T0 };
        }
      }

      // props: explicit positions, otherwise one row on the floor in the free region
      const items = slide.props.map((p) => ({ p, def: Pres.props[p.id] }));
      const auto = items.filter((it) => !it.p.at);
      if (auto.length) {
        auto.forEach((it) => { it.slotW = Math.max(it.def.w, it.p.label && ui ? ui.label(it.p.label, { theme: th }).w : 0); });
        const gap = 8, total = auto.reduce((n, it) => n + it.slotW, 0) + gap * (auto.length - 1);
        let x = Math.max(region.x0 - 2, Math.round((region.x0 + region.x1) / 2 - total / 2));
        const base = ground - 12;
        auto.forEach((it) => { it.x = x + Math.round((it.slotW - it.def.w) / 2); it.y = base - it.def.h; x += it.slotW + gap; });
      }
      items.forEach((it) => { if (it.p.at) { it.x = it.p.at[0]; it.y = it.p.at[1]; } });
      L.props = items;
    }

    // ---------------------------------------------------------------- one rendered step
    _render() {
      const slide = this.slide, lt = this.time - slide.start, t = this.time, th = this.theme, L = this.L;
      const back = new Pres.Buf();
      let live = '';
      if (this.bg.tick) { const b = new Pres.Buf(); this.bg.tick(b, t); live = b.svg(); }

      // props with entrance animations
      L.props.forEach((it) => {
        const p = it.p, def = it.def, e = lt - p.delay;
        if (e < 0) return;
        const step = Math.floor(e * this.fps);
        const buf = new Pres.Buf();
        def.draw(buf, t);
        if (p.flip) { const m = new Pres.Buf(); for (const [k, c] of buf.m) m.set(def.w - 1 - ((k % 4096) - 1024), Math.floor(k / 4096) - 1024, c); buf.m = m.m; }
        let dx = 0, dy = 0, out = buf;
        if (p.enter === 'drop' && step < 4) dy = [-16, -9, -4, -1][step];
        else if (p.enter === 'slide-left' && step < 4) dx = [-36, -20, -8, -2][step];
        else if (p.enter === 'slide-right' && step < 4) dx = [36, 20, 8, 2][step];
        else if (p.enter === 'dissolve' && step < 6) out = maskBuf(buf, (step + 1) / 6);
        else if (p.enter === 'pop' && step === 0) out = buf.clone().outline('#ffffff');
        back.blit(out, it.x + dx, it.y + dy);
        if (p.label && Pres.ui && step >= 2) {
          const lab = Pres.ui.label(p.label, { theme: th });
          back.blit(lab.buf, Math.round(it.x + def.w / 2 - lab.w / 2), it.y + def.h + 3);
        }
      });

      const backMarkup = `<g>${this.cache.bgStatic.get(slide.background)}</g><g>${live}</g><g>${back.svg()}</g>`;
      if (backMarkup !== this.cache.back) { this.backSvg.innerHTML = backMarkup; this.cache.back = backMarkup; }

      // characters: the speaker's mouth moves while its text is typed (or the old window without a typewriter)
      const ty = L.bubble && L.bubble.type;
      this.chars.forEach((o) => {
        if (!o.spec || o.visible === false) return;
        if (o.spec.say && ty) o.c.setTalking(lt > ty.T0 && lt < ty.T0 + ty.typeDur + 0.15);
        else o.c.setTalking(o.spec.say ? lt > 0.15 && lt < slide.duration - 0.5 : !!o.spec.talking);
      });

      // front layer: title card, panel, bubble, transition cover
      const front = new Pres.Buf();
      if (L.title && lt > 0.1) front.blit(L.title.r.buf, L.title.x, L.title.y);
      if (L.panel && lt > 0.2) {
        const n = L.panel.n, span = Math.max(1, slide.duration - 1.6) / n;
        const shown = Math.min(n, Math.max(0, Math.floor((lt - 0.6) / span) + 1));
        // the panel only changes when another bullet appears, so draw each reveal state once
        if (!L.panel.cache) L.panel.cache = new Map();
        if (!L.panel.cache.has(shown)) {
          L.panel.cache.set(shown, Pres.ui.panel({ title: slide.panel.title || '', bullets: slide.panel.bullets, maxWidth: L.panel.maxW, reveal: shown, theme: th }));
        }
        front.blit(L.panel.cache.get(shown).buf, L.panel.x, L.panel.y);
      }
      if (L.bubble && lt > 0.3 && lt < slide.duration - 0.2) {
        if (!ty) front.blit(L.bubble.r.buf, L.bubble.x, L.bubble.y);
        else {
          // typing only changes the revealed count; the box size is fixed, so each count is built once
          const b = L.bubble, n = typedCount(ty, lt);
          if (!b.cache) b.cache = new Map();
          if (!b.cache.has(n)) b.cache.set(n, Pres.ui.bubble(Object.assign({}, b.args, { reveal: n })));
          front.blit(b.cache.get(n).buf, b.x, b.y);
        }
      }

      const TR = 0.6;                                         // transition length in seconds
      if (slide.transition !== 'cut' && lt < TR) {
        const p = lt / TR, cover = new Pres.Buf(), col = th === 'dark' ? '#1d1633' : '#fff6e8';
        if (slide.transition === 'dissolve') {
          for (let y = 0; y < G.h; y++) for (let x = 0; x < G.w; x++) if (!dither(x, y, p)) cover.set(x, y, col);
        } else {                                              // wipe: a hard-edged curtain that slides away to the right
          const edge = Math.floor(p * G.w);
          for (let y = 0; y < G.h; y++) for (let x = edge; x < G.w; x++) cover.set(x, y, col);
        }
        front.blit(cover, 0, 0);
      }
      const frontMarkup = front.svg();
      if (frontMarkup !== this.cache.front) { this.frontSvg.innerHTML = frontMarkup; this.cache.front = frontMarkup; }
    }

    // snapshot useful for tests and for the player UI
    state() {
      return { slide: this.slideIndex, id: this.slide && this.slide.id, time: this.time, total: this.duration, playing: this.playing };
    }
  }

  Pres.Player = Player;
  Pres.scenarios = Pres.scenarios || {};
})(window);
