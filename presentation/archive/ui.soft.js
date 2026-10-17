/*
 * ui.js - small pixel UI helpers for the presentation layer (defines Pres.ui). Needs font.js.
 *
 * Every helper returns { buf, w, h }: buf is a Pres.Buf whose top-left is (0,0), w/h its exact size.
 * Each takes an optional theme: 'light' (cream fill, dark purple text) or 'dark' (deep indigo fill,
 * cream text, cyan outline). The 1px outline is drawn outside the fill, so it is part of w/h.
 *
 *   Pres.ui.bubble({ text, maxWidth, tail, theme })      tail: 'left' | 'right' | 'none'  (+ tip {x,y})
 *   Pres.ui.panel({ title, bullets, maxWidth, reveal, theme })
 *   Pres.ui.titleCard({ title, subtitle, w, theme })
 *   Pres.ui.label(text, { theme })
 */
(function (global) {
  'use strict';

  const Pres = (global.Pres = global.Pres || {});
  const PAD = 4;          // inner padding of bubbles and panels
  const ICON = 5;         // bullet icon size
  const ICON_GAP = 3;     // gap between bullet icon and text
  const BULLET_GAP = 3;   // vertical gap between bullets

  const THEME = {
    light: {
      fill: '#fffaf0', fill2: '#ffe3ec', text: '#3b2a4d', soft: '#7d5f94', line: '#5a2d82',
      hi: '#ffffff', shadow: '#ffc2d1', bar: '#ffc4d6', barText: '#3b2a4d', tag: '#ffe0ea',
      accent: '#ff8fa3', star: '#ffa43a', accents: ['#ff7f9b', '#ffa43a', '#2fc9e8'],
    },
    dark: {
      fill: '#2a2650', fill2: '#352f66', text: '#fff3dc', soft: '#b9b3e6', line: '#6fd8f0',
      hi: '#4a4382', shadow: '#14112e', bar: '#4b3f86', barText: '#fff3dc', tag: '#3d3675',
      accent: '#6fd8f0', star: '#ff8fa3', accents: ['#ff8fa3', '#ffb15c', '#6fd8f0'],
    },
  };
  const theme = (name) => THEME[name === 'dark' ? 'dark' : 'light'];

  // Move a drawing so its top-left is (0,0); returns the Buf and its size (and a shifted tip if given).
  function finish(f, tip) {
    const b = f.bounds();
    const buf = new Pres.Buf();
    buf.blit(f, -b.x, -b.y);
    const out = { buf, w: b.w, h: b.h };
    if (tip) out.tip = { x: tip.x - b.x, y: tip.y - b.y };
    return out;
  }

  // 5x5 heart: accent fill with one white highlight pixel
  const HEART = ['##.##', '#####', '#####', '.###.', '..#..'];
  function drawHeart(f, x, y, color, hi) {
    HEART.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#') f.set(x + i, y + j, color);
    });
    f.set(x + 1, y + 1, hi);
  }

  // ------------------------------------------------------------------ speech bubble
  function bubble(opts) {
    opts = opts || {};
    const t = theme(opts.theme);
    const F = Pres.font;
    const text = opts.text == null ? '' : String(opts.text);
    const maxW = Math.max(24, Math.floor(opts.maxWidth || 120));
    const tail = opts.tail === 'left' || opts.tail === 'right' ? opts.tail : 'none';
    const ext = tail === 'none' ? 0 : 3;   // a tail sticks out 3 px to one side

    const lines = F.wrap(text, Math.max(1, maxW - 2 - 2 * PAD - ext));
    let contentW = 0;
    for (const l of lines) contentW = Math.max(contentW, F.measure(l).w);
    const iw = Math.max(contentW + 2 * PAD, 12);
    const ih = (lines.length - 1) * F.lineHeight + F.glyphHeight + 2 * PAD;

    const f = new Pres.Buf();
    f.rrect(0, 0, iw, ih, 3, t.fill);

    let tip = { x: Math.floor(iw / 2), y: ih };
    if (tail !== 'none') {
      // 6 rows below the body; x ranges for a tail on the left, mirrored for the right
      const rows = [[-3, 2], [-3, 1], [-3, 0], [-3, -1], [-3, -2], [-3, -3]];
      rows.forEach(([a, b], r) => {
        const x0 = tail === 'left' ? a : iw - 1 - b;
        const x1 = tail === 'left' ? b : iw - 1 - a;
        for (let x = x0; x <= x1; x++) f.set(x, ih + r, t.fill);
      });
      tip = { x: tail === 'left' ? -3 : iw + 2, y: ih + 5 };
    }

    f.outline(t.line);
    f.set(3, 1, t.hi).set(4, 1, t.hi).set(2, 2, t.hi);     // tiny top-left highlight

    const innerW = iw - 2 * PAD;
    lines.forEach((l, i) => {
      const lw = F.measure(l).w;
      F.draw(f, l, PAD + Math.floor((innerW - lw) / 2), PAD + i * F.lineHeight, t.text);
    });
    return finish(f, tip);
  }

  // ------------------------------------------------------------------ bullet panel
  function panel(opts) {
    opts = opts || {};
    const t = theme(opts.theme);
    const F = Pres.font;
    const title = opts.title == null ? '' : String(opts.title);
    const bullets = (opts.bullets || []).map((b) => (b == null ? '' : String(b)));
    const n = bullets.length;
    const reveal = opts.reveal == null ? n : Math.max(0, Math.min(n, Math.floor(opts.reveal)));
    const maxW = Math.max(48, Math.floor(opts.maxWidth || 130));
    const contentMax = maxW - 2 - 2 * PAD;

    // title: scale 2 when it fits on one line, otherwise scale 1 (wrapped)
    let ts = 2;
    if (title && F.measure(title, { scale: 2 }).w > contentMax) ts = 1;
    const tLines = title ? F.wrap(title, contentMax, { scale: ts }) : [];
    const tH = title ? ((tLines.length - 1) * F.lineHeight + F.glyphHeight) * ts : 0;
    const barH = title ? tH + 6 : 0;

    // bullet text: every bullet is laid out, even hidden ones, so the size never changes
    const textW = contentMax - ICON - ICON_GAP;
    const bl = bullets.map((b) => F.wrap(b, textW));
    let natural = 0;
    for (const l of tLines) natural = Math.max(natural, F.measure(l, { scale: ts }).w);
    for (const ls of bl) for (const l of ls) natural = Math.max(natural, F.measure(l).w + ICON + ICON_GAP);
    const iw = Math.min(contentMax, Math.max(natural, 24)) + 2 * PAD;

    const pos = [];
    let y = barH ? barH + PAD : PAD;
    bl.forEach((ls) => { pos.push(y); y += (ls.length - 1) * F.lineHeight + F.glyphHeight + BULLET_GAP; });
    const ih = n ? y - BULLET_GAP + PAD : y + PAD;

    const f = new Pres.Buf();
    f.rrect(0, 0, iw, ih, 4, t.fill);
    if (barH) {
      f.rrect(0, 0, iw, barH + 3, 3, t.bar);
      f.rect(0, barH, iw, 3, t.bar);                       // square bottom corners on the bar
      tLines.forEach((l, i) => {
        const lw = F.measure(l, { scale: ts }).w;
        F.draw(f, l, PAD + Math.floor((iw - 2 * PAD - lw) / 2), 3 + i * F.lineHeight * ts, t.barText, { scale: ts });
      });
    }
    for (let i = 0; i < reveal; i++) {
      drawHeart(f, PAD, pos[i] + 1, t.accents[i % t.accents.length], '#ffffff');
      bl[i].forEach((l, j) => F.draw(f, l, PAD + ICON + ICON_GAP, pos[i] + j * F.lineHeight, t.text));
    }
    f.outline(t.line);
    return finish(f);
  }

  // ------------------------------------------------------------------ title card
  function titleCard(opts) {
    opts = opts || {};
    const t = theme(opts.theme);
    const F = Pres.font;
    const title = opts.title == null ? '' : String(opts.title);
    const sub = opts.subtitle == null ? '' : String(opts.subtitle);
    const W = Math.max(64, Math.floor(opts.w || 160));
    const iw = W - 2;
    const padX = 10, topPad = 9, bottomPad = 9, gap = 5;
    const innerW = iw - 2 * padX;

    const tLines = F.wrap(title, innerW, { scale: 2 });
    const tH = (tLines.length - 1) * F.lineHeight * 2 + F.glyphHeight * 2;
    const sLines = sub ? F.wrap(sub, innerW) : [];
    const sH = sub ? (sLines.length - 1) * F.lineHeight + F.glyphHeight : 0;
    const ih = topPad + tH + (sub ? gap + sH : 0) + bottomPad;

    const f = new Pres.Buf();
    f.rrect(0, 0, iw, ih, 4, t.fill);
    const band = Math.floor(ih * 0.3);
    f.rrect(0, ih - band, iw, band, 4, t.fill2);           // soft two-tone fill

    // dotted border inset 3 px, with a small star on each corner
    const x0 = 3, y0 = 3, x1 = iw - 4, y1 = ih - 4;
    for (let x = x0; x <= x1; x += 2) { f.set(x, y0, t.accent); f.set(x, y1, t.accent); }
    for (let y = y0; y <= y1; y += 2) { f.set(x0, y, t.accent); f.set(x1, y, t.accent); }
    [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(([cx, cy]) => {
      [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => f.set(cx + dx, cy + dy, t.star));
    });

    tLines.forEach((l, i) => {
      const lw = F.measure(l, { scale: 2 }).w;
      F.draw(f, l, Math.floor((iw - lw) / 2), topPad + i * F.lineHeight * 2, t.text, { scale: 2, shadow: t.shadow });
    });
    sLines.forEach((l, i) => {
      const lw = F.measure(l).w;
      F.draw(f, l, Math.floor((iw - lw) / 2), topPad + tH + gap + i * F.lineHeight, t.soft);
    });
    f.outline(t.line);
    return finish(f);
  }

  // ------------------------------------------------------------------ label tag
  function label(text, opts) {
    if (text && typeof text === 'object') { opts = text; text = text.text; }
    opts = opts || {};
    const t = theme(opts.theme);
    const F = Pres.font;
    const s = text == null ? '' : String(text);
    const iw = F.measure(s).w + 4;
    const ih = F.glyphHeight + 4;
    const f = new Pres.Buf();
    f.rrect(0, 0, iw, ih, 3, t.tag);
    F.draw(f, s, 2, 2, t.text);
    f.outline(t.line);
    return finish(f);
  }

  Pres.ui = { bubble, panel, titleCard, label };
})(window);
