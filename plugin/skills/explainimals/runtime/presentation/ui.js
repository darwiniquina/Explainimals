/*
 * ui.js - retro console-style windows for the presentation layer (defines Pres.ui). Needs font.js.
 *
 * Look: 8/16-bit RPG dialogue and menu windows. Hard edges, no anti-aliasing, square corners with
 * one clipped pixel, a near-black outline, a 1px inner rule and a mustard accent. One palette:
 * cream, navy, mustard, plus the shared ink outline.
 *
 * Every helper returns { buf, w, h }: buf is a Pres.Buf whose top-left is (0,0), w/h its exact size.
 * The 1px outline is drawn outside the fill, so it is part of w/h. Each takes an optional theme:
 * 'light' (cream window, navy rule) or 'dark' (navy window, cream rule); the engine picks it from the
 * background tone. titleCard always uses its navy plate.
 *
 *   Pres.ui.bubble({ text, maxWidth, tail, theme, reveal })  tail: 'left' | 'right' | 'none'  (+ tip {x,y})
 *                    reveal: draw only the first N chars of lines.join(''); the box is always sized
 *                    from the full text. Result also has lines (wrapped, as drawn) and total (their char count).
 *   Pres.ui.panel({ title, bullets, maxWidth, reveal, theme })
 *   Pres.ui.titleCard({ title, subtitle, w, theme })
 *   Pres.ui.label(text, { theme })
 */
(function (global) {
  'use strict';

  const Pres = (global.Pres = global.Pres || {});
  const PAD = 4;          // inner padding of bubbles and panels
  const ICON = 5;         // bullet marker slot
  const ICON_GAP = 3;     // gap between bullet marker and text
  const BULLET_GAP = 3;   // vertical gap between bullets

  // one palette: shared ink outline, cream and navy families, mustard accent
  const INK = '#1a1220';
  const CREAM = '#f7eed2';
  const NAVY = '#1f2f73';
  const NAVY_DEEP = '#131d52';
  const MUSTARD = '#f2b632';

  const THEME = {
    light: {                       // cream window, navy inner rule, navy title bar
      fill: CREAM, rule: NAVY, text: INK, bar: NAVY, barText: MUSTARD, marker: NAVY,
      tag: NAVY, tagText: CREAM,
    },
    dark: {                        // navy window, cream inner rule, mustard title bar
      fill: NAVY, rule: CREAM, text: CREAM, bar: MUSTARD, barText: NAVY, marker: MUSTARD,
      tag: MUSTARD, tagText: INK,
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

  // solid rectangle with its top-left pixel clipped: the notched corner of a console window
  function plate(f, x, y, w, h, fill) {
    f.rect(x, y, w, h, fill);
    f.erase(x, y);
    return f;
  }

  // window body: clipped plate plus a 1px inner rule inset from the edge (its corner clipped too)
  function windowBody(f, w, h, fill, rule) {
    plate(f, 0, 0, w, h, fill);
    if (rule && w > 4 && h > 4) {
      f.frame(1, 1, w - 2, h - 2, rule);
      f.erase(1, 1);
    }
    return f;
  }

  // 3x5 right-pointing triangle bullet marker (whole pixels), top-left at (x, y)
  const MARK = ['#..', '##.', '###', '##.', '#..'];
  function drawMarker(f, x, y, color) {
    MARK.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#') f.set(x + i, y + j, color);
    });
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
    windowBody(f, iw, ih, t.fill, t.rule);

    let tip = { x: Math.floor(iw / 2), y: ih };
    if (tail !== 'none') {
      // blocky pointer under the body: 6 rows, each one pixel narrower; mirrored for the right
      const rows = [[-3, 2], [-3, 1], [-3, 0], [-3, -1], [-3, -2], [-3, -3]];
      rows.forEach(([a, b], r) => {
        const x0 = tail === 'left' ? a : iw - 1 - b;
        const x1 = tail === 'left' ? b : iw - 1 - a;
        for (let x = x0; x <= x1; x++) f.set(x, ih + r, t.fill);
      });
      tip = { x: tail === 'left' ? -3 : iw + 2, y: ih + 5 };
    }

    f.outline(INK);

    // reveal: characters to draw, counted over lines.join(''). Each line keeps its full-width
    // centring, so a partial line is a prefix of the full line drawn in the same place.
    const total = lines.reduce((n, l) => n + l.length, 0);
    const shown = opts.reveal == null ? total : Math.max(0, Math.floor(Number(opts.reveal)) || 0);
    const innerW = iw - 2 * PAD;
    let left = shown;
    lines.forEach((l, i) => {
      const lw = F.measure(l).w;
      const k = Math.max(0, Math.min(l.length, left));
      left -= l.length;
      if (k > 0) F.draw(f, l.slice(0, k), PAD + Math.floor((innerW - lw) / 2), PAD + i * F.lineHeight, t.text);
    });
    const out = finish(f, tip);
    out.lines = lines;
    out.total = total;
    return out;
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
    windowBody(f, iw, ih, t.fill, t.rule);
    if (barH) {
      f.rect(1, 1, iw - 2, barH + 2, t.bar);              // title bar strip inside the rule
      f.rect(1, barH + 3, iw - 2, 1, INK);                // hard line under the bar
      tLines.forEach((l, i) => {
        const lw = F.measure(l, { scale: ts }).w;
        F.draw(f, l, PAD + Math.floor((iw - 2 * PAD - lw) / 2), 3 + i * F.lineHeight * ts, t.barText, { scale: ts });
      });
    }
    for (let i = 0; i < reveal; i++) {
      drawMarker(f, PAD, pos[i] + 1, t.marker);
      bl[i].forEach((l, j) => F.draw(f, l, PAD + ICON + ICON_GAP, pos[i] + j * F.lineHeight, t.text));
    }
    f.outline(INK);
    return finish(f);
  }

  // ------------------------------------------------------------------ title card
  // A navy title plate with a darker base band and a double border (cream rule outside,
  // mustard rule inside), like a game title screen. Text is cream with a hard ink shadow.
  function titleCard(opts) {
    opts = opts || {};
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
    plate(f, 0, 0, iw, ih, NAVY);
    const band = Math.floor(ih * 0.3);
    f.rect(0, ih - band, iw, band, NAVY_DEEP);             // darker base band
    f.frame(2, 2, iw - 4, ih - 4, CREAM);                  // outer rule of the double border
    f.frame(4, 4, iw - 8, ih - 8, MUSTARD);                // inner rule of the double border

    tLines.forEach((l, i) => {
      const lw = F.measure(l, { scale: 2 }).w;
      F.draw(f, l, Math.floor((iw - lw) / 2), topPad + i * F.lineHeight * 2, CREAM, { scale: 2, shadow: INK });
    });
    sLines.forEach((l, i) => {
      const lw = F.measure(l).w;
      F.draw(f, l, Math.floor((iw - lw) / 2), topPad + tH + gap + i * F.lineHeight, MUSTARD);
    });
    f.outline(INK);
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
    plate(f, 0, 0, iw, ih, t.tag);
    F.draw(f, s, 2, 2, t.tagText);
    f.outline(INK);
    return finish(f);
  }

  Pres.ui = { bubble, panel, titleCard, label };
})(window);
