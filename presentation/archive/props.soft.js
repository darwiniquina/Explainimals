/*
 * props.js - the prop icon library: 18 small pixel icons (16..40 px) that sit next to a character
 * and explain a concept. Everything is whole pixels drawn into Pres.Buf; no rotation, no scaling.
 * Animated props draw(buf, t) deterministically from t (seconds). See presentation/CONTRACT.md.
 */
(function (global) {
  'use strict';

  const Pres = (global.Pres = global.Pres || {});
  const Buf = Pres.Buf;

  // ------------------------------------------------------------------ helpers

  // Paint a silhouette with a 1px outline in colour ol. fill(b) draws the shape (body colour) into a
  // scratch Buf; the outline goes on the empty pixels around it. Returns the silhouette without the
  // outline, so shading can be clipped to it with clip().
  function part(buf, ol, fill) {
    const sil = new Buf();
    fill(sil);
    const o = sil.clone();
    o.outline(ol);
    buf.blit(o);
    return sil;
  }

  // Fill a rectangle, but only where the silhouette mask has pixels (keeps shading inside the shape).
  function clip(buf, mask, x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (mask.has(x + i, y + j)) buf.set(x + i, y + j, c);
    return buf;
  }

  // Fill a polygon (even-odd scanline, pixel centres) into buffer b.
  function poly(b, pts, c) {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) * (bx - ax)) / (by - ay));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x + 0.5 <= xs[k + 1]; x++) b.set(x, y, c);
      }
    }
    return b;
  }

  // the tiny cute face used on several props: two dot eyes, blush, a smile (7 x 3)
  const FACE = ['.k...k.', 'p.....p', '..kkk..'];
  const FACE_MAP = { k: '#3d2b4a', p: '#ff9fb8' };
  const face = (buf, x, y) => buf.sprite(FACE, FACE_MAP, x, y);

  // ------------------------------------------------------------------ laptop (static)
  Pres.registerProp('laptop', {
    label: 'Laptop', w: 36, h: 28,
    draw(buf) {
      const OL = '#4a5599', LID = '#cfd6ff', LIDS = '#aeb8ee', SCR = '#b8f2ff', SCRS = '#8fdcf2';
      const BASE = '#e3e7ff', KEY = '#8c97d6';
      part(buf, OL, (b) => b.rrect(4, 1, 28, 19, 3, LID));          // lid
      buf.rect(5, 18, 26, 1, LIDS);                                 // lid chin shade
      buf.rect(7, 4, 22, 11, SCR);                                  // screen
      buf.rect(7, 13, 22, 2, SCRS);                                 // lower screen band
      buf.set(8, 5, '#ffffff').set(9, 5, '#ffffff').set(8, 6, '#ffffff');   // gloss
      face(buf, 14, 7);
      part(buf, OL, (b) => b.rrect(1, 21, 34, 6, 2, BASE));         // keyboard base
      buf.rect(15, 21, 6, 1, LIDS);                                 // hinge notch
      for (let x = 4; x <= 31; x += 3) buf.set(x, 23, KEY);         // key dots
      buf.rect(13, 25, 10, 1, KEY);                                 // space bar
    },
  });

  // ------------------------------------------------------------------ server (animated)
  Pres.registerProp('server', {
    label: 'Server', w: 28, h: 36, animated: true,
    draw(buf, t) {
      const OL = '#2f7a64', BODY = '#bdf0dc', UNIT = '#eefff8', UNITS = '#8fd9bd';
      const ON = '#4fe08a', OFF = '#b9efd2';
      part(buf, OL, (b) => b.rrect(1, 1, 26, 34, 3, BODY));         // rack cabinet
      const f = Math.floor(t * 4) % 3;                              // LED chase, 3 frames
      for (let i = 0; i < 3; i++) {
        const y = 4 + i * 10;
        buf.rrect(4, y, 20, 7, 1, UNIT);                            // rack unit
        buf.rect(5, y + 6, 18, 1, UNITS);                           // unit bottom shade
        buf.rect(6, y + 2, 8, 1, UNITS);                            // vent slots
        buf.rect(6, y + 4, 8, 1, UNITS);
        for (let k = 0; k < 3; k++) buf.set(17 + k * 2, y + 3, (k === (f + i) % 3) ? ON : OFF);
      }
      buf.set(3, 2, '#ffffff');                                     // gloss
    },
  });

  // ------------------------------------------------------------------ cloud (static)
  Pres.registerProp('cloud', {
    label: 'Cloud', w: 36, h: 22,
    draw(buf) {
      const OL = '#5f86c2', CLOUD = '#f0f8ff', SHADE = '#c9e2fb';
      const sil = part(buf, OL, (b) => {
        b.ellipse(9.5, 13, 8.5, 6.5, CLOUD);                       // left puff
        b.ellipse(19, 9.5, 9, 8.5, CLOUD);                         // top puff
        b.ellipse(27.5, 13, 7, 6.5, CLOUD);                        // right puff
        b.rrect(2, 12, 33, 9, 4, CLOUD);                           // flat base
      });
      clip(buf, sil, 2, 18, 33, 3, SHADE);                         // underside shade
      buf.set(12, 4, '#ffffff').set(13, 4, '#ffffff').set(11, 5, '#ffffff').set(12, 5, '#ffffff');
      face(buf, 16, 13);
    },
  });

  // ------------------------------------------------------------------ globe (animated)
  // Ocean sphere; the continents scroll sideways 1 px per step and wrap around the sphere.
  const LAND = [[5, 7, 3.5, 4], [7, 16, 2.5, 4.5], [13, 22, 3, 2], [18, 7, 3.5, 2.5], [20, 17, 3, 3.5], [25, 23, 3, 2], [26, 9, 2, 3]];
  const PERIOD = 30;
  Pres.registerProp('globe', {
    label: 'Globe', w: 30, h: 30, animated: true,
    draw(buf, t) {
      const OL = '#2f6fb0', OCEAN = '#9fdcff', OCEAN_S = '#7cc6f5', LANDC = '#9be7a4', LAND_S = '#5fbf78';
      const sil = part(buf, OL, (b) => b.ellipse(14.5, 14.5, 14, 14, OCEAN));
      const step = Math.floor(t * 3) % PERIOD;
      const isLand = (u, v) => LAND.some(([cx, cy, rx, ry]) => {
        for (const d of [-PERIOD, 0, PERIOD]) {
          const du = u - cx - d;
          if ((du / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1) return true;
        }
        return false;
      });
      for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) {
        if (!sil.has(x, y)) continue;
        const u = (((x + step) % PERIOD) + PERIOD) % PERIOD;
        if (isLand(u, y)) buf.set(x, y, x + y > 33 ? LAND_S : LANDC);
        else if (x + y > 36) buf.set(x, y, OCEAN_S);
      }
      buf.set(7, 5, '#ffffff').set(6, 6, '#ffffff').set(8, 5, '#ffffff');   // gloss
    },
  });

  // ------------------------------------------------------------------ lightbulb (animated)
  Pres.registerProp('lightbulb', {
    label: 'Idea', w: 22, h: 31, animated: true,
    draw(buf, t) {
      const OL = '#c99a2e', GLASS = '#fff3b0', GLASS_S = '#ffe27a', RAY = '#ffc542';
      const f = Math.floor(t * 4) % 3;                              // rays pulse out and in
      const glass = f === 1 ? '#fff9d6' : GLASS;
      const sil = part(buf, OL, (b) => b.ellipse(10.5, 12, 9.5, 9.5, glass));
      for (let y = 0; y < 32; y++) for (let x = 0; x < 22; x++) {  // lower-right crescent shade
        if (sil.has(x, y) && x + y > 28) buf.set(x, y, GLASS_S);
      }
      buf.set(6, 6, '#ffffff').set(5, 7, '#ffffff');               // gloss
      face(buf, 7, 11);
      part(buf, '#5d6b93', (b) => b.rrect(7, 19, 8, 5, 1, '#c7d0e8')); // metal collar
      part(buf, '#5d6b93', (b) => b.rrect(7, 24, 8, 6, 2, '#9aa6c9')); // screw base
      // rays are short 2 px dashes that move out and back in as the glow pulses
      const RAYS = [
        [[3, 0, 4, 1], [17, 0, 18, 1], [10, 0, 11, 0]],
        [[0, 5, 0, 6], [21, 5, 21, 6], [1, 1, 2, 2], [19, 1, 20, 2]],
        [[5, 1, 6, 1], [15, 1, 16, 1]],
      ];
      RAYS[f].forEach(([x0, y0, x1, y1]) => buf.line(x0, y0, x1, y1, RAY));
    },
  });

  // ------------------------------------------------------------------ magnifier (static)
  Pres.registerProp('magnifier', {
    label: 'Search', w: 28, h: 28,
    draw(buf) {
      const OL = '#3d6b8f', GLASS = '#d4f1ff', GLASS_S = '#a9dcf5';
      const HANDLE = '#f2b48c', HANDLE_OL = '#9c5a3c';
      part(buf, HANDLE_OL, (b) => { for (let k = 0; k < 7; k++) b.rect(18 + k, 18 + k, 3, 3, HANDLE); });
      const sil = part(buf, OL, (b) => b.ellipse(10.5, 10.5, 9.5, 9.5, GLASS));
      for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
        if (sil.has(x, y) && x + y > 24) buf.set(x, y, GLASS_S);   // lower-right rim shade
      }
      buf.set(6, 6, '#ffffff').set(5, 7, '#ffffff').set(6, 5, '#ffffff').set(7, 5, '#ffffff');  // glare
    },
  });

  // ------------------------------------------------------------------ lock (static)
  Pres.registerProp('lock', {
    label: 'Secure', w: 22, h: 28,
    draw(buf) {
      const OL = '#b5762a', BODY = '#ffd98a', BODY_S = '#ffc46b', SHACKLE = '#cfd8ee', SHACKLE_OL = '#56648f';
      part(buf, SHACKLE_OL, (b) => {                               // shackle: an arch with a hole
        b.rrect(5, 1, 12, 13, 5, SHACKLE);
        for (let y = 4; y < 14; y++) for (let x = 8; x < 14; x++) b.erase(x, y);
      });
      const sil = part(buf, OL, (b) => b.rrect(1, 11, 20, 16, 3, BODY));
      clip(buf, sil, 17, 11, 4, 16, BODY_S);                       // right side shade
      clip(buf, sil, 1, 24, 20, 3, BODY_S);                        // bottom shade
      buf.set(4, 13, '#ffffff').set(4, 14, '#ffffff').set(5, 13, '#ffffff');
      const KEY = '#8a5a1e';
      buf.ellipse(10.5, 17, 1.6, 1.6, KEY);                        // keyhole
      buf.rect(10, 18, 2, 4, KEY);
    },
  });

  // ------------------------------------------------------------------ gear (animated)
  // Three hand-placed tooth layouts (teeth centres on a 28 px grid), picked by t: no rotation.
  const GEAR_TEETH = [
    [[14, 4], [21, 7], [24, 14], [21, 21], [14, 24], [7, 21], [4, 14], [7, 7]],
    [[23, 18], [18, 23], [10, 23], [5, 18], [5, 10], [10, 5], [18, 5], [23, 10]],
    [[24, 16], [20, 22], [12, 24], [6, 20], [4, 12], [8, 6], [16, 4], [22, 9]],
  ];
  Pres.registerProp('gear', {
    label: 'Settings', w: 25, h: 25, animated: true,
    draw(buf, t) {
      const OL = '#3f5590', BODY = '#c7d4f5', BODY_S = '#a9b9e6', HUB = '#eef3ff', INK = '#3d2b4a';
      const f = Math.floor(t * 3) % 3;
      // drawn around (14, 14) on a scratch buffer, then shifted by (-2, -2) to sit in 0..24
      const g = new Buf();
      const sil = part(g, OL, (b) => {
        b.ellipse(14, 14, 8, 8, BODY);
        for (const [x, y] of GEAR_TEETH[f]) b.rect(x - 1, y - 1, 3, 3, BODY);
      });
      for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
        if (sil.has(x, y) && x + y > 30) g.set(x, y, BODY_S);
      }
      g.set(9, 9, '#ffffff').set(10, 8, '#ffffff');                // gloss
      g.ellipse(14, 14, 4, 4, OL);                                 // hub ring
      g.ellipse(14, 14, 3, 3, HUB);
      g.set(12, 13, INK).set(16, 13, INK);                         // hub face
      g.set(13, 15, INK).set(14, 15, INK).set(15, 15, INK);
      buf.blit(g, -2, -2);
    },
  });

  // ------------------------------------------------------------------ envelope (animated)
  const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  Pres.registerProp('envelope', {
    label: 'Mail', w: 30, h: 22, animated: true,
    draw(buf, t) {
      const OL = '#c06a86', ENV = '#fff2f6', FLAP = '#ffd9e4', SPARK = '#ffe066';
      part(buf, OL, (b) => b.rrect(1, 4, 28, 17, 3, ENV));          // envelope
      poly(buf, [[2, 5], [27, 5], [14.5, 13]], FLAP);              // flap
      buf.line(2, 5, 14, 13, OL).line(27, 5, 15, 13, OL);           // flap edges
      buf.line(2, 19, 11, 12, '#f2b4c8').line(27, 19, 18, 12, '#f2b4c8'); // bottom folds
      buf.sprite(HEART, { '#': '#ff6f91' }, 11, 9);                // heart seal
      buf.set(12, 10, '#ffd0dc');                                  // seal gloss
      const f = Math.floor(t * 4) % 3;                             // sparkle flickers
      if (f === 0) {
        buf.set(25, 0, SPARK).set(24, 1, SPARK).set(25, 1, SPARK).set(26, 1, SPARK).set(25, 2, SPARK);
      } else if (f === 1) {
        buf.set(3, 1, SPARK).set(2, 0, SPARK);
      } else {
        buf.set(14, 0, SPARK);
      }
    },
  });

  // ------------------------------------------------------------------ chart (static)
  Pres.registerProp('chart', {
    label: 'Growth', w: 32, h: 28,
    draw(buf) {
      const OL = '#3b6a8f', PANEL = '#eef9ff', GRID = '#dfeefa', AXIS = '#8fb3d6';
      part(buf, OL, (b) => b.rrect(1, 1, 30, 26, 3, PANEL));       // panel
      for (let x = 3; x < 29; x += 4) buf.set(x, 9, GRID);          // faint grid dots
      const bars = [[5, 6, '#ffb3c6'], [11, 10, '#ffd98a'], [17, 8, '#a8e6cf'], [23, 13, '#b9b6ff']];
      for (const [x, h, c] of bars) {
        buf.rect(x, 22 - h, 4, h, c);
        buf.rect(x + 3, 22 - h, 1, h, '#8f7fb0');                     // right-edge shade
      }
      buf.rect(4, 22, 24, 1, AXIS);                                 // baseline
      const ARROW = '#ff6b8a';
      buf.line(6, 19, 23, 8, ARROW).line(6, 18, 22, 8, ARROW);      // thick rising trend
      buf.line(19, 6, 25, 6, ARROW).line(25, 6, 25, 12, ARROW);     // arrowhead
      buf.line(19, 7, 24, 7, ARROW);
    },
  });

  // ------------------------------------------------------------------ check (static)
  Pres.registerProp('check', {
    label: 'Done', w: 24, h: 24,
    draw(buf) {
      const OL = '#2e9a55', GREEN = '#8ee6a0', GREEN_S = '#5fcf85';
      const sil = part(buf, OL, (b) => b.ellipse(11.5, 11.5, 10.5, 10.5, GREEN));
      for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
        if (sil.has(x, y) && x + y > 36) buf.set(x, y, GREEN_S);
      }
      buf.set(6, 6, '#ffffff').set(7, 5, '#ffffff');                // gloss
      // a 3 px thick stroke: the centre line plus one pixel right and one pixel down
      const seg = (x0, y0, x1, y1, c, dx, dy) => buf.line(x0 + dx, y0 + dy, x1 + dx, y1 + dy, c)
        .line(x0 + dx + 1, y0 + dy, x1 + dx + 1, y1 + dy, c).line(x0 + dx, y0 + dy + 1, x1 + dx, y1 + dy + 1, c);
      seg(6, 12, 9, 15, '#2e9a55', 1, 1); seg(9, 15, 17, 7, '#2e9a55', 1, 1);     // check shadow
      seg(6, 12, 9, 15, '#ffffff', 0, 0); seg(9, 15, 17, 7, '#ffffff', 0, 0);     // check
    },
  });

  // ------------------------------------------------------------------ question (animated bob)
  const QMARK = ['.#####.', '##...##', '.....##', '....##.', '...##..', '..##...', '..##...', '.......', '..##...', '..##...'];
  Pres.registerProp('question', {
    label: 'Question', w: 22, h: 28, animated: true,
    draw(buf, t) {
      const OL = '#c28a1e', BUB = '#fff1b8', BUB_S = '#ffe38a', INK = '#b8601c';
      const dy = Math.floor(t * 2) % 2;                            // bobs 1 px
      const sil = part(buf, OL, (b) => {
        b.rrect(1, 1 + dy, 20, 20, 7, BUB);
        poly(b, [[2, 17 + dy], [5, 27.5], [12, 17 + dy]], BUB);   // tail
      });
      for (let y = 0; y < 28; y++) for (let x = 0; x < 22; x++) {
        if (sil.has(x, y) && x + y > 30) buf.set(x, y, BUB_S);
      }
      buf.set(4, 4 + dy, '#ffffff').set(5, 3 + dy, '#ffffff');       // gloss
      buf.sprite(QMARK, { '#': INK }, 7, 5 + dy);
    },
  });

  // ------------------------------------------------------------------ folder (static)
  Pres.registerProp('folder', {
    label: 'Files', w: 30, h: 24,
    draw(buf) {
      const OL = '#b8832a', FOLD = '#ffc86b', FRONT = '#ffe2a0', FRONT_S = '#ffd27a';
      part(buf, OL, (b) => { b.rrect(1, 1, 12, 7, 2, FOLD); b.rrect(1, 4, 28, 19, 3, FOLD); });
      part(buf, '#b9a27a', (b) => b.rect(6, 4, 20, 6, '#fffdf5')); // paper peeking out
      const sil = part(buf, OL, (b) => b.rrect(1, 8, 28, 15, 3, FRONT));
      clip(buf, sil, 2, 20, 26, 3, FRONT_S);                       // lower shade
      buf.set(4, 10, '#ffffff').set(5, 10, '#ffffff').set(4, 11, '#ffffff');
    },
  });

  // ------------------------------------------------------------------ wifi (animated)
  // Three arcs and a dot. Each step lights one more arc (dot, arc 1, arc 2, arc 3).
  const ARCS = [[6, 9.5], [12, 15.5], [18, 21]];
  Pres.registerProp('wifi', {
    label: 'Wi-Fi', w: 26, h: 23, animated: true,
    draw(buf, t) {
      const ON = '#5ccfff', ON_E = '#2a8fd6', OFF = '#d7dcf2', OFF_E = '#c0c8e6';
      const lit = Math.floor(t * 3) % 4;                           // 0..3 arcs on
      const cx = 12.5, cy = 20.5;
      for (let y = 0; y < 23; y++) for (let x = 0; x < 26; x++) {
        const dx = x - cx, dy = y - cy;
        if (dy > -2) continue;                                     // arcs sit above the dot
        if (Math.abs(dx) > -dy * 0.8) continue;                    // about +-40 degree fan
        const r = Math.sqrt(dx * dx + dy * dy);
        ARCS.forEach(([r0, r1], i) => {
          if (r < r0 || r >= r1) return;
          const on = i < lit;
          const edge = r >= r1 - 1;                                // darker outer edge
          buf.set(x, y, on ? (edge ? ON_E : ON) : (edge ? OFF_E : OFF));
        });
      }
      for (let y = 19; y < 23; y++) for (let x = 10; x <= 14; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= 6.5) buf.set(x, y, lit > 0 ? ON_E : OFF_E);
      }
    },
  });

  // ------------------------------------------------------------------ database (static)
  Pres.registerProp('database', {
    label: 'Data', w: 24, h: 30,
    draw(buf) {
      const OL = '#2a7fa6', BODY = '#a6ecff', TOP = '#d6f8ff', BAND = '#6fcfee';
      const inEll = (x, y, cx, cy, rx, ry) => ((x - cx) / (rx + 0.35)) ** 2 + ((y - cy) / (ry + 0.35)) ** 2 <= 1;
      const sil = part(buf, OL, (b) => {
        b.ellipse(11.5, 5.5, 10.5, 4.5, BODY);                     // top disc
        b.rect(1, 5, 22, 19, BODY);                                 // body
        b.ellipse(11.5, 23.5, 10.5, 4.5, BODY);                     // bottom disc
      });
      for (const cy of [11, 17]) {                                  // the stacked-disc bands: a 1-2 px lower lip
        for (let y = 0; y < 30; y++) for (let x = 0; x < 24; x++) {
          if (sil.has(x, y) && inEll(x, y, 11.5, cy + 1.2, 10.5, 3.4) && !inEll(x, y, 11.5, cy, 10.5, 3.4)) buf.set(x, y, BAND);
        }
      }
      buf.ellipse(11.5, 5.5, 8.5, 2.8, TOP);                        // lit top surface
      buf.rect(19, 9, 2, 14, '#7fd3f0');                            // right shade
      buf.set(4, 9, '#ffffff').set(4, 10, '#ffffff').set(5, 9, '#ffffff');
    },
  });

  // ------------------------------------------------------------------ rocket (animated flame)
  const FLAME_LEN = [4, 7, 5];
  Pres.registerProp('rocket', {
    label: 'Launch', w: 21, h: 34, animated: true,
    draw(buf, t) {
      const OL = '#5a6fb0', BODY = '#f4f7ff', FIN = '#ff9eb5', FIN_OL = '#b8476b', NOSE = '#ff8fa3';
      const WIN = '#a8e6ff', FACE = '#3d2b4a', FL_OUT = '#ffb36b', FL_IN = '#ffe38a';
      part(buf, FIN_OL, (b) => { poly(b, [[6, 17], [1, 26], [6, 26]], FIN); poly(b, [[15, 17], [20, 26], [15, 26]], FIN); });
      part(buf, OL, (b) => b.rrect(6, 8, 10, 19, 5, BODY));       // body, centred on x = 10.5
      part(buf, OL, (b) => poly(b, [[10.5, 1], [16.5, 9.5], [4.5, 9.5]], NOSE));
      buf.ellipse(10.5, 15, 3.8, 3.8, OL);                         // porthole
      buf.ellipse(10.5, 15, 3, 3, WIN);
      buf.set(8, 14, FACE).set(12, 14, FACE);                      // porthole face
      buf.set(9, 16, FACE).set(10, 16, FACE).set(11, 16, FACE);
      buf.set(7, 9, '#ffffff').set(6, 10, '#ffffff');              // gloss
      const len = FLAME_LEN[Math.floor(t * 6) % 3];                // flicker
      poly(buf, [[6.5, 27], [14.5, 27], [10.5, 27 + len]], FL_OUT);
      poly(buf, [[8, 27], [13, 27], [10.5, 27 + len - 2]], FL_IN);
    },
  });

  // ------------------------------------------------------------------ star (animated twinkle)
  const starPts = (cx, cy, R, r) => {
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5, rad = k % 2 ? r : R;
      pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
    }
    return pts;
  };
  Pres.registerProp('star', {
    label: 'Star', w: 23, h: 23, animated: true,
    draw(buf, t) {
      const OL = '#c98f00', STAR = '#ffe066', STAR_S = '#ffc93c', STAR_B = '#fff1a8', SPARK = '#ffffff';
      const f = Math.floor(t * 4) % 3;
      const body = f === 2 ? STAR_B : STAR;
      const g = new Buf();                                          // drawn at 24 px, then shifted 1 px left
      const sil = part(g, OL, (b) => poly(b, starPts(12, 12.5, 11.5, 4.6), body));
      for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
        if (sil.has(x, y) && y > 15) g.set(x, y, STAR_S);
      }
      g.set(8, 8, '#ffffff').set(9, 7, '#ffffff');                  // gloss
      if (f === 0) {
        g.set(22, 0, SPARK).set(21, 1, SPARK).set(22, 1, SPARK).set(23, 1, SPARK).set(22, 2, SPARK);
      } else if (f === 1) {
        g.set(22, 1, SPARK);
      }
      buf.blit(g, -1, 0);
    },
  });

  // ------------------------------------------------------------------ arrow (animated shine)
  Pres.registerProp('arrow', {
    label: 'Next', w: 32, h: 16, animated: true,
    draw(buf, t) {
      const OL = '#2f7fb0', BODY = '#9be7ff', BODY_S = '#6cc9ec', SHINE = '#dff9ff', CHEV = '#ffffff';
      const sil = part(buf, OL, (b) => {
        b.rrect(1, 5, 20, 6, 2, BODY);
        poly(b, [[18, 1], [32, 8], [18, 15]], BODY);
      });
      for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) {
        if (sil.has(x, y) && y >= 9) buf.set(x, y, BODY_S);
      }
      for (let x = 3; x <= 16; x++) buf.set(x, 6, SHINE);           // top shine line
      const pos = 2 + (Math.floor(t * 10) % 24);                    // chevron slides along the shaft
      [[pos, 6], [pos + 1, 7], [pos + 2, 8], [pos + 1, 9], [pos, 10]].forEach(([x, y]) => buf.set(x, y, CHEV));
    },
  });
})(window);
