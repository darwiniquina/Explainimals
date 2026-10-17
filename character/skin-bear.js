/*
 * skin-bear.js - "Bear", a plump warm-brown bear drawn as retro 8/16-bit pixel art on a 61 x 76 grid.
 *
 * Structure follows the other pixel skins (copied rather than shared, so each file stands alone):
 *   - every shape is built from whole pixels (Buf) and emitted as crisp SVG rects
 *   - layer() outlines a membership test in near-black ink and shades its inside; fillS() paints a cream patch
 *     with no outline (the muzzle and belly sit inside the fur)
 *   - eyes, brows and the mouth are hand-authored text grids; gaze shifts an eye by one pixel
 *   - arms are redrawn at the current angle by drawArm: a tapered brush from shoulder to a round paw
 *   - motion is whole pixels only: 1 px breathing, 1 px talking bob, lean and lift as whole pixels, no tilt
 *
 * Look: a plump warm-brown bear drawn as one Pou-like blob, with no separate head, no neck and no feet. The blob has
 * the penguin's outline: a rounded dome on top, sides that swell out and run almost straight down, and a flat floor
 * that rests on a ground shadow. Two small round ears sit on the top corners of the dome, with cream inner ears. A
 * cream oval muzzle sits low on the face between two round dark eyes (each with a white glint), with a dark nose and
 * a small mouth on it. A large cream belly oval fills the lower body, a darker underside shades the bottom, and a
 * tiny tail nub peeks out on the right. Short arms hang at the sides. No blush.
 *
 * Recolourable roles: body (fur), belly (muzzle and belly), accent (nose). Classes are b-<name>, variables --b-<name>.
 */
