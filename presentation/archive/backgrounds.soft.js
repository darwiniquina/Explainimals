/*
 * backgrounds.js - the five stage backgrounds (240 x 135 grid, see presentation/CONTRACT.md).
 *
 * draw(buf) paints the whole stage once. Anything that moves is drawn only in tick(buf, t), which
 * paints a fresh overlay every frame, so a moving cloud or twinkling star is never also baked into
 * draw() (that would leave ghost copies behind). Whole pixels only, no anti-aliasing.
 */
(function (global) {
  'use strict';

  const Pres = (global.Pres = global.Pres || {});
  const Buf = Pres.Buf;
  const { darken: dk, mix } = Pres.color;
  const W = 240, H = 135;

  // ------------------------------------------------------------------ helpers
  // deterministic pseudo-random numbers, so every load draws the same picture
  const rng = (seed) => {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  // vertical gradient from y0 to y1: solid bands, each ending in a 2-row checkerboard seam
  const bands = (b, y0, y1, cols) => {
    const h = (y1 - y0) / cols.length;
    cols.forEach((c, i) => {
      const top = Math.round(y0 + i * h), bot = Math.round(y0 + (i + 1) * h);
      b.rect(0, top, W, bot - top, c);
      if (i < cols.length - 1) b.dither(0, bot - 2, W, 2, cols[i + 1], 0);
    });
  };

  // the floor: a 1px edge row at y (where the characters stand), then a solid body to the bottom
  const floor = (b, y, edge, body) => {
    b.rect(0, y, W, H - y, body);
    b.rect(0, y, W, 1, edge);
  };

  // union of ellipses as a mask (the colour '#000' is only a marker)
  const ellipses = (list) => {
    const m = new Buf();
    list.forEach(([cx, cy, rx, ry]) => m.ellipse(cx, cy, rx, ry, '#000'));
    return m;
  };

  // recolour a mask pixel by pixel: fn(x, y, mask) returns the colour
  const paint = (mask, fn) => {
    const out = new Buf();
    const r = mask.bounds();
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (mask.has(x, y)) out.set(x, y, fn(x, y, mask));
      }
    }
    return out;
  };

  // a picture moved so its top-left is (0, 0), with its size; used for things that move
  const pic = (b) => {
    const r = b.bounds();
    return { buf: new Buf().blit(b, -r.x, -r.y), w: r.w, h: r.h };
  };

  // move a picture along the stage at `speed` px/s, wrapping around the edges
  const drift = (b, p, x0, y, speed, t) => {
    const span = W + p.w + 16;
    const x = ((((x0 + Math.floor(t * speed)) % span) + span) % span) - p.w;
    b.blit(p.buf, x, y);
  };

  // fluffy cloud from circles (absolute coordinates): body colour, a 2-row shade underneath, 1px outline
  const cloudBuf = (puffs, body, line) => {
    const under = mix(body, line, 0.25);
    const c = paint(ellipses(puffs), (x, y, m) => (m.has(x, y + 2) ? body : under));
    return c.outline(line);
  };
  const cloud = (puffs, body, line) => pic(cloudBuf(puffs, body, line));

  // soft hill (absolute coordinates) whose top row is a darker edge
  const hill = (b, cx, cy, rx, ry, fill, edge) => {
    b.blit(paint(ellipses([[cx, cy, rx, ry]]), (x, y, m) => (m.has(x, y - 1) ? fill : edge)));
  };

  // point at distance s along an axis-aligned polyline (wraps around)
  const pointOn = (path, s) => {
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      total += Math.abs(path[i][0] - path[i - 1][0]) + Math.abs(path[i][1] - path[i - 1][1]);
    }
    s = ((s % total) + total) % total;
    for (let i = 1; i < path.length; i++) {
      const [x0, y0] = path[i - 1], [x1, y1] = path[i];
      const len = Math.abs(x1 - x0) + Math.abs(y1 - y0);
      if (s <= len) {
        const f = len ? s / len : 0;
        return [Math.round(x0 + (x1 - x0) * f), Math.round(y0 + (y1 - y0) * f)];
      }
      s -= len;
    }
    return path[path.length - 1];
  };

  // ------------------------------------------------------------ 1. meadow
  const CLOUD_LINE = '#9cc9ea';
  const meadowClouds = [
    { p: cloud([[8, 7, 6, 5], [15, 4, 7, 7], [24, 7, 5, 5], [15, 9, 13, 4]], '#ffffff', CLOUD_LINE), x: 10, y: 13, v: 1.5 },
    { p: cloud([[5, 6, 4, 4], [11, 4, 5, 5], [17, 6, 4, 4], [11, 8, 9, 3]], '#ffffff', CLOUD_LINE), x: 120, y: 27, v: 1 },
    { p: cloud([[4, 5, 3, 3], [9, 3, 4, 4], [14, 5, 3, 3], [9, 6, 7, 2]], '#ffffff', CLOUD_LINE), x: 200, y: 8, v: 0.7 },
  ];
  const TUFT = ['v.v', 'vvv'];
  const FLOWER = ['.p.', 'pyp', '.p.', '.g.', '.g.'];
  const FLOWER_MAP = { p: '#ff9fc4', y: '#ffe38a', g: '#7cbf74' };

  Pres.registerBackground('meadow', {
    label: 'Sunny meadow',
    tone: 'light',
    ground: 116,
    draw(b) {
      // sky fades to a pale green haze at the horizon, so no gaps show between the hills
      const FAR = '#c4ecc9', NEAR = '#a6e096';
      bands(b, 0, 116, ['#9fd8ff', '#c9ecff', '#fff4dc', '#e2f6dc']);
      hill(b, 40, 126, 96, 34, FAR, dk(FAR, 0.08));
      hill(b, 196, 132, 82, 30, FAR, dk(FAR, 0.08));
      hill(b, 120, 152, 150, 38, NEAR, dk(NEAR, 0.1));
      floor(b, 116, '#86c97f', '#a9e09c');

      // tufts and flowers on the grass, to the right of the character
      const r = rng(11);
      for (let i = 0; i < 22; i++) {
        b.sprite(TUFT, { v: '#7cbf74' }, 78 + Math.floor(r() * 156), 120 + Math.floor(r() * 12));
      }
      for (let i = 0; i < 9; i++) {
        b.sprite(FLOWER, FLOWER_MAP, 80 + i * 17 + Math.floor(r() * 6), 118 + Math.floor(r() * 5));
      }

      // a tree and a bush at the far right edge
      b.rect(230, 101, 4, 15, '#c99a72');
      const LEAF = '#8fdc8a', LEAF_LINE = '#4a9a66';
      b.blit(paint(ellipses([[233, 94, 8, 8]]), () => LEAF).outline(LEAF_LINE));
      b.blit(paint(ellipses([[220, 111, 6, 4]]), () => LEAF).outline(LEAF_LINE));
    },
    tick(b, t) {
      meadowClouds.forEach((c) => drift(b, c.p, c.x, c.y, c.v, t));
    },
  });

  // ------------------------------------------------------------ 2. night sky
  const PLUS_STAR = ['.s.', 'sss', '.s.'];
  const PLUS_STAR_MAP = { s: '#fff6d8' };
  const DIM_STAR = '#b9b3ff';
  const NIGHT_STARS = [];
  const TWINKLE = [];
  (() => {
    const r = rng(42);
    const free = (x, y) => !(x < 72 && y >= 40) && Math.hypot(x - 204, y - 30) > 24;
    const place = (n, yMin, yMax, big) => {
      for (let i = 0; i < n; i++) {
        let x = 0, y = 0, tries = 0;
        do {
          x = Math.floor(r() * W);
          y = yMin + Math.floor(r() * (yMax - yMin));
          tries++;
        } while (!free(x, y) && tries < 50);
        NIGHT_STARS.push({ x, y, big });
      }
    };
    place(6, 6, 40, true);
    place(44, 2, 70, false);
    NIGHT_STARS.forEach((s, i) => {
      if (i % 5 === 0) {
        s.tw = { phase: i * 1.7, speed: 1.1 + (i % 4) * 0.35 };
        TWINKLE.push(s);
      }
    });
  })();

  // a soft moon with a checkerboard halo, a 1px outline and two craters
  const moon = (b, cx, cy, r) => {
    for (let y = cy - r - 6; y <= cy + r + 6; y++) {
      for (let x = cx - r - 6; x <= cx + r + 6; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r + 0.5 && d <= r + 5 && (x + y) % 2 === 0) b.set(x, y, '#4a3f94');
      }
    }
    const disc = paint(ellipses([[cx, cy, r, r]]), () => '#fff4cc');
    b.blit(disc.outline('#d9b25a'));
    b.rect(cx - 5, cy - 5, 3, 2, '#f3dc9a');             // craters, same tone as the shaded side
    b.rect(cx + 2, cy + 6, 2, 2, '#f3dc9a');
    b.rect(cx + 7, cy - 4, 2, 2, '#f3dc9a');
  };

  Pres.registerBackground('night-sky', {
    label: 'Starry night',
    tone: 'dark',
    ground: 116,
    draw(b) {
      bands(b, 0, 112, ['#1f1b4e', '#2c2665', '#3c2f78', '#4d3a88']);
      moon(b, 204, 30, 13);
      NIGHT_STARS.forEach((s) => {
        if (s.tw) return;                                  // twinkling stars are drawn in tick()
        if (s.big) b.sprite(PLUS_STAR, PLUS_STAR_MAP, s.x - 1, s.y - 1);
        else b.set(s.x, s.y, DIM_STAR);
      });
      hill(b, 60, 128, 120, 26, '#3f3080', '#4b3b8c');
      hill(b, 170, 130, 110, 24, '#33286c', '#3f3280');
      floor(b, 116, '#5a4a9a', '#2a2160');
    },
    tick(b, t) {
      TWINKLE.forEach((s) => {
        const on = Math.sin(t * s.tw.speed + s.tw.phase) > 0.25;
        if (!on) b.set(s.x, s.y, DIM_STAR);                // 1 px dot
        else if (s.big) b.sprite(PLUS_STAR, PLUS_STAR_MAP, s.x - 1, s.y - 1);
        else b.rect(s.x, s.y, 2, 2, '#fff6d8');            // 2 px sparkle
      });
    },
  });

  // ------------------------------------------------------------ 3. classroom
  const WOOD = '#c9955f', WOOD_DARK = '#8a5a34';
  Pres.registerBackground('classroom', {
    label: 'Cozy classroom',
    tone: 'light',
    ground: 118,
    draw(b) {
      // wall, skirting board and wooden floor
      b.rect(0, 0, W, 110, '#fff1d9');
      b.rect(0, 110, W, 8, '#ecd0a2');                   // skirting board
      floor(b, 118, WOOD_DARK, '#e2b184');               // wooden floor
      b.rect(0, 124, W, 1, WOOD_DARK);
      b.rect(0, 130, W, 1, WOOD_DARK);
      for (let x = 0; x < W; x += 40) {
        b.rect(x, 119, 1, 5, WOOD_DARK);
        b.rect(x + 20, 125, 1, 5, WOOD_DARK);
        b.rect(x, 131, 1, 4, WOOD_DARK);
      }

      // window in the far top-left corner, with a sill
      b.rect(8, 8, 28, 30, WOOD);
      b.rect(10, 10, 24, 26, '#bfe6ff');
      b.rect(20, 10, 3, 26, WOOD);
      b.rect(10, 20, 24, 2, WOOD);
      b.frame(8, 8, 28, 30, WOOD_DARK);
      b.rect(6, 38, 32, 2, WOOD_DARK);

      // wall clock (the second hand is in tick)
      const CX = 60, CY = 24;
      const face = paint(ellipses([[CX, CY, 9, 9]]), (x, y) => (Math.hypot(x - CX, y - CY) > 7.2 ? WOOD : '#fffdf6'));
      b.blit(face.outline(WOOD_DARK));
      b.line(CX, CY, CX, CY - 5, '#5a4a6a');
      b.line(CX, CY, CX + 4, CY + 2, '#5a4a6a');

      // big empty green chalkboard, kept plain on purpose
      b.rect(100, 14, 129, 80, WOOD);                    // wooden frame x 100..228, y 14..93
      b.rect(103, 17, 123, 74, '#3e6b57');               // board
      b.frame(100, 14, 129, 80, WOOD_DARK);
      b.rect(100, 94, 129, 3, WOOD_DARK);                // chalk ledge

      // shelf with books at the right edge
      b.rect(230, 62, 10, 2, WOOD);
      b.rect(231, 55, 2, 7, '#ff9fb0');
      b.rect(233, 57, 2, 5, '#7fc8e8');
      b.rect(235, 53, 2, 9, '#ff9fb0');

      // potted plant on the floor at the far right
      b.rrect(226, 105, 12, 12, 2, '#e9906f');
      const leaves = paint(ellipses([[231, 101, 6, 5], [226, 97, 4, 4], [237, 98, 4, 4]]), () => '#8fd99a');
      b.blit(leaves.outline('#3f8f5c'));
    },
    tick(b, t) {
      // ticking second hand, one step per second
      const a = ((Math.floor(t) % 60) / 60) * Math.PI * 2;
      b.line(60, 24, 60 + Math.sin(a) * 7, 24 - Math.cos(a) * 7, '#ff7b8f');
    },
  });

  // ------------------------------------------------------------ 4. circuit board
  const PCB_TRACE = '#1f6f86', PCB_PINK = '#8e4a6e';
  const PAD = '#3fc3d6', PAD_IN = '#b8f4ff';
  const CHIP = '#15495c', CHIP_EDGE = '#2b9fb5', PIN = '#8ee4f2';
  const TRACES = [
    { path: [[0, 3], [239, 3]], col: PCB_TRACE, pads: [[40, 3], [120, 3], [200, 3]] },
    { path: [[235, 10], [235, 112]], col: PCB_PINK, pads: [[235, 30], [235, 62], [235, 90]] },
    { path: [[0, 124], [239, 124]], col: PCB_TRACE, pads: [[30, 124], [90, 124], [150, 124], [210, 124]] },
    { path: [[1, 8], [1, 30], [20, 30]], col: PCB_TRACE, pads: [[1, 8]] },
  ];
  const PULSES = [
    { tr: 0, speed: 26, off: 0 },
    { tr: 1, speed: 18, off: 40 },
    { tr: 2, speed: 30, off: 100 },
    { tr: 0, speed: 22, off: 180 },
  ];
  const chip = (b, x, y, w, h) => {
    b.rect(x, y, w, h, CHIP);
    b.frame(x, y, w, h, CHIP_EDGE);
    for (let i = 2; i < w - 2; i += 3) {
      b.set(x + i, y - 1, PIN);
      b.set(x + i, y + h, PIN);
    }
  };

  Pres.registerBackground('circuit', {
    label: 'Circuit board',
    tone: 'dark',
    ground: 116,
    draw(b) {
      bands(b, 0, 116, ['#0a2b3d', '#0c3143', '#0e3749', '#10404f']);
      floor(b, 116, '#1f7f94', '#0a2433');
      TRACES.forEach((tr) => {
        for (let i = 1; i < tr.path.length; i++) {
          const [x0, y0] = tr.path[i - 1], [x1, y1] = tr.path[i];
          b.line(x0, y0, x1, y1, tr.col);
        }
        tr.pads.forEach(([x, y]) => {
          b.rrect(x - 1, y - 1, 3, 3, 1, PAD);
          b.set(x, y, PAD_IN);
        });
      });
      chip(b, 222, 22, 12, 14);
      chip(b, 222, 74, 12, 10);
      chip(b, 6, 14, 10, 8);
    },
    tick(b, t) {
      PULSES.forEach((p) => {
        const path = TRACES[p.tr].path;
        const s = p.off + t * p.speed;
        const [hx, hy] = pointOn(path, s);
        b.set(hx, hy, '#eafcff');
        for (let k = 1; k <= 3; k++) {
          const [x, y] = pointOn(path, s - k);
          b.set(x, y, k === 1 ? '#4de3ff' : '#1fa7d6');
        }
      });
    },
  });

  // ------------------------------------------------------------ 5. candy clouds
  const CANDY_CLOUD = '#fff4fb', CANDY_LINE = '#e9a4cc';
  const candyClouds = [
    { p: cloud([[10, 10, 8, 6], [20, 6, 10, 9], [32, 9, 9, 7], [24, 12, 18, 5]], CANDY_CLOUD, CANDY_LINE), x: 12, y: 16, ph: 0 },
    { p: cloud([[6, 8, 6, 5], [14, 5, 7, 7], [22, 8, 5, 5], [14, 10, 12, 4]], CANDY_CLOUD, CANDY_LINE), x: 190, y: 12, ph: 2 },
  ];
  const CANDY_STARS = [[94, 12], [122, 40], [150, 8], [176, 56], [224, 38], [238, 60]];
  const PLUS_WHITE = ['.w.', 'www', '.w.'];
  const PLUS_WHITE_MAP = { w: '#ffffff' };
  // a row of puffs along the horizon: the pastel cloud floor (absolute coordinates)
  const bankPuffs = [];
  for (let x = -6; x <= 250; x += 26) {
    bankPuffs.push([x, 108, 13, 7]);   // scalloped top
    bankPuffs.push([x, 111, 14, 4]);   // solid body, so no gaps show between the puffs
  }
  const bank = cloudBuf(bankPuffs, '#f8d9ee', '#e7a6cf');

  Pres.registerBackground('candy-clouds', {
    label: 'Candy sky',
    tone: 'light',
    ground: 114,
    draw(b) {
      bands(b, 0, 112, ['#ffd3e8', '#f6d0f0', '#e8d3fb', '#ffdcd6']);
      // faint rainbow arc at the top right (five pale bands, 3 px each)
      const RB = ['#ffc2d9', '#ffd9bd', '#fff0a8', '#c3f0dc', '#c4d8ff'];
      for (let y = 20; y < 104; y++) {
        for (let x = 130; x < W; x++) {
          const d = Math.hypot(x - 212, y - 104);
          if (d <= 74 && d > 59) b.set(x, y, RB[Math.floor((74 - d) / 3)]);
        }
      }
      b.blit(bank);
      floor(b, 114, '#e9a4cc', '#fde3f2');
    },
    tick(b, t) {
      // big clouds bob by one pixel
      candyClouds.forEach((c) => b.blit(c.p.buf, c.x, c.y + Math.round(Math.sin(t * 0.9 + c.ph))));
      // small stars twinkle between a plus and a single dot
      CANDY_STARS.forEach(([x, y], i) => {
        const on = Math.sin(t * (1.2 + (i % 3) * 0.4) + i * 2.1) > 0.1;
        if (on) b.sprite(PLUS_WHITE, PLUS_WHITE_MAP, x - 1, y - 1);
        else b.set(x, y, '#ffffff');
      });
    },
  });
})(window);
