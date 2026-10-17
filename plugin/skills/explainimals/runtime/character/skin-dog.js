/*
 * skin-dog.js - "Dog", a fawn pug with big floppy brown ears, drawn as flat pixel art on a 61 x 76 grid.
 *
 * Same structure as the other pixel skins (copied rather than shared, so each file stands alone):
 *   - every shape is built from whole pixels (Buf) and emitted as crisp SVG rects
 *   - layer() outlines a membership test in ink and shades its inside; paint() fills a patch with no outline
 *   - eyes, brows, nose and mouths are hand-authored text grids; gaze shifts an eye by one pixel
 *   - the tail is a whole-pixel patch drawn behind the body
 *   - arms are redrawn at the current angle by drawArm: a brush from shoulder to wrist, outline pass first,
 *     then the fill, with a darker-tan paw tip
 *   - motion is whole pixels only: 1 px breathing, 1 px talking bob, lean and lift as whole pixels, no tilt
 *
 * Look: a fawn pug drawn as one plump Pou-like blob, with no separate head, no collar and no feet. The blob has the
 * penguin's outline: a rounded dome on top, sides that swell out and run almost straight down, and a flat floor that
 * rests on a ground shadow. Two big brown ears hang over its top corners, a dark grey-brown face mask covers the
 * lower face with patches round the eyes, and there are two square black eyes with a white glint and a black nose
 * with a short line down to a wide smile. A small brown tail peeks out on the right.
 * Recolourable roles: body (fur), belly (face mask), accent (ears and tail). Classes are d-<name>, variables --d-<name>.
 */
