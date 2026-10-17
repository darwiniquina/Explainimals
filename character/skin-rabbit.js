/*
 * skin-rabbit.js - "Rabbit", a tiny white bunny with soft blue outlines, flat pixel art on a 61 x 76 grid.
 *
 * Same structure as the other pixel skins (copied rather than shared, so each file stands alone):
 *   - every shape is built from whole pixels (Buf) and emitted as crisp SVG rects
 *   - layer() outlines a membership test in soft blue and shades its inside; paint() fills a patch with no outline
 *   - eyes, brows, the nose and the mouths are hand-authored text grids; gaze shifts an eye by one pixel
 *   - arms are redrawn at the current angle by drawArm: a short white brush from shoulder to a round paw
 *   - motion is whole pixels only: 1 px breathing, 1 px talking bob, lean and lift as whole pixels, no tilt
 *
 * Look: a white bunny drawn as one plump Pou-like blob, with no separate head, no neck and no feet. The blob has the
 * penguin's outline: a rounded dome on top, sides that swell out and run almost straight down, and a flat floor on
 * row 69 that rests on a ground shadow. Two tall ears rise from the top of the dome: the left one stands straight up,
 * the right one is floppy and folds over to the right. Both are white with pink insides. Two small dark eyes with a
 * white glint, pink blush under them, and a tiny red-pink nose. A round tail puff peeks out on the right side. The
 * underside of the blob is shaded deeper blue. The neutral face has only the nose; talking shows an open mouth.
 *
 * Recolourable roles: body (fur), belly (pale blue, not drawn on the blob at present), accent (inner ears and blush).
 * Classes are r-<name>, variables --r-<name>.
 */
