/*
 * character.js - the rig. Builds the SVG for one character and animates it.
 *
 *   const c = new Character(containerEl, { skin: 'penguin' | 'frog' | 'dog' | 'whisker' | 'rabbit' | 'bear', viewBox: '...' });
 *   c.apply({ expression: 'happy', pose: 'wave', talking: true });
 *   c.action('nod');   // a timed gesture on top of the pose, see Character.actions
 *   // each frame:
 *   c.tick(dtSeconds);
 *
 * A skin (see skin-*.js) supplies the pixel art, the face-part variants, the pose numbers and drawArm().
 * Expression and pose NAMES are shared by every skin, so a scene list works on any of them.
 *
 * Time only advances through tick(dt), never through the wall clock, so a video renderer can
 * drive it frame by frame and get identical output.
 */
(function (global) {
  'use strict';

  const P = global.CharacterParts;
  const NS = 'http://www.w3.org/2000/svg';

  const BLINKABLE = ['open', 'wide', 'squint'];
  const BLINK_PERIOD = 3.7;
  const BLINK_LENGTH = 0.13;

  // Numeric channels that glide toward their targets.
  const CHANNELS = ['lS', 'lE', 'rS', 'rE', 'tilt', 'lean', 'lift', 'lookX', 'lookY', 'waveL', 'waveR', 'bounce'];

  const f2 = (n) => n.toFixed(2);

  // Timed gestures started with char.action(name), and how many seconds each one lasts.
  const ACTIONS = { nod: 0.6, shake: 0.7, hop: 0.6, recoil: 0.5, shiver: 0.8 };

  // Whole-pixel offsets of one action at progress p (0 to 1) over dur seconds. body and head are [x, y] grid pixels,
  // added on top of the skin's own motion. A pure function of p, so the same time always gives the same frame.
  function actionOffset(name, p, dur) {
    const none = [0, 0];
    switch (name) {
      case 'nod': // head dips 2 px, twice
        return { body: none, head: [0, Math.round(2 * Math.abs(Math.sin(p * 2 * Math.PI)))] };
      case 'shake': // head swings 2 px left and right, twice
        return { body: none, head: [Math.round(2 * Math.sin(p * 4 * Math.PI)), 0] };
      case 'hop': // one jump, 6 px up and back down
        return { body: [0, -Math.round(6 * Math.sin(p * Math.PI))], head: none };
      case 'recoil': // quick lean back 5 px, then settle to rest
        return { body: [Math.round(-5 * (p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8)), 0], head: none };
      case 'shiver': // body jitters 1 px left and right, 25 steps a second
        return { body: [Math.floor(p * dur * 25) % 2 ? 1 : -1, 0], head: none };
      default:
        return { body: none, head: none };
    }
  }

  // Default body/head motion, used when a skin does not supply its own motion(): the whole body bobs, the head tilts on its neck.
  function defaultMotion(skin, { c, t, talkT, state }) {
    const breathe = state.idle ? Math.sin(t * 2.1) * 1.6 : 0;
    const hop = c.bounce ? Math.abs(Math.sin(t * 5)) * c.bounce : 0;
    const sway = state.idle ? Math.sin(t * 1.3) * 0.8 : 0;
    const bob = state.talking ? Math.sin(talkT * 9) * 1.1 : 0;
    const pv = skin.headPivot;
    return {
      body: `translate(${f2(c.lean)} ${f2(-(c.lift + breathe + hop))})`,
      head: `rotate(${f2(c.tilt + sway + bob)} ${pv.x} ${pv.y})`,
    };
  }

  class Character {
    constructor(container, opts = {}) {
      const skinId = opts.skin || 'penguin';
      const skin = global.CharacterSkins && global.CharacterSkins[skinId];
      if (!skin) throw new Error(`Unknown skin "${skinId}". Valid: ${Character.skins.join(', ')}`);
      this.skin = skin;
      this.opts = opts;
      this.poses = Object.assign({}, P.POSES, skin.poses);
      this.colors = Object.assign({}, skin.colors, opts.colors);
      this.speed = opts.speed || 9; // how fast poses glide (higher = snappier)
      this.t = 0;
      this.talkT = 0;
      this.act = null; // the timed action in progress: { name, t, dur }

      this.state = {
        expression: 'neutral',
        pose: 'idle',
        talking: false,
        blink: opts.blink !== false,
        idle: opts.idle !== false, // breathing + sway
        manualLook: null,
        override: { eyes: null, brows: null, mouth: null },
      };
      this.hands = { L: 'open', R: 'open' };
      this.waveFreq = 2.4;
      this.cur = {};
      this.target = {};
      CHANNELS.forEach((k) => (this.cur[k] = this.target[k] = 0));
      this._cache = {};

      this._build(container);
      this.setColors({});
      this.apply({ expression: 'neutral', pose: 'idle' }, { snap: true });
    }

    // ---------------------------------------------------------- building
    _build(container) {
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', this.opts.viewBox || this.skin.viewBox);
      svg.setAttribute('xmlns', NS);
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.overflow = 'visible';
      svg.innerHTML = this.skin.skeleton;
      container.appendChild(svg);
      this.svg = svg;
      this.slot = {};
      svg.querySelectorAll('[data-s]').forEach((el) => (this.slot[el.dataset.s] = el));
    }

    setColors(colors) {
      Object.assign(this.colors, colors);
      this.skin.applyColors(this.svg, this.colors);
      return this;
    }

    // --------------------------------------------------------- public API
    static get skins() { return Object.keys(global.CharacterSkins || {}); }
    static get expressions() { return Object.keys(P.EXPRESSIONS); }
    static get poses() { return Object.keys(P.POSES); }
    static get actions() { return Object.keys(ACTIONS); }

    // names of the swappable face parts a given skin provides
    static partNames(skinId) {
      const s = global.CharacterSkins[skinId];
      return { eyes: Object.keys(s.eyes), brows: Object.keys(s.brows), mouth: Object.keys(s.mouths) };
    }

    setExpression(name) {
      if (!P.EXPRESSIONS[name]) throw new Error(`Unknown expression "${name}". Valid: ${Character.expressions.join(', ')}`);
      this.state.expression = name;
      return this;
    }

    setPose(name, { snap = false } = {}) {
      const pose = this.poses[name];
      if (!pose) throw new Error(`Unknown pose "${name}". Valid: ${Character.poses.join(', ')}`);
      this.state.pose = name;
      const T = this.target;
      T.lS = pose.L.s; T.lE = pose.L.e || 0;
      T.rS = pose.R.s; T.rE = pose.R.e || 0;
      T.tilt = pose.tilt || 0;
      T.lean = pose.lean || 0;
      T.lift = pose.lift || 0;
      T.bounce = pose.bounce || 0;
      T.waveL = pose.wave && pose.wave.arm === 'L' ? pose.wave.amp : 0;
      T.waveR = pose.wave && pose.wave.arm === 'R' ? pose.wave.amp : 0;
      if (pose.wave) this.waveFreq = pose.wave.freq || 2.4;
      this.hands.L = pose.L.h || 'open';
      this.hands.R = pose.R.h || 'open';
      if (snap) this.snap();
      return this;
    }

    // Start a timed action (nod shake hop recoil shiver). It only advances through tick(dt).
    // Starting one while another runs replaces it. action(null) cancels the one in progress.
    action(name) {
      if (name === null) { this.act = null; return this; }
      if (!Object.prototype.hasOwnProperty.call(ACTIONS, name)) {
        throw new Error(`Unknown action "${name}". Valid: ${Character.actions.join(', ')}`);
      }
      this.act = { name, t: 0, dur: ACTIONS[name] };
      return this;
    }

    get actionActive() { return !!this.act; }

    setTalking(on) { this.state.talking = !!on; return this; }
    setBlink(on) { this.state.blink = !!on; return this; }
    setIdle(on) { this.state.idle = !!on; return this; }

    // setLook(x, y) with x,y in -1..1 overrides the expression's gaze; setLook(null) releases it.
    setLook(x, y) {
      this.state.manualLook = x == null ? null : { x, y: y || 0 };
      return this;
    }

    // part: 'eyes' | 'brows' | 'mouth'; name: a variant name, or null to follow the expression.
    override(part, name) {
      const s = this.skin;
      const table = { eyes: s.eyes, brows: s.brows, mouth: s.mouths }[part];
      if (!table) throw new Error(`Unknown part "${part}". Valid: eyes, brows, mouth`);
      if (name && !table[name]) throw new Error(`Unknown ${part} "${name}". Valid: ${Object.keys(table).join(', ')}`);
      this.state.override[part] = name || null;
      return this;
    }

    /*
     * Apply one scene-style spec. Any field may be omitted.
     *   { expression, pose, talking, look: {x,y} | null, eyes, brows, mouth, action: name | { id } }
     */
    apply(spec, { snap = false } = {}) {
      if (spec.expression !== undefined) this.setExpression(spec.expression);
      if (spec.pose !== undefined) this.setPose(spec.pose);
      if (spec.talking !== undefined) this.setTalking(spec.talking);
      if ('look' in spec) spec.look ? this.setLook(spec.look.x, spec.look.y) : this.setLook(null);
      ['eyes', 'brows', 'mouth'].forEach((p) => p in spec && this.override(p, spec[p]));
      if (spec.action !== undefined) {
        const a = spec.action;
        this.action(a && typeof a === 'object' ? a.id : a);
      }
      if (snap) this.snap();
      return this;
    }

    snap() {
      CHANNELS.forEach((k) => (this.cur[k] = this.target[k]));
      const look = this._targetLook();
      this.cur.lookX = look.x;
      this.cur.lookY = look.y;
      this.tick(0);
      return this;
    }

    // Snapshot of the current spec (handy for copying into a scene list).
    getSpec() {
      const s = this.state;
      const spec = { expression: s.expression, pose: s.pose, talking: s.talking };
      if (s.manualLook) spec.look = s.manualLook;
      for (const p of ['eyes', 'brows', 'mouth']) if (s.override[p]) spec[p] = s.override[p];
      if (this.act) spec.action = this.act.name;
      return spec;
    }

    // -------------------------------------------------------------- tick
    _targetLook() {
      if (this.state.manualLook) return this.state.manualLook;
      return P.EXPRESSIONS[this.state.expression].look || { x: 0, y: 0 };
    }

    tick(dt) {
      this.t += dt;
      if (this.state.talking) this.talkT += dt;
      if (this.act) {
        this.act.t += dt;
        if (this.act.t >= this.act.dur) this.act = null; // finished: the next frame is the plain rest pose
      }

      const look = this._targetLook();
      this.target.lookX = look.x;
      this.target.lookY = look.y;

      const k = dt > 0 ? 1 - Math.exp(-dt * this.speed) : 0;
      for (const ch of CHANNELS) this.cur[ch] += (this.target[ch] - this.cur[ch]) * k;

      this._render();
    }

    _set(key, el, attr, value) {
      if (this._cache[key] !== value) {
        el.setAttribute(attr, value);
        this._cache[key] = value;
      }
    }

    _html(key, el, html) {
      if (this._cache[key] !== html) {
        el.innerHTML = html;
        this._cache[key] = html;
      }
    }

    _render() {
      const { cur: c, t, slot, state, skin } = this;

      // body + head motion (a skin may replace it, e.g. squash-and-stretch for a blob body)
      const motion = (skin.motion || ((ctx) => defaultMotion(skin, ctx)))({ c, t, talkT: this.talkT, state });
      // a timed action is appended as extra translate()s, so the skin's motion is kept as it is
      let bodyT = motion.body;
      let headT = motion.head;
      if (this.act) {
        const o = actionOffset(this.act.name, this.act.t / this.act.dur, this.act.dur);
        bodyT += ` translate(${o.body[0]} ${o.body[1]})`;
        headT += ` translate(${o.head[0]} ${o.head[1]})`;
      }
      this._set('body', slot.body, 'transform', bodyT);
      if (slot.head) this._set('head', slot.head, 'transform', headT);

      // arms: each skin redraws its arm at the current angle with drawArm(side, angle, hand).
      // R is mirrored inside the skin, so the same numbers work on both sides.
      const waveSpin = Math.sin(t * this.waveFreq * Math.PI * 2);
      const single = skin.arms.single; // one-piece arm: the elbow value just adds to the shoulder
      const armAngles = {
        L: [c.lS, c.lE + waveSpin * c.waveL],
        R: [c.rS, c.rE + waveSpin * c.waveR],
      };
      for (const side of ['L', 'R']) {
        const [s, e] = armAngles[side];
        this._html('arm' + side, slot['arm' + side], skin.drawArm(side, single ? s + e : s, this.hands[side]));
      }

      // face
      const expr = P.EXPRESSIONS[state.expression];
      const look = { x: c.lookX, y: c.lookY };
      let eyeName = state.override.eyes || expr.eyes;
      const blinking = state.blink && BLINKABLE.includes(eyeName) && t % BLINK_PERIOD > BLINK_PERIOD - BLINK_LENGTH;
      if (blinking) eyeName = 'closed';
      const eyeFn = skin.eyes[eyeName];
      const lq = { x: Math.round(look.x * 20) / 20, y: Math.round(look.y * 20) / 20 };
      const ec = skin.eyeCenter;
      this._html('eyes', slot.eyes, eyeFn(ec.L.x, ec.L.y, lq, -1) + eyeFn(ec.R.x, ec.R.y, lq, 1));

      const browFn = skin.brows[state.override.brows || expr.brows];
      this._html('brows', slot.brows, browFn(ec.L.x, -1) + browFn(ec.R.x, 1));

      let mouthName = state.override.mouth || expr.mouth;
      if (state.talking && !state.override.mouth) {
        const i = Math.floor(this.talkT * 10);
        const hash = ((Math.imul(i + 1, 2654435761) >>> 0) >>> 3) % 9973;
        mouthName = P.TALK_SHAPES[hash % P.TALK_SHAPES.length];
      }
      this._html('mouth', slot.mouth, skin.mouths[mouthName]());

      this._set('cheeks', slot.cheeks, 'style', expr.cheeks ? 'display:inline' : 'display:none');
    }
  }

  global.Character = Character;
})(window);
