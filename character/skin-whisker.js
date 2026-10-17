/*
 * skin-whisker.js - "Cat" (skin id "whisker"), a plump grey tabby cat in flat pixel art on a 61 x 76 grid.
 *
 * Look: one plump blob that reads as a cat at a glance: a head as broad as the body, two big pointed ears over the
 * top corners (drawn in front, with pink inner ears), two small cheek tufts, three whisker lines on each cheek
 * reaching past the face, big eyes, a small pink nose over a "w" mouth, a white muzzle and belly, tabby bars on the
 * forehead, cheeks and flanks, and a long striped tail that rises out of the right side. Still one shape: no
 * head/neck line, no legs or feet, and a flat floor on row 69 that rests on a ground shadow.
 * Recolourable roles: body (fur), belly (muzzle & belly), accent (nose & ears). Classes are w-<name>, variables --w-<name>.
 */
(function (global) {
  'use strict';

  const W = 61;
  const H = 76;
  const CX = 30;

  const COLORS = {
    outline: '#1c1c1c',
    body: '#9094a5',
    bodyL: '#a9acba',
    bodyS: '#767a8e',
    stripe: '#4a4a4a',
    belly: '#ffffff',
    bellyS: '#e8e8e8',
    accent: '#c98a8a',
    glint: '#ffffff',
  };

  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const darken = (h, amt) => hex(rgb(h).map((v) => v * (1 - amt)));
  const lift = (h) => hex(rgb(h).map((v, i) => v + [25, 24, 21][i]));

  const derive = (c) => Object.assign({}, COLORS, {
    body: c.body, bodyL: lift(c.body), bodyS: darken(c.body, 0.18),
    belly: c.belly, bellyS: darken(c.belly, 0.09),
    accent: c.accent,
  });

  const STYLE = Object.entries(COLORS).map(([n, h]) => `.w-${n}{fill:var(--w-${n},${h})}`).join('') +
    '.w-shadow{fill:#000;fill-opacity:.2}.w-cat *{shape-rendering:crispEdges}';

  class Buf {
    constructor() { this.m = new Map(); }
    set(x, y, c) {
      if (c && x >= 0 && y >= 0 && x < W && y < H) this.m.set(y * 1000 + x, c);
    }
    svg() {
      const byColor = new Map();
      for (const [k, c] of this.m) {
        const y = Math.floor(k / 1000), x = k % 1000;
        if (!byColor.has(c)) byColor.set(c, []);
        byColor.get(c).push([y, x]);
      }
      let out = '';
      for (const [c, pts] of byColor) {
        pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        let d = '', i = 0;
        while (i < pts.length) {
          const [y, x] = pts[i];
          let w = 1;
          while (i + w < pts.length && pts[i + w][0] === y && pts[i + w][1] === x + w) w++;
          d += `M${x} ${y}h${w}v1h-${w}z`;
          i += w;
        }
        out += `<path class="w-${c}" d="${d}"/>`;
      }
      return out;
    }
  }

  const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const mirror = (f) => (x, y) => f(2 * CX - x, y);
  const inset = (f, d) => (x, y) => {
    for (let dy = -d; dy <= d; dy++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= d && !f(x + dx, y + dy)) return false;
      }
    }
    return true;
  };

  const side = (x, y, [ax, ay], [bx, by]) => (x - bx) * (ay - by) - (ax - bx) * (y - by);
  const inTri = (x, y, A, B, C) => {
    const d1 = side(x, y, A, B), d2 = side(x, y, B, C), d3 = side(x, y, C, A);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };

  const layer = (buf, inside, shader) => {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        buf.set(x, y, edge ? 'outline' : shader(x, y));
      }
    }
  };

  const paint = (buf, inside, shader) => {
    const f = typeof shader === 'function' ? shader : () => shader;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (inside(x, y)) buf.set(x, y, f(x, y));
      }
    }
  };

  const SPRITE_COLORS = { o: 'outline', w: 'glint', a: 'accent', r: 'accent', g: 'stripe', b: 'belly' };
  const sprite = (rows, x0, y0, buf = new Buf()) => {
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch !== '.') buf.set(x0 + i, y0 + j, SPRITE_COLORS[ch]);
    }));
    return buf;
  };
  const flip = (rows) => rows.map((r) => [...r].reverse().join(''));

  const stamp = (buf, cx, cy, r, color) => {
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy <= r * r + 0.3) buf.set(Math.round(cx) + dx, Math.round(cy) + dy, color);
      }
    }
  };

  const brush = (buf, pts, r, color) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      for (let k = 0; k <= n; k++) stamp(buf, ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, r, color);
    }
  };

  // The whole cat is one shape: a dome, then a head as wide as the body (23 px out) with two pointed cheek tufts at
  // rows 31 and 34 (25 px out), then sides that run almost straight down to a flat 43 px floor on row 69. Rows
  // outside 4..69 are not body.
  const PROFILE = [
    [4, 7], [5, 11], [7, 16], [10, 20],
    [15, 22], [22, 23], [27, 23], [29, 23],
    [31, 25], [32, 23], [34, 25], [36, 23],
    [43, 23], [53, 23], [61, 23],
    [66, 22], [69, 21],
  ];
  const halfW = (y) => {
    for (let i = 0; i < PROFILE.length - 1; i++) {
      const [y0, w0] = PROFILE[i], [y1, w1] = PROFILE[i + 1];
      if (y >= y0 && y <= y1) return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0);
    }
    return -1;
  };
  const BODY = (x, y) => { const w = halfW(y); return w >= 0 && Math.abs(x - CX) <= w; };

  // Pointed ears over the top corners of the dome. They are drawn in front of the body (see SKELETON), so the whole
  // triangle shows, with a pink inner ear.
  const EAR_L = (x, y) => inTri(x, y, [15, 2], [9, 14], [23, 14]);
  const EAR_R = (x, y) => EAR_L(2 * CX - x, y);
  const EAR_IN_L = (x, y) => inTri(x, y, [15, 6], [13, 12], [17, 12]);
  const EAR_IN_R = (x, y) => EAR_IN_L(2 * CX - x, y);

  // Tabby forehead stripes (the M marking, rows 9..14), and a white muzzle on the face, about 11 px wide, rows 27..35.
  const STRIPES = [[26, 11, 4], [30, 9, 3], [34, 11, 4]];
  const MUZZLE = ell(CX, 31, 5.5, 4);

  // Tabby bars, all in the darker stripe colour: two on each cheek pointing in from the edge, and three on each
  // flank. Each is [x, y, length] for the left side; the right side is the mirror image.
  const CHEEK_BARS = [[14, 26, 4], [12, 28, 4]];
  const FLANK_BARS = [[9, 46, 4], [9, 52, 4], [9, 58, 4]];

  // A white belly patch, kept two pixels in from the edge of the body.
  const BELLY = ell(CX, 57, 11, 11);
  const CREAM = (x, y) => inset(BODY, 2)(x, y) && BELLY(x, y);

  // The tail: a long, 4 px thick tail rising out of the right side, low down, curving out and up. Its centre line
  // starts behind the body and ends at the tip; the ink stays inside columns 3..58.
  const TAIL = [[46, 64], [53, 61], [55, 54], [55, 46], [55, 38]];
  const segDist = (x, y, [ax, ay], [bx, by]) => {
    const vx = bx - ax, vy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(x - (ax + t * vx), y - (ay + t * vy));
  };
  const TAIL_INK = (x, y) => {
    for (let i = 0; i < TAIL.length - 1; i++) if (segDist(x, y, TAIL[i], TAIL[i + 1]) <= 2.9) return true;
    return false;
  };
  const TAIL_RING = (y) => y === 44 || y === 45 || y === 51 || y === 52 || y === 58 || y === 59;
  const TAIL_TIP = (y) => y <= 39;

  // Bigger, rounder eyes with bright highlights.
  const EYE_ROWS = {
    open:   ['.ooo.', 'ooooo', 'oowoo', '.ooo.', '..o..'],
    wide:   ['.ooo.', 'ooooo', 'oowoo', 'ooooo', '.ooo.'],
    happy:  ['.o.o.', 'o...o'],
    closed: ['.....', '.ooo.', '.....'],
    squint: ['ooooo', 'oowoo', '.ooo.'],
    sleepy: ['ooooo', '.ooo.'],
  };

  const WET_OPEN = ['.ooo.', 'ooooo', 'owooo', '.ooo.', '..o..'];

  // the w mouth sits on rows 31..32, under the nose (rows 28..29); the open and talking mouths hang from it
  const MOUTH_AT_Y = 31;
  const MOUTH_ROWS = {
    closed: ['o.o.o', '.ooo.'],
    smile:  ['o...o', '.ooo.'],
    grin:   ['o.o.o', 'owwwo', '.ooo.'],
    open:   ['o.o.o', 'orrro', '.ooo.'],
    wide:   ['.ooooo.', 'orrrrro', '.ooooo.'],
    small:  ['ooo', 'oro', 'ooo'],
    O:      ['o.o.o', 'orrro', 'orrro', '.ooo.'],
    frown:  ['.ooo.', 'o...o'],
    flat:   ['ooooo'],
    smirk:  ['.oooo', '....o'],
    wavy:   ['o.o.o', '.o.o.'],
  };

  const BROW_AT_Y = 19;
  const BROW_ROWS = {
    raised:  ['.gg.', 'g..g'],
    worried: ['..gg', 'gg..'],
    angry:   ['gg..', '..gg'],
    flat:    ['....', 'gggg'],
  };

  const EYES = { L: { x: 22, y: 24 }, R: { x: 38, y: 24 } };    // symmetric about CX; eyes span rows 22..26
  // the arm roots sit 4 px in from the body's side edge (x 7 / 53) at mid-body, so the arms hang off the flank
  const SHOULDER = { L: { x: 11, y: 42 }, R: { x: 49, y: 42 } };
  const ARM_LEN = 10;

  // three whiskers on each cheek: from x 14 out past the face edge to x 4, angled up, straight and down by 1 px
  const WHISKERS = [[[14, 32], [4, 31]], [[14, 33], [4, 33]], [[14, 34], [4, 35]]];
  const whiskerLines = (buf) => {
    for (const [[x0, y0], [x1, y1]] of WHISKERS) {
      const n = x0 - x1;
      for (let i = 0; i <= n; i++) {
        const x = x0 - i, y = Math.round(y0 + ((y1 - y0) * i) / n);
        buf.set(x, y, 'outline');
        buf.set(2 * CX - x, y, 'outline');
      }
    }
  };

  const gazeStep = (v) => (Math.abs(v) < 0.35 ? 0 : Math.sign(v));

  const eyeSprite = (name) => (cx, cy, look, side = -1) => {
    const wet = name === 'open' && look.y > 0.3;
    const base = wet ? WET_OPEN : EYE_ROWS[name];
    const rows = side > 0 ? flip(base) : base;
    const x0 = cx - Math.floor(rows[0].length / 2) + gazeStep(look.x);
    const y0 = cy - Math.floor(rows.length / 2) + gazeStep(look.y);
    return sprite(rows, x0, y0).svg();
  };

  const mouthSprite = (name) => () => {
    const rows = MOUTH_ROWS[name];
    return sprite(rows, CX - Math.floor(rows[0].length / 2), MOUTH_AT_Y).svg();
  };

  const browSprite = (rows) => (cx, side) => {
    const x0 = EYES.L.x - 2, w = rows[0].length;
    return side < 0
      ? sprite(rows, x0, BROW_AT_Y).svg()
      : sprite(flip(rows), 2 * CX - (x0 + w - 1), BROW_AT_Y).svg();
  };

  const buildBody = () => {
    // a ground shadow under the body (the floor is at y = 70, the lowest body row is 69)
    const shadow = new Buf();
    for (let x = 7; x <= 53; x++) shadow.set(x, 70, 'shadow');
    for (let x = 11; x <= 49; x++) shadow.set(x, 71, 'shadow');

    // behind the body: the tail (ink ring, then fur with three dark rings and a dark tip)
    const tail = new Buf();
    layer(tail, TAIL_INK, (x, y) => (TAIL_RING(y) || TAIL_TIP(y) ? 'stripe' : 'body'));

    // the two ears: fur with a pink inner ear. They sit over the torso (see SKELETON).
    const ears = new Buf();
    for (const ear of [EAR_L, EAR_R]) layer(ears, ear, () => 'body');
    paint(ears, EAR_IN_L, 'accent');
    paint(ears, EAR_IN_R, 'accent');

    // the body: fur with ink on its edge. Light comes from the upper left, so the lowest two fill rows of each
    // column are darker (the lowest body row of a column is its ink edge), and a 1-2 px crescent down the
    // lower-right edge thins out by row 56.
    const bottomAt = Array.from({ length: W }, (_, x) => {
      let b = -1;
      for (let y = 0; y < H; y++) if (BODY(x, y)) b = y;
      return b;
    });
    const baseShade = (x, y) => {
      if (y >= bottomAt[x] - 2) return 'bodyS';
      const rim = y >= 59 ? 2 : y >= 56 ? 1 : 0;
      if (rim && x - CX >= Math.floor(halfW(y)) - rim) return 'bodyS';
      return 'body';
    };
    const torso = new Buf();
    layer(torso, BODY, baseShade);
    paint(torso, CREAM, 'belly');
    for (const [x0, y, n] of FLANK_BARS) {
      for (let k = 0; k < n; k++) {
        torso.set(x0 + k, y, 'stripe');
        torso.set(2 * CX - x0 - k, y, 'stripe');
      }
    }

    // the head: the white muzzle, the forehead M stripes, the cheek bars, the pink nose (3x2 on rows 28..29) and
    // the whisker lines
    const head = new Buf();
    paint(head, MUZZLE, 'belly');
    for (const [x, y0, n] of STRIPES) {
      for (let k = 0; k < n; k++) head.set(x, y0 + k, 'stripe');
    }
    for (const [x0, y, n] of CHEEK_BARS) {
      for (let k = 0; k < n; k++) {
        head.set(x0 + k, y, 'stripe');
        head.set(2 * CX - x0 - k, y, 'stripe');
      }
    }
    sprite(['aaa', 'aaa'], CX - 1, 28, head);
    whiskerLines(head);

    return { shadow, tail, ears, torso, head };
  };

  const B = buildBody();

  const SKELETON = `
    <style>${STYLE}</style>
    <g class="w-cat">
      ${B.shadow.svg()}
      <g data-s="body">
        <g data-s="tail">${B.tail.svg()}</g>
        ${B.torso.svg()}
        ${B.ears.svg()}
        <g data-s="head">
          ${B.head.svg()}
          <g data-s="cheeks" style="display:none"></g>
          <g data-s="eyes"></g>
          <g data-s="brows"></g>
          <g data-s="mouth"></g>
        </g>
        <g data-s="armL"></g>
        <g data-s="armR"></g>
      </g>
    </g>`;

  const drawArm = (side, angle, hand) => {
    const rad = (angle * Math.PI) / 180;
    const dir = { x: (side === 'L' ? -1 : 1) * Math.sin(rad), y: Math.cos(rad) };
    const sh = SHOULDER[side];
    const wanted = hand === 'point' ? ARM_LEN + 2 : ARM_LEN;
    // a sideways arm is cut short so its wrist stays at column 5 (or 55): the grid is only 61 px wide
    const room = side === 'L' ? sh.x - 5 : W - 6 - sh.x;
    const len = Math.abs(dir.x) > 0.01 ? Math.min(wanted, room / Math.abs(dir.x)) : wanted;
    const wrist = { x: sh.x + dir.x * len, y: sh.y + dir.y * len };
    const buf = new Buf();

    const sweep = (r, color, a, b) => {
      const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2);
      for (let i = 0; i <= n; i++) {
        stamp(buf, a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, r, color);
      }
    };

    const paw = hand === 'fist' ? 2.0 : 1.8;
    sweep(2.1, 'outline', sh, wrist);
    stamp(buf, wrist.x, wrist.y, paw + 0.9, 'outline');
    sweep(1.4, 'body', sh, wrist);
    stamp(buf, wrist.x, wrist.y, paw, 'bellyS');
    return buf.svg();
  };

  const arm = (s, h = 'open') => ({ s, e: 0, h });
  const poses = {
    idle: { L: arm(12), R: arm(12) },
    wave: { L: arm(12), R: arm(135), wave: { arm: 'R', amp: 18, freq: 2.6 } },
    point_right: { L: arm(12), R: arm(85, 'point'), lean: -4 },
    point_left: { L: arm(85, 'point'), R: arm(12), lean: 4 },
    point_up: { L: arm(12), R: arm(165, 'point') },
    present: { L: arm(62), R: arm(62) },
    shrug: { L: arm(48), R: arm(48), lift: 4 },
    think: { L: arm(12), R: arm(132, 'fist'), lean: -3 },
    cheer: { L: arm(150, 'fist'), R: arm(150, 'fist'), bounce: 10 },
    hands_on_hips: { L: arm(40, 'fist'), R: arm(40, 'fist') },
  };

  const eyeTable = Object.fromEntries(Object.keys(EYE_ROWS).map((n) => [n, eyeSprite(n)]));
  global.CharacterSkins = global.CharacterSkins || {};
  global.CharacterSkins.whisker = {
    id: 'whisker',
    label: 'Cat',
    viewBox: `0 0 ${W} ${H}`,
    pixelGrid: { w: W, h: H },
    colors: { body: COLORS.body, belly: COLORS.belly, accent: COLORS.accent },
    colorControls: [
      { key: 'body', label: 'Fur' },
      { key: 'belly', label: 'Muzzle & belly' },
      { key: 'accent', label: 'Nose & ears' },
    ],
    applyColors(svg, c) {
      for (const [n, v] of Object.entries(derive(c))) svg.style.setProperty('--w-' + n, v);
    },
    palette: (c) => Object.values(derive(c)),
    skeleton: SKELETON,
    arms: { elbow: { x: 0, y: 0 }, single: true },
    eyeCenter: EYES,
    headPivot: { x: CX, y: EYES.L.y },
    eyes: eyeTable,
    brows: {
      neutral: () => '',
      raised: browSprite(BROW_ROWS.raised),
      worried: browSprite(BROW_ROWS.worried),
      angry: browSprite(BROW_ROWS.angry),
      skeptic: (cx, side) => (side < 0
        ? browSprite(BROW_ROWS.raised)(cx, side)
        : browSprite(BROW_ROWS.flat)(cx, side)),
    },
    mouths: Object.fromEntries(Object.keys(MOUTH_ROWS).map((n) => [n, mouthSprite(n)])),
    hands: {},
    drawArm,
    poses,

    motion({ c, t, talkT, state }) {
      const inhale = state.idle && Math.sin(t * 2.1) > 0.35 ? -1 : 0;
      const hop = c.bounce ? Math.round(Math.abs(Math.sin(t * 5)) * c.bounce * 0.3) : 0;
      const lean = Math.round(c.lean * 0.4);
      const lift = Math.round(c.lift * 0.5);
      const talk = state.talking && Math.sin(talkT * 9) > 0 ? 1 : 0;

      return {
        body: `translate(${lean} ${inhale - lift - hop - talk})`,
        head: 'translate(0 0)',
      };
    },
  };
})(window);