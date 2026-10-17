/*
 * skin-frog.js - "Frog", a squat, wide green frog sitting in flat pixel art on a 61 x 76 grid.
 *
 * Built like the other pixel skins: every shape is whole pixels (Buf), emitted as crisp SVG rects.
 *   - layer() outlines a membership test in near-black ink and shades its inside
 *   - fillS() paints a patch with no outline (the belly sits inside the body)
 *   - the eyes are round cream eyeballs (one-pixel ink outline) with a big round black pupil and two white
 *     glints, set in two round green bumps that bulge up from the top corners of the head; eyes, brows and
 *     the mouth are drawn per expression
 *   - the arms are redrawn at the current angle by drawArm: a brush from shoulder to a small round hand
 *   - motion is whole pixels only: 1 px breathing, 1 px talking bob, lean and lift as whole pixels, no tilt
 *
 * Look: one squat, wide blob, with no separate head, no neck and no feet. The silhouette is a broad, flat-topped
 * head, 51 px wide at its widest (rows 42 to 62), that tapers to a flat 45 px floor on row 69 resting on a ground
 * shadow. Two big round eyes bulge up out of the top corners of the head as two round bumps. A wide smile runs
 * across the lower face on a cream throat patch, with two nostril dots between the eyes and a dark green spot on
 * each side. A peach belly fills the lower body; a darker underside and a mid-green crescent on the lower right
 * give it some roundness.
 * Recolourable roles: body (green), belly (peach), accent (mouth interior). Classes are f-<name>, variables --f-<name>.
 */
