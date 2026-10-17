/*
 * emotes.js - the speech-emote set: eight tiny retro pixel icons (at most 12 x 12) that float above a
 * character's head: exclamation, question, heart, dots, sweat, zzz, sparkle and bulb.
 * Same 8/16-bit rules as props.js: whole pixels, a 1 px dark ink outline, a 1 px white halo so each
 * emote reads on light and dark stages, 2-3 tones per icon and at most five colours each. Every emote
 * has a two-frame animation that switches at 4 steps per second or slower (Math.floor(t * k) % 2).
 *
 *   Pres.registerEmote(id, { label, w, h, draw(buf, t) })
 *   Pres.emotes          id -> definition
 *   Pres.emoteCatalog()  -> [{ id, label, w, h }]
 */
(function (global) {
  'use strict';

  const Pres = (global.Pres = global.Pres || {});
  const Buf = Pres.Buf;

  const INK = '#2b1d33';     // dark ink outline
  const WHITE = '#ffffff';   // light halo, so the emote reads on dark backgrounds too

  // Tone sets: hi = top/left rim, mid = body, lo = bottom/right rim (light from the top-left).
  const TONE = {
    red:      { hi: '#ff8a7a', mid: '#e5453a', lo: '#a3241c' },
    blue:     { hi: '#9fd4ff', mid: '#3a8fe0', lo: '#1f5a9e' },
    pink:     { hi: '#ffb3cf', mid: '#ec4f86', lo: '#a52858' },
    grey:     { hi: '#e6e9ef', mid: '#9aa3b2', lo: '#5b6474' },
    sky:      { hi: '#d6f5ff', mid: '#4fb8ec', lo: '#2a7fb5' },
    lilac:    { hi: '#dcd4ff', mid: '#9583ea', lo: '#5a48b0' },
    gold:     { hi: '#fff6c2', mid: '#ffd23f', lo: '#d18f12' },
    glass:    { hi: '#fffbe0', mid: '#ffe27a', lo: '#e6b43a' },
    glassDim: { hi: '#f6e2a0', mid: '#dcae40', lo: '#a77e1c' },
  };

  // ------------------------------------------------------------------ helpers

  // Text rows -> Buf with every '#' pixel set to c ('.' and ' ' stay empty).
  function fill(rows, c) {
    const b = new Buf();
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') b.set(i, j, c); }));
    return b;
  }

  // Text rows -> Buf shaded like props.js: top/left rim = hi, bottom/right rim = lo, the rest = mid.
  function shade(rows, t) {
    const sil = fill(rows, 'x');
    const b = new Buf();
    const r = sil.bounds();
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (!sil.has(x, y)) continue;
      const hi = !sil.has(x, y - 1) || !sil.has(x - 1, y);
      const lo = !sil.has(x, y + 1) || !sil.has(x + 1, y);
      b.set(x, y, hi ? t.hi : lo ? t.lo : t.mid);
    }
    return b;
  }

  // Paint a body Buf into the w x h box with its top-left at (ox, oy), under a 1 px ink outline and a
  // 1 px white halo. Anything outside the box is dropped, so an animated frame can never leak out.
  function paint(buf, w, h, body, ox, oy) {
    const s = new Buf().blit(body, ox, oy);
    const ink = s.clone().outline(INK, true);
    const halo = ink.clone().outline(WHITE, true);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = ink.get(x, y) || halo.get(x, y);
      if (c) buf.set(x, y, c);
    }
  }

  // ------------------------------------------------------------------ registry

  Pres.emotes = {};

  Pres.registerEmote = (id, def) => {
    if (typeof def.draw !== 'function' || !def.w || !def.h) throw new Error(`emote "${id}" needs w, h and draw(buf, t)`);
    if (def.w > 12 || def.h > 12) throw new Error(`emote "${id}" must fit in 12 x 12`);
    Pres.emotes[id] = Object.assign({ label: id }, def);
  };

  Pres.emoteCatalog = () => Object.entries(Pres.emotes).map(([id, e]) => ({ id, label: e.label, w: e.w, h: e.h }));

  // ------------------------------------------------------------------ exclamation (animated jitter)
  // A red alarm mark: a bar and a dot. The whole mark jitters 1 px sideways.
  Pres.registerEmote('exclamation', {
    label: 'Exclamation', w: 8, h: 12,
    draw(buf, t) {
      const body = shade(['###', '###', '###', '###', '###', '...', '###', '###'], TONE.red);
      paint(buf, 8, 12, body, 2 + (Math.floor(t * 4) % 2), 2);
    },
  });

  // ------------------------------------------------------------------ question (animated bob)
  // A blue question mark; the whole glyph bobs 1 px down and back.
  const QUESTION = [
    '.#####.',
    '##...##',
    '....##.',
    '...##..',
    '.......',
    '...##..',
    '...##..',
  ];
  Pres.registerEmote('question', {
    label: 'Question', w: 11, h: 12,
    draw(buf, t) {
      paint(buf, 11, 12, shade(QUESTION, TONE.blue), 2, 2 + (Math.floor(t * 2) % 2));
    },
  });

  // ------------------------------------------------------------------ heart (animated pulse)
  // A pink heart that swells from a small heart to a full one and back.
  const HEART_BIG = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  const HEART_SMALL = ['##.##', '#####', '.###.', '..#..'];
  Pres.registerEmote('heart', {
    label: 'Heart', w: 11, h: 11,
    draw(buf, t) {
      if (Math.floor(t * 2) % 2 === 1) paint(buf, 11, 11, shade(HEART_BIG, TONE.pink), 2, 2);
      else paint(buf, 11, 11, shade(HEART_SMALL, TONE.pink), 3, 3);
    },
  });

  // ------------------------------------------------------------------ dots (animated typing)
  // Three grey dots that light up one by one: 1, 2, 3, then again.
  Pres.registerEmote('dots', {
    label: 'Thinking dots', w: 12, h: 6,
    draw(buf, t) {
      const n = (Math.floor(t * 3) % 3) + 1;
      const body = new Buf();
      for (let k = 0; k < n; k++) body.blit(shade(['##', '##'], TONE.grey), k * 3, 0);
      paint(buf, 12, 6, body, 2, 2);
    },
  });

  // ------------------------------------------------------------------ sweat (animated slide)
  // A sky-blue sweat drop; it slides down 1 px and back.
  const DROP = ['..#..', '..#..', '.###.', '#####', '#####', '.###.'];
  Pres.registerEmote('sweat', {
    label: 'Sweat drop', w: 9, h: 11,
    draw(buf, t) {
      paint(buf, 9, 11, shade(DROP, TONE.sky), 2, 2 + (Math.floor(t * 2) % 2));
    },
  });

  // ------------------------------------------------------------------ zzz (animated rise)
  // Three lilac Z letters stepping up a diagonal; the group rises 1 px and drops back.
  const ZZZ = ['....###', '.....#.', '..#####', '...#...', '#####..', '.#.....', '###....'];
  Pres.registerEmote('zzz', {
    label: 'Sleep zzz', w: 12, h: 12,
    draw(buf, t) {
      paint(buf, 12, 12, fill(ZZZ, TONE.lilac.mid), 2, 3 - (Math.floor(t * 2) % 2));
    },
  });

  // ------------------------------------------------------------------ sparkle (animated twinkle)
  // A gold four-point sparkle that twinkles between a full star and a small one.
  const STAR_BIG = ['...#...', '...#...', '..###..', '#######', '..###..', '...#...', '...#...'];
  const STAR_SMALL = ['.#.', '###', '.#.'];
  Pres.registerEmote('sparkle', {
    label: 'Sparkle', w: 11, h: 11,
    draw(buf, t) {
      if (Math.floor(t * 2) % 2 === 0) paint(buf, 11, 11, shade(STAR_BIG, TONE.gold), 2, 2);
      else paint(buf, 11, 11, shade(STAR_SMALL, TONE.gold), 4, 4);
    },
  });

  // ------------------------------------------------------------------ bulb (animated flicker)
  // A yellow idea bulb with a brass base; the glass flickers between bright and dim.
  const GLASS = ['..###..', '.#####.', '#######', '#######', '.#####.', '..###..'];
  const BASE = ['###', '###'];
  Pres.registerEmote('bulb', {
    label: 'Idea bulb', w: 11, h: 12,
    draw(buf, t) {
      const tone = Math.floor(t * 4) % 2 === 0 ? TONE.glass : TONE.glassDim;
      const body = shade(GLASS, tone);
      body.blit(fill(BASE, tone.lo), 2, 6);
      paint(buf, 11, 12, body, 2, 2);
    },
  });
})(window);