(function (global) {
  'use strict';

  const W = 61;
  const H = 76;
  const CX = 30;                              // centre column of the grid

  // ------------------------------------------------------------ colour maths
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const darken = (h, amt) => hex(rgb(h).map((v) => v * (1 - amt)));
  // the highlight is the fur colour blended 12% toward white
  const lift = (h) => hex(rgb(h).map((v) => v + (255 - v) * 0.12));

  const DEFAULT = { body: '#a85d2f', belly: '#f3e3c3', accent: '#2b1b17' };

  // Flat colours. body, belly and accent are the recolourable roles; their shades are derived in derive().
  const COLORS = {
    outline: '#1a1220',                       // near-black ink: the outline, the eyes and the brows
    body: DEFAULT.body,                       // warm brown fur (recolourable)
    bodyL: lift(DEFAULT.body),                // lighter highlight on the upper-left rim
    bodyS: darken(DEFAULT.body, 0.35),        // darker shade band on the lower right
    belly: DEFAULT.belly,                     // cream muzzle and belly (recolourable)
    bellyS: darken(DEFAULT.belly, 0.13),      // the cream's shade
    accent: DEFAULT.accent,                   // dark nose (recolourable)
    glint: '#ffffff',                         // eye glints and the nose shine
  };

  const derive = (c) => Object.assign({}, COLORS, {
    body: c.body, bodyL: lift(c.body), bodyS: darken(c.body, 0.35),
    belly: c.belly, bellyS: darken(c.belly, 0.13),
    accent: c.accent,
  });

  const STYLE = Object.entries(COLORS).map(([n, h]) => `.b-${n}{fill:var(--b-${n},${h})}`).join('') +
    '.b-shadow{fill:#000;fill-opacity:.2}.bear *{shape-rendering:crispEdges}';

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
        out += `<path class="b-${c}" d="${d}"/>`;
      }
      return out;
    }
  }

  // membership tests (x, y are whole pixels)
  const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

  // Paint a membership test in one shader colour; pixels on its edge get the outline colour.
  const layer = (buf, inside, shader) => {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        buf.set(x, y, edge ? 'outline' : shader(x, y));
      }
    }
  };
  // Fill a membership test with no outline (cream patches sit inside the fur).
  const fillS = (buf, inside, shader) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x, y)) buf.set(x, y, shader(x, y));
  };
  // Fur shading for a round part: a light rim on the upper left, a dark band on the lower right.
  const furShade = (cx, cy, rx, ry) => (x, y) => {
    const s = (x - cx) / rx + (y - cy) / ry;
    return s < -0.9 ? 'bodyL' : s > 0.9 ? 'bodyS' : 'body';
  };

  // sprites: rows of characters, '.' is transparent
  //   o outline   w glint   a dark nose
  const SPRITE_COLORS = { o: 'outline', w: 'glint', a: 'accent' };
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
  // The whole bear is one shape, the penguin's wide Pou profile: a rounded dome on top, sides that swell out to
  // half-width 23 and run almost straight down, and a flat 43 px floor on row 69. Half-widths are interpolated
  // between these points; rows outside 4..69 are not part of the body.
  const PROFILE = [
    [4, 7], [5, 11], [7, 15], [10, 18],
    [15, 20], [22, 21], [32, 22],
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
  const mirror = (f) => (x, y) => f(2 * CX - x, y);   // the right side is the mirror image of the left

  // two small round ears on the top corners of the dome, behind the body: only the part outside the outline shows
  const EAR_L = ell(11, 9, 4.2, 4.2);
  const EAR_R = mirror(EAR_L);
  const EAR_IN_L = ell(10.6, 9.4, 2, 2);      // the lighter cream inner ear
  const EAR_IN_R = mirror(EAR_IN_L);
  // a tiny round tail nub on the right, peeking out past the body edge (behind the body)
  const TAIL = ell(54.6, 50, 2.8, 2.8);
  // the cream muzzle: an oval low on the face, under the eyes
  const MUZZLE = ell(CX, 30, 8, 6);
  // the cream belly oval, low on the body and well inside the outline
  const BELLY = ell(CX, 52, 15, 14);

  // ------------------------------------------------------------- the art
  // The eyes are round 5 px discs with clipped corners, each with a white glint in the upper left.
  const EYE_ROWS = {
    open: [
      '.ooo.',
      'owooo',
      'ooooo',
      'ooooo',
      '.ooo.',
    ],
    // surprised: a taller round eye, same glint
    wide: [
      '.ooo.',
      'owooo',
      'ooooo',
      'ooooo',
      'ooooo',
      '.ooo.',
    ],
    // happy: a closed arch (^ ^)
    happy: [
      '.ooo.',
      'o...o',
    ],
    // closed: a flat line through the eye centre (used for blinks)
    closed: [
      '.....',
      'ooooo',
      '.....',
    ],
    // determined: a round eye under a flat lid, so the top is level
    squint: [
      'ooooo',
      'owooo',
      'ooooo',
      '.ooo.',
    ],
    // sleepy: a half-closed disc, the lid flat across the top and no glint
    sleepy: [
      'ooooo',
      '.ooo.',
    ],
  };
  // Sad (open eyes looking down): the glint drops to the lower half of the disc.
  const WET_OPEN = [
    '.ooo.',
    'ooooo',
    'owooo',
    'ooooo',
    '.ooo.',
  ];

  // The nose sits under the eyes, on the muzzle.
  const NOSE = [
    '.aaa.',
    'aaaaa',
    '.aaa.',
  ];
  const NOSE_AT = { x: CX - 2, y: 27 };

  // The mouth hangs under the nose. Shapes are centred on CX; the smile is the U (corners up).
  const MOUTH_AT_Y = 30;
  const MOUTH_ROWS = {
    closed: ['.ooo.'],
    smile:  ['o...o', '.ooo.'],                 // corners curl up
    grin:   ['ooooo', 'o...o', '.ooo.'],         // open and happy: a hollow D
    open:   ['.ooo.', 'ooooo', '.ooo.'],
    wide:   ['ooooooo', 'ooooooo', '.ooooo.'],
    small:  ['ooo', 'ooo'],
    O:      ['.ooo.', 'o...o', 'o...o', '.ooo.'],
    frown:  ['.ooo.', 'o...o'],                  // corners dip down
    flat:   ['ooooo'],
    smirk:  ['.ooo.', '....o'],                  // lopsided, one corner up
    wavy:   ['o.o.o.o', '.o.o.o.'],              // wobbly, unsure
  };

  // Brows are drawn for the viewer-left eye; the right one is the mirror image.
  const BROW_AT_Y = 18;
  const BROW_ROWS = {
    raised:  ['.oo.', 'o..o'],
    worried: ['..oo', 'oo..'],
    angry:   ['oo..', '..oo'],
    flat:    ['....', 'oooo'],
  };

  const EYES = { L: { x: 22, y: 23 }, R: { x: 38, y: 23 } };   // symmetric about CX, on the upper face
  // on the side outline (as the penguin), so the arm root sits on the fur
  const SHOULDER = { L: { x: 11, y: 42 }, R: { x: 49, y: 42 } };
  const ARM_LEN = 10;

  // gaze: one step per axis, or 0 when the look is near the middle
  const gazeStep = (v) => (Math.abs(v) < 0.35 ? 0 : Math.sign(v));
  // The whole eye shifts by one pixel to look around, which keeps the shape intact.
  const eyeSprite = (name) => (cx, cy, look) => {
    const wet = name === 'open' && look.y > 0.3;
    const rows = wet ? WET_OPEN : EYE_ROWS[name];
    const x0 = cx - Math.floor(rows[0].length / 2) + gazeStep(look.x);
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
  const buildBear = () => {
    // a ground shadow under the body (the floor is at y = 70, the lowest body row is 69)
    const shadow = new Buf();
    for (let x = 7; x <= 53; x++) shadow.set(x, 70, 'shadow');
    for (let x = 11; x <= 49; x++) shadow.set(x, 71, 'shadow');

    // behind the body: the two ears (cream inner ear) and the tail nub
    const ears = new Buf();
    layer(ears, EAR_L, furShade(11, 9, 4.2, 4.2));
    layer(ears, EAR_R, furShade(49, 9, 4.2, 4.2));
    fillS(ears, EAR_IN_L, () => 'belly');
    fillS(ears, EAR_IN_R, () => 'belly');
    const tail = new Buf();
    layer(tail, TAIL, furShade(54.6, 50, 2.8, 2.8));

    // the body: one fur shape with ink on its edge. Light comes from the upper left: a light rim along the top-left of
    // the dome, a darker underside (the two lowest fill pixels of each column) and a 1-2 px crescent down the
    // lower-right edge that thins out by row 56. floor(halfW) is the outline column, so -1 is inside.
    const bottomAt = Array.from({ length: W }, (_, x) => {
      let b = -1;
      for (let y = 0; y < H; y++) if (BODY(x, y)) b = y;
      return b;
    });
    const shadeBody = (x, y) => {
      if (y >= bottomAt[x] - 2) return 'bodyS';
      const rim = y >= 59 ? 2 : y >= 56 ? 1 : 0;
      if (rim && x - CX >= Math.floor(halfW(y)) - rim) return 'bodyS';
      if (y <= 30 && CX - x >= Math.floor(halfW(y)) - 1) return 'bodyL';
      return 'body';
    };
    const torso = new Buf();
    layer(torso, BODY, shadeBody);
    // the cream belly oval, with a darker lower-right edge
    fillS(torso, BELLY, (x, y) => ((x - CX) / 15 + (y - 52) / 14 > 0.9 ? 'bellyS' : 'belly'));

    // the face, drawn on the fur: the cream muzzle with a darker lower-right edge, and the dark nose on it
    const face = new Buf();
    fillS(face, MUZZLE, (x, y) => ((x - CX) / 8 + (y - 30) / 6 > 0.8 ? 'bellyS' : 'belly'));
    sprite(NOSE, NOSE_AT.x, NOSE_AT.y, face);

    return { shadow, tail, ears, torso, face };
  };

  const B = buildBear();

  // The body group holds the tail and ears behind the body, then the body with its belly, then the head group: the
  // muzzle and nose, and the face slots drawn over them. The arms sit on top of the body.
  const SKELETON = `
    <style>${STYLE}</style>
    <g class="bear">
      ${B.shadow.svg()}
      <g data-s="body">
        <g data-s="tail">${B.tail.svg()}</g>
        ${B.ears.svg()}
        ${B.torso.svg()}
        <g data-s="head">
          ${B.face.svg()}
          <g data-s="cheeks" style="display:none"></g>
          <g data-s="eyes"></g>
          <g data-s="brows"></g>
          <g data-s="mouth"></g>
        </g>
        <g data-s="armL"></g>
        <g data-s="armR"></g>
      </g>
    </g>`;

  // -------------------------------------------------------------- arms
  // An arm is a tapered brush from shoulder to a round paw: an outline pass one pixel wider, then the fill pass
  // on top, with the last part of the arm in the darker fur shade. a: 0 = down, 90 = out, 180 = up.
  const drawArm = (side, angle, hand) => {
    const rad = (angle * Math.PI) / 180;
    const dir = { x: (side === 'L' ? -1 : 1) * Math.sin(rad), y: Math.cos(rad) };
    const sh = SHOULDER[side];
    const len = hand === 'point' ? ARM_LEN + 1 : ARM_LEN;
    const tip = { x: sh.x + dir.x * len, y: sh.y + dir.y * len };
    const r0 = 2.2;                           // radius at the shoulder
    const r1 = hand === 'fist' ? 2.6 : 2.3;   // radius at the paw (a fist is blunter)
    const at = (t) => [sh.x + (tip.x - sh.x) * t, sh.y + (tip.y - sh.y) * t];
    const n = Math.ceil(len * 3);
    const buf = new Buf();
    const paint = (grow, ink) => {
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const [x, y] = at(t);
        stamp(buf, x, y, r0 + (r1 - r0) * t + grow, ink(t));
      }
    };
    paint(1, () => 'outline');
    paint(0, (t) => (t > 0.75 ? 'bodyS' : 'body'));
    // a light edge along the arm's outer side (the side away from the body)
    const outer = side === 'L' ? -1 : 1;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (t > 0.7) continue;
      const r = r0 + (r1 - r0) * t;
      const [x, y] = at(t);
      buf.set(Math.round(x + outer * (r - 1)), Math.round(y), 'bodyL');
    }
    return buf.svg();
  };

  // ------------------------------------------------------------ poses
  // Same pose names as every other skin. Arm angles are tuned for the arm length (ARM_LEN).
  const arm = (s, h = 'open') => ({ s, e: 0, h });
  const poses = {
    idle: { L: arm(18), R: arm(18) },
    wave: { L: arm(18), R: arm(135), wave: { arm: 'R', amp: 18, freq: 2.6 } },
    point_right: { L: arm(18), R: arm(85, 'point'), lean: -4 },
    point_left: { L: arm(85, 'point'), R: arm(18), lean: 4 },
    point_up: { L: arm(18), R: arm(165, 'point') },
    present: { L: arm(62), R: arm(62) },
    shrug: { L: arm(48), R: arm(48), lift: 4 },
    think: { L: arm(18), R: arm(140, 'fist'), lean: -3 },
    cheer: { L: arm(150, 'fist'), R: arm(150, 'fist'), bounce: 10 },
    hands_on_hips: { L: arm(40, 'fist'), R: arm(40, 'fist') },
  };

  // ----------------------------------------------------------- the skin
  const eyeTable = Object.fromEntries(Object.keys(EYE_ROWS).map((n) => [n, eyeSprite(n)]));
  global.CharacterSkins = global.CharacterSkins || {};
  global.CharacterSkins.bear = {
    id: 'bear',
    label: 'Bear',
    viewBox: `0 0 ${W} ${H}`,
    pixelGrid: { w: W, h: H },           // tells the runner to show it at a whole-number scale
    colors: { body: COLORS.body, belly: COLORS.belly, accent: COLORS.accent },
    colorControls: [
      { key: 'body', label: 'Fur' },
      { key: 'belly', label: 'Muzzle & belly' },
      { key: 'accent', label: 'Nose' },
    ],
    applyColors(svg, c) {
      for (const [n, v] of Object.entries(derive(c))) svg.style.setProperty('--b-' + n, v);
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
    // The head is part of the body group, so the face moves with the body.
    motion({ c, t, talkT, state }) {
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
