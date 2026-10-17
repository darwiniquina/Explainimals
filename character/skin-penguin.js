(function (global) {
  'use strict';

  const W = 61;
  const H = 76;
  const CX = 30;

  const COLORS = {
    outline: '#10121c',
    body: '#4a4a4a',
    bodyL: '#606060',
    belly: '#fafafa',
    bellyS: '#e6e6f0',
    accent: '#ff8c00',
    accentS: '#e07400',
    beak: '#ff9a1f',
    glint: '#ffffff',
  };

  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const hex = a => '#' + a.map(v =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  ).join('');
  const shift = (h, d) => hex(rgb(h).map((v, i) => v + d[i]));

  const derive = c => ({
    ...COLORS,
    body: c.body,
    bodyL: shift(c.body, [18, 18, 18]),
    belly: c.belly,
    accent: c.accent,
    accentS: shift(c.accent, [-31, -24, 0]),
    beak: shift(c.accent, [0, 14, 31]),
  });

  const STYLE = Object.entries(COLORS)
    .map(([n, h]) => `.p-${n}{fill:var(--p-${n},${h})}`)
    .join('') +
    '.p-shadow{fill:#000;fill-opacity:.16}.penguin *{shape-rendering:crispEdges}';

  class Buf {
    constructor() { this.m = new Map(); }

    set(x, y, c) {
      if (c && x >= 0 && y >= 0 && x < W && y < H)
        this.m.set(y * 1000 + x, c);
    }

    svg() {
      const colors = new Map();

      for (const [k, c] of this.m) {
        const y = Math.floor(k / 1000);
        const x = k % 1000;
        if (!colors.has(c)) colors.set(c, []);
        colors.get(c).push([y, x]);
      }

      let out = '';

      for (const [c, pts] of colors) {
        pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        let d = '', i = 0;

        while (i < pts.length) {
          const [y, x] = pts[i];
          let w = 1;

          while (i + w < pts.length &&
            pts[i + w][0] === y &&
            pts[i + w][1] === x + w) w++;

          d += `M${x} ${y}h${w}v1h-${w}z`;
          i += w;
        }

        out += `<path class="p-${c}" d="${d}"/>`;
      }

      return out;
    }
  }

  const ell = (cx, cy, rx, ry) =>
    (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

  const inset = (f, d) => (x, y) => {
    for (let dy = -d; dy <= d; dy++)
      for (let dx = -d; dx <= d; dx++)
        if (Math.abs(dx) + Math.abs(dy) <= d && !f(x + dx, y + dy))
          return false;
    return true;
  };

  const layer = (buf, inside, shader) => {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!inside(x, y)) continue;

        const edge = !inside(x - 1, y) || !inside(x + 1, y) ||
          !inside(x, y - 1) || !inside(x, y + 1);

        buf.set(x, y, edge ? 'outline' : shader(x, y));
      }
  };

  const paint = (buf, inside, shader) => {
    const f = typeof shader === 'function' ? shader : () => shader;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (inside(x, y)) buf.set(x, y, f(x, y));
  };

  const SPRITE_COLORS = {
    o: 'outline', w: 'glint', a: 'accent',
    k: 'accentS', b: 'beak',
  };

  const sprite = (rows, x0, y0, buf = new Buf()) => {
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch !== '.') buf.set(x0 + i, y0 + j, SPRITE_COLORS[ch]);
    }));
    return buf;
  };

  const flip = rows => rows.map(r => [...r].reverse().join(''));

  const stamp = (buf, cx, cy, r, color) => {
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++)
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++)
        if (dx * dx + dy * dy <= r * r + 0.3)
          buf.set(Math.round(cx) + dx, Math.round(cy) + dy, color);
  };

  // Wide, round Pou-like body with flat base.
  const PROFILE = [
    [4, 7], [5, 11], [7, 15], [10, 18],
    [15, 20], [22, 21], [32, 22],
    [43, 23], [53, 23], [61, 23],
    [66, 22], [69, 21],
  ];

  const halfWidth = y => {
    for (let i = 0; i < PROFILE.length - 1; i++) {
      const [y0, w0] = PROFILE[i];
      const [y1, w1] = PROFILE[i + 1];

      if (y >= y0 && y <= y1)
        return w0 + (w1 - w0) * ((y - y0) / (y1 - y0));
    }
    return -1;
  };

  const BODY = (x, y) => {
    const w = halfWidth(y);
    return w >= 0 && Math.abs(x - CX) <= w;
  };

  const BODY_IN = inset(BODY, 2);

  // Larger connected face patch for cute game-character proportions.
  const FACE = ell(CX, 27, 16, 19);
  const BELLY = ell(CX, 51, 16, 17);
  const CREAM = (x, y) =>
    BODY_IN(x, y) && (FACE(x, y) || BELLY(x, y));

  const STRIPE = (x, y) =>
    y >= 8 && y <= 31 && Math.abs(x - CX) <= 1;

  const EYE_ROWS = {
    open: ['.wo.', 'oooo', 'oooo', '.oo.'],
    wide: ['.wo.', 'oooo', 'oooo', 'oooo', '.oo.'],
    happy: ['.o.', 'o.o'],
    closed: ['oo'],
    squint: ['oooo', 'oooo', '.wo.'],
    sleepy: ['oooo', 'oooo'],
  };

  const WET_OPEN = ['.oo.', 'owoo', 'oooo', '.oo.'];
  const MOUTH_AT_Y = 32;

  const MOUTH_ROWS = {
    closed: ['bbb', 'bbb', '.o.'],
    smile: ['bbb', 'bbb', 'o.o'],
    grin: ['bbb', 'ooo', 'bbb', '.o.'],
    open: ['bbb', 'ooo', 'bbb'],
    wide: ['bbbbb', 'ooooo', 'bbbbb', '.ooo.'],
    small: ['bbb', 'ooo'],
    O: ['bbb', 'ooo', 'ooo', '.o.'],
    frown: ['bbb', 'bbb', 'ooo'],
    flat: ['bbb', 'bbb'],
    smirk: ['bbb', 'bbb', '..o'],
    wavy: ['bbb', 'ooo', 'o.o'],
  };

  const BROW_AT_Y = 19;
  const BROW_ROWS = {
    raised: ['.oo.', 'o..o'],
    worried: ['..oo', 'oo..'],
    angry: ['oo..', '..oo'],
    flat: ['....', 'oooo'],
  };

  const EYES = {
    L: { x: 20, y: 26 },
    R: { x: 40, y: 26 },
  };

  const SHOULDER = {
    L: { x: 11, y: 41 },
    R: { x: 49, y: 41 },
  };

  const ARM_LEN = 11;
  const gazeStep = v => Math.abs(v) < 0.35 ? 0 : Math.sign(v);

  const eyeSprite = name => (cx, cy, look, side = -1) => {
    const base = name === 'open' && look.y > 0.3
      ? WET_OPEN : EYE_ROWS[name];

    const rows = side > 0 ? flip(base) : base;
    const w = base[0].length;

    const x0 = (side > 0
      ? cx - w + 1 + Math.floor(w / 2)
      : cx - Math.floor(w / 2)) + gazeStep(look.x);

    const y0 = cy - Math.floor(base.length / 2) + gazeStep(look.y);

    return sprite(rows, x0, y0).svg();
  };

  const mouthSprite = name => () => {
    const rows = MOUTH_ROWS[name];
    return sprite(rows, CX - Math.floor(rows[0].length / 2), MOUTH_AT_Y).svg();
  };

  const browSprite = rows => (cx, side) => {
    const x0 = EYES.L.x - 2;
    const w = rows[0].length;

    return side < 0
      ? sprite(rows, x0, BROW_AT_Y).svg()
      : sprite(flip(rows), 2 * CX - (x0 + w - 1), BROW_AT_Y).svg();
  };

  const buildBody = () => {
    const torso = new Buf();

    layer(torso, BODY, (x, y) =>
      (!BODY(x, y - 2) || (y <= 12 && !BODY(x - 2, y)))
        ? 'bodyL' : 'body'
    );

    paint(torso, CREAM, (x, y) => y >= 62 ? 'bellyS' : 'belly');
    paint(torso, STRIPE, 'body');

    // No feet. Flat bottom silhouette.
    const legs = new Buf();
    const shadow = new Buf();

    for (let x = 12; x <= 48; x++) shadow.set(x, 71, 'shadow');

    return { torso, legs, shadow };
  };

  const B = buildBody();

  const SKELETON = `
    <style>${STYLE}</style>
    <g class="penguin">
      ${B.shadow.svg()}
      <g data-s="body">
        ${B.torso.svg()}
        <g data-s="legs">${B.legs.svg()}</g>
        <g data-s="head">
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
    const rad = angle * Math.PI / 180;

    const dir = {
      x: (side === 'L' ? -1 : 1) * Math.sin(rad),
      y: Math.cos(rad),
    };

    const sh = SHOULDER[side];

    const wanted = hand === 'point' ? ARM_LEN + 1
      : hand === 'fist' ? ARM_LEN - 1 : ARM_LEN;

    const room = side === 'L' ? sh.x - 5 : W - 6 - sh.x;
    const len = Math.abs(dir.x) > 0.01
      ? Math.min(wanted, room / Math.abs(dir.x)) : wanted;

    const tip = {
      x: sh.x + dir.x * len,
      y: sh.y + dir.y * len,
    };

    const r0 = 2.4;
    const r1 = hand === 'fist' ? 2.5 : 2;
    const buf = new Buf();

    const paintStroke = (grow, ink) => {
      const n = Math.ceil(len * 3);

      for (let i = 0; i <= n; i++) {
        const t = i / n;

        stamp(buf,
          sh.x + (tip.x - sh.x) * t,
          sh.y + (tip.y - sh.y) * t,
          r0 + (r1 - r0) * t + grow,
          ink
        );
      }
    };

    paintStroke(1, 'outline');
    paintStroke(0, 'body');

    return buf.svg();
  };

  const arm = (s, h = 'open') => ({ s, e: 0, h });

  const poses = {
    idle: { L: arm(30), R: arm(30) },
    wave: {
      L: arm(30), R: arm(135),
      wave: { arm: 'R', amp: 18, freq: 2.6 },
    },
    point_right: { L: arm(30), R: arm(85, 'point'), lean: -4 },
    point_left: { L: arm(85, 'point'), R: arm(30), lean: 4 },
    point_up: { L: arm(30), R: arm(165, 'point') },
    present: { L: arm(62), R: arm(62) },
    shrug: { L: arm(48), R: arm(48), lift: 4 },
    think: { L: arm(30), R: arm(132, 'fist'), lean: -3 },
    cheer: {
      L: arm(150, 'fist'), R: arm(150, 'fist'), bounce: 10,
    },
    hands_on_hips: { L: arm(40, 'fist'), R: arm(40, 'fist') },
  };

  const eyeTable = Object.fromEntries(
    Object.keys(EYE_ROWS).map(n => [n, eyeSprite(n)])
  );

  global.CharacterSkins = global.CharacterSkins || {};

  global.CharacterSkins.penguin = {
    id: 'penguin',
    label: 'Penguin',
    viewBox: `0 0 ${W} ${H}`,
    pixelGrid: { w: W, h: H },

    colors: {
      body: COLORS.body,
      belly: COLORS.belly,
      accent: COLORS.accent,
    },

    colorControls: [
      { key: 'body', label: 'Body' },
      { key: 'belly', label: 'Face & belly' },
      { key: 'accent', label: 'Beak' },
    ],

    applyColors(svg, c) {
      for (const [n, v] of Object.entries(derive(c)))
        svg.style.setProperty('--p-' + n, v);
    },

    palette: c => Object.values(derive(c)),
    skeleton: SKELETON,
    arms: { elbow: { x: 0, y: 0 }, single: true },
    eyeCenter: EYES,
    headPivot: { x: CX, y: 26 },
    eyes: eyeTable,

    brows: {
      neutral: () => '',
      raised: browSprite(BROW_ROWS.raised),
      worried: browSprite(BROW_ROWS.worried),
      angry: browSprite(BROW_ROWS.angry),
      skeptic: (cx, side) => side < 0
        ? browSprite(BROW_ROWS.raised)(cx, side)
        : browSprite(BROW_ROWS.flat)(cx, side),
    },

    mouths: Object.fromEntries(
      Object.keys(MOUTH_ROWS).map(n => [n, mouthSprite(n)])
    ),

    hands: {},
    drawArm,
    poses,

    motion({ c, t, talkT, state }) {
      const inhale = state.idle && Math.sin(t * 2.1) > 0.35 ? -1 : 0;
      const hop = c.bounce
        ? Math.round(Math.abs(Math.sin(t * 5)) * c.bounce * 0.4)
        : 0;

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