(function (global) {
  'use strict';

  const W = 61;
  const H = 76;
  const CX = 30;                              // centre column of the grid

  // The flat colours of the pug, taken from the reference. body, belly (face mask) and accent (ears, tail) are the
  // recolourable roles; the rest are derived in derive().
  const COLORS = {
    outline: '#1c1208',                       // dark near-black brown ink: outlines, eyes, nose and mouth
    body: '#e2b27c',                          // fawn fur (recolourable)
    accent: '#6b4513',                        // brown ears and tail (recolourable)
    belly: '#5e5248',                         // dark grey-brown face mask (recolourable)
    glint: '#ffffff',                         // eye highlights
    tongue: '#ff5f4a',                        // a tiny tongue in the grin
  };

  // ------------------------------------------------------------ colour maths
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const darken = (h, amt) => hex(rgb(h).map((v) => v * (1 - amt)));
  // the darker tan shade: each channel of the fur scaled (gives #c0894a for the default fur)
  const tanShade = (h) => hex(rgb(h).map((v, i) => v * [0.85, 0.77, 0.6][i]));
  // the taupe rim of the mask: the mask colour lifted by a fixed amount (gives #7a6b60 for the default mask)
  const lift = (h, a) => hex(rgb(h).map((v, i) => v + a[i]));

  const derive = (c) => ({
    outline: COLORS.outline,
    body: c.body, bodyS: tanShade(c.body),
    accent: c.accent, accentS: darken(c.accent, 0.25),
    mask: c.belly, maskL: lift(c.belly, [28, 25, 24]),
    glint: COLORS.glint, tongue: COLORS.tongue,
  });

  const STYLE = Object.entries(derive(COLORS)).map(([n, h]) => `.d-${n}{fill:var(--d-${n},${h})}`).join('') +
    '.d-shadow{fill:#000;fill-opacity:.2}.dog *{shape-rendering:crispEdges}';

  // ------------------------------------------------------------ pixel buffer
  // A sparse grid of named colours. svg() merges horizontal runs into one path per colour.
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
        out += `<path class="d-${c}" d="${d}"/>`;
      }
      return out;
    }
  }

  // membership tests (x, y are whole pixels)
  const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  // a superellipse (exponent 4): a rounded shape with flat sides and a flat top, like a pug's head or an ear
  const sup = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 4 + ((y - cy) / ry) ** 4 <= 1;
  const mirror = (f) => (x, y) => f(2 * CX - x, y);   // the right side is the mirror image of the left

  // Paint a membership test: pixels on its edge get the edge colour (ink by default), the rest get shader(x, y).
  const layer = (buf, inside, shader, edge = 'outline') => {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!inside(x, y)) continue;
        const onEdge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        buf.set(x, y, onEdge ? edge : shader(x, y));
      }
    }
  };
  // Paint a membership test with one colour and no outline.
  const paint = (buf, inside, shader) => {
    const f = typeof shader === 'function' ? shader : () => shader;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x, y)) buf.set(x, y, f(x, y));
  };

  // sprites: rows of characters, '.' is transparent
  //   o outline   w glint   T tongue
  const SPRITE_COLORS = { o: 'outline', w: 'glint', T: 'tongue' };
  const sprite = (rows, x0, y0, buf = new Buf()) => {
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch !== '.') buf.set(x0 + i, y0 + j, SPRITE_COLORS[ch]);
    }));
    return buf;
  };
  const flip = (rows) => rows.map((r) => [...r].reverse().join(''));

  // stamp every pixel within radius r of (cx, cy)
  const stamp = (buf, cx, cy, r, color) => {
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy <= r * r + 0.3) buf.set(Math.round(cx) + dx, Math.round(cy) + dy, color);
      }
    }
  };

  // ------------------------------------------------------------- the silhouette
  // The floppy ears: a rounded rectangle on each side, columns 5..15, rows 6..25. They sit behind the body, so only the
  // part that hangs out past the blob's top corners shows.
  const EAR_L = sup(10, 15.5, 5.5, 10);
  const EAR_R = mirror(EAR_L);
  // The dark face mask: a rounded block over the lower face, with a patch round each eye, and a fawn notch
  // between the two patches at the top.
  const MASK_LOW = sup(CX, 27, 10, 9.5);
  const MASK_EYE_L = ell(22.5, 22, 5.2, 5);
  const MASK_EYE_R = mirror(MASK_EYE_L);
  const MASK = (x, y) => (MASK_LOW(x, y) || MASK_EYE_L(x, y) || MASK_EYE_R(x, y)) &&
    !(Math.abs(x - CX) <= 1 && y <= 19);

  // The whole dog is one shape, the penguin's wide Pou profile: head and body in a single blob, a rounded dome on top,
  // sides that swell out to half-width 23 and run almost straight down, and a flat 43 px floor on row 69.
  // Half-widths are interpolated between these points; rows outside 4..69 are not part of the body.
  const PROFILE = [[4, 7], [5, 11], [7, 15], [10, 18], [15, 20], [22, 21], [32, 22], [43, 23], [53, 23], [61, 23],
    [66, 22], [69, 21]];
  const halfW = (y) => {
    for (let i = 0; i < PROFILE.length - 1; i++) {
      const [y0, w0] = PROFILE[i], [y1, w1] = PROFILE[i + 1];
      if (y >= y0 && y <= y1) return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0);
    }
    return -1;
  };
  const BODY = (x, y) => { const w = halfW(y); return w >= 0 && Math.abs(x - CX) <= w; };
  // a small curled tail on the right, peeking out past the body edge
  const TAIL = ell(55.4, 56, 2.6, 3.2);

  // ------------------------------------------------------------- the face art
  // Square eyes, 4 px wide, black, with one white glint in the upper inner corner. The right eye is the mirror
  // image of the left one (flip() in eyeSprite).
  const EYE_ROWS = {
    open: ['oowo', 'oooo', 'oooo', 'oooo'],
    // surprised: a taller square eye, same glint
    wide: ['oowo', 'oooo', 'oooo', 'oooo', 'oooo'],
    // happy: a closed arch (^ ^)
    happy: ['.oo.', 'o..o'],
    // closed: a flat line through the eye centre (used for blinks and sleepy)
    closed: ['....', 'oooo', '....'],
    // determined: a flat lid over the eye, the glint kept
    squint: ['oooo', 'oooo', 'owoo', '.oo.'],
    // sleepy: a half-lidded eye, no glint
    sleepy: ['oooo', '.oo.'],
  };
  // sad (open eyes looking down): the glint drops to the lower half of the eye
  const WET_OPEN = ['oooo', 'oooo', 'owoo', 'oooo'];

  // The nose: a 3 x 2 black block with a glint on top, then a short line down to the mouth.
  const NOSE_ROWS = ['owo', 'ooo'];
  const NOSE_AT = { x: 29, y: 25 };
  const NOSE_LINE = [27, 28];                 // rows of the single black pixel under the nose, at CX
  const MOUTH_AT_Y = 29;
  const MOUTH_ROWS = {
    closed: ['o.o.o', '.ooo.'],                          // neutral: a small gentle smile
    smile:  ['o.ooo.o', '.o...o.'],                      // happy: the wide W smile, corners up
    grin:   ['o.ooo.o', '.oTTTo.'],                      // joy: the grin with a tiny tongue
    open:   ['.ooo.', 'oTTTo', '.ooo.'],                 // talking: an open mouth
    wide:   ['.ooooo.', 'oTTTTTo', '.ooooo.'],
    small:  ['ooo', 'oTo', 'ooo'],
    O:      ['.ooo.', 'oTTTo', 'oTTTo', '.ooo.'],        // surprised
    frown:  ['.ooo.', 'o...o'],                          // corners dip down
    flat:   ['ooooo'],
    smirk:  ['.oooo', '....o'],
    wavy:   ['o.o.o', '.o.o.'],
  };

  // Brows sit on the fawn forehead above the eyes; drawn for the viewer-left eye, the right one is the mirror image.
  const BROW_AT_Y = 14;
  const BROW_ROWS = {
    raised:  ['.oo.', 'o..o'],
    worried: ['..oo', 'oo..'],
    angry:   ['oo..', '..oo'],
    flat:    ['....', 'oooo'],
  };

  const EYES = { L: { x: 23, y: 22 }, R: { x: 37, y: 22 } };    // symmetric about CX; eyes span rows 20..23
  // on the body's side outline, so the arm root touches the fur
  const SHOULDER = { L: { x: 11, y: 42 }, R: { x: 49, y: 42 } };
  const ARM_LEN = 10;

  // gaze: one step per axis, or 0 when the look is near the middle
  const gazeStep = (v) => (Math.abs(v) < 0.35 ? 0 : Math.sign(v));
  // The whole eye shifts by one pixel to look around, which keeps the shape intact. The right eye is the mirror
  // image of the left, so its column is worked out from the left eye's centre.
  const eyeSprite = (name) => (cx, cy, look, side = -1) => {
    const wet = name === 'open' && look.y > 0.3;
    const base = wet ? WET_OPEN : EYE_ROWS[name];
    const w = base[0].length;
    const cL = side > 0 ? 2 * CX - cx : cx;                 // the left-hand eye's centre column
    const x0 = side > 0
      ? 2 * CX - (cL - Math.floor(w / 2) + w - 1) + gazeStep(look.x)
      : cL - Math.floor(w / 2) + gazeStep(look.x);
    const y0 = cy - Math.floor(base.length / 2) + gazeStep(look.y);
    return sprite(side > 0 ? flip(base) : base, x0, y0).svg();
  };
  const mouthSprite = (name) => () => {
    const rows = MOUTH_ROWS[name];
    return sprite(rows, CX - Math.floor(rows[0].length / 2), MOUTH_AT_Y).svg();
  };
  // side -1 = viewer-left; side +1 is the mirror image of the same brow about CX
  const browSprite = (rows) => (cx, side) => {
    const x0 = EYES.L.x - 2, w = rows[0].length;
    return side < 0
      ? sprite(rows, x0, BROW_AT_Y).svg()
      : sprite(flip(rows), 2 * CX - (x0 + w - 1), BROW_AT_Y).svg();
  };

  // ------------------------------------------------------------- static body
  const buildBody = () => {
    // a ground shadow under the body (the floor is at y = 70, the lowest body row is 69)
    const shadow = new Buf();
    for (let x = 7; x <= 53; x++) shadow.set(x, 70, 'shadow');
    for (let x = 11; x <= 49; x++) shadow.set(x, 71, 'shadow');

    // behind the body: the tail, brown with a darker lower half
    const tail = new Buf();
    layer(tail, TAIL, (x, y) => (y >= 58 ? 'accentS' : 'accent'), 'outline');

    // the body: fawn, ink on its edge, and light shade from the upper left: a darker underside (the two lowest fill
    // pixels of each column) and a 1-2 px crescent down the lower-right edge that thins out by row 56.
    // floor(halfW) is the outline column, so -1 is inside
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

    // the face: the dark mask and nose on the fawn blob; the ears sit behind the body
    const ears = new Buf();
    for (const ear of [EAR_L, EAR_R]) layer(ears, ear, (x, y) => (y >= 21 ? 'accentS' : 'accent'));
    const head = new Buf();
    layer(head, MASK, () => 'mask', 'maskL');
    sprite(NOSE_ROWS, NOSE_AT.x, NOSE_AT.y, head);
    for (const y of NOSE_LINE) head.set(CX, y, 'outline');

    return { shadow, tail, torso, head, ears };
  };

  const B = buildBody();

  // The tail and body sit inside the body group, so a hop, a lift or a lean moves the whole dog together (the shadow
  // stays on the ground). The ears and face are inside the body group too, drawn over the torso. The face sits in the head group.
  const SKELETON = `
    <style>${STYLE}</style>
    <g class="dog">
      ${B.shadow.svg()}
      <g data-s="body">
        <g data-s="tail">${B.tail.svg()}</g>
        ${B.torso.svg()}
        <g data-s="head">
          <g data-s="cheeks" style="display:none"></g>
          ${B.ears.svg()}
          ${B.head.svg()}
          <g data-s="eyes"></g>
          <g data-s="brows"></g>
          <g data-s="mouth"></g>
        </g>
        <g data-s="armL"></g>
        <g data-s="armR"></g>
      </g>
    </g>`;

  // -------------------------------------------------------------- arms
  // An arm is a brush swept from shoulder to wrist: outline pass first, fill pass on top, then a darker-tan paw tip.
  // a: 0 = down, 90 = out, 180 = up.
  const drawArm = (side, angle, hand) => {
    const rad = (angle * Math.PI) / 180;
    const dir = { x: (side === 'L' ? -1 : 1) * Math.sin(rad), y: Math.cos(rad) };
    const sh = SHOULDER[side];
    const len = hand === 'point' ? ARM_LEN + 2 : hand === 'fist' ? ARM_LEN - 1 : ARM_LEN;
    const wrist = { x: sh.x + dir.x * len, y: sh.y + dir.y * len };
    const buf = new Buf();
    const sweep = (r, color, a, b) => {
      const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2);
      for (let i = 0; i <= n; i++) stamp(buf, a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, r, color);
    };
    const paw = hand === 'fist' ? 2.0 : 1.8;
    sweep(2.3, 'outline', sh, wrist);
    stamp(buf, wrist.x, wrist.y, paw + 0.9, 'outline');
    sweep(1.4, 'body', sh, wrist);
    stamp(buf, wrist.x, wrist.y, paw, 'bodyS');
    return buf.svg();
  };

  // ------------------------------------------------------------ poses
  // Same pose names as every other skin. Arm angles are tuned for the arm length (ARM_LEN).
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

  // ----------------------------------------------------------- the skin
  const eyeTable = Object.fromEntries(Object.keys(EYE_ROWS).map((n) => [n, eyeSprite(n)]));
  global.CharacterSkins = global.CharacterSkins || {};
  global.CharacterSkins.dog = {
    id: 'dog',
    label: 'Dog',
    viewBox: `0 0 ${W} ${H}`,
    pixelGrid: { w: W, h: H },           // tells the runner to show it at a whole-number scale
    colors: { body: COLORS.body, belly: COLORS.belly, accent: COLORS.accent },
    colorControls: [
      { key: 'body', label: 'Fur' },
      { key: 'belly', label: 'Face mask' },
      { key: 'accent', label: 'Ears & tail' },
    ],
    applyColors(svg, c) {
      for (const [n, v] of Object.entries(derive(c))) svg.style.setProperty('--d-' + n, v);
    },
    palette: (c) => Object.values(derive(c)),
    skeleton: SKELETON,
    arms: { elbow: { x: 0, y: 0 }, single: true },
    eyeCenter: EYES,
    headPivot: { x: CX, y: 23 },
    eyes: eyeTable,
    brows: {
      neutral: () => '',
      raised: browSprite(BROW_ROWS.raised),
      worried: browSprite(BROW_ROWS.worried),
      angry: browSprite(BROW_ROWS.angry),
      skeptic: (cx, side) => (side < 0 ? browSprite(BROW_ROWS.raised)(cx, side) : browSprite(BROW_ROWS.flat)(cx, side)),
    },
    mouths: Object.fromEntries(Object.keys(MOUTH_ROWS).map((n) => [n, mouthSprite(n)])),
    hands: {},                            // paws are drawn by drawArm, with no separate hand sprites
    drawArm,
    poses,

    // Everything moves in whole pixels: no rotation, no scaling, no tilt, no sub-pixel drift.
    // The face is inside the body group, so it moves together with the body.
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