(function (global) {
  'use strict';

  const W = 61;
  const H = 76;
  const CX = 30;                              // centre column of the grid

  // Flat colours. body, belly and accent are the recolourable roles; the shades of the body are derived in derive().
  const COLORS = {
    outline: '#243622',                       // soft dark green ink: outline, pupils, brows, the smile, the ground line
    body: '#7db35f',                          // soft leaf green (recolourable)
    bodyL: '#a9d184',                         // pale green highlight: the upper-left rim, the eye bumps, toe tips
    bodyS: '#5e9447',                         // mid green shade: the underside and the lower-right crescent
    bodyD: '#487a38',                         // dark green: the patch between the eyes and the deepest shade
    cream: '#fbf3d6',                         // warm cream: the eyeballs and the face patch under the eyes
    belly: '#f1d29c',                         // soft peach-cream belly (recolourable)
    accent: '#a35a48',                        // mouth interior (recolourable)
    glint: '#ffffff',                         // eye glints
    blush: '#f0a9b4',                         // soft pink cheeks (shown on the happy faces)
  };

  // ------------------------------------------------------------ colour maths
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  // a derived shade: the body colour moved by the same amount the default shade sits from the default body colour
  const shift = (c, role) => hex(rgb(c.body).map((v, i) => v + rgb(COLORS[role])[i] - rgb(COLORS.body)[i]));

  const derive = (c) => Object.assign({}, COLORS, {
    body: c.body, bodyL: shift(c, 'bodyL'), bodyS: shift(c, 'bodyS'), bodyD: shift(c, 'bodyD'),
    belly: c.belly, accent: c.accent,
  });

  const STYLE = Object.entries(COLORS).map(([n, h]) => `.f-${n}{fill:var(--f-${n},${h})}`).join('') +
    '.f-shadow{fill:#000;fill-opacity:.2}.frog *{shape-rendering:crispEdges}';

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
        out += `<path class="f-${c}" d="${d}"/>`;
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
  // Fill a membership test with no outline (the belly sits inside the body).
  const fillS = (buf, inside, shader) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x, y)) buf.set(x, y, shader(x, y));
  };

  // sprites: rows of characters, '.' is transparent
  //   o outline   w glint   r mouth interior (accent)   c cream mouth interior   p blush
  const SPRITE_COLORS = { o: 'outline', w: 'glint', r: 'accent', c: 'cream', p: 'blush' };
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
  // The whole frog is one shape: a squat, wide body. The head is flat-topped on row 24 (25 px wide), swells out to
  // half-width 25 by row 42, holds that width to row 62 and tapers to a flat 45 px floor on row 69. Half-widths are
  // interpolated between these points. Rows above 24 are not head: only the eye bumps reach up there.
  const PROFILE = [[24, 12], [25, 17], [27, 21], [30, 23], [34, 24], [42, 25], [55, 25], [62, 25], [66, 24], [69, 22]];
  const halfW = (y) => {
    for (let i = 0; i < PROFILE.length - 1; i++) {
      const [y0, w0] = PROFILE[i], [y1, w1] = PROFILE[i + 1];
      if (y >= y0 && y <= y1) return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0);
    }
    return -1;
  };
  // The eyeballs sit in the eye bumps, centred on them. Their centres are symmetric about CX, 22 px apart.
  const EYE = { L: { x: 19, y: 17 }, R: { x: 41, y: 17 } };
  const BALL_R = 6.1;
  // The two eye bumps: round green bulges of outer radius 8 centred on the eyes, joined to the top of the head.
  const BUMP_R = 8;
  const inBump = (x, y) => ell(EYE.L.x, EYE.L.y, BUMP_R, BUMP_R)(x, y) || ell(EYE.R.x, EYE.R.y, BUMP_R, BUMP_R)(x, y);
  const BODY = (x, y) => { const w = halfW(y); return (w >= 0 && Math.abs(x - CX) <= w) || inBump(x, y); };

  // ------------------------------------------------------------- the face art
  // Eyeballs: a round cream ball with a one-pixel ink outline. The pupil is a black disc in the lower half under a
  // heavy black lid; a white glint sits on the pupil. look: pupil offset by one pixel.
  const gazeStep = (v) => (Math.abs(v) < 0.35 ? 0 : Math.sign(v));
  // a friendly eye: a big round pupil with a 2x2 glint at the upper left and a 1 px glint at the lower right
  const glints = (buf, px, py) => {
    buf.set(px - 2, py - 2, 'glint'); buf.set(px - 1, py - 2, 'glint');
    buf.set(px - 2, py - 1, 'glint'); buf.set(px - 1, py - 1, 'glint');
    buf.set(px + 1, py + 1, 'glint');
  };
  const eyeOpen = (cx, cy, look) => {
    const gx = gazeStep(look.x), gy = gazeStep(look.y);
    const px = cx + gx, py = cy + 1 + gy;
    const pupil = ell(px, py, 3.3, 3.5);
    const buf = new Buf();
    layer(buf, ell(cx, cy, BALL_R, BALL_R), (x, y) => (pupil(x, y) ? 'outline' : 'cream'));
    glints(buf, px, py);
    return buf.svg();
  };
  const eyeWide = (cx, cy, look) => {
    const gx = gazeStep(look.x), gy = gazeStep(look.y);
    const px = cx + gx, py = cy + gy;
    const pupil = ell(px, py, 2.4, 2.6);
    const buf = new Buf();
    layer(buf, ell(cx, cy, 6.7, 6.7), (x, y) => (pupil(x, y) ? 'outline' : 'cream'));
    buf.set(px - 1, py - 1, 'glint'); buf.set(px, py - 1, 'glint');
    return buf.svg();
  };
  // half-closed: a green eyelid over the top of the ball, with a thin ink line under it
  const eyeSquint = (cx, cy, look) => {
    const gx = gazeStep(look.x), gy = gazeStep(look.y);
    const px = cx + gx, py = cy + 2 + gy;
    const pupil = ell(px, py, 2.8, 2.6);
    const buf = new Buf();
    layer(buf, ell(cx, cy, BALL_R, BALL_R), (x, y) => (y <= cy - 2 ? 'body' : y === cy - 1 ? 'outline' : pupil(x, y) ? 'outline' : 'cream'));
    buf.set(px - 1, py - 1, 'glint'); buf.set(px - 2, py - 1, 'glint');
    return buf.svg();
  };
  // closed: a green lid over the eye (the ball is filled with body green), and a soft closed-eye line
  const CLOSED_LINE = [[-3, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 0]];
  const eyeClosed = (cx, cy) => {
    const buf = new Buf();
    fillS(buf, ell(cx, cy, BALL_R - 1, BALL_R - 1), () => 'body');
    for (const [dx, dy] of CLOSED_LINE) buf.set(cx + dx, cy + dy, 'outline');
    return buf.svg();
  };
  // Happy: an arch-shaped lid over the eye (an upside-down U); the ball is not drawn
  const ARCH = ['..ooooo..', '.o.....o.', 'o.......o'];
  // Blush: a small soft-pink cheek on each side (p = blush), drawn in the cheeks group
  const BLUSH = ['.ppp.', 'ppppp', '.ppp.'];

  // The mouth: a wide smile across the lower face, in ink, on the cream throat patch. Rows start at MOUTH_AT_Y.
  // Every mouth has an odd width and is centred on CX, so it stays symmetric about column 30 (smirk is the one
  // deliberate exception). The thin smile spans x 15..45. Letters: o ink, r mouth interior (accent), c cream mouth
  // interior (happy faces), p pink tongue.
  const MOUTH_AT_Y = 33;
  const MOUTH_ROWS = {
    // the default: a thin ink smile, 31 px wide, the two ends curl up 2 px
    closed: ['oo...........................oo', '..o.........................o..', '...ooooooooooooooooooooooooo...'],
    // happy: a big open smile, cream mouth interior, a small pink tongue
    smile: ['ooooooooooooooooooooooooooooooo', 'occccccccccccccccccccccccccccco', '.occccccccccccpppcccccccccccco.', '..ooooooooooooooooooooooooooo..'],
    // joy: a wide open grin, cream mouth interior, a pink tongue
    grin: ['ooooooooooooooooooooooooooooooo', 'occccccccccccccccccccccccccccco', '.occccccccccccccccccccccccccco.', '.occcccccccccpppppccccccccccco.', '..ooooooooooooooooooooooooooo..'],
    // talking: a wide open D-shape, 4 rows tall
    open: ['ooooooooooooooooooooo', 'orrrrrrrrrrrrrrrrrrro', '.orrrrrrrrrrrrrrrrro.', '..ooooooooooooooooo..'],
    // talking: the widest open mouth, 5 rows tall
    wide: ['ooooooooooooooooooooooooooo', 'orrrrrrrrrrrrrrrrrrrrrrrrro', 'orrrrrrrrrrrrrrrrrrrrrrrrro', '.orrrrrrrrrrrrrrrrrrrrrrro.', '..ooooooooooooooooooooooo..'],
    // talking: a small open mouth
    small: ['.ooooo.', 'orrrrro', '.ooooo.'],
    // surprised: a round O
    O: ['.ooo.', 'orrro', 'orrro', 'orrro', '.ooo.'],
    // sad: the corners dip down
    frown: ['...ooooooooooooooooooooooooo...', '..o.........................o..', 'oo...........................oo'],
    // a flat line
    flat: ['ooooooooooooooooooooo'],
    // one corner lifts (the one deliberately asymmetric mouth)
    smirk: ['...........................oo..', '..ooooooooooooooooooooooooo....'],
    // confused: a zigzag squiggle
    wavy: ['o.o.o.o.o.o.o.o.o.o.o.o.o.o.o.o', '.o.o.o.o.o.o.o.o.o.o.o.o.o.o.o.']
  };

  // Brows sit just above the eyeballs, drawn for the viewer-left eye; the right one is the mirror image.
  const BROW_AT_Y = 9;
  const BROW_ROWS = {
    raised:  ['.oo.', 'o..o'],
    worried: ['..oo', 'oo..'],
    angry:   ['oo..', '..oo'],
    flat:    ['....', 'oooo'],
  };

  const EYES = EYE;
  const SHOULDER = { L: { x: 8, y: 40 }, R: { x: 52, y: 40 } };   // on the body side, so the arm roots touch the body
  const ARM_LEN = 9;

  // the eye sprites: each takes the centre (cx, cy) and the gaze; the same shape serves both eyes
  const eyeTable = {
    open: (cx, cy, look) => eyeOpen(cx, cy, look),
    wide: (cx, cy, look) => eyeWide(cx, cy, look),
    squint: (cx, cy, look) => eyeSquint(cx, cy, look),
    closed: (cx, cy) => eyeClosed(cx, cy),
    happy: (cx, cy) => sprite(ARCH, cx - 4, cy - 3).svg(),
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
  // The colour patches on the blob: a small dark green spot on each side, a cream throat patch under the mouth (the
  // mouth sits on it), and a peach belly that fills the lower body down to the darker underside.
  const SPOTS = [[8, 40]];                                          // 2x2, top-left pixel; the right side mirrors it
  const THROAT = ell(CX, 41, 13, 5.5);                              // rows 36..46
  const BELLY = (x, y) => y <= 66 && ell(CX, 55, 19, 11.5)(x, y);   // rows 44..66, half-width 19

  const buildBody = () => {
    // a ground shadow under the blob (the floor is at y = 70, the lowest body row is 69)
    const shadow = new Buf();
    for (let x = 6; x <= 54; x++) shadow.set(x, 70, 'shadow');
    for (let x = 10; x <= 50; x++) shadow.set(x, 71, 'shadow');

    // the lowest body pixel of each column is its outline, so the two pixels above it are the underside
    const bottomAt = Array.from({ length: W }, (_, x) => {
      let b = -1;
      for (let y = 0; y < H; y++) if (BODY(x, y)) b = y;
      return b;
    });
    // Shade: a light rim on the top and left edges, a darker underside (the two
    // lowest fill pixels of each column) and a 1-2 px mid-green crescent down the lower-right edge that thins out by row 56.
    const bodyShade = (x, y) => {
      if (!BODY(x, y - 2) || !BODY(x - 2, y)) return 'bodyL';
      if (y >= bottomAt[x] - 2) return 'bodyS';
      const rim = y >= 59 ? 2 : y >= 56 ? 1 : 0;
      if (rim && x - CX >= Math.floor(halfW(y)) - rim) return 'bodyS';
      return 'body';
    };
    const torso = new Buf();
    layer(torso, BODY, bodyShade);
    // the cream throat patch under the mouth, then the peach belly on the lower body
    fillS(torso, THROAT, () => 'cream');
    fillS(torso, BELLY, () => 'belly');
    // two dark green spots (2x2, one per side) and two nostril dots (2 px each) between the eyes, at row 27
    for (const [sx, sy] of SPOTS) for (const x0 of [sx, 2 * CX - 1 - sx]) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) torso.set(x0 + dx, sy + dy, 'bodyD');
    for (const x of [27, 28, 32, 33]) torso.set(x, 27, 'outline');

    // the blush cheeks, shown by the cheeks group on the happy faces: beside the mouth corners, under the eyes
    const cheeks = new Buf();
    sprite(BLUSH, 10, 30, cheeks);
    sprite(flip(BLUSH), 46, 30, cheeks);

    return { torso, cheeks, shadow };
  };

  const B = buildBody();

  // The frog's body sits inside the body group, so a hop or a lift moves the whole frog together
  // (the shadow stays on the ground). The eyes, brows and mouth sit in the head group, drawn over the body.
  const SKELETON = `
    <style>${STYLE}</style>
    <g class="frog">
      ${B.shadow.svg()}
      <g data-s="body">
        ${B.torso.svg()}
        <g data-s="head">
          <g data-s="cheeks" style="display:none">${B.cheeks.svg()}</g>
          <g data-s="eyes"></g>
          <g data-s="brows"></g>
          <g data-s="mouth"></g>
        </g>
        <g data-s="armL"></g>
        <g data-s="armR"></g>
      </g>
    </g>`;

  // -------------------------------------------------------------- front arms
  // An arm is a tapered brush from shoulder to tip: an outline pass one pixel wider, then the fill pass
  // on top, with the last part of the arm in the darker shade. a: 0 = down, 90 = out, 180 = up.
  const drawArm = (side, angle, hand) => {
    const rad = (angle * Math.PI) / 180;
    const dir = { x: (side === 'L' ? -1 : 1) * Math.sin(rad), y: Math.cos(rad) };
    const sh = SHOULDER[side];
    const len = hand === 'point' ? ARM_LEN + 1 : hand === 'fist' ? ARM_LEN - 1 : ARM_LEN;
    const tip = { x: sh.x + dir.x * len, y: sh.y + dir.y * len };
    const r0 = 2.4;                           // radius at the shoulder (a 4 to 5 px wide arm with its outline)
    const r1 = hand === 'fist' ? 2.2 : 2.0;   // radius at the tip: a small round hand (a fist is blunter)
    const buf = new Buf();
    // keep every arm pixel inside the 2 px margin (columns 2..58)
    const put = buf.set.bind(buf);
    buf.set = (x, y, c) => { if (x >= 2 && x <= 58) put(x, y, c); };
    const paint = (grow, ink) => {
      const n = Math.ceil(len * 3);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        stamp(buf, sh.x + (tip.x - sh.x) * t, sh.y + (tip.y - sh.y) * t, r0 + (r1 - r0) * t + grow, ink(t));
      }
    };
    paint(1, () => 'outline');
    paint(0, (t) => (t > 0.7 ? 'bodyS' : 'body'));
    // the inner edge (toward the body) in the darker shade, so the arm separates from the green body
    const inner = side === 'L' ? 1 : -1;
    const m = Math.ceil(len * 3);
    for (let i = 0; i <= m; i++) {
      const t = i / m;
      if (t > 0.85) continue;
      const r = r0 + (r1 - r0) * t;
      buf.set(Math.round(sh.x + (tip.x - sh.x) * t + inner * (r - 1)), Math.round(sh.y + (tip.y - sh.y) * t), 'bodyS');
    }
    // a light edge along the arm's outer side (the side away from the body)
    const outer = side === 'L' ? -1 : 1;
    const n = Math.ceil(len * 3);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (t > 0.7) continue;
      const r = r0 + (r1 - r0) * t;
      buf.set(Math.round(sh.x + (tip.x - sh.x) * t + outer * (r - 1)), Math.round(sh.y + (tip.y - sh.y) * t), 'bodyL');
    }
    // three tiny toes at the end of an open or pointing hand: an outline pixel each, with a light pad past it
    if (hand !== 'fist') {
      const px = -dir.y, py = dir.x;   // a unit vector across the arm
      for (const k of [-1, 0, 1]) {
        const fx = tip.x + dir.x * 2.2 + px * k * 1.3, fy = tip.y + dir.y * 2.2 + py * k * 1.3;
        buf.set(Math.round(fx), Math.round(fy), 'outline');
        buf.set(Math.round(fx + dir.x * 1.1), Math.round(fy + dir.y * 1.1), 'bodyL');
      }
    }
    return buf.svg();
  };

  // ------------------------------------------------------------ poses
  // Same pose names as every other skin. Arm angles are tuned for the short front arms (ARM_LEN).
  const arm = (s, h = 'open') => ({ s, e: 0, h });
  const poses = {
    idle: { L: arm(22), R: arm(22) },
    wave: { L: arm(22), R: arm(135), wave: { arm: 'R', amp: 18, freq: 2.6 } },
    point_right: { L: arm(22), R: arm(85, 'point'), lean: -4 },
    point_left: { L: arm(85, 'point'), R: arm(22), lean: 4 },
    point_up: { L: arm(22), R: arm(165, 'point') },
    present: { L: arm(60), R: arm(60) },
    shrug: { L: arm(50), R: arm(50), lift: 4 },
    think: { L: arm(22), R: arm(132, 'fist'), lean: -3 },
    cheer: { L: arm(150, 'fist'), R: arm(150, 'fist'), bounce: 10 },
    hands_on_hips: { L: arm(40, 'fist'), R: arm(40, 'fist') },
  };

  // ------------------------------------------------------------ expression faces
  // Brows per side. Eyes come from eyeTable; the mouth from MOUTH_ROWS.
  const brows = {
    neutral: () => '',
    raised: browSprite(BROW_ROWS.raised),
    worried: browSprite(BROW_ROWS.worried),
    angry: browSprite(BROW_ROWS.angry),
    skeptic: (cx, side) => (side < 0 ? browSprite(BROW_ROWS.raised)(cx, side) : browSprite(BROW_ROWS.flat)(cx, side)),
  };

  // ----------------------------------------------------------- the skin
  global.CharacterSkins = global.CharacterSkins || {};
  global.CharacterSkins.frog = {
    id: 'frog',
    label: 'Frog',
    viewBox: `0 0 ${W} ${H}`,
    pixelGrid: { w: W, h: H },           // tells the runner to show it at a whole-number scale
    colors: { body: COLORS.body, belly: COLORS.belly, accent: COLORS.accent },
    colorControls: [
      { key: 'body', label: 'Body' },
      { key: 'belly', label: 'Belly' },
      { key: 'accent', label: 'Mouth' },
    ],
    applyColors(svg, c) {
      for (const [n, v] of Object.entries(derive(c))) svg.style.setProperty('--f-' + n, v);
    },
    palette: (c) => Object.values(derive(c)),
    skeleton: SKELETON,
    arms: { elbow: { x: 0, y: 0 }, single: true },
    eyeCenter: EYES,
    headPivot: { x: CX, y: EYE.L.y },
    eyes: eyeTable,
    brows,
    mouths: Object.fromEntries(Object.keys(MOUTH_ROWS).map((n) => [n, mouthSprite(n)])),
    hands: {},                            // arms are drawn by drawArm, with no separate hand sprites
    drawArm,
    poses,

    // Everything moves in whole pixels: no rotation, no scaling, no tilt, no sub-pixel drift.
    // The head group does not move on its own, so the face bobs together with the body.
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