(function (global) {
  'use strict';

  const W = 61;
  const H = 76;
  const CX = 30;                              // centre column of the grid (mirror axis: col c <-> 60 - c)

  // ------------------------------------------------------------- palette
  // One named block for every colour. body, belly and accent are the recolourable roles (see colorControls).
  const COLORS = {
    outline: '#8fb0e6',                       // soft blue ink, a touch deeper than the reference so the rabbit reads on light stages
    body: '#ffffff',                          // white fur (recolourable)
    belly: '#cddcfc',                         // pale blue (recolourable); no part of the blob is drawn in it at present
    shade: '#a9c1ee',                         // deeper blue shading: the underside and lower-right crescent of the blob, and the ground shadow
    accent: '#ff9aa5',                        // soft pink: inner ears and cheek blush (recolourable)
    nose: '#e0556a',                          // red-pink nose and mouth interior
    eye: '#1e1e2e',                           // very dark navy: eyes, brows and mouth lines
    glint: '#ffffff',                         // eye highlight
  };
  const GROUND = COLORS.shade;                // the ground shadow under the blob (fixed, not recoloured)

  // ------------------------------------------------------------ colour maths
  const derive = (c) => Object.assign({}, COLORS, { body: c.body, belly: c.belly, accent: c.accent });

  const STYLE = Object.entries(COLORS).map(([n, h]) => `.r-${n}{fill:var(--r-${n},${h})}`).join('') +
    `.r-shadow{fill:${GROUND};fill-opacity:.8}.rabbit *{shape-rendering:crispEdges}`;

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
        out += `<path class="r-${c}" d="${d}"/>`;
      }
      return out;
    }
  }

  // ------------------------------------------------------------ membership tests (x, y are whole pixels)
  const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  // an ellipse turned by deg degrees, rising to the right for a positive angle (screen y points down)
  const tilted = (cx, cy, a, b, deg) => {
    const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    return (x, y) => {
      const dx = x - cx, dy = y - cy;
      const along = dx * c - dy * s, across = dx * s + dy * c;
      return (along / a) ** 2 + (across / b) ** 2 <= 1;
    };
  };
  const rect = (x0, x1, y0, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const either = (...fs) => (x, y) => fs.some((f) => f(x, y));
  // the shape pulled in by d pixels: a pixel stays only if every pixel within d steps is inside as well
  const inset = (f, d) => (x, y) => {
    for (let dy = -d; dy <= d; dy++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= d && !f(x + dx, y + dy)) return false;
      }
    }
    return true;
  };

  // Paint a membership test: pixels on its edge get the outline colour, the rest get shader(x, y).
  const layer = (buf, inside, shader) => {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        buf.set(x, y, edge ? 'outline' : shader(x, y));
      }
    }
  };
  // Paint a membership test with no outline. shader: a colour name or a function of (x, y).
  const paint = (buf, inside, shader) => {
    const f = typeof shader === 'function' ? shader : () => shader;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x, y)) buf.set(x, y, f(x, y));
  };

  // sprites: rows of characters, a dot is transparent
  //   o eye navy (eyes, brows, mouth lines)   w glint   n nose   p pink (blush)
  const SPRITE_COLORS = { o: 'eye', w: 'glint', n: 'nose', p: 'accent' };
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
  // The whole rabbit is one shape: the penguin's wide Pou profile, with no separate head, neck or feet. A rounded dome
  // on top, sides that swell out to half-width 23 and run almost straight down, and a flat floor on row 69 that rests
  // on the ground shadow. Half-widths are interpolated between these points; rows outside 13..69 are not body.
  const PROFILE = [
    [13, 7], [14, 11], [16, 15], [18, 18],
    [22, 20], [27, 21], [35, 22],
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

  // The upright left ear: a tall oval standing on the dome. Its lower part sinks into the blob, and the blob's outline
  // covers the join. Its top is row 2, the highest the grid allows.
  const EAR_L = ell(22, 10.5, 3.8, 8.5);
  // The floppy right ear: an upright oval whose top folds over to the right, so its tip hangs past the dome's edge.
  const EAR_R_STEM = ell(38, 11, 3.6, 7.5);
  const EAR_R = (x, y) => EAR_R_STEM(x, y) || tilted(42, 4.5, 5.5, 2.8, -35)(x, y);
  // pink inner ears: the part of each ear that shows above the dome
  const PINK_L = (x, y) => inset(EAR_L, 1)(x, y) && x >= 20 && x <= 24 && y >= 4 && y <= 14;
  const PINK_R = (x, y) => inset(EAR_R_STEM, 1)(x, y) && x >= 36 && x <= 40 && y >= 6 && y <= 14;
  // a round fluffy tail puff on the right side, peeking out past the blob's edge
  const TAIL = ell(54.5, 57, 3.6, 3.6);

  // ------------------------------------------------------------- the face art
  // Eyes: two dark vertical bars, 2 px wide and 4 px tall, with a white glint on the upper left. The right eye
  // is its mirror image. The eye centres sit on the upper face, symmetric about CX.
  const EYE_ROWS = {
    open: ['wo', 'oo', 'oo', 'oo'],
    // surprised: a taller bar, same glint
    wide: ['wo', 'oo', 'oo', 'oo', 'oo'],
    // happy: a closed arch (^ ^)
    happy: ['.o.', 'o.o'],
    // closed: a flat line through the eye centre (used for blinks)
    closed: ['..', 'oo', '..'],
    // determined: a short bar under a flat lid, glint kept
    squint: ['oo', 'wo', 'oo'],
    // sleepy: a half-lidded bar, the lid flat across the top and no glint
    sleepy: ['oo', '.o'],
  };
  // sad (open eyes looking down): the glint drops to the lower half of the bar
  const WET_OPEN = ['oo', 'oo', 'wo', 'oo'];

  // The mouth area starts at MOUTH_AT_Y and is centred on CX. The neutral face has only the nose (closed).
  const MOUTH_AT_Y = 34;
  const MOUTH_ROWS = {
    closed: ['nnn'],                                       // the tiny nose
    smile:  ['o...o', '.nnn.'],                            // corners curl up
    grin:   ['ooooo', 'onnno', '.ooo.'],                   // open happy mouth
    open:   ['.ooo.', 'onnno', '.ooo.'],                   // talking: a small open mouth
    wide:   ['.ooooo.', 'onnnnno', '.ooooo.'],
    small:  ['ooo', 'ono', 'ooo'],
    O:      ['.ooo.', 'onnno', 'onnno', '.ooo.'],
    frown:  ['.ooo.', 'o...o'],                            // corners dip down
    flat:   ['ooooo'],
    smirk:  ['ooooo', '....o'],                            // one end lifts
    wavy:   ['o.o.o', '.o.o.'],
  };

  // Brows are thin navy lines, drawn for the viewer-left eye; the right one is the mirror image.
  const BROW_AT_Y = 23;
  const BROW_ROWS = {
    raised:  ['.oo.', 'o..o'],
    worried: ['..oo', 'oo..'],
    angry:   ['oo..', '..oo'],
    flat:    ['....', 'oooo'],
  };

  const EYES = { L: { x: 23, y: 28 }, R: { x: 37, y: 28 } };   // symmetric about CX (23 + 37 = 60)
  const SHOULDER = { L: { x: 11, y: 42 }, R: { x: 49, y: 42 } }; // on the blob's side outline, where the arm root meets it
  const ARM_LEN = 10;

  // Set by motion() once per frame, before the face is drawn: the happy expression shows arch eyes.
  const live = { arch: false };

  // gaze: one step per axis, or 0 when the look is near the middle
  const gazeStep = (v) => (Math.abs(v) < 0.35 ? 0 : Math.sign(v));
  // The whole eye shifts by one pixel to look around, which keeps the shape intact. The right eye is the
  // mirror of the left one about CX, so an odd or even width both stay symmetric.
  const eyeSprite = (name) => (cx, cy, look, side = -1) => {
    let rows = EYE_ROWS[name];
    if (name === 'open' && live.arch) rows = EYE_ROWS.happy;
    else if (name === 'open' && look.y > 0.3) rows = WET_OPEN;
    const w = rows[0].length;
    const base = side > 0 ? cx - Math.ceil(w / 2) + 1 : cx - Math.floor(w / 2);
    if (side > 0) rows = flip(rows);
    const x0 = base + gazeStep(look.x);
    const y0 = cy - Math.floor(rows.length / 2) + gazeStep(look.y);
    return sprite(rows, x0, y0).svg();
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
  // Pink blush under each eye, on the outer side (the right pad is the mirror image). It sits in the head group.
  const buildCheeks = () => {
    const buf = new Buf();
    sprite(['pppp', 'pppp'], 18, 32, buf);
    sprite(['pppp', 'pppp'], 39, 32, buf);
    return buf;
  };

  const buildBody = () => {
    // a ground shadow under the blob: the floor is row 69, the shadow sits on rows 70-71
    const shadow = new Buf();
    for (let x = 7; x <= 53; x++) shadow.set(x, 70, 'shadow');
    for (let x = 11; x <= 49; x++) shadow.set(x, 71, 'shadow');

    // behind the blob: the two ears and the tail puff. The blob's outline covers where they join it.
    const ears = new Buf();
    layer(ears, EAR_L, (x, y) => (PINK_L(x, y) ? 'accent' : 'body'));
    layer(ears, EAR_R, (x, y) => (PINK_R(x, y) ? 'accent' : 'body'));
    const tail = new Buf();
    layer(tail, TAIL, () => 'body');

    // the blob: white fur with ink on its edge, and a darker underside. The underside is the two lowest fill pixels of
    // each column, plus a 1-2 px crescent down the lower-right edge that thins out by row 56.
    // floor(halfW) is the outline column, so -1 is inside
    const bottomAt = Array.from({ length: W }, (_, x) => {
      let b = -1;
      for (let y = 0; y < H; y++) if (BODY(x, y)) b = y;
      return b;
    });
    const shaded = (x, y) => {
      if (y >= bottomAt[x] - 2) return 'shade';
      const rim = y >= 59 ? 2 : y >= 56 ? 1 : 0;
      if (rim && x - CX >= Math.floor(halfW(y)) - rim) return 'shade';
      return 'body';
    };
    const torso = new Buf();
    layer(torso, BODY, shaded);

    return { shadow, ears, tail, torso };
  };

  const B = buildBody();
  const CHEEKS = buildCheeks();

  // The body group moves the blob, ears, tail and arms together (the ground shadow stays put). The face sits in the
  // head group, drawn over the blob, with the cheeks under the eyes.
  const SKELETON = `
    <style>${STYLE}</style>
    <g class="rabbit">
      ${B.shadow.svg()}
      <g data-s="body">
        <g data-s="tail">${B.tail.svg()}</g>
        ${B.ears.svg()}
        ${B.torso.svg()}
        <g data-s="head">
          <g data-s="cheeks" style="display:none"></g>
          ${CHEEKS.svg()}
          <g data-s="eyes"></g>
          <g data-s="brows"></g>
          <g data-s="mouth"></g>
        </g>
        <g data-s="armL"></g>
        <g data-s="armR"></g>
      </g>
    </g>`;

  // -------------------------------------------------------------- arms
  // A small white arm: an outline pass one pixel wider, then the white fill, then a round paw.
  // a: 0 = down, 90 = out, 180 = up.
  const drawArm = (side, angle, hand) => {
    const rad = (angle * Math.PI) / 180;
    const dir = { x: (side === 'L' ? -1 : 1) * Math.sin(rad), y: Math.cos(rad) };
    const sh = SHOULDER[side];
    const wanted = hand === 'point' ? ARM_LEN + 2 : hand === 'fist' ? ARM_LEN - 1 : ARM_LEN;
    // cut the arm short when it points out sideways, so the paw stays inside columns 2..58
    const room = side === 'L' ? sh.x - 5 : W - 6 - sh.x;
    const len = Math.abs(dir.x) > 0.01 ? Math.min(wanted, room / Math.abs(dir.x)) : wanted;
    const tip = { x: sh.x + dir.x * len, y: sh.y + dir.y * len };
    const r0 = 1.5;                           // radius at the shoulder
    const r1 = 1.3;                           // radius at the wrist
    const paw = hand === 'fist' ? 2.0 : 1.7;  // radius of the round paw
    const buf = new Buf();
    const n = Math.ceil(len * 3);
    const at = (i) => {
      const t = i / n;
      return { x: sh.x + (tip.x - sh.x) * t, y: sh.y + (tip.y - sh.y) * t, r: r0 + (r1 - r0) * t };
    };
    for (let i = 0; i <= n; i++) { const p = at(i); stamp(buf, p.x, p.y, p.r + 1, 'outline'); }
    stamp(buf, tip.x, tip.y, paw + 1, 'outline');
    for (let i = 0; i <= n; i++) { const p = at(i); stamp(buf, p.x, p.y, p.r, 'body'); }
    stamp(buf, tip.x, tip.y, paw, 'body');
    return buf.svg();
  };

  // ------------------------------------------------------------ poses
  // Same pose names as every other skin. Arm angles are tuned for ARM_LEN.
  const arm = (s, h = 'open') => ({ s, e: 0, h });
  const poses = {
    idle: { L: arm(16), R: arm(16) },
    wave: { L: arm(16), R: arm(135), wave: { arm: 'R', amp: 18, freq: 2.6 } },
    point_right: { L: arm(16), R: arm(85, 'point'), lean: -4 },
    point_left: { L: arm(85, 'point'), R: arm(16), lean: 4 },
    point_up: { L: arm(16), R: arm(165, 'point') },
    present: { L: arm(62), R: arm(62) },
    shrug: { L: arm(48), R: arm(48), lift: 4 },
    think: { L: arm(16), R: arm(150, 'fist'), lean: -3 },
    cheer: { L: arm(150, 'fist'), R: arm(150, 'fist'), bounce: 6 },
    hands_on_hips: { L: arm(50, 'fist'), R: arm(50, 'fist') },
  };

  // ----------------------------------------------------------- the skin
  const eyeTable = Object.fromEntries(Object.keys(EYE_ROWS).map((n) => [n, eyeSprite(n)]));
  global.CharacterSkins = global.CharacterSkins || {};
  global.CharacterSkins.rabbit = {
    id: 'rabbit',
    label: 'Rabbit',
    viewBox: `0 0 ${W} ${H}`,
    pixelGrid: { w: W, h: H },           // tells the runner to show it at a whole-number scale
    colors: { body: COLORS.body, belly: COLORS.belly, accent: COLORS.accent },
    colorControls: [
      { key: 'body', label: 'Fur' },
      { key: 'belly', label: 'Blue shading' },
      { key: 'accent', label: 'Ears & blush' },
    ],
    applyColors(svg, c) {
      for (const [n, v] of Object.entries(derive(c))) svg.style.setProperty('--r-' + n, v);
    },
    palette: (c) => Object.values(derive(c)),
    skeleton: SKELETON,
    arms: { elbow: { x: 0, y: 0 }, single: true },
    eyeCenter: EYES,
    headPivot: { x: CX, y: 28 },
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
    // At rest the floor of the blob sits on row 69, so a breath, a hop or a talk bob lifts the whole rabbit off the ground line.
    motion({ c, t, talkT, state }) {
      live.arch = state.expression === 'happy' && !state.override.eyes;
      const inhale = state.idle && Math.sin(t * 2.1) > 0.35 ? -1 : 0;
      const hop = c.bounce ? Math.round(Math.abs(Math.sin(t * 5)) * c.bounce * 0.4) : 0;
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
