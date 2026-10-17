/*
 * backgrounds.js - the seven stage backgrounds (240 x 135 grid, see presentation/CONTRACT.md).
 *
 * Retro 8/16-bit look: a few saturated console colours, hard edges, two-tone shading, checkerboard
 * dithering between sky bands, tile-like repeated patterns and a dark outline on foreground shapes.
 * draw(buf) paints the whole stage once. Anything that moves or blinks is painted fresh in
 * tick(buf, t), so a moving cloud or a blinking light is never also baked into draw().
 * Whole pixels only, no anti-aliasing, no transparency.
 */
(function (global) {
  'use strict';

  const Pres = (global.Pres = global.Pres || {});
  const Buf = Pres.Buf;
  const { darken: dk } = Pres.color;
  const W = 240, H = 135;

  // shared console palette
  const INK = '#14131f';        // dark outline for foreground shapes
  const CREAM = '#f4e9c8';
  const MUSTARD = '#f2c14e';
  const BRICK = '#c4442f';
  const ORANGE = '#d2622b';

  // ------------------------------------------------------------------ helpers
  // deterministic pseudo-random numbers, so every load draws the same picture
  const rng = (seed) => {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  // flat bands from y0 to y1, each join a 2-row checkerboard seam (ordered dithering)
  const bands = (b, y0, y1, cols) => {
    const h = (y1 - y0) / cols.length;
    cols.forEach((c, i) => {
      const top = Math.round(y0 + i * h), bot = Math.round(y0 + (i + 1) * h);
      b.rect(0, top, W, bot - top, c);
      if (i < cols.length - 1) b.dither(0, bot - 2, W, 2, cols[i + 1], 0);
    });
  };

  // the sky: dithered bands from y = 0 down to y1, then the last colour fills the rest of the stage
  const sky = (b, y1, cols) => {
    bands(b, 0, y1, cols);
    b.rect(0, y1, W, H - y1, cols[cols.length - 1]);
  };

  // the floor: a 1px edge row at y (where the characters stand), then a solid body to the bottom
  const floor = (b, y, edge, body) => {
    b.rect(0, y, W, H - y, body);
    b.rect(0, y, W, 1, edge);
  };

  // a silhouette ridge: top(x) is the outline row for each column, everything below it is filled
  const ridge = (b, top, fill, edge) => {
    for (let x = 0; x < W; x++) {
      const y0 = Math.round(top(x));
      b.set(x, y0, edge);
      b.rect(x, y0 + 1, 1, H - y0 - 1, fill);
    }
  };

  // a wave quantised to whole steps, so hills read as stepped pixel art
  const wave = (base, parts, step = 2) => (x) => {
    let v = base;
    parts.forEach(([k, a, ph]) => { v += a * Math.sin(x * k + ph); });
    return Math.round(v / step) * step;
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

  // blocky block-built shape from rectangles [x, y, w, h]: body colour, a 2-row shade underneath,
  // 1px outline. Used for clouds and bushes.
  const shape = (parts) => {
    const m = new Buf();
    parts.forEach(([x, y, w, h]) => m.rect(x, y, w, h, '#000'));
    return m;
  };
  const cloud = (parts, body, shade, line) =>
    pic(paint(shape(parts), (x, y, m) => (m.has(x, y + 2) ? body : shade)).outline(line));

  // a point at distance s along an axis-aligned polyline (wraps around)
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
  const SKY_DAY = ['#1d4fa8', '#2f72c9', '#4f95e0', '#86c2ef'];
  const CLOUD_LINE = '#1d4fa8', CLOUD_SHADE = '#86c2ef';
  const CLOUD_BIG = [[7, 0, 7, 3], [3, 2, 15, 3], [0, 4, 21, 3]];
  const CLOUD_SMALL = [[3, 0, 4, 2], [1, 2, 9, 2], [0, 4, 13, 2]];
  const meadowClouds = [
    { p: cloud(CLOUD_BIG, CREAM, CLOUD_SHADE, CLOUD_LINE), x: 14, y: 12, v: 1.5 },
    { p: cloud(CLOUD_SMALL, CREAM, CLOUD_SHADE, CLOUD_LINE), x: 120, y: 26, v: 1 },
    { p: cloud(CLOUD_SMALL, CREAM, CLOUD_SHADE, CLOUD_LINE), x: 200, y: 8, v: 0.7 },
  ];
  const TUFT = ['v.v', 'vvv'];
  const FLOWER = ['.r.', 'ryr', '.r.', '.g.', '.g.'];
  const FLOWER_MAP = { r: MUSTARD, y: MUSTARD, g: '#2b6a2a' };

  Pres.registerBackground('meadow', {
    label: 'Sunny meadow',
    tone: 'light',
    ground: 116,
    draw(b) {
      sky(b, 100, SKY_DAY);
      ridge(b, wave(86, [[0.05, 6, 0.4], [0.13, 2, 1.3]]), '#3a8088', '#1f5560');    // far hills, teal
      ridge(b, wave(102, [[0.03, 6, 2.0], [0.09, 2, 0.2]]), '#2f7a3a', '#174d22');   // near hills, forest
      floor(b, 116, '#8ad65a', '#4a9e3a');

      // grass tufts on a loose tile grid (same tile everywhere, so it reads as a repeated pattern)
      const r = rng(11);
      for (let y = 120; y < H - 1; y += 6) {
        for (let x = 0; x < W; x += 10) {
          if (r() < 0.55) b.sprite(TUFT, { v: '#2b6a2a' }, x + Math.floor(r() * 4), y + Math.floor(r() * 2));
        }
      }
      [[84, 120], [106, 124], [132, 119], [160, 125], [188, 120], [212, 123]].forEach(([x, y]) => {
        b.sprite(FLOWER, FLOWER_MAP, x, y);
      });

      // a blocky tree at the far right edge
      b.rect(229, 98, 3, 18, '#6e4220');
      b.blit(cloud([[4, 0, 6, 2], [1, 2, 12, 4], [0, 6, 14, 3]], '#2f7a3a', '#174d22', '#174d22').buf, 223, 86);
    },
    tick(b, t) {
      meadowClouds.forEach((c) => drift(b, c.p, c.x, c.y, c.v, t));
    },
  });

  // ------------------------------------------------------------ 2. night sky
  const STAR_BRIGHT = '#fff3c4', STAR_DIM = '#8fa6dc';
  const MOON = '#f2d15a', MOON_LINE = '#6b5420', CRATER = '#b8b2a0';
  const PLUS = ['.s.', 'sss', '.s.'];
  const PLUS_MAP = { s: STAR_BRIGHT };
  const MOON_AT = { x: 214, y: 26, r: 10 };
  const NIGHT_STARS = [];
  const TWINKLE = [];
  (() => {
    const r = rng(42);
    const free = (x, y) => Math.hypot(x - MOON_AT.x, y - MOON_AT.y) > MOON_AT.r + 8 && !(x < 72 && y >= 40);
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

  // a plain yellow moon with a grey crater pattern and a shaded lower-right side
  const moon = (b, cx, cy, r) => {
    const disc = paint(ellipses([[cx, cy, r, r]]), () => MOON);
    b.blit(disc.outline(MOON_LINE));
    b.rect(cx - 5, cy - 4, 3, 3, CRATER);
    b.rect(cx + 2, cy + 2, 2, 2, CRATER);
    b.set(cx + 4, cy - 4, CRATER);
  };

  Pres.registerBackground('night-sky', {
    label: 'Starry night',
    tone: 'dark',
    ground: 116,
    draw(b) {
      sky(b, 100, ['#0a1230', '#101c48', '#16275c', '#1e3270']);
      moon(b, MOON_AT.x, MOON_AT.y, MOON_AT.r);
      NIGHT_STARS.forEach((s) => {
        if (s.tw) return;                                  // twinkling stars are drawn in tick()
        if (s.big) b.sprite(PLUS, PLUS_MAP, s.x - 1, s.y - 1);
        else b.set(s.x, s.y, STAR_DIM);
      });
      ridge(b, wave(90, [[0.04, 6, 1.0], [0.11, 2, 0]]), '#1d2c63', '#2c4286');     // far hills
      ridge(b, wave(104, [[0.025, 7, 3.1], [0.08, 2, 0.5]]), '#141e4b', '#24376f'); // near hills
      floor(b, 116, '#2c4286', '#1b2350');
      for (let y = 120; y < H; y += 6) b.rect(0, y, W, 1, '#24376f');               // grid floor
      for (let x = 0; x < W; x += 12) b.rect(x, 117, 1, H - 117, '#24376f');
    },
    tick(b, t) {
      TWINKLE.forEach((s) => {
        const on = Math.sin(t * s.tw.speed + s.tw.phase) > 0.25;
        if (!on) b.set(s.x, s.y, STAR_DIM);                // one dim dot
        else if (s.big) b.sprite(PLUS, PLUS_MAP, s.x - 1, s.y - 1);
        else b.rect(s.x, s.y, 2, 2, STAR_BRIGHT);          // 2 px sparkle
      });
    },
  });

  // ------------------------------------------------------------ 3. classroom
  const BRICK_WALL = '#9a4a35', BRICK_JOINT = '#6e4220';
  const WOOD = '#a86a3a', WOOD_DARK = '#6e4220', WOOD_LIGHT = '#c08a52';
  const TILE_A = '#8f8c9a', TILE_B = '#7d7a88', GROUT = INK, TILE_EDGE = CREAM;
  const BOARD = '#2e5a48', GLASS = '#4f95e0';
  const LEAF = '#2f7a3a', LEAF_LINE = '#14131f';

  Pres.registerBackground('classroom', {
    label: 'Classroom',
    tone: 'dark',
    ground: 118,
    draw(b) {
      // brick wall down to y 82, then a wooden wainscot with a chair rail
      for (let y = 0; y < 82; y++) {
        const off = Math.floor(y / 6) % 2 ? 6 : 0;
        for (let x = 0; x < W; x++) b.set(x, y, y % 6 === 5 || (x + off) % 12 === 11 ? BRICK_JOINT : BRICK_WALL);
      }
      b.rect(0, 82, W, 28, WOOD);
      for (let x = 0; x < W; x += 6) b.rect(x, 82, 1, 28, WOOD_DARK);
      b.rect(0, 108, W, 2, WOOD);
      b.rect(0, 110, W, 8, WOOD_DARK);

      // floor: square tiles in two tones with grout, plus a cream edge where the characters stand
      for (let y = 118; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let c;
          if (y === 118) c = TILE_EDGE;
          else {
            const tr = Math.floor((y - 119) / 8), tc = Math.floor(x / 8);
            c = (tr + tc) % 2 ? TILE_A : TILE_B;
            if ((y - 119) % 8 === 7 || x % 8 === 7) c = GROUT;
          }
          b.set(x, y, c);
        }
      }

      // plain window in the top-left corner: cream frame, blue glass, cross bars, sill
      b.rect(8, 8, 28, 30, CREAM);
      b.rect(10, 10, 24, 26, GLASS);
      b.rect(20, 10, 2, 26, CREAM);
      b.rect(10, 20, 24, 2, CREAM);
      b.frame(8, 8, 28, 30, INK);
      b.rect(6, 38, 32, 2, CREAM);
      b.rect(6, 40, 32, 1, WOOD_DARK);

      // wall clock on the left (the second hand moves in tick)
      const CX = 66, CY = 22;
      const face = paint(ellipses([[CX, CY, 8, 8]]), () => CREAM);
      b.blit(face.outline(INK));
      b.line(CX, CY, CX, CY - 4, INK);
      b.line(CX, CY, CX + 3, CY + 1, INK);

      // plain green chalkboard in a wooden frame, with a chalk ledge
      b.rect(100, 14, 129, 80, WOOD);
      b.rect(103, 17, 123, 74, BOARD);
      b.frame(100, 14, 129, 80, WOOD_DARK);
      b.rect(100, 94, 129, 3, WOOD_DARK);
      b.rect(146, 93, 5, 1, CREAM);

      // shelf with three books at the right edge
      b.rect(226, 62, 14, 2, WOOD_DARK);
      b.rect(231, 55, 2, 7, MUSTARD);
      b.rect(233, 57, 2, 5, GLASS);
      b.rect(235, 53, 2, 9, BRICK_WALL);

      // potted plant in the far right corner: orange pot, blocky leaves
      b.rrect(226, 106, 12, 11, 2, BRICK);
      b.blit(cloud([[4, 0, 6, 2], [1, 2, 12, 4], [0, 6, 14, 3]], LEAF, LEAF, LEAF_LINE).buf, 222, 88);
    },
    tick(b, t) {
      // ticking second hand, one step per second
      const a = ((Math.floor(t) % 60) / 60) * Math.PI * 2;
      b.line(66, 22, 66 + Math.sin(a) * 6, 22 - Math.cos(a) * 6, BRICK);
    },
  });

  // ------------------------------------------------------------ 4. circuit board
  const BOARD_G = '#16402e', BOARD_DOT = '#1d5238', EDGE_G = '#4fb384', BOARD_DARK = '#0b2619';
  const TRACE_G = '#4fb384', TRACE_C = '#c9962e', PAD = CREAM;
  const CHIP_BODY = '#2a2f38', CHIP_PIN = '#9aa3ad';
  const LED = [
    { x: 120, y: 62, c: '#e0462f' }, { x: 125, y: 62, c: '#7ee06a' }, { x: 130, y: 62, c: MUSTARD },
    { x: 150, y: 106, c: '#7ee06a' }, { x: 160, y: 106, c: '#e0462f' }, { x: 226, y: 42, c: '#7ee06a' },
  ];
  LED.forEach((l, i) => { l.ph = i; });
  const TRACES = [
    { path: [[0, 3], [239, 3]], col: TRACE_G, pads: [[40, 3], [120, 3], [200, 3]] },
    { path: [[235, 10], [235, 112]], col: TRACE_C, pads: [[235, 30], [235, 62], [235, 90]] },
    { path: [[0, 124], [239, 124]], col: TRACE_G, pads: [[30, 124], [90, 124], [150, 124], [210, 124]] },
    { path: [[1, 8], [1, 30], [20, 30]], col: TRACE_G, pads: [[1, 8]] },
  ];
  const PULSES = [
    { tr: 0, speed: 26, off: 0 },
    { tr: 1, speed: 18, off: 40 },
    { tr: 2, speed: 30, off: 100 },
    { tr: 0, speed: 22, off: 180 },
  ];
  const chip = (b, x, y, w, h) => {
    b.rect(x, y, w, h, CHIP_BODY);
    b.frame(x, y, w, h, INK);
    b.set(x + 1, y + 1, INK);                              // pin-1 notch
    for (let i = 2; i < w - 2; i += 3) {
      b.set(x + i, y - 1, CHIP_PIN);
      b.set(x + i, y + h, CHIP_PIN);
    }
  };

  Pres.registerBackground('circuit', {
    label: 'Circuit board',
    tone: 'dark',
    ground: 116,
    draw(b) {
      b.rect(0, 0, W, 116, BOARD_G);
      for (let y = 4; y < 116; y += 8) for (let x = 4; x < W; x += 8) b.set(x, y, BOARD_DOT);  // solder-mask grid
      floor(b, 116, EDGE_G, BOARD_DARK);
      TRACES.forEach((tr) => {
        for (let i = 1; i < tr.path.length; i++) {
          const [x0, y0] = tr.path[i - 1], [x1, y1] = tr.path[i];
          b.line(x0, y0, x1, y1, tr.col);
        }
        tr.pads.forEach(([x, y]) => {
          b.rrect(x - 1, y - 1, 3, 3, 1, PAD);
        });
      });
      chip(b, 222, 22, 12, 14);
      chip(b, 222, 74, 12, 10);
      chip(b, 6, 14, 10, 8);
      LED.forEach((l) => {                                 // LEDs start off, tick() lights them
        b.rect(l.x - 1, l.y - 1, 4, 4, INK);
        b.rect(l.x, l.y, 2, 2, dk(l.c, 0.55));
      });
    },
    tick(b, t) {
      LED.forEach((l) => {
        if (((Math.floor(t * 2.5) + l.ph) % 4) < 2) {
          b.rect(l.x, l.y, 2, 2, l.c);
        }
      });
      PULSES.forEach((p) => {
        const path = TRACES[p.tr].path;
        const s = p.off + t * p.speed;
        const [hx, hy] = pointOn(path, s);
        b.set(hx, hy, CREAM);
        for (let k = 1; k <= 3; k++) {
          const [x, y] = pointOn(path, s - k);
          b.set(x, y, k === 1 ? MUSTARD : ORANGE);
        }
      });
    },
  });

  // ------------------------------------------------------------ 5. retro dusk
  const SKY_DUSK = ['#262759', '#6b2a2e', '#a8392a', '#d2622b', '#f0a53a'];
  const SILHOUETTE = '#1d1a3a', SILHOUETTE_EDGE = '#2b2752', DUSK_GROUND = '#14122e';
  // blocky skyline on the right: [x, width, top]
  const CITY = [[180, 10, 80], [190, 14, 70], [204, 8, 84], [212, 12, 64], [224, 10, 76], [234, 6, 66]];
  // lit windows: they blink in tick(), so only the building silhouettes are painted in draw()
  const WINDOWS = [];
  CITY.forEach(([bx, bw, top], bi) => {
    for (let wy = top + 4; wy < 106; wy += 6) {
      for (let wx = bx + 2; wx < bx + bw - 2; wx += 4) WINDOWS.push({ x: wx, y: wy, ph: (WINDOWS.length * 7 + bi) % 5 });
    }
  });

  Pres.registerBackground('sunset', {
    label: 'Retro dusk',
    tone: 'dark',
    ground: 114,
    draw(b) {
      sky(b, 100, SKY_DUSK);
      // blocky sun sitting on the horizon, with cut lines in its lower half
      const sun = paint(ellipses([[138, 84, 13, 13]]), (x, y) => (y - 86 > 1 && (y - 86) % 3 === 0 ? SKY_DUSK[4] : MUSTARD));
      b.blit(sun.outline(SKY_DUSK[3]));
      CITY.forEach(([bx, bw, top]) => {
        b.rect(bx, top, bw, H - top, SILHOUETTE);
        b.rect(bx, top, bw, 1, SILHOUETTE_EDGE);
      });
      ridge(b, wave(98, [[0.05, 6, 0.5], [0.12, 2, 1]]), SILHOUETTE, SILHOUETTE_EDGE);    // far hills
      ridge(b, wave(108, [[0.03, 5, 2], [0.09, 2, 0]]), DUSK_GROUND, SILHOUETTE_EDGE);     // near hills
      floor(b, 114, ORANGE, DUSK_GROUND);
    },
    tick(b, t) {
      // lit windows blink in stepped frames
      const step = Math.floor(t * 2);
      WINDOWS.forEach((w) => {
        if ((step + w.ph) % 5 === 0) b.rect(w.x, w.y, 2, 2, MUSTARD);
      });
    },
  });

  // ------------------------------------------------------------ 6. dungeon
  const STONE = '#4b4c57', STONE_HI = '#575965', STONE_LO = '#44454f', MORTAR = '#383944';
  const FLAG = '#55545f', FLAG_HI = '#6f6e7c', FLAG_LINE = '#2a2930';
  const IRON = '#2b2b33', TORCH_WOOD = '#8a5a2a', GLOW = '#7a4f2a';
  const FLAME_A = ['..o..', '.oYo.', 'oYWYo', 'oYWYo', '.ooo.'];
  const FLAME_B = ['.o...', '..Yo.', '.oYWo', 'oYWYo', '.ooo.'];
  const FLAME_MAP = { o: '#b5452a', Y: MUSTARD, W: STAR_BRIGHT };
  const TORCHES = [{ x: 118, y: 40 }, { x: 206, y: 40 }];

  const torch = (b, x, y) => {
    b.rect(x, y + 2, 2, 8, TORCH_WOOD);          // handle
    b.rect(x - 2, y, 6, 2, IRON);                // cup
    b.rect(x - 1, y + 9, 4, 2, IRON);            // wall bracket
  };
  // a soft dithered glow around each flame, drawn over the wall in tick()
  const glow = (b, cx, cy, r, phase) => {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && (x + y + phase) % 2 === 0) b.set(x, y, GLOW);
      }
    }
  };

  Pres.registerBackground('dungeon', {
    label: 'Dungeon',
    tone: 'dark',
    ground: 116,
    draw(b) {
      // stone block wall: staggered courses, mortar lines, a lit top edge on each block
      for (let y = 0; y < 116; y++) {
        const off = Math.floor(y / 8) % 2 ? 8 : 0;
        for (let x = 0; x < W; x++) {
          let c = STONE;
          if (y % 8 === 0 || (x + off) % 16 === 0) c = MORTAR;
          else if (y % 8 === 1) c = STONE_HI;
          else if (y % 8 === 7) c = STONE_LO;
          b.set(x, y, c);
        }
      }
      TORCHES.forEach((t) => torch(b, t.x, t.y));

      // flagstone floor: staggered slabs with a lit top edge
      floor(b, 116, '#1d1d24', FLAG);
      for (let y = 117; y < H; y++) {
        const row = Math.floor((y - 117) / 6), off = row % 2 ? 11 : 0;
        for (let x = 0; x < W; x++) {
          let c = FLAG;
          if ((y - 117) % 6 === 5 || (x + off) % 22 === 0) c = FLAG_LINE;
          else if ((y - 117) % 6 === 0) c = FLAG_HI;
          b.set(x, y, c);
        }
      }
    },
    tick(b, t) {
      const frame = Math.floor(t * 4) % 2;         // two flame frames, stepped
      const phase = frame;
      TORCHES.forEach((tc) => {
        glow(b, tc.x, tc.y - 3, 9, phase);
        b.sprite(frame ? FLAME_B : FLAME_A, FLAME_MAP, tc.x - 2, tc.y - 5);
      });
    },
  });

  // ------------------------------------------------------------ 7. arcade room
  const ARC_WALL = '#17234f', ARC_WALL_LINE = '#1d2b5f', ARC_WAINS = '#22336b';
  const ARC_FLOOR = '#0f1838', ARC_GRID = '#27377a', ARC_EDGE = '#3b5ca8';
  const CAB = '#090d1f', CAB_LINE = '#2a3d7c', SCREEN = '#2f5f8a', SCAN = '#8fbce0';
  // [x, top] of each cabinet; all stand on the floor line at y = 116
  const CABINETS = [[168, 90], [192, 80], [216, 80]];

  const cabinet = (b, x, top) => {
    const base = 116;
    b.rect(x, top + 6, 16, base - top - 6, CAB);       // body
    b.rect(x + 2, top, 12, 6, CAB);                    // marquee housing
    b.rect(x + 3, top + 1, 10, 3, BRICK);              // marquee (lamps blink in tick)
    b.rect(x + 3, top + 9, 10, 9, SCREEN);             // screen
    b.rect(x + 2, top + 21, 12, 3, CAB_LINE);          // control panel
    b.frame(x, top + 6, 16, base - top - 6, CAB_LINE);
  };

  Pres.registerBackground('arcade', {
    label: 'Arcade room',
    tone: 'dark',
    ground: 116,
    draw(b) {
      // dark blue wall with vertical panel seams and a wainscot band
      b.rect(0, 0, W, 116, ARC_WALL);
      for (let x = 29; x < W; x += 30) b.rect(x, 0, 1, 96, ARC_WALL_LINE);
      b.rect(0, 96, W, 4, ARC_WAINS);
      b.rect(0, 100, W, 1, ARC_WALL_LINE);
      // grid floor
      floor(b, 116, ARC_EDGE, ARC_FLOOR);
      for (let y = 118; y < H; y += 6) b.rect(0, y, W, 1, ARC_GRID);
      for (let x = 0; x < W; x += 12) b.rect(x, 117, 1, H - 117, ARC_GRID);
      CABINETS.forEach(([x, top]) => cabinet(b, x, top));
    },
    tick(b, t) {
      // marquee lamps alternate, and a scanline steps down each screen
      const lamp = Math.floor(t * 2);
      const scan = Math.floor(t * 6);
      CABINETS.forEach(([x, top], ci) => {
        for (let i = 0; i < 3; i++) {
          if ((lamp + i + ci) % 2 === 0) b.set(x + 4 + i * 3, top + 2, MUSTARD);
        }
        b.rect(x + 4, top + 9 + (scan % 9), 8, 1, SCAN);
      });
    },
  });
})(window);
