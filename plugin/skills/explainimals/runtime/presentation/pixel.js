/*
 * pixel.js - the shared pixel toolkit for the presentation layer.
 *
 * Buf is a sparse grid of coloured pixels (any CSS colour string, usually "#rrggbb").
 * Everything on the presentation stage (backgrounds, props, text, speech bubbles) is drawn into a
 * Buf and emitted as crisp SVG, so all of it sits on the same pixel grid as the characters.
 * Coordinates are whole pixels; x grows right, y grows down. Negative coordinates are allowed.
 */
(function (global) {
  'use strict';

  const Pres = (global.Pres = global.Pres || {});
  const key = (x, y) => (y + 1024) * 4096 + (x + 1024);

  // ------------------------------------------------------------- colour helpers
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  Pres.color = {
    // amt 0..1: toward black / toward white / toward another colour
    darken: (h, amt) => hex(rgb(h).map((v) => v * (1 - amt))),
    lighten: (h, amt) => hex(rgb(h).map((v) => v + (255 - v) * amt)),
    mix: (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); },
  };

  // ----------------------------------------------------------------- pixel buffer
  class Buf {
    constructor() { this.m = new Map(); }

    set(x, y, c) { if (c) this.m.set(key(Math.round(x), Math.round(y)), c); return this; }
    get(x, y) { return this.m.get(key(Math.round(x), Math.round(y))); }
    has(x, y) { return this.m.has(key(Math.round(x), Math.round(y))); }
    erase(x, y) { this.m.delete(key(Math.round(x), Math.round(y))); return this; }
    clear() { this.m.clear(); return this; }
    get size() { return this.m.size; }

    // filled rectangle at (x, y) with width w and height h
    rect(x, y, w, h, c) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
      return this;
    }

    // 1px rectangle outline
    frame(x, y, w, h, c) {
      for (let i = 0; i < w; i++) { this.set(x + i, y, c); this.set(x + i, y + h - 1, c); }
      for (let j = 0; j < h; j++) { this.set(x, y + j, c); this.set(x + w - 1, y + j, c); }
      return this;
    }

    // filled rounded rectangle; r is the corner radius in pixels
    rrect(x, y, w, h, r, c) {
      const x1 = x + w - 1, y1 = y + h - 1;
      for (let py = y; py <= y1; py++) {
        for (let px = x; px <= x1; px++) {
          const cx = px < x + r ? x + r : px > x1 - r ? x1 - r : px;
          const cy = py < y + r ? y + r : py > y1 - r ? y1 - r : py;
          if ((px - cx) ** 2 + (py - cy) ** 2 <= (r + 0.35) ** 2) this.set(px, py, c);
        }
      }
      return this;
    }

    // filled ellipse centred on (cx, cy) with radii rx, ry
    ellipse(cx, cy, rx, ry, c) {
      for (let py = Math.floor(cy - ry); py <= Math.ceil(cy + ry); py++) {
        for (let px = Math.floor(cx - rx); px <= Math.ceil(cx + rx); px++) {
          if (((px - cx) / (rx + 0.35)) ** 2 + ((py - cy) / (ry + 0.35)) ** 2 <= 1) this.set(px, py, c);
        }
      }
      return this;
    }

    // 1px line (Bresenham)
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        this.set(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
      return this;
    }

    // Text-art sprite: rows of characters, map gives char -> colour, '.' and ' ' are transparent.
    sprite(rows, map, x = 0, y = 0) {
      rows.forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch !== '.' && ch !== ' ' && map[ch]) this.set(x + i, y + j, map[ch]);
      }));
      return this;
    }

    // copy another buffer in, shifted by (dx, dy)
    blit(other, dx = 0, dy = 0) {
      for (const [k, c] of other.m) {
        const x = (k % 4096) - 1024, y = Math.floor(k / 4096) - 1024;
        this.set(x + dx, y + dy, c);
      }
      return this;
    }

    // Add a 1px outline in colour c around everything drawn so far (outline goes on empty pixels).
    outline(c, diagonals = false) {
      const add = [];
      for (const k of this.m.keys()) {
        const x = (k % 4096) - 1024, y = Math.floor(k / 4096) - 1024;
        const n = diagonals
          ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]
          : [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of n) if (!this.has(x + dx, y + dy)) add.push([x + dx, y + dy]);
      }
      add.forEach(([x, y]) => this.set(x, y, c));
      return this;
    }

    // checkerboard dither: sets every other pixel inside the rectangle (phase 0 or 1)
    dither(x, y, w, h, c, phase = 0) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if ((i + j + phase) % 2 === 0) this.set(x + i, y + j, c);
      return this;
    }

    bounds() {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const k of this.m.keys()) {
        const x = (k % 4096) - 1024, y = Math.floor(k / 4096) - 1024;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return this.m.size ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : { x: 0, y: 0, w: 0, h: 0 };
    }

    clone() { const b = new Buf(); b.m = new Map(this.m); return b; }

    // SVG markup: one <path> per colour, merged into horizontal runs. dx/dy shift the whole thing.
    svg(dx = 0, dy = 0) {
      const byColor = new Map();
      for (const [k, c] of this.m) {
        const x = (k % 4096) - 1024, y = Math.floor(k / 4096) - 1024;
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
          d += `M${x + dx} ${y + dy}h${w}v1h-${w}z`;
          i += w;
        }
        out += `<path fill="${c}" d="${d}"/>`;
      }
      return out;
    }
  }

  Pres.Buf = Buf;
})(window);